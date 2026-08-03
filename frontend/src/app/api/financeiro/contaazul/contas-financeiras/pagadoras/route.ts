import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';

/**
 * Contas PAGADORAS do bar (quais contas do Conta Azul podem pagar e qual é a sugerida).
 *
 * Por que existe: `pagadora` / `pagadora_padrao` viviam SÓ no banco, marcadas na unha por SQL
 * quando cada bar era configurado. Bar novo nascia sem nenhuma marcada e o furo só aparecia na
 * hora de lançar — a fatura de cartão devolvia "Complete antes de lançar: conta pagadora" com o
 * dropdown vazio, sem dizer que o problema era de configuração do bar (aconteceu com o bar 6,
 * PREFS, em 03/08/2026). Esta rota dá uma tela pra isso.
 *
 *  - `pagadora`        = pode pagar (aparece no seletor de pedidos/fatura de cartão).
 *  - `pagadora_padrao` = a sugerida do bar; é o fallback de quem lança sem escolher conta.
 *    No máximo UMA por bar — marcar uma desmarca a anterior (na mesma transação lógica).
 *
 * Contas de investimento/aplicação ficam de fora de propósito: não são pagadoras.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const getSupabaseAdmin = () =>
  createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const contas = () =>
  (getSupabaseAdmin().schema('bronze' as any) as any).from('bronze_contaazul_contas_financeiras');

/** GET — contas ativas do bar com as flags, pra tela de configuração. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para ver contas pagadoras');

  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || Number(user.bar_id);
  if (!Number.isFinite(barId)) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

  const { data, error } = await contas()
    .select('contaazul_id, nome, banco, tipo, ativo, pagadora, pagadora_padrao')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .order('nome');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lista = ((data as any[]) || []).map((c) => ({
    contaazul_id: String(c.contaazul_id),
    nome: String(c.nome),
    banco: c.banco ?? null,
    tipo: c.tipo ?? null,
    pagadora: !!c.pagadora,
    pagadora_padrao: !!c.pagadora_padrao,
  }));

  return NextResponse.json({
    bar_id: barId,
    contas_financeiras: lista,
    // A tela avisa em cima quando o bar está incompleto — é exatamente o estado que fazia
    // o lançamento de cartão falhar sem explicar o motivo.
    sem_pagadora: lista.every((c) => !c.pagadora),
    sem_padrao: lista.every((c) => !c.pagadora_padrao),
  });
}

/**
 * PATCH — liga/desliga as flags de UMA conta.
 * body: { bar_id, contaazul_id, pagadora?: boolean, pagadora_padrao?: boolean }
 *
 * Invariantes garantidas aqui (não confie no cliente):
 *  - marcar `pagadora_padrao` implica `pagadora` (a padrão precisa poder pagar);
 *  - só existe UMA padrão por bar (as outras são desmarcadas antes);
 *  - desmarcar `pagadora` desmarca `pagadora_padrao` junto (senão sobra padrão que não paga).
 */
export async function PATCH(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin' && !podeFinanceiro(user)) {
    return permissionErrorResponse('Sem permissão para alterar contas pagadoras');
  }

  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const contaId = String(body?.contaazul_id || '');
  if (!Number.isFinite(barId) || !contaId) {
    return NextResponse.json({ error: 'bar_id e contaazul_id são obrigatórios' }, { status: 400 });
  }

  const { data: atual } = await contas()
    .select('contaazul_id, nome, pagadora, pagadora_padrao')
    .eq('bar_id', barId)
    .eq('contaazul_id', contaId)
    .maybeSingle();
  if (!atual) return NextResponse.json({ error: 'Conta não encontrada neste bar' }, { status: 404 });

  let pagadora = body?.pagadora === undefined ? !!(atual as any).pagadora : !!body.pagadora;
  let padrao = body?.pagadora_padrao === undefined ? !!(atual as any).pagadora_padrao : !!body.pagadora_padrao;
  if (padrao) pagadora = true; // a padrão obrigatoriamente paga
  if (!pagadora) padrao = false; // e quem não paga não pode ser a padrão

  // Uma padrão por bar: limpa as outras ANTES de gravar esta.
  if (padrao) {
    const { error: eLimpa } = await contas()
      .update({ pagadora_padrao: false })
      .eq('bar_id', barId)
      .neq('contaazul_id', contaId)
      .eq('pagadora_padrao', true);
    if (eLimpa) return NextResponse.json({ error: eLimpa.message }, { status: 500 });
  }

  const { error } = await contas()
    .update({ pagadora, pagadora_padrao: padrao })
    .eq('bar_id', barId)
    .eq('contaazul_id', contaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    sucesso: true,
    conta: { contaazul_id: contaId, nome: (atual as any).nome, pagadora, pagadora_padrao: padrao },
  });
}
