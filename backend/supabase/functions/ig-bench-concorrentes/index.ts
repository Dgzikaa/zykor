/**
 * 🥊 Instagram Business Discovery (F16)
 *
 * Para cada bar com IG ativo, coleta dados públicos dos concorrentes
 * cadastrados em integrations.instagram_concorrentes via:
 *   /me?fields=business_discovery.username(X){followers_count,media_count,profile_picture_url,biography}
 *
 * Salva snapshot diário em instagram_concorrentes_snapshots pra plotar
 * evolução vs Ord/Deb.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const IG_GRAPH = 'https://graph.instagram.com/v22.0';

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

    const hoje = new Date().toISOString().split('T')[0];

    const { data: contas } = await supabase.schema('integrations').from('instagram_contas')
      .select('bar_id, access_token').eq('ativo', true);
    if (!contas?.length) return new Response(JSON.stringify({ success: true, contas: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const resultados: any[] = [];

    for (const conta of contas) {
      const { data: concorrentes } = await supabase.schema('integrations')
        .from('instagram_concorrentes')
        .select('id, username, nome_amigavel').eq('bar_id', conta.bar_id).eq('ativo', true);

      for (const conc of (concorrentes ?? [])) {
        try {
          const fields = `business_discovery.username(${conc.username})%7Bfollowers_count%2Cmedia_count%2Cprofile_picture_url%2Cbiography%2Cname%2Cusername%7D`;
          const r = await fetch(`${IG_GRAPH}/me?fields=${fields}&access_token=${conta.access_token}`);
          const j = await r.json();
          const disc = j.business_discovery;

          if (!disc) {
            resultados.push({ bar_id: conta.bar_id, username: conc.username, status: 'nao_encontrado', erro: JSON.stringify(j).slice(0, 200) });
            continue;
          }

          await supabase.schema('integrations').from('instagram_concorrentes_snapshots').upsert({
            concorrente_id: conc.id,
            data_snapshot: hoje,
            followers_count: disc.followers_count ?? null,
            follows_count: null,
            media_count: disc.media_count ?? null,
            profile_picture_url: disc.profile_picture_url ?? null,
            biography: disc.biography ?? null,
            raw_data: disc,
          }, { onConflict: 'concorrente_id,data_snapshot' });

          resultados.push({
            bar_id: conta.bar_id,
            username: conc.username,
            status: 'ok',
            followers: disc.followers_count,
            media_count: disc.media_count,
          });
        } catch (e: any) {
          resultados.push({ bar_id: conta.bar_id, username: conc.username, status: 'erro', erro: e?.message });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
