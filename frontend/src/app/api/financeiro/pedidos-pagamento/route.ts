import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import {
  fin,
  podeAprovar,
  comentarioSistema,
  formatBRL,
  TIPOS_VALIDOS,
  type PedidoTipo,
} from '@/lib/financeiro/pedidos-pagamento';
import { paginate } from '@/lib/supabase/paginate';
import { broadcastPedidoChange } from '@/lib/realtime/broadcastPedidos';

export const dynamic = 'force-dynamic';

// =====================================================
// GET — lista de pedidos do bar
//   ?status= filtro · ?tipo= filtro · ?escopo=meus|todos
//   - escopo=meus: só os do próprio solicitante
//   - escopo=todos: todos do bar (default p/ quem pode aprovar)
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) {
    return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const tipo = searchParams.get('tipo');
  const escopoParam = searchParams.get('escopo');
  // Se o cliente pedir limit explícito, respeita (cap 1000); senão pagina TUDO.
  // Bug 14/07: default 100 ordenado por created_at cortava pedidos válidos (ex.: PIX
  // "Terça na Roda" agendado) quando havia >100 pedidos mais recentes — a aba Aprovado
  // ficava sem eles, mas o solicitante (escopo=meus, lista curta) ainda os via. Mesmo
  // limite-100 que já tinha derrubado os freelas. Agora pagina por-bar (tabela pequena).
  const limitParam = searchParams.get('limit');
  const limitExplicito = limitParam ? Math.min(parseInt(limitParam), 1000) : null;

  // Quem não pode aprovar só enxerga os próprios pedidos, mesmo pedindo "todos".
  const escopo = podeAprovar(user) && escopoParam !== 'meus' ? 'todos' : 'meus';

  const supabase = await getAdminClient();
  const buildQuery = () => {
    let q = fin(supabase)
      .from('pedidos_pagamento')
      .select('*')
      .eq('bar_id', user.bar_id)
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (tipo) q = q.eq('tipo', tipo);
    if (escopo === 'meus') q = q.eq('solicitante_id', user.auth_id);
    return q;
  };

  let pedidos: any[];
  try {
    pedidos = limitExplicito != null
      ? ((await buildQuery().limit(limitExplicito)).data || [])
      : await paginate<any>(buildQuery, { label: 'financial.pedidos_pagamento' });
  } catch (error: any) {
    console.error('[PEDIDOS-PAG][GET]', error);
    return NextResponse.json({ success: false, error: error?.message || 'erro ao listar' }, { status: 500 });
  }

  // Anexa as competências (diárias) aos freelas agrupados — o financeiro aprova a categoria por
  // competência e o agendar cria 1 lançamento no CA por competência. Freela legado (per-dia, sem
  // competências) segue como pedido de 1 linha só.
  const freelaIds = pedidos.filter((p: any) => p.tipo === 'freela').map((p: any) => p.id);
  if (freelaIds.length) {
    const { data: comps } = await fin(supabase)
      .from('pedidos_pagamento_competencias')
      .select('id, pedido_id, data_competencia, valor, descricao, categoria_id, categoria_nome, contaazul_lancamento_id, ordem')
      .in('pedido_id', freelaIds)
      .order('ordem', { ascending: true });
    const byPedido = new Map<string, any[]>();
    for (const c of (comps || []) as any[]) (byPedido.get(c.pedido_id) || byPedido.set(c.pedido_id, []).get(c.pedido_id)!).push(c);
    for (const p of pedidos) if (p.tipo === 'freela') p.competencias = byPedido.get(p.id) || [];
  }

  // Sugestão de categoria (Zykor sugere) — só p/ quem aprova e p/ pendentes sem categoria.
  // Fonte: categoria do último pedido APROVADO. Pro FREELA, a categoria reflete O QUE a pessoa
  // fez no dia (garçom→atendimento, cozinha→cozinha), então a FUNÇÃO é o sinal principal; cai
  // pra pessoa/nome quando não há histórico da função. Pros demais, segue por pessoa/nome.
  // A função da diária vem na descrição ("Freela <função> — <nome> (venc)").
  if (podeAprovar(user)) {
    const pendentes = pedidos.filter(
      (p: any) => ['aguardando_aprovacao', 'erro_ca', 'erro_inter'].includes(p.status)
    );
    if (pendentes.length) {
      const norm = (s?: string | null) => (s || '').trim().toLowerCase();
      const funcaoDe = (desc?: string | null) => {
        const m = /^Freela\s+(.+?)\s+—\s+/.exec(desc || '');
        return m ? norm(m[1]) : '';
      };
      const [{ data: hist }, { data: histComp }] = await Promise.all([
        fin(supabase).from('pedidos_pagamento')
          .select('tipo, descricao, beneficiario_nome, contaazul_pessoa_id, categoria_id, categoria_nome, created_at')
          .eq('bar_id', user.bar_id).in('status', ['aprovado', 'agendado', 'pago'])
          .not('categoria_id', 'is', null).order('created_at', { ascending: false }).limit(500),
        // Histórico da FUNÇÃO por competência (descricao = função pura, ex.: "Garçom").
        fin(supabase).from('pedidos_pagamento_competencias')
          .select('descricao, categoria_id, categoria_nome, created_at')
          .eq('bar_id', user.bar_id).not('categoria_id', 'is', null)
          .order('created_at', { ascending: false }).limit(500),
      ]);
      const byPessoa = new Map<string, any>();
      const byNome = new Map<string, any>();
      const byFuncao = new Map<string, any>();
      // Função por competência tem prioridade (mais fiel ao "garçom→atendimento").
      for (const c of (histComp || []) as any[]) {
        const fn = norm(c.descricao);
        if (fn && !byFuncao.has(fn)) byFuncao.set(fn, { categoria_id: c.categoria_id, categoria_nome: c.categoria_nome });
      }
      for (const h of hist || []) {
        if (h.contaazul_pessoa_id && !byPessoa.has(h.contaazul_pessoa_id)) byPessoa.set(h.contaazul_pessoa_id, h);
        const n = norm(h.beneficiario_nome);
        if (n && !byNome.has(n)) byNome.set(n, h);
        if (h.tipo === 'freela') { const fn = funcaoDe(h.descricao); if (fn && !byFuncao.has(fn)) byFuncao.set(fn, h); }
      }
      const sugerir = (funcao: string, pessoaId?: string | null, nome?: string | null) =>
        byFuncao.get(funcao) || (pessoaId && byPessoa.get(pessoaId)) || byNome.get(norm(nome));
      for (const p of pendentes) {
        const comps: any[] = Array.isArray(p.competencias) ? p.competencias : [];
        if (p.tipo === 'freela' && comps.length) {
          // Grouped: sugere categoria POR competência (pela função de cada dia).
          for (const c of comps) {
            if (c.categoria_id) continue;
            const hit = sugerir(norm(c.descricao), p.contaazul_pessoa_id, p.beneficiario_nome);
            if (hit) { c.categoria_sugerida_id = hit.categoria_id; c.categoria_sugerida_nome = hit.categoria_nome; }
          }
        } else if (!p.categoria_id) {
          // Legado / não-freela: sugestão a nível de pedido.
          const hit = sugerir(p.tipo === 'freela' ? funcaoDe(p.descricao) : '', p.contaazul_pessoa_id, p.beneficiario_nome);
          if (hit) { p.categoria_sugerida_id = hit.categoria_id; p.categoria_sugerida_nome = hit.categoria_nome; }
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    pedidos,
    escopo,
    pode_aprovar: podeAprovar(user),
  });
}

// =====================================================
// POST — cria um novo pedido (qualquer funcionário logado)
// =====================================================
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);
  if (!user.bar_id) {
    return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const tipo = String(body.tipo || '') as PedidoTipo;
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      { success: false, error: `tipo inválido (use: ${TIPOS_VALIDOS.join(', ')})` },
      { status: 400 }
    );
  }

  const valor = Number(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ success: false, error: 'valor inválido' }, { status: 400 });
  }

  const descricao = String(body.descricao || '').trim();
  if (!descricao) {
    return NextResponse.json({ success: false, error: 'descrição é obrigatória' }, { status: 400 });
  }

  // Competências múltiplas (opcional): 1 PIX cheio → N lançamentos no CA, um por
  // competência/valor. O valor total do pedido passa a ser a SOMA das competências.
  // Cada competência é uma linha de RATEIO: data + valor + (opcional) categoria própria (#21).
  const competencias: Array<{ data_competencia: string; valor: number; descricao: string | null; categoria_id: string | null; categoria_nome: string | null }> = [];
  if (Array.isArray(body.competencias)) {
    for (let i = 0; i < body.competencias.length; i++) {
      const c = body.competencias[i];
      const d = String(c?.data_competencia || '');
      const v = Number(c?.valor);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return NextResponse.json({ success: false, error: `competência ${i + 1}: data inválida (AAAA-MM-DD)` }, { status: 400 });
      }
      if (!Number.isFinite(v) || v <= 0) {
        return NextResponse.json({ success: false, error: `competência ${i + 1}: valor inválido` }, { status: 400 });
      }
      competencias.push({
        data_competencia: d,
        valor: Math.round(v * 100) / 100,
        descricao: c?.descricao ? String(c.descricao).trim() : null,
        categoria_id: c?.categoria_id ? String(c.categoria_id) : null,
        categoria_nome: c?.categoria_nome ? String(c.categoria_nome) : null,
      });
    }
  }
  // Com competências, o valor total é a soma (fonte da verdade); senão é o valor enviado.
  const valorEfetivo = competencias.length
    ? Math.round(competencias.reduce((s, c) => s + c.valor, 0) * 100) / 100
    : valor;

  const data_vencimento = body.data_vencimento;
  if (!data_vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(String(data_vencimento))) {
    return NextResponse.json(
      { success: false, error: 'data_vencimento (AAAA-MM-DD) é obrigatória' },
      { status: 400 }
    );
  }

  // Com competências, a competência "principal" do pedido é a menor data (só p/ exibição);
  // senão exige a data_competencia única.
  const data_competencia = competencias.length
    ? competencias.map(c => c.data_competencia).sort()[0]
    : body.data_competencia;
  if (!competencias.length && (!data_competencia || !/^\d{4}-\d{2}-\d{2}$/.test(String(data_competencia)))) {
    return NextResponse.json(
      { success: false, error: 'data_competencia (AAAA-MM-DD) é obrigatória' },
      { status: 400 }
    );
  }

  // PIX copia e cola / QR (ex.: Meta Ads via Adyen) — pagamento manual no Inter.
  const pix_copia_cola = body.pix_copia_cola ? String(body.pix_copia_cola).trim() : null;
  // Boleto: pago pela LINHA DIGITÁVEL (o Inter paga boleto por ela; não tem chave PIX).
  const linha_digitavel = body.linha_digitavel ? String(body.linha_digitavel).replace(/\D/g, '') : null;
  // Reembolso e adiantamento normalmente caem na chave do próprio funcionário.
  const chave_pix = body.chave_pix ? String(body.chave_pix).trim() : null;
  // Destino do pagamento: chave PIX, copia e cola OU linha digitável (boleto). Um dos três.
  if ((tipo === 'reembolso' || tipo === 'fornecedor') && !chave_pix && !pix_copia_cola && !linha_digitavel) {
    return NextResponse.json(
      { success: false, error: 'informe a chave PIX, o código copia e cola ou a linha digitável do boleto' },
      { status: 400 }
    );
  }

  const supabase = await getAdminClient();
  const novo = {
    bar_id: user.bar_id,
    tipo,
    status: 'aguardando_aprovacao',
    solicitante_id: user.auth_id,
    solicitante_nome: user.nome,
    descricao,
    valor: valorEfetivo,
    data_competencia,
    data_vencimento,
    beneficiario_nome: body.beneficiario_nome || null,
    chave_pix,
    cpf_cnpj: body.cpf_cnpj || null,
    linha_digitavel,
    pix_copia_cola,
    observacao: body.observacao || null,
    precisa_comprovante: body.precisa_comprovante === true,
    // Pré-sugestões opcionais (financeiro confirma na aprovação)
    contaazul_pessoa_id: body.contaazul_pessoa_id || null,
    conta_financeira_id: body.conta_financeira_id || null,
    // Com rateio por categoria (#21): se o pedido não tem categoria no topo, herda a da 1ª
    // linha — assim as validações de aprovar/agendar (que exigem categoria) passam.
    categoria_id: body.categoria_id || competencias.find(c => c.categoria_id)?.categoria_id || null,
    categoria_nome: body.categoria_nome || competencias.find(c => c.categoria_id)?.categoria_nome || null,
    centro_custo_id: body.centro_custo_id || null,
    centro_custo_nome: body.centro_custo_nome || null,
    criado_por: user.auth_id,
    atualizado_por: user.auth_id,
  };

  // Boleto/fornecedor: tenta já vincular a pessoa do CA (a aprovação exige).
  // 1) por documento (CNPJ/CPF); 2) fallback por NOME (a maioria dos fornecedores do
  //    CA está sem documento, então o nome pega muito mais).
  if (!novo.contaazul_pessoa_id && novo.cpf_cnpj) {
    const doc = String(novo.cpf_cnpj).replace(/\D/g, '');
    if (doc.length === 11 || doc.length === 14) {
      const { data: pessoa } = await (supabase.schema('bronze' as any) as any)
        .from('bronze_contaazul_pessoas')
        .select('contaazul_id')
        .eq('bar_id', user.bar_id).eq('documento', doc).limit(1).maybeSingle();
      if (pessoa?.contaazul_id) novo.contaazul_pessoa_id = pessoa.contaazul_id;
    }
  }
  if (!novo.contaazul_pessoa_id && novo.beneficiario_nome) {
    const nome = String(novo.beneficiario_nome).trim();
    if (nome.length >= 3) {
      const { data: pessoa } = await (supabase.schema('bronze' as any) as any)
        .from('bronze_contaazul_pessoas')
        .select('contaazul_id')
        .eq('bar_id', user.bar_id).ilike('nome', nome).limit(1).maybeSingle();
      if (pessoa?.contaazul_id) novo.contaazul_pessoa_id = pessoa.contaazul_id;
    }
  }

  const { data, error } = await fin(supabase)
    .from('pedidos_pagamento')
    .insert(novo)
    .select()
    .single();

  if (error) {
    console.error('[PEDIDOS-PAG][POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Grava as competências (se houver) — cada uma vira um lançamento no CA na aprovação.
  if (competencias.length) {
    const linhas = competencias.map((c, i) => ({
      pedido_id: data.id,
      bar_id: user.bar_id,
      data_competencia: c.data_competencia,
      valor: c.valor,
      descricao: c.descricao,
      categoria_id: c.categoria_id,
      categoria_nome: c.categoria_nome,
      ordem: i,
    }));
    const { error: errComp } = await fin(supabase)
      .from('pedidos_pagamento_competencias')
      .insert(linhas);
    if (errComp) console.error('[PEDIDOS-PAG][POST][competencias]', errComp);
  }

  await comentarioSistema(supabase, {
    pedido_id: data.id,
    bar_id: user.bar_id,
    mensagem: `Pedido criado por ${user.nome} — ${formatBRL(valorEfetivo)} (${tipo})${
      competencias.length ? ` · ${competencias.length} competências` : ''
    }${pix_copia_cola ? ' · PIX copia e cola' : ''}.`,
  });

  await broadcastPedidoChange(user.bar_id);
  return NextResponse.json({ success: true, pedido: data });
}
