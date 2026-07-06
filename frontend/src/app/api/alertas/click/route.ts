import { withAuth } from '@/lib/http/with-auth';
import { success } from '@/lib/http/responses';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/alertas/click
 * Registra a abertura da Central de Alertas com sua origem (atribuição).
 * Ex: o botão do template WhatsApp aponta pra /alertas?source=whatsapp → aqui
 * a gente grava o clique pra medir quantos vieram do WhatsApp.
 *
 * Body: { source?: string, alerta_id?: string }
 * Best-effort: nunca quebra a navegação (falha só loga).
 */
export const POST = withAuth(async ({ user, request }) => {
  let body: { source?: unknown; alerta_id?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* body vazio ok */
  }

  const source =
    typeof body.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, 40)
      : 'direto';
  const alertaId = typeof body.alerta_id === 'string' ? body.alerta_id : null;

  try {
    const supabase = await getAdminClient();
    await supabase
      .schema('system')
      .from('alerta_clicks')
      .insert({
        usuario_id: user.auth_id,
        bar_id: user.bar_id ?? null,
        source,
        alerta_id: alertaId,
      });
  } catch (e) {
    console.error('[alertas/click] falha ao registrar clique (ignorado):', e);
  }

  return success({ ok: true });
});
