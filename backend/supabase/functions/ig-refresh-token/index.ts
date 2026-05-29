/**
 * 🔄 Instagram Refresh Token
 *
 * Long-lived token IG expira em 60d. Endpoint refresh_access_token estende
 * por mais 60d (sem precisar do user reautorizar) DESDE QUE o token seja
 * mais velho que 24h.
 *
 * Estrategia: cron diario verifica se expires_at < 14 dias do hoje.
 * Se sim, chama /refresh_access_token. Atualiza expires_at + access_token.
 *
 * Se falhar (token revogado pelo user / app desinstalado / etc), marca conta
 * ativo=false e dispara alerta Discord pra reconectar manualmente.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const IG_GRAPH = 'https://graph.instagram.com';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Pega contas ativas com token expirando em <14 dias
    const limite = new Date(Date.now() + 14 * 86400000).toISOString();
    const { data: contas } = await supabase
      .schema('integrations')
      .from('instagram_contas')
      .select('bar_id, ig_username, access_token, expires_at')
      .eq('ativo', true)
      .lte('expires_at', limite);

    const resultados: any[] = [];

    for (const conta of (contas ?? [])) {
      const t0 = Date.now();
      try {
        const r = await fetch(
          `${IG_GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${conta.access_token}`,
        );
        const j = await r.json();

        if (!r.ok || !j.access_token) {
          // Token irrecuperavel — marca conta inativa
          await supabase.schema('integrations').from('instagram_contas').update({
            ativo: false,
            desconectado_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('bar_id', conta.bar_id);

          resultados.push({
            bar_id: conta.bar_id,
            ig_username: conta.ig_username,
            status: 'falhou_marcado_inativo',
            erro: JSON.stringify(j).slice(0, 200),
            tempo_ms: Date.now() - t0,
          });
          continue;
        }

        const newExpiresIn = Number(j.expires_in) || 60 * 24 * 3600;
        const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000).toISOString();

        await supabase.schema('integrations').from('instagram_contas').update({
          access_token: j.access_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        }).eq('bar_id', conta.bar_id);

        resultados.push({
          bar_id: conta.bar_id,
          ig_username: conta.ig_username,
          status: 'renovado',
          novo_expires_at: newExpiresAt,
          tempo_ms: Date.now() - t0,
        });
      } catch (e: any) {
        resultados.push({
          bar_id: conta.bar_id,
          ig_username: conta.ig_username,
          status: 'erro',
          erro: e?.message || String(e),
          tempo_ms: Date.now() - t0,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        contas_verificadas: (contas ?? []).length,
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[ig-refresh-token] excecao:', e);
    return new Response(
      JSON.stringify({ success: false, erro: e?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
