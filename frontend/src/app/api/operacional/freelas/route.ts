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
    fin(supabase).from('pedidos_pagamento')
      .select('id, beneficiario_nome, valor, status, data_vencimento, data_competencia, contaazul_pessoa_id')
      .eq('bar_id', bar_id).eq('tipo', 'freela')
      .gte('data_competencia', mon).lte('data_competencia', sun)
      .order('data_competencia'),
  ]);
  if (rosterRes.error) return NextResponse.json({ success: false, error: rosterRes.error.message }, { status: 500 });
  if (pedidosRes.error) return NextResponse.json({ success: false, error: pedidosRes.error.message }, { status: 500 });

  return NextResponse.json({
    success: true, semana: { mon, sun },
    roster: rosterRes.data || [], pedidos: pedidosRes.data || [],
  });
}

export async function POST(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { user, supabase, bar_id } = c;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action || 'lancar');

  // --- ENCERRAR: rascunho da semana → aguardando_aprovacao (envia ao financeiro) ---
  if (action === 'encerrar' || action === 'reabrir') {
    const { mon, sun } = body;
    if (!isISO(mon) || !isISO(sun)) return NextResponse.json({ success: false, error: 'mon/sun (AAAA-MM-DD) obrigatórios' }, { status: 400 });
    const de = action === 'encerrar' ? 'rascunho' : 'aguardando_aprovacao';
    const para = action === 'encerrar' ? 'aguardando_aprovacao' : 'rascunho';
    const { data: alterados, error } = await fin(supabase).from('pedidos_pagamento')
      .update({ status: para, atualizado_por: user.auth_id })
      .eq('bar_id', bar_id).eq('tipo', 'freela').eq('status', de)
      .gte('data_competencia', mon).lte('data_competencia', sun)
      .select('id, valor');
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    for (const p of alterados || []) {
      await comentarioSistema(supabase, {
        pedido_id: p.id, bar_id: bar_id,
        mensagem: action === 'encerrar'
          ? `Semana encerrada pela operação (${user.nome}) — enviado ao financeiro.`
          : `Semana reaberta pela operação (${user.nome}) — voltou a rascunho.`,
      });
    }
    const total = (alterados || []).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
    return NextResponse.json({ success: true, alterados: (alterados || []).length, total });
  }

  // --- CADASTRAR_FREELA: adiciona uma pessoa ao roster (financial.beneficiarios tipo=freela) ---
  if (action === 'cadastrar_freela') {
    const nome = String(body.nome || '').trim();
    if (!nome) return NextResponse.json({ success: false, error: 'nome do freela é obrigatório' }, { status: 400 });
    const funcao = String(body.funcao || '').trim() || null;
    const chave_pix = String(body.chave_pix || '').trim() || null;
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
      nome, funcao, valor_padrao, chave_pix, cpf_cnpj,
    }).select('id, nome, funcao, valor_padrao, chave_pix, tipo_chave, cpf_cnpj, contaazul_pessoa_id').single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, freela: criado });
  }

  // --- LANCAR: cria N diárias em RASCUNHO ---
  const data_vencimento = String(body.data_vencimento || '');
  const data_competencia = String(body.data_competencia || '');
  if (!isISO(data_vencimento) || !isISO(data_competencia)) {
    return NextResponse.json({ success: false, error: 'data_competencia e data_vencimento (AAAA-MM-DD) obrigatórias' }, { status: 400 });
  }
  const itens: Array<{ freela_id: string; valor: number }> = Array.isArray(body.itens) ? body.itens : [];
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
    novos.push({
      bar_id: bar_id,
      tipo: 'freela',
      status: 'rascunho',
      solicitante_id: user.auth_id,
      solicitante_nome: user.nome,
      descricao: `Freela ${f.funcao ? f.funcao + ' — ' : ''}${f.nome} (${data_vencimento})`,
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
