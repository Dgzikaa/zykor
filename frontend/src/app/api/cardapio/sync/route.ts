import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';

/**
 * POST /api/cardapio/sync
 * Dispara o re-sync das planilhas de cardapio (edge function sync-cardapio-custo)
 * para o bar do usuario, na hora. Exige o módulo financeiro (custo é dado financeiro).
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);
  if (!podeFinanceiro(user))
    return permissionErrorResponse('Sem permissão para sincronizar');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey)
    return NextResponse.json({ error: 'Configuração do servidor ausente' }, { status: 500 });

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/sync-cardapio-custo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bar_id: user.bar_id }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok)
      return NextResponse.json({ error: result?.error || `Edge function HTTP ${resp.status}` }, { status: 502 });

    const meu = (result?.resultados ?? []).find((r: any) => r.bar_id === user.bar_id) ?? {};
    return NextResponse.json({
      success: true,
      atualizadas: meu.linhas_atualizadas ?? 0,
      produtos_lidos: meu.produtos_lidos ?? null,
      erro: meu.erro ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Falha ao sincronizar' }, { status: 500 });
  }
}
