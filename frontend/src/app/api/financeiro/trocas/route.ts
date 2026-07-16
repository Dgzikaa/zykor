import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Trocas de insumo entre bares (item 2). Quem ENVIA registra (bar_origem = bar do usuário);
 * escolhe o bar contraparte (bar_destino) e os insumos + qtd. O valor = Σ custo dos insumos.
 * A troca reflete NA HORA no Desvio de Consumo (saída no emissor, entrada no recebedor) —
 * gold.fn_desvios/fn_desvios_proteina leem financial.trocas. O lançamento no Conta Azul
 * (receita a receber no emissor / despesa a pagar no recebedor) é um passo separado (TODO).
 *
 *  GET  ?de&ate            → trocas do bar (como origem OU destino) no período
 *  POST { bar_destino, data_competencia, descricao?, itens:[{insumo_codigo,quantidade,custo_unitario}] }
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const de = sp.get('de'); const ate = sp.get('ate');
  const fin = (sb() as any).schema('financial');

  let q = fin.from('trocas')
    .select('id,bar_origem,bar_destino,data_competencia,descricao,valor,status,inter_codigo_solicitacao,inter_pix_erro,criado_por,created_at,troca_itens(insumo_codigo,insumo_codigo_destino,quantidade,custo_unitario,subtotal)')
    .or(`bar_origem.eq.${user.bar_id},bar_destino.eq.${user.bar_id}`)
    .order('data_competencia', { ascending: false }).order('created_at', { ascending: false }).limit(200);
  if (de) q = q.gte('data_competencia', de);
  if (ate) q = q.lte('data_competencia', ate);
  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // marca o sentido em relação ao bar atual (enviou/recebeu)
  const trocas = (data || []).map((t: any) => ({
    ...t,
    sentido: t.bar_origem === user.bar_id ? 'enviou' : 'recebeu',
  }));

  // Resolve o NOME do insumo pra mostrar na coluna "Itens" (a tabela só guarda os códigos).
  // O código i0XXX é INDEPENDENTE por bar (o mesmo i0279 é "Pão Smash" no Deboche e "Espumante"
  // no Ordinário) → cada perna resolve no catálogo do SEU bar: origem por insumo_codigo,
  // destino por insumo_codigo_destino. Item sem destino = sem equivalente cadastrado lá.
  const temItens = trocas.some((t: any) => (t.troca_itens || []).length > 0);
  if (temItens) {
    const bares = Array.from(new Set(trocas.flatMap((t: any) => [t.bar_origem, t.bar_destino])));
    const cods = Array.from(new Set(trocas.flatMap((t: any) => (t.troca_itens || [])
      .flatMap((i: any) => [i.insumo_codigo, i.insumo_codigo_destino]).filter(Boolean))));
    const { data: cat } = await (sb() as any).schema('silver').from('insumo_catalogo')
      .select('bar_id,codigo,nome').in('bar_id', bares).in('codigo', cods);
    const nomePorBarCod = new Map<string, string>();
    for (const c of (cat || [])) nomePorBarCod.set(`${c.bar_id}:${c.codigo}`, c.nome);
    for (const t of trocas) for (const it of (t.troca_itens || [])) {
      it.nome = nomePorBarCod.get(`${t.bar_origem}:${it.insumo_codigo}`) || null;
      it.nome_destino = it.insumo_codigo_destino ? (nomePorBarCod.get(`${t.bar_destino}:${it.insumo_codigo_destino}`) || null) : null;
      it.sem_equivalente = !it.insumo_codigo_destino;
    }
    // troca com algum item sem equivalente → a entrada NÃO foi lançada no bar recebedor (avisa na lista)
    for (const t of trocas) t.sem_equivalente = (t.troca_itens || []).some((i: any) => i.sem_equivalente);
  }

  // Categoria de custo (CA) por troca: classifica cada item (categoria+tipo_local do insumo,
  // catálogo do bar de ORIGEM) e expõe as categorias distintas p/ a coluna "Categoria" da lista.
  // Mesma lógica de gold/trocas/[id]/lancar-ca (classificarCA) — manter em sincronia.
  if (temItens) {
    const classificarCA = (ins: { codigo?: string | null; categoria?: string | null; tipo_local?: string | null }): string => {
      const cod = String(ins.codigo || '').toLowerCase();
      const cat = String(ins.categoria || '').toUpperCase();
      const tl = String(ins.tipo_local || '').toLowerCase();
      const has = (arr: string[]) => arr.some((k) => cat.includes(k));
      if (cod.startsWith('pd')) return 'Drinks';
      if (cod.startsWith('pc')) return 'Comida';
      if (/\(F\)/.test(cat)) return 'Outros';
      if (has(['NÃO-ALCÓOLICOS', 'NAO-ALCOOLICOS']) && tl === 'cozinha') return 'Drinks';
      if (tl === 'bar') return 'Bebidas';
      if (has(['RETORNÁVEIS', 'RETORNAVEIS', 'VINHOS', 'LONG NECK', 'LATA', 'ARTESANAL', 'POLPA', 'FRUTA', 'NÃO-ALCÓOLICOS', 'NAO-ALCOOLICOS', 'AMBEV', 'HEINEKEN', 'CERVEJ', 'CHOPP'])) return 'Bebidas';
      if (has(['DESTILADOS', 'IMPÉRIO', 'IMPERIO', 'POLPAS', 'ARMAZÉM (B)', 'ARMAZEM (B)', 'HORTIFRUTI (B)', 'MERCADO (B)', 'DRINK'])) return 'Drinks';
      if (has(['COZINHA', 'ARMAZÉM (C)', 'ARMAZEM (C)', 'HORTIFRUTI (C)', 'MERCADO (C)', 'PÃES', 'PAES', 'PEIXE', 'PROTEÍNA', 'PROTEINA', 'TEMPERO', 'FEIJOADA', 'LÍQUIDO', 'LIQUIDO'])) return 'Comida';
      return 'Outros';
    };
    const bares = Array.from(new Set(trocas.map((t: any) => t.bar_origem)));
    const cods = Array.from(new Set(trocas.flatMap((t: any) => (t.troca_itens || []).map((i: any) => i.insumo_codigo).filter(Boolean))));
    const { data: ins } = await (sb() as any).schema('operations').from('insumos')
      .select('bar_id,codigo,categoria,tipo_local').in('bar_id', bares).in('codigo', cods);
    const insPorBarCod = new Map<string, { categoria?: string | null; tipo_local?: string | null }>();
    for (const c of (ins || [])) insPorBarCod.set(`${c.bar_id}:${c.codigo}`, c);
    for (const t of trocas) {
      const cats = new Set<string>();
      for (const it of (t.troca_itens || [])) {
        const meta = insPorBarCod.get(`${t.bar_origem}:${it.insumo_codigo}`) || {};
        cats.add(classificarCA({ codigo: it.insumo_codigo, categoria: meta.categoria, tipo_local: meta.tipo_local }));
      }
      t.categorias = Array.from(cats);
    }
  }

  // Status REAL do PIX (fonte: financial.pix_enviados, mantido pelo webhook do Inter).
  const refs = trocas.map((t: any) => `troca:${t.id}`);
  if (refs.length) {
    const { data: pixs } = await fin.from('pix_enviados')
      .select('pagamento_zykor_id, inter_status, inter_codigo_solicitacao, data_envio')
      .in('pagamento_zykor_id', refs)
      .order('data_envio', { ascending: false });
    const byRef = new Map<string, any>();
    for (const p of (pixs || [])) if (!byRef.has(p.pagamento_zykor_id)) byRef.set(p.pagamento_zykor_id, p);
    for (const t of trocas) {
      const p = byRef.get(`troca:${t.id}`);
      t.pix_status = p?.inter_status || null;   // ENVIADO/AGENDADO/REPROVADO/EFETUADO...
      t.pix_codigo = p?.inter_codigo_solicitacao || null;
    }
  }
  return NextResponse.json({ success: true, trocas });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const barDestino = Number(body.bar_destino);
  const dataComp = String(body.data_competencia || '').slice(0, 10);
  const itens = Array.isArray(body.itens) ? body.itens : [];

  if (!Number.isFinite(barDestino) || barDestino <= 0) return NextResponse.json({ success: false, error: 'bar_destino obrigatório' }, { status: 400 });
  if (barDestino === user.bar_id) return NextResponse.json({ success: false, error: 'O bar de destino deve ser diferente do seu' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataComp)) return NextResponse.json({ success: false, error: 'data_competencia (YYYY-MM-DD) obrigatória' }, { status: 400 });

  // normaliza/valida itens. insumo_codigo = código no catálogo de quem ENVIA;
  // insumo_codigo_destino = o equivalente no catálogo de quem RECEBE (os códigos NÃO batem
  // entre bares — ver comentário do GET). Vazio = "sem equivalente": a saída é registrada e a
  // entrada no destino não, em vez de creditar um insumo aleatório lá.
  const norm = itens
    .map((i: any) => {
      const cod = String(i.insumo_codigo || '').trim();
      const codDest = String(i.insumo_codigo_destino || '').trim();
      const qtd = Number(i.quantidade);
      const custo = Number(i.custo_unitario) || 0;
      return { insumo_codigo: cod, insumo_codigo_destino: codDest || null, quantidade: qtd, custo_unitario: custo, subtotal: Math.round(qtd * custo * 100) / 100 };
    })
    .filter((i: any) => i.insumo_codigo && Number.isFinite(i.quantidade) && i.quantidade > 0);
  if (norm.length === 0) return NextResponse.json({ success: false, error: 'Inclua ao menos um insumo com quantidade > 0' }, { status: 400 });

  // Guarda: o código de destino tem que EXISTIR no catálogo do bar destino. Sem isso, um código
  // digitado/estale volta a lançar a entrada no insumo errado — que é exatamente o bug de 16/07.
  const codsDest = Array.from(new Set(norm.map((i: any) => i.insumo_codigo_destino).filter(Boolean))) as string[];
  if (codsDest.length) {
    const { data: okDest } = await (sb() as any).schema('operations').from('insumos')
      .select('codigo').eq('bar_id', barDestino).in('codigo', codsDest);
    const existe = new Set((okDest || []).map((r: any) => String(r.codigo).toLowerCase()));
    const faltando = codsDest.filter((c) => !existe.has(c.toLowerCase()));
    if (faltando.length) {
      return NextResponse.json({ success: false, error: `Código não existe no bar de destino: ${faltando.join(', ')}` }, { status: 400 });
    }
  }

  const valor = Math.round(norm.reduce((s: number, i: any) => s + i.subtotal, 0) * 100) / 100;
  const fin = (sb() as any).schema('financial');

  const { data: troca, error: eT } = await fin.from('trocas').insert({
    bar_origem: user.bar_id, bar_destino: barDestino, data_competencia: dataComp,
    descricao: body.descricao ? String(body.descricao) : null, valor,
    criado_por: user.email || 'app',
  }).select('id').single();
  if (eT) return NextResponse.json({ success: false, error: eT.message }, { status: 500 });

  const { error: eI } = await fin.from('troca_itens').insert(norm.map((i: any) => ({ ...i, troca_id: troca.id })));
  if (eI) {
    await fin.from('trocas').delete().eq('id', troca.id); // rollback do cabeçalho
    return NextResponse.json({ success: false, error: eI.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: troca.id, valor });
}
