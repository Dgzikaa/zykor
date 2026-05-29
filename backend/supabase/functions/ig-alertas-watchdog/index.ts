/**
 * 🚨 IG Alertas Watchdog (F14)
 *
 * Roda 1h após sync diário. Aplica regras:
 *   - queda_followers: followers caiu > 1% em 24h
 *   - pico_engagement: total_interactions hoje > 3x média 7d
 *   - alta_reclamacoes: DMs categoria='reclamacao' >= 3 nas últimas 24h
 *   - sentimento_negativo_alto: > 30% de DMs categorizadas como negativo
 *
 * Insere em integrations.instagram_alertas. Opcionalmente envia Discord
 * via tabela operations.discord_webhooks (canal por bar).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

interface Alerta {
  bar_id: number;
  tipo: string;
  severidade: 'info' | 'warn' | 'critico';
  titulo: string;
  descricao: string;
  dados: any;
}

async function checarBar(supabase: any, conta: any): Promise<Alerta[]> {
  const alertas: Alerta[] = [];
  const barId = conta.bar_id;

  // 1) Snapshots últimos 8 dias
  const desde = new Date(Date.now() - 8 * 86400000).toISOString().split('T')[0];
  const { data: snaps } = await supabase.schema('integrations').from('instagram_conta_metricas')
    .select('data_snapshot, followers_count, total_interactions, reach')
    .eq('bar_id', barId).gte('data_snapshot', desde)
    .order('data_snapshot', { ascending: true });

  if (snaps && snaps.length >= 2) {
    const ultimo = snaps[snaps.length - 1];
    const penultimo = snaps[snaps.length - 2];

    // queda_followers > 1%
    const diff = (ultimo.followers_count ?? 0) - (penultimo.followers_count ?? 0);
    const percDiff = penultimo.followers_count ? (diff / penultimo.followers_count) * 100 : 0;
    if (percDiff < -1) {
      alertas.push({
        bar_id: barId, tipo: 'queda_followers', severidade: 'critico',
        titulo: `Perdeu ${Math.abs(diff).toLocaleString('pt-BR')} seguidores em 24h`,
        descricao: `${conta.ig_username}: ${penultimo.followers_count} → ${ultimo.followers_count} (${percDiff.toFixed(2)}%). Investigar conteúdo do dia anterior.`,
        dados: { diff, perc: percDiff, antes: penultimo.followers_count, depois: ultimo.followers_count },
      });
    }

    // pico_engagement: > 3x media 7d (excluindo ontem)
    const interacoesSemana = snaps.slice(0, -1).map((s: any) => s.total_interactions ?? 0);
    const mediaSemana = interacoesSemana.length > 0 ? interacoesSemana.reduce((a: number, b: number) => a + b, 0) / interacoesSemana.length : 0;
    const interacoesHoje = ultimo.total_interactions ?? 0;
    if (mediaSemana > 100 && interacoesHoje > mediaSemana * 3) {
      alertas.push({
        bar_id: barId, tipo: 'pico_engagement', severidade: 'info',
        titulo: `Pico de engajamento (${interacoesHoje.toLocaleString('pt-BR')} interações)`,
        descricao: `${conta.ig_username} teve ${(interacoesHoje / mediaSemana).toFixed(1)}x a média semanal (${Math.round(mediaSemana)}). Algo viralizou — investigar qual post.`,
        dados: { hoje: interacoesHoje, media_7d: mediaSemana },
      });
    }
  }

  // 2) Reclamações 24h
  const ontem = new Date(Date.now() - 86400000).toISOString();
  const { data: dmsReclama } = await supabase.schema('integrations').from('instagram_mensagens')
    .select('id').eq('bar_id', barId).eq('autor', 'cliente').eq('categoria', 'reclamacao')
    .gte('enviada_em', ontem);
  if ((dmsReclama?.length ?? 0) >= 3) {
    alertas.push({
      bar_id: barId, tipo: 'alta_reclamacoes', severidade: 'warn',
      titulo: `${dmsReclama!.length} reclamações via DM em 24h`,
      descricao: `${conta.ig_username}: clientes enviaram ${dmsReclama!.length} mensagens classificadas como reclamação. Abre o inbox pra responder.`,
      dados: { count: dmsReclama!.length },
    });
  }

  // 3) % de DMs negativas
  const { data: dms24h } = await supabase.schema('integrations').from('instagram_mensagens')
    .select('sentimento').eq('bar_id', barId).eq('autor', 'cliente').not('sentimento', 'is', null)
    .gte('enviada_em', ontem);
  const totalCl = dms24h?.length ?? 0;
  const negativas = (dms24h ?? []).filter((m: any) => m.sentimento === 'negativo').length;
  if (totalCl >= 5 && (negativas / totalCl) > 0.30) {
    alertas.push({
      bar_id: barId, tipo: 'sentimento_negativo_alto', severidade: 'warn',
      titulo: `${((negativas / totalCl) * 100).toFixed(0)}% das DMs com sentimento negativo`,
      descricao: `${conta.ig_username}: ${negativas} de ${totalCl} DMs categorizadas como negativas. Pode ter algo ruim circulando.`,
      dados: { negativas, total: totalCl, perc: (negativas / totalCl) * 100 },
    });
  }

  return alertas;
}

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

    const { data: contas } = await supabase.schema('integrations').from('instagram_contas')
      .select('bar_id, ig_username').eq('ativo', true);
    if (!contas?.length) return new Response(JSON.stringify({ success: true, contas: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const todosAlertas: Alerta[] = [];
    for (const conta of contas) {
      const alertas = await checarBar(supabase, conta);
      for (const a of alertas) {
        // Anti-spam: 1 alerta do mesmo tipo por bar por 12h
        const desde = new Date(Date.now() - 12 * 3600000).toISOString();
        const { data: existente } = await supabase.schema('integrations').from('instagram_alertas')
          .select('id').eq('bar_id', a.bar_id).eq('tipo', a.tipo).gte('criado_em', desde).limit(1);
        if (existente && existente.length > 0) continue;

        await supabase.schema('integrations').from('instagram_alertas').insert(a);
        todosAlertas.push(a);
      }
    }

    return new Response(JSON.stringify({ success: true, alertas_disparados: todosAlertas.length, alertas: todosAlertas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
