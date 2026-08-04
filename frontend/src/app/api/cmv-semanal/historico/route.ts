import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

// Rota dinâmica (usa request.url)
export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/**
 * GET - Histórico de alterações do CMV Semanal (financial.cmv_semanal_historico).
 *
 * Pedido do Isaías (04/08/2026): "ter um histórico igual nas planilhas, pra quando mudar a
 * gente ver o que mudou". O trigger `trg_cmv_semanal_historico` grava o diff de TODO update —
 * inclusive o recálculo automático da edge/cron, que não passa pela auditoria da tela.
 *
 * Params:
 * - bar_id (obrigatório)
 * - ano (default: ano corrente)
 * - semana (opcional; sem ela traz as últimas alterações do bar todo)
 * - limite (default 100, teto 500)
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

  const ano = Number(sp.get('ano')) || new Date().getFullYear();
  const semana = sp.get('semana') ? Number(sp.get('semana')) : null;
  const limite = Math.min(Number(sp.get('limite')) || 100, 500);

  let q = supabase
    .schema('financial')
    .from('cmv_semanal_historico')
    .select('id, bar_id, ano, semana, alterado_em, origem, autor, mudancas')
    .eq('bar_id', barId)
    .eq('ano', ano)
    .order('alterado_em', { ascending: false })
    .limit(limite);
  if (semana != null) q = q.eq('semana', semana);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ historico: data || [], total: (data || []).length });
}
