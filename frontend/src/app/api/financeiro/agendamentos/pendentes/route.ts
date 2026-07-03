import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();
const TABELA = 'pagamentos_pendentes';

// Lista de pagamentos pendentes (rascunho) do /financeiro/agendamentos.
// Persistida no banco (financial.pagamentos_pendentes) e COMPARTILHADA por bar:
// quem sobe a folha grava aqui e qualquer admin/financeiro do mesmo bar enxerga.
// O bar vem SEMPRE do usuário autenticado (com override seguro via
// x-selected-bar-id), nunca de um bar_id solto no body — evita escrita cross-bar.

function podeAcessar(user: { role?: string }): boolean {
  return podeFinanceiro(user);
}

/** Valor -> número p/ a coluna de relatório. Trata pt-BR ("R$ 1.089,10") e
 *  ponto-decimal ("1089.10"); só é coluna de apoio, o pagamento usa o raw em dados. */
function parseValorReport(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const s = String(valor ?? '').replace(/[R$\s]/g, '');
  if (!s) return null;
  // Com vírgula = pt-BR (ponto é milhar); sem vírgula = ponto já é decimal.
  const normalizado = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number.parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Data ISO (YYYY-MM-DD) ou null — evita gravar string vazia numa coluna date. */
function dataOuNull(valor: unknown): string | null {
  const s = String(valor ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

// GET — lista os pendentes do bar selecionado
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeAcessar(user)) return permissionErrorResponse('Sem permissão');

  const barId = Number(user.bar_id);
  if (!Number.isFinite(barId)) {
    return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema('financial')
    .from(TABELA)
    .select('dados, created_at')
    .eq('bar_id', barId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Devolve o PagamentoAgendamento completo (dados) — round-trip exato com a tela.
  const pagamentos = (data || []).map((row: any) => row.dados);
  return NextResponse.json({ success: true, pagamentos, total: pagamentos.length });
}

// POST — upsert (idempotente) de um ou mais pagamentos no bar selecionado.
// NUNCA apaga: remoção é só via DELETE explícito (evita clobber entre usuários).
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeAcessar(user)) return permissionErrorResponse('Sem permissão');

  const barId = Number(user.bar_id);
  if (!Number.isFinite(barId)) {
    return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const lista: any[] = Array.isArray(body?.pagamentos) ? body.pagamentos : [];
  if (lista.length === 0) {
    return NextResponse.json({ success: true, salvos: 0 });
  }

  const autorId = user.auth_id ?? null;
  const autorNome = user.nome ?? user.email ?? 'Usuário';
  const agora = new Date().toISOString();

  const rows = lista
    .filter(p => p && p.id)
    .map((p: any) => ({
      // bar_id é SEMPRE o do usuário — ignora qualquer bar_id vindo do cliente.
      id: String(p.id),
      bar_id: barId,
      status: String(p.status ?? 'pendente'),
      valor: parseValorReport(p.valor),
      nome_beneficiario: p.nome_beneficiario ?? null,
      data_pagamento: dataOuNull(p.data_pagamento),
      dados: { ...p, bar_id: barId },
      criado_por_id: p.criado_por_id ?? autorId,
      criado_por_nome: p.criado_por_nome ?? autorNome,
      atualizado_por_id: autorId,
      atualizado_por_nome: autorNome,
      updated_at: agora,
    }));

  const { error } = await supabase
    .schema('financial')
    .from(TABELA)
    .upsert(rows, { onConflict: 'bar_id,id' });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, salvos: rows.length });
}

// DELETE — remove pagamentos do bar. { ids: string[] } ou { all: true }.
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeAcessar(user)) return permissionErrorResponse('Sem permissão');

  const barId = Number(user.bar_id);
  if (!Number.isFinite(barId)) {
    return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    /* body opcional */
  }

  const base = supabase.schema('financial').from(TABELA).delete().eq('bar_id', barId);

  if (body?.all === true) {
    const { error } = await base;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: 'Informe ids ou all=true' }, { status: 400 });
  }

  const { error } = await base.in('id', ids);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, removidos: ids.length });
}
