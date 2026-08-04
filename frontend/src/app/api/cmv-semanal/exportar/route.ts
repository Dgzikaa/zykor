import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

// Rota dinâmica (usa request.url)
export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/**
 * GET - Dados do CMV Semanal para exportar em planilha.
 *
 * Pedido do Isaías (04/08/2026): "consegue colocar pra eu exportar como xls? tanto os antigos
 * ou como tá agora". Devolve a semana com a DECOMPOSIÇÃO do Faturamento Limpo (denominador do
 * CMV%) e as três leituras do CMV%: como está hoje, pela regra até 30/06 (sem bilheteria) e
 * corrigida (bilheteria só do ingresso, sem o consumo de bar do evento).
 *
 * Params: bar_id (obrigatório), ano (default: corrente)
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
  const ano = Number(sp.get('ano')) || new Date().getFullYear();

  const { data, error } = await supabase
    .schema('financial')
    .rpc('fn_cmv_semanal_export', { p_bar_id: barId, p_ano: ano });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ semanas: data || [], ano, bar_id: barId });
}
