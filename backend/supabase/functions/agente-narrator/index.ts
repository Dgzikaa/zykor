/**
 * @camada ops
 * @jobName agente-narrator
 * @descricao AI V2 narrator
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
/**
 * 📖 NARRATOR LLM - Agent V2
 * 
 * Gera insights acionáveis usando LLM (Gemini) a partir de eventos detectados.
 * Transforma eventos técnicos em narrativas compreensíveis com ações recomendadas.
 * 
 * Fluxo:
 * 1. Recebe { bar_id, data?, eventos? }
 * 2. Se eventos não vier, busca insight_events (processed=false)
 * 3. Monta prompt com system + eventos + contexto
 * 4. Chama Gemini para gerar insights
 * 5. Salva insights em agent_insights_v2
 * 6. Marca eventos como processed=true
 * 7. Retorna insights gerados
 * 
 * @version 1.0.0
 * @date 2026-04-01
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, errorResponse, handleCorsOptions } from '../_shared/cors.ts';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';
import { generateGeminiResponse, extractJsonFromGemini } from '../_shared/gemini-client.ts';
import { formatDateISO, daysAgo } from '../_shared/date-helpers.ts';

// ============================================================
// TIPOS
// ============================================================

interface NarratorRequest {
  bar_id: number;
  data?: string;
  eventos?: InsightEvent[];
}

interface InsightEvent {
  id: string;
  event_type: string;
  severity: string;
  evidence_json: string[];
  data: string;
}

interface InsightGerado {
  titulo: string;
  severidade: 'baixa' | 'media' | 'alta';
  tipo: 'problema' | 'oportunidade';
  descricao: string;
  causa_provavel: string;
  acoes_recomendadas: string[];
}

interface NarratorResponse {
  insights: InsightGerado[];
  resumo_geral: string;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `Você é um agente de inteligência operacional do sistema Zykor, responsável por analisar
eventos detectados em um bar (gastrobar + balada) e gerar insights acionáveis para os sócios.

Seu objetivo NÃO é apenas descrever dados. Seu objetivo é:
- detectar problemas
- identificar oportunidades
- explicar causas prováveis
- sugerir ações práticas e executáveis

Você deve agir como um analista sênior de operações + financeiro + growth.

CONTEXTO: Bar com horário 15h-05h. Receita: vendas, couvert, reservas.
Custos: produção artística, equipe, insumos, operação.

REGRAS:
- NÃO seja genérico
- NÃO repita dados sem análise
- NÃO use linguagem vaga
- COMPARE com histórico
- APONTE desvios relevantes
- SUGIRA ações concretas
- PRIORIZE o que importa
- Se não houver problema, identifique oportunidades

RESPONDA SEMPRE em JSON válido:
{
  "insights": [
    {
      "titulo": "",
      "severidade": "baixa | media | alta",
      "tipo": "problema | oportunidade",
      "descricao": "",
      "causa_provavel": "",
      "acoes_recomendadas": ["", ""]
    }
  ],
  "resumo_geral": ""
}`;

// ============================================================
// FUNÇÕES DE BUSCA
// ============================================================

async function buscarEventosNaoProcessados(
  supabase: any,
  barId: number,
  data: string
): Promise<InsightEvent[]> {
  const { data: eventos, error } = await supabase
    .from('insight_events')
    .select('*')
    .eq('bar_id', barId)
    .eq('data', data)
    .eq('processed', false)
    .order('severity', { ascending: false });

  if (error) {
    console.error('❌ Erro ao buscar eventos:', error);
    throw new Error(`Erro ao buscar eventos: ${error.message}`);
  }

  return (eventos || []) as InsightEvent[];
}

async function buscarContextoDia(
  supabase: any,
  barId: number,
  data: string
): Promise<Record<string, any>> {
  const { data: evento } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('bar_id', barId)
    .eq('data_evento', data)
    .maybeSingle();

  const { data: barConfig } = await supabase
    .from('bares_config')
    .select('bar_id, nome_bar')
    .eq('bar_id', barId)
    .maybeSingle();

  return {
    evento: evento || {},
    bar: barConfig || { bar_id: barId, nome_bar: 'Bar' },
  };
}

// ============================================================
// GERAÇÃO DE INSIGHTS COM LLM
// ============================================================

async function gerarInsightsComLLM(
  eventos: InsightEvent[],
  contexto: Record<string, any>
): Promise<NarratorResponse> {
  const eventosFormatados = eventos.map(e => ({
    tipo: e.event_type,
    severidade: e.severity,
    evidencias: e.evidence_json,
  }));

  const userPrompt = `
EVENTOS DETECTADOS (${eventos.length}):
${JSON.stringify(eventosFormatados, null, 2)}

CONTEXTO DO DIA:
- Bar: ${contexto.bar?.nome_bar || 'N/A'}
- Data: ${eventos[0]?.data || 'N/A'}
- Faturamento: R$ ${contexto.evento?.real_r?.toFixed(2) || 'N/A'}
- Clientes: ${contexto.evento?.cl_real || 'N/A'}
- Ticket Médio: R$ ${contexto.evento?.t_medio?.toFixed(2) || 'N/A'}
- Atração: ${contexto.evento?.atracao || 'N/A'}

Analise os eventos detectados e gere insights acionáveis em JSON.
`;

  const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

  console.log('🤖 Chamando Gemini para gerar insights...');
  
  const response = await generateGeminiResponse(fullPrompt, {
    model: 'gemini-2.0-flash-exp',
    temperature: 0.3,
    maxOutputTokens: 2048,
  });

  console.log('📝 Resposta do Gemini recebida');

  const parsed = extractJsonFromGemini<NarratorResponse>(response);
  
  if (!parsed.insights || !Array.isArray(parsed.insights)) {
    throw new Error('Resposta do Gemini não contém array de insights');
  }

  return parsed;
}

// ============================================================
// SALVAR INSIGHTS NO BANCO
// ============================================================

async function salvarInsights(
  supabase: any,
  barId: number,
  data: string,
  narratorResponse: NarratorResponse,
  eventosIds: string[]
): Promise<number> {
  let salvos = 0;

  for (const insight of narratorResponse.insights) {
    const { error } = await supabase
      .from('agent_insights_v2')
      .insert({
        bar_id: barId,
        data,
        titulo: insight.titulo,
        descricao: insight.descricao,
        severidade: insight.severidade,
        tipo: insight.tipo,
        causa_provavel: insight.causa_provavel || null,
        acoes_recomendadas: insight.acoes_recomendadas || [],
        eventos_relacionados: eventosIds,
        resumo_geral: narratorResponse.resumo_geral,
        source: 'zykor_agent',
        visualizado: false,
        arquivado: false,
      });

    if (error) {
      console.error(`❌ Erro ao salvar insight "${insight.titulo}":`, error);
    } else {
      salvos++;
      console.log(`✅ Insight salvo: ${insight.titulo} (${insight.severidade})`);
    }
  }

  return salvos;
}

async function marcarEventosProcessados(
  supabase: any,
  eventosIds: string[]
): Promise<void> {
  if (eventosIds.length === 0) return;

  const { error } = await supabase
    .from('insight_events')
    .update({ processed: true })
    .in('id', eventosIds);

  if (error) {
    console.error('❌ Erro ao marcar eventos como processados:', error);
  } else {
    console.log(`✅ ${eventosIds.length} eventos marcados como processados`);
  }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();
  let barIdForError: number | undefined;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({})) as NarratorRequest;
    const { bar_id, data, eventos: eventosInput } = body;

    if (!bar_id) {
      return errorResponse('bar_id é obrigatório', null, 400);
    }

    barIdForError = bar_id;

    const hbResult = await heartbeatStart(supabase, 'agente-narrator', bar_id, 'narrate', 'api');
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;

    const dataAnalise = data || formatDateISO(daysAgo(1));
    console.log(`📖 Iniciando narrator para bar_id=${bar_id}, data=${dataAnalise}`);

    let eventos: InsightEvent[];
    if (eventosInput && eventosInput.length > 0) {
      eventos = eventosInput;
      console.log(`📥 Usando ${eventos.length} eventos fornecidos no request`);
    } else {
      eventos = await buscarEventosNaoProcessados(supabase, bar_id, dataAnalise);
      console.log(`📥 Buscados ${eventos.length} eventos não processados do banco`);
    }

    if (eventos.length === 0) {
      await heartbeatEnd(supabase, heartbeatId, 'success', startTime, 0, {
        mensagem: 'Sem eventos para processar',
        data: dataAnalise,
      });
      return jsonResponse({
        success: true,
        insights: [],
        resumo_geral: 'Sem anomalias detectadas.',
        eventos_processados: 0,
      });
    }

    const contexto = await buscarContextoDia(supabase, bar_id, dataAnalise);
    console.log(`📊 Contexto carregado: bar=${contexto.bar?.nome_bar}, faturamento=R$ ${contexto.evento?.real_r?.toFixed(2) || 'N/A'}`);

    const narratorResponse = await gerarInsightsComLLM(eventos, contexto);
    console.log(`💡 ${narratorResponse.insights.length} insights gerados pelo LLM`);

    const eventosIds = eventos.map(e => e.id);
    const insightsSalvos = await salvarInsights(
      supabase,
      bar_id,
      dataAnalise,
      narratorResponse,
      eventosIds
    );

    await marcarEventosProcessados(supabase, eventosIds);

    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, insightsSalvos, {
      eventos_processados: eventos.length,
      insights_gerados: narratorResponse.insights.length,
      insights_salvos: insightsSalvos,
      data_analise: dataAnalise,
    });

    return jsonResponse({
      success: true,
      data_analise: dataAnalise,
      eventos_processados: eventos.length,
      insights_gerados: narratorResponse.insights.length,
      insights_salvos: insightsSalvos,
      insights: narratorResponse.insights,
      resumo_geral: narratorResponse.resumo_geral,
    });

  } catch (error) {
    console.error('❌ Erro no narrator:', error);
    await heartbeatError(supabase, heartbeatId, startTime, error as Error, {}, 'agente-narrator', barIdForError);
    return errorResponse('Erro ao executar narrator', error, 500);
  }
});
