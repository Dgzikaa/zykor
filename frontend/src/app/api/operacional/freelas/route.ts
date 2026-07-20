import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { fin, comentarioSistema, formatBRL } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

/**
 * FREELAS — ETAPA DE OPERAÇÃO (montar + encerrar a semana).
 *
 * A operação (ex.: Junin) monta a semana de freelas como RASCUNHO (status='rascunho'),
 * editável à vontade, e só ao "Encerrar semana" os pedidos viram 'aguardando_aprovacao'
 * → aí caem no financeiro (Pedidos de Pagamento, aba Freela) pra aprovar + agendar
 * (Inter/Conta Azul). A operação NÃO toca em CA/Inter.
 *
 * Grava tudo em financial.pedidos_pagamento (tipo='freela') — mesma base do financeiro.
 * O roster de freelas (financial.beneficiarios) vem junto no GET, pra a tela de operação
 * não depender da permissão do financeiro.
 *
 * GET    ?semana=AAAA-MM-DD           → roster + pedidos da semana (rascunho + já enviados)
 * POST   { action:'lancar', ... }     → cria N diárias em RASCUNHO
 * POST   { action:'encerrar', mon, sun } → rascunho → aguardando_aprovacao (envia ao financeiro)
 * POST   { action:'reabrir', mon, sun }  → aguardando_aprovacao → rascunho (só o que ainda não foi aprovado)
 * PUT    { id, valor }                → edita o valor de um rascunho
 * DELETE ?id=...                      → remove um rascunho
 */

const isISO = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// A função do dia é gravada na descrição da diária: "Freela <função> — <nome> (venc)".
function funcaoDaDescricao(desc?: string | null): string {
  const m = /^Freela\s+(.+?)\s+—\s+/.exec(desc || '');
  return m ? m[1].trim() : '';
}

async function ctx(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return { erro: authErrorResponse('Usuário não autenticado') };
  const nega = negarPorRota(user, request); if (nega) return { erro: nega };
  if (!user.ativo) return { erro: authErrorResponse('Usuário inativo', 403) };
  const bar_id = user.bar_id;
  if (!bar_id) return { erro: NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 }) };
  return { user, supabase: await getAdminClient(), bar_id };
}

export async function GET(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { user, supabase, bar_id } = c;
  const sp = new URL(request.url).searchParams;
  const semana = sp.get('semana');
  if (!isISO(semana)) return NextResponse.json({ success: false, error: 'semana (AAAA-MM-DD) obrigatória' }, { status: 400 });

  // Semana = segunda→domingo da data recebida (o cliente já manda a segunda).
  const mon = semana;
  const d = new Date(mon + 'T00:00:00'); d.setDate(d.getDate() + 6);
  const sun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [rosterRes, pedidosRes] = await Promise.all([
    fin(supabase).from('beneficiarios')
      .select('id, nome, funcao, valor_padrao, chave_pix, tipo_chave, cpf_cnpj, contaazul_pessoa_id')
      .eq('bar_id', bar_id).eq('tipo', 'freela').eq('ativo', true).order('nome'),
    // Rascunho segue POR DIA (montagem intocada). Enviados (aguardando+) viram PARENTS agrupados
    // (1 por pessoa/semana) desde o "Encerrar"; o parent é ancorado em data_competencia=segunda.
    fin(supabase).from('pedidos_pagamento')
      .select('id, beneficiario_nome, valor, status, data_vencimento, data_competencia, contaazul_pessoa_id, descricao')
      .eq('bar_id', bar_id).eq('tipo', 'freela')
      .gte('data_competencia', mon).lte('data_competencia', sun)
      .order('data_competencia'),
  ]);
  if (rosterRes.error) return NextResponse.json({ success: false, error: rosterRes.error.message }, { status: 500 });
  if (pedidosRes.error) return NextResponse.json({ success: false, error: pedidosRes.error.message }, { status: 500 });

  const linhas = (pedidosRes.data || []) as any[];
  const rascunhos = linhas.filter((p) => p.status === 'rascunho');
  const parents = linhas.filter((p) => p.status !== 'rascunho');

  // Expande os parents (agrupados) em itens POR DIA pra exibição read-only ("Enviado ao
  // financeiro"). Parent SEM competências = linha legado (per-dia antiga), fica como está.
  let enviadosExpandido: any[] = parents;
  if (parents.length) {
    const { data: comps } = await fin(supabase)
      .from('pedidos_pagamento_competencias')
      .select('id, pedido_id, data_competencia, valor, descricao')
      .in('pedido_id', parents.map((p) => p.id))
      .order('data_competencia');
    const byParent = new Map<string, any[]>();
    for (const c of (comps || []) as any[]) (byParent.get(c.pedido_id) || byParent.set(c.pedido_id, []).get(c.pedido_id)!).push(c);
    enviadosExpandido = parents.flatMap((p) => {
      const cs = byParent.get(p.id);
      if (!cs || cs.length === 0) return [p]; // legado per-dia
      return cs.map((c) => ({
        id: c.id, beneficiario_nome: p.beneficiario_nome, valor: c.valor, status: p.status,
        data_vencimento: p.data_vencimento, data_competencia: c.data_competencia,
        contaazul_pessoa_id: p.contaazul_pessoa_id, descricao: c.descricao,
      }));
    });
  }

  return NextResponse.json({
    success: true, semana: { mon, sun },
    roster: rosterRes.data || [], pedidos: [...rascunhos, ...enviadosExpandido],
  });
}

