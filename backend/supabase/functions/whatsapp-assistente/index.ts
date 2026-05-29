/**
 * 💬 WhatsApp Assistente do Sócio (G4)
 *
 * Recebe { telefone, mensagem } e:
 *   1. Verifica whitelist em whatsapp_assistente_socios
 *   2. Detecta bar pela mensagem ou usa default do sócio
 *   3. Monta snapshot rico de dados (vendas, IG, NPS, stockout, previsao)
 *   4. Chama Claude com contexto + pergunta
 *   5. Loga + retorna resposta
 *
 * Quem chama: /api/webhooks/whatsapp-assistente (que recebe do Umbler).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODELO = 'claude-sonnet-4-6';

function normalizeTel(t: string): string {
  return t.replace(/\D/g, '');
}

function detectarBar(msg: string, baresAutorizados: number[]): number {
  const m = msg.toLowerCase();
  if (m.includes('debo') || m.includes('descubra')) return baresAutorizados.includes(4) ? 4 : baresAutorizados[0];
  if (m.includes('ord') || m.includes('ordinar')) return baresAutorizados.includes(3) ? 3 : baresAutorizados[0];
  return baresAutorizados[0];
}

async function snapshotBar(supabase: any, barId: number): Promise<any> {
  const hoje = new Date().toISOString().split('T')[0];
  const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Última semana gold.desempenho
  const { data: desempenho } = await supabase
    .schema('gold').from('desempenho')
    .select('numero_semana, ano, data_inicio, data_fim, faturamento_total, clientes_atendidos, ticket_medio, nps_geral, stockout_total_perc, reservas_quebra_pct, atrasos_comida_perc, atrasos_drinks_perc, cmv_global_real, cmo')
    .eq('bar_id', barId).eq('granularidade', 'semanal')
    .order('data_fim', { ascending: false }).limit(2);

  // Quality score
  const { data: quality } = await supabase
    .schema('gold').from('quality_scorecard')
    .select('score, numero_semana').eq('bar_id', barId)
    .order('numero_semana', { ascending: false }).limit(1).maybeSingle();

  // Previsões próximos 7 dias
  const { data: previsoes } = await supabase
    .schema('gold').from('demanda_previsoes')
    .select('data_evento, fat_previsto, publico_previsto').eq('bar_id', barId)
    .gte('data_evento', hoje).order('data_evento').limit(7);

  // IG snapshot atual
  const { data: ig } = await supabase
    .schema('integrations').from('instagram_conta_metricas')
    .select('data_snapshot, followers_count, reach, profile_views, total_interactions, accounts_engaged')
    .eq('bar_id', barId).order('data_snapshot', { ascending: false }).limit(2);

  // Stockout ontem
  const { data: stockout } = await supabase
    .schema('silver').from('silver_contahub_operacional_stockout_processado')
    .select('incluido, prd_venda').eq('bar_id', barId).eq('data_consulta', ontem);
  const stockoutIncluidos = (stockout ?? []).filter((s: any) => s.incluido).length;
  const stockoutFora = (stockout ?? []).filter((s: any) => s.incluido && s.prd_venda === 'N').length;
  const stockoutPerc = stockoutIncluidos > 0 ? (stockoutFora / stockoutIncluidos * 100).toFixed(2) : 'sem dado';

  return {
    bar_id: barId,
    semana_atual: desempenho?.[0] ?? null,
    semana_anterior: desempenho?.[1] ?? null,
    quality_score: quality?.score ?? null,
    previsoes_proximos_7d: previsoes ?? [],
    instagram: ig?.[0] ?? null,
    stockout_ontem_perc: stockoutPerc,
  };
}

async function chamarClaude(prompt: string): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente');
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELO, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Anthropic: ${await r.text()}`);
  const j = await r.json();
  return { text: j.content?.[0]?.text || '', tokensIn: j.usage?.input_tokens || 0, tokensOut: j.usage?.output_tokens || 0 };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = requireAuth(req);
  if (authError) return authError;

  const t0 = Date.now();
  try {
    const body = await req.json();
    const telefone = normalizeTel(body?.telefone || '');
    const mensagem: string = (body?.mensagem || '').trim();
    if (!telefone || !mensagem) {
      return new Response(JSON.stringify({ erro: 'telefone+mensagem obrigatorios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Whitelist
    const { data: socio } = await supabase.schema('integrations').from('whatsapp_assistente_socios')
      .select('*').eq('telefone', telefone).eq('ativo', true).maybeSingle();

    if (!socio) {
      const resposta = 'Desculpe, este número não está autorizado a usar o Assistente Zykor. Fale com o admin pra ser cadastrado.';
      await supabase.schema('integrations').from('whatsapp_assistente_log').insert({
        telefone, pergunta: mensagem, resposta, tempo_ms: Date.now() - t0,
        erro_msg: 'nao_autorizado',
      });
      return new Response(JSON.stringify({ resposta }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const barId = detectarBar(mensagem, socio.bares_autorizados);
    const { data: bar } = await supabase.schema('operations').from('bares')
      .select('id, nome').eq('id', barId).maybeSingle();

    const snap = await snapshotBar(supabase, barId);

    const prompt = `Você é o **Zykor Assistant**, assistente analítico do sócio **${socio.nome}** dos bares Grupo Menos e Mais.

Bar em análise: **${bar?.nome || `Bar ${barId}`}** (id=${barId})
Data atual: ${new Date().toLocaleDateString('pt-BR')}

DADOS FRESCOS (snapshot agora):
${JSON.stringify(snap, null, 2)}

PERGUNTA DO SÓCIO:
"${mensagem}"

Responda em **português direto e curto** (max 6 linhas), tipo WhatsApp. Use números reais do snapshot. Se faltou dado pra responder, diga que precisa de mais contexto e sugira de que aba do Zykor pegar (/ferramentas/instagram, /estrategico/desempenho, etc). Sem floreio.`;

    const claude = await chamarClaude(prompt);

    await supabase.schema('integrations').from('whatsapp_assistente_log').insert({
      telefone, socio_nome: socio.nome, pergunta: mensagem, resposta: claude.text,
      bar_id_inferido: barId, tokens_input: claude.tokensIn, tokens_output: claude.tokensOut,
      tempo_ms: Date.now() - t0,
    });

    return new Response(JSON.stringify({ success: true, resposta: claude.text, bar_id: barId, tokens: { in: claude.tokensIn, out: claude.tokensOut } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
