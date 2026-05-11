/**
 * @camada bronze
 * @jobName instagram-sync-account
 * @descricao Métricas e demografia da conta (snapshot diário). 1x/dia, 5h BRT.
 *
 * Salva por (bar_id, data) um snapshot de:
 *  - followers_count, follows_count, media_count, profile_views, reach, etc
 *  - demografia: cidade, gênero/idade, locale (apenas se >100 followers, requisito Meta)
 *  - audiência online por hora (heatmap pra agendar posts)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  listarContasAtivas,
  igGet,
  startSyncLog,
  marcarUltimaSync,
  isTokenInvalido,
} from '../_shared/instagram-client.ts';

const METRICAS_DAY = ['reach', 'profile_views', 'website_clicks', 'email_contacts', 'phone_call_clicks', 'text_message_clicks', 'get_directions_clicks'];
const METRICAS_LIFETIME = ['online_followers'];
const DEMOGRAFIA = ['audience_city', 'audience_country', 'audience_gender_age', 'audience_locale'];

async function tryFetch<T>(fn: () => Promise<T>, contexto: string): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[ig-account] ${contexto} falhou:`, String(e).slice(0, 200));
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const contas = await listarContasAtivas(supabase);
  const hojeIso = new Date().toISOString().split('T')[0];
  const resultadosPorBar: Array<{ bar_id: number; ok: boolean; erro?: string }> = [];

  for (const conta of contas) {
    const log = await startSyncLog(supabase, conta.bar_id, 'account');

    try {
      // Stats básicas
      const basic = await igGet<{
        followers_count: number;
        follows_count: number;
        media_count: number;
        username: string;
      }>(
        conta.ig_business_id,
        conta.access_token,
        { fields: 'followers_count,follows_count,media_count,username' },
      );

      // Métricas diárias (period=day)
      const insightsDay = await tryFetch(
        () => igGet<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(
          `${conta.ig_business_id}/insights`,
          conta.access_token,
          { metric: METRICAS_DAY.join(','), period: 'day', metric_type: 'total_value' },
        ),
        'metrics day',
      );

      const insightsLifetime = await tryFetch(
        () => igGet<{ data: Array<{ name: string; values: Array<{ value: any }> }> }>(
          `${conta.ig_business_id}/insights`,
          conta.access_token,
          { metric: METRICAS_LIFETIME.join(','), period: 'lifetime' },
        ),
        'metrics lifetime',
      );

      const demografia = await tryFetch(
        () => igGet<{ data: Array<{ name: string; values: Array<{ value: any }> }> }>(
          `${conta.ig_business_id}/insights`,
          conta.access_token,
          { metric: DEMOGRAFIA.join(','), period: 'lifetime' },
        ),
        'demografia',
      );

      const mapDay: Record<string, number> = {};
      for (const m of insightsDay?.data || []) mapDay[m.name] = m.values?.[0]?.value ?? 0;

      const mapLife: Record<string, any> = {};
      for (const m of insightsLifetime?.data || []) mapLife[m.name] = m.values?.[0]?.value;

      const mapDemog: Record<string, any> = {};
      for (const m of demografia?.data || []) mapDemog[m.name] = m.values?.[0]?.value;

      const row = {
        bar_id: conta.bar_id,
        data_snapshot: hojeIso,
        followers_count: basic.followers_count,
        follows_count: basic.follows_count,
        media_count: basic.media_count,
        profile_views: mapDay.profile_views ?? null,
        website_clicks: mapDay.website_clicks ?? null,
        reach: mapDay.reach ?? null,
        email_contacts: mapDay.email_contacts ?? null,
        phone_call_clicks: mapDay.phone_call_clicks ?? null,
        text_message_clicks: mapDay.text_message_clicks ?? null,
        get_directions_clicks: mapDay.get_directions_clicks ?? null,
        online_followers: mapLife.online_followers ?? null,
        audience_city: mapDemog.audience_city ?? null,
        audience_country: mapDemog.audience_country ?? null,
        audience_gender_age: mapDemog.audience_gender_age ?? null,
        audience_locale: mapDemog.audience_locale ?? null,
        raw_data: { basic, day: insightsDay, lifetime: insightsLifetime, demog: demografia },
        capturado_em: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('instagram_conta_metricas')
        .upsert(row, { onConflict: 'bar_id,data_snapshot' });

      if (error) throw new Error(`Upsert falhou: ${error.message}`);

      // Atualiza username em instagram_contas se mudou
      if (basic.username && basic.username !== conta.ig_username) {
        await supabase
          .from('instagram_contas')
          .update({ ig_username: basic.username })
          .eq('bar_id', conta.bar_id);
      }

      await marcarUltimaSync(supabase, conta.bar_id);
      await log.finalizar({ status: 'success', itens_processados: 1, itens_novos: 1 });
      resultadosPorBar.push({ bar_id: conta.bar_id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ig-account] bar ${conta.bar_id} erro:`, msg);
      if (isTokenInvalido(err)) {
        await supabase
          .from('instagram_contas')
          .update({ ativo: false, desconectado_em: new Date().toISOString() })
          .eq('bar_id', conta.bar_id);
      }
      await log.finalizar({ status: 'error', erro_mensagem: msg });
      resultadosPorBar.push({ bar_id: conta.bar_id, ok: false, erro: msg });
    }
  }

  return new Response(
    JSON.stringify({ success: true, bars: resultadosPorBar }),
    { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
  );
});