export async function POST(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { user, supabase, bar_id } = c;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action || 'lancar');

  // --- ENCERRAR: rascunho da semana → 1 pedido/pessoa (aguardando_aprovacao) + N competências ---
  // Agrupa as diárias por PESSOA numa única conta (1 PIX no financeiro); cada diária vira uma
  // competência (dia + função na descrição + valor), com a categoria decidida depois no aprovar.
  if (action === 'encerrar') {
    const { mon, sun } = body;
    if (!isISO(mon) || !isISO(sun)) return NextResponse.json({ success: false, error: 'mon/sun (AAAA-MM-DD) obrigatórios' }, { status: 400 });

    const { data: diarias, error: errD } = await fin(supabase).from('pedidos_pagamento')
      .select('*').eq('bar_id', bar_id).eq('tipo', 'freela').eq('status', 'rascunho')
      .gte('data_competencia', mon).lte('data_competencia', sun);
    if (errD) return NextResponse.json({ success: false, error: errD.message }, { status: 500 });
    if (!diarias || diarias.length === 0) return NextResponse.json({ success: true, alterados: 0, total: 0 });

    const norm = (s?: string | null) => (s || '').trim().toLowerCase();
    const grupos = new Map<string, any[]>();
    for (const d of diarias) (grupos.get(norm(d.beneficiario_nome)) || grupos.set(norm(d.beneficiario_nome), []).get(norm(d.beneficiario_nome))!).push(d);

    let pessoas = 0, total = 0;
    for (const [, lista] of grupos) {
      lista.sort((a, b) => String(a.data_competencia).localeCompare(String(b.data_competencia)));
      const base = lista.find((d) => d.contaazul_pessoa_id) || lista[0];
      const soma = lista.reduce((s, d) => s + Number(d.valor || 0), 0);
      const venc = base.data_vencimento;
      const nome = base.beneficiario_nome || 'Freela';
      const ddmm = (iso: string) => { const [, m, dd] = iso.split('-'); return `${dd}/${m}`; };

      const { data: parent, error: errP } = await fin(supabase).from('pedidos_pagamento').insert({
        bar_id, tipo: 'freela', status: 'aguardando_aprovacao',
        solicitante_id: base.solicitante_id, solicitante_nome: base.solicitante_nome,
        descricao: `Freelas ${ddmm(mon)}–${ddmm(sun)} — ${nome} (${lista.length} diária(s))`,
        valor: soma,
        data_competencia: mon,       // âncora da semana (usada só p/ escopo/nav da operação)
        data_vencimento: venc,
        beneficiario_nome: nome,
        chave_pix: base.chave_pix, tipo_chave: base.tipo_chave, cpf_cnpj: base.cpf_cnpj,
        contaazul_pessoa_id: base.contaazul_pessoa_id,
        criado_por: user.auth_id, atualizado_por: user.auth_id,
      }).select('id').single();
      if (errP) return NextResponse.json({ success: false, error: errP.message }, { status: 500 });

      const comps = lista.map((d, i) => ({
        pedido_id: parent.id, bar_id,
        data_competencia: d.data_competencia, valor: d.valor,
        descricao: funcaoDaDescricao(d.descricao) || null,  // função do dia
        ordem: i,
      }));
      const { error: errC } = await fin(supabase).from('pedidos_pagamento_competencias').insert(comps);
      if (errC) {
        // Rollback do parent recém-criado — evita conta órfã sem competências.
        await fin(supabase).from('pedidos_pagamento').delete().eq('id', parent.id);
        return NextResponse.json({ success: false, error: errC.message }, { status: 500 });
      }

      await fin(supabase).from('pedidos_pagamento').delete().in('id', lista.map((d) => d.id));
      await comentarioSistema(supabase, {
        pedido_id: parent.id, bar_id,
        mensagem: `Semana encerrada pela operação (${user.nome}) — ${lista.length} diária(s) de ${nome} agrupadas em 1 pagamento (${formatBRL(soma)}), enviado ao financeiro.`,
      });
      pessoas++; total += soma;
    }
    return NextResponse.json({ success: true, alterados: pessoas, total });
  }

  // --- REABRIR: desfaz o agrupamento (parent+competências → diárias por dia em rascunho). Só o
  // que o financeiro ainda NÃO tocou (status aguardando_aprovacao). Trata também linhas legado
  // per-dia (sem competências): só volta pra rascunho. ---
  if (action === 'reabrir') {
    const { mon, sun } = body;
    if (!isISO(mon) || !isISO(sun)) return NextResponse.json({ success: false, error: 'mon/sun (AAAA-MM-DD) obrigatórios' }, { status: 400 });

    const { data: parents, error: errP } = await fin(supabase).from('pedidos_pagamento')
      .select('*').eq('bar_id', bar_id).eq('tipo', 'freela').eq('status', 'aguardando_aprovacao')
      .gte('data_competencia', mon).lte('data_competencia', sun);
    if (errP) return NextResponse.json({ success: false, error: errP.message }, { status: 500 });
    if (!parents || parents.length === 0) return NextResponse.json({ success: true, alterados: 0 });

    const { data: comps } = await fin(supabase).from('pedidos_pagamento_competencias')
      .select('*').in('pedido_id', parents.map((p) => p.id)).order('ordem');
    const byParent = new Map<string, any[]>();
    for (const c of (comps || []) as any[]) (byParent.get(c.pedido_id) || byParent.set(c.pedido_id, []).get(c.pedido_id)!).push(c);

    let diarias = 0;
    for (const p of parents) {
      const cs = byParent.get(p.id);
      if (!cs || cs.length === 0) {
        // Legado per-dia: só volta a rascunho.
        await fin(supabase).from('pedidos_pagamento').update({ status: 'rascunho', atualizado_por: user.auth_id }).eq('id', p.id);
        diarias++;
        continue;
      }
      const novas = cs.map((c) => ({
        bar_id, tipo: 'freela', status: 'rascunho',
        solicitante_id: p.solicitante_id, solicitante_nome: p.solicitante_nome,
        descricao: `Freela ${c.descricao ? c.descricao + ' — ' : ''}${p.beneficiario_nome} (${p.data_vencimento})`,
        valor: c.valor, data_competencia: c.data_competencia, data_vencimento: p.data_vencimento,
        beneficiario_nome: p.beneficiario_nome, chave_pix: p.chave_pix, tipo_chave: p.tipo_chave,
        cpf_cnpj: p.cpf_cnpj, contaazul_pessoa_id: p.contaazul_pessoa_id,
        criado_por: user.auth_id, atualizado_por: user.auth_id,
      }));
      const { error: errN } = await fin(supabase).from('pedidos_pagamento').insert(novas);
      if (errN) return NextResponse.json({ success: false, error: errN.message }, { status: 500 });
      await fin(supabase).from('pedidos_pagamento_competencias').delete().eq('pedido_id', p.id);
      await fin(supabase).from('pedidos_pagamento').delete().eq('id', p.id);
      diarias += cs.length;
    }
    return NextResponse.json({ success: true, alterados: diarias });
  }

  // --- CADASTRAR_FREELA: adiciona uma pessoa ao roster (financial.beneficiarios tipo=freela) ---
  if (action === 'cadastrar_freela') {
    const nome = String(body.nome || '').trim();
    if (!nome) return NextResponse.json({ success: false, error: 'nome do freela é obrigatório' }, { status: 400 });
    const funcao = String(body.funcao || '').trim() || null;
    const chave_pix = String(body.chave_pix || '').trim() || null;
    const tipo_chave = String(body.tipo_chave || '').trim() || null;
    const cpf_cnpj = String(body.cpf_cnpj || '').replace(/\D/g, '') || null;
    const valorPadrao = body.valor_padrao != null && body.valor_padrao !== ''
      ? Math.round(Number(body.valor_padrao) * 100) / 100 : null;
    const valor_padrao = Number.isFinite(valorPadrao as number) && (valorPadrao as number) > 0 ? valorPadrao : null;

    // Evita duplicar: mesmo bar + mesmo nome (normalizado) já ativo.
    const { data: existentes } = await fin(supabase).from('beneficiarios')
      .select('id, nome').eq('bar_id', bar_id).eq('tipo', 'freela').eq('ativo', true);
    const norm = (s: string) => s.trim().toLowerCase();
    if ((existentes || []).some((f: any) => norm(f.nome) === norm(nome))) {
      return NextResponse.json({ success: false, error: `Já existe um freela "${nome}" cadastrado.` }, { status: 409 });
    }

    const { data: criado, error } = await fin(supabase).from('beneficiarios').insert({
      bar_id, tipo: 'freela', ativo: true,
      nome, funcao, valor_padrao, chave_pix, tipo_chave, cpf_cnpj,
    }).select('id, nome, funcao, valor_padrao, chave_pix, tipo_chave, cpf_cnpj, contaazul_pessoa_id').single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, freela: criado });
  }

  // --- EDITAR_FREELA: atualiza cadastro (função padrão, valor padrão, PIX etc.) ---
  if (action === 'editar_freela') {
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ success: false, error: 'id do freela obrigatório' }, { status: 400 });

    // Só grava o que veio no payload (undefined não sobrescreve).
    const patch: Record<string, unknown> = {};
    if (body.nome !== undefined) {
      const nome = String(body.nome).trim();
      if (!nome) return NextResponse.json({ success: false, error: 'nome não pode ficar vazio' }, { status: 400 });
      patch.nome = nome;
    }
    if (body.funcao !== undefined) patch.funcao = String(body.funcao || '').trim() || null;
    if (body.chave_pix !== undefined) patch.chave_pix = String(body.chave_pix || '').trim() || null;
    if (body.tipo_chave !== undefined) patch.tipo_chave = String(body.tipo_chave || '').trim() || null;
    if (body.cpf_cnpj !== undefined) patch.cpf_cnpj = String(body.cpf_cnpj || '').replace(/\D/g, '') || null;
    if (body.valor_padrao !== undefined) {
      const v = body.valor_padrao === '' || body.valor_padrao == null ? null : Math.round(Number(body.valor_padrao) * 100) / 100;
      patch.valor_padrao = v != null && Number.isFinite(v) && v > 0 ? v : null;
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ success: true, sem_mudancas: true });

    const { data: upd, error } = await fin(supabase).from('beneficiarios')
      .update(patch).eq('id', id).eq('bar_id', bar_id).eq('tipo', 'freela')
      .select('id, nome, funcao, valor_padrao, chave_pix, tipo_chave, cpf_cnpj, contaazul_pessoa_id').single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, freela: upd });
  }

  // --- LANCAR: cria N diárias em RASCUNHO ---
  const data_vencimento = String(body.data_vencimento || '');
  const data_competencia = String(body.data_competencia || '');
  if (!isISO(data_vencimento) || !isISO(data_competencia)) {
    return NextResponse.json({ success: false, error: 'data_competencia e data_vencimento (AAAA-MM-DD) obrigatórias' }, { status: 400 });
  }
  const itens: Array<{ freela_id: string; valor: number; funcao?: string }> = Array.isArray(body.itens) ? body.itens : [];
  if (itens.length === 0) return NextResponse.json({ success: false, error: 'nenhum freela no lote' }, { status: 400 });

  const ids = itens.map(i => i.freela_id);
  const { data: freelas, error: errFre } = await fin(supabase)
    .from('beneficiarios').select('*').eq('bar_id', bar_id).eq('tipo', 'freela').in('id', ids);
  if (errFre) return NextResponse.json({ success: false, error: errFre.message }, { status: 500 });
  const mapa = new Map((freelas || []).map((f: any) => [f.id, f]));

  const novos: any[] = [];
  const erros: string[] = [];
  for (const it of itens) {
    const f: any = mapa.get(it.freela_id);
    if (!f) { erros.push(`freela ${it.freela_id} não encontrado`); continue; }
    const valor = Math.round(Number(it.valor) * 100) / 100;
    if (!Number.isFinite(valor) || valor <= 0) { erros.push(`valor inválido para ${f.nome}`); continue; }
    // Função DO DIA: se o item veio com função (a operação escolheu na hora — ex.: mesma
    // pessoa hoje é garçom, amanhã é cumim), usa ela; senão cai na função padrão do
    // cadastro. A função final entra na descrição do pedido pro financeiro/DRE.
    const funcaoDoDia = it.funcao != null && String(it.funcao).trim()
      ? String(it.funcao).trim()
      : (f.funcao || '');
    novos.push({
      bar_id: bar_id,
      tipo: 'freela',
      status: 'rascunho',
      solicitante_id: user.auth_id,
      solicitante_nome: user.nome,
      descricao: `Freela ${funcaoDoDia ? funcaoDoDia + ' — ' : ''}${f.nome} (${data_vencimento})`,
      valor,
      data_competencia,
      data_vencimento,
      beneficiario_nome: f.nome,
      chave_pix: f.chave_pix,
      tipo_chave: f.tipo_chave,
      cpf_cnpj: f.cpf_cnpj,
      categoria_id: f.categoria_id,
      categoria_nome: f.categoria_nome,
      contaazul_pessoa_id: f.contaazul_pessoa_id,
      criado_por: user.auth_id,
      atualizado_por: user.auth_id,
    });
  }
  if (novos.length === 0) return NextResponse.json({ success: false, error: 'nada a lançar', detalhes: erros }, { status: 400 });

  const { data: criados, error } = await fin(supabase).from('pedidos_pagamento').insert(novos).select();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const total = (criados || []).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
  return NextResponse.json({ success: true, criados: (criados || []).length, total, erros });
}

export async function PUT(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { user, supabase, bar_id } = c;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }
  const id = String(body.id || '');
  const valor = Math.round(Number(body.valor) * 100) / 100;
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  if (!Number.isFinite(valor) || valor <= 0) return NextResponse.json({ success: false, error: 'valor inválido' }, { status: 400 });

  // Só edita RASCUNHO do próprio bar (depois de encerrado é o financeiro que manda).
  const { data: upd, error } = await fin(supabase).from('pedidos_pagamento')
    .update({ valor, atualizado_por: user.auth_id })
    .eq('id', id).eq('bar_id', bar_id).eq('tipo', 'freela').eq('status', 'rascunho')
    .select('id');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!upd || upd.length === 0) return NextResponse.json({ success: false, error: 'diária não encontrada ou já encerrada' }, { status: 409 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { user, supabase, bar_id } = c;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const { data: del, error } = await fin(supabase).from('pedidos_pagamento')
    .delete().eq('id', id).eq('bar_id', bar_id).eq('tipo', 'freela').eq('status', 'rascunho')
    .select('id');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!del || del.length === 0) return NextResponse.json({ success: false, error: 'diária não encontrada ou já encerrada' }, { status: 409 });
  return NextResponse.json({ success: true });
}
