/**
 * 🤖 Agente Dispatcher - Dispatcher Unificado para Agentes IA
 * 
 * Centraliza todas as funções de agentes IA em um único endpoint.
 * Reduz duplicação de código e facilita manutenção.
 * 
 * Actions disponíveis:
 * - analise-diaria: Análise diária com IA (versão básica)
 * - analise-diaria-v2: Análise diária automática com tool-use (versão avançada)
 * - analise-semanal: Análise semanal com IA
 * - analise-mensal: Análise mensal com IA
 * - metas: Relatório de metas
 * - comparacao: Comparação entre períodos
 * - treinamento: Geração de FAQ/tutoriais
 * - auditor: Auditoria de dados
 * - chat: Chat SQL interativo
 * - chat-v2: Chat com tool-use
 * - custos: Análise de CMV
 * - padroes: Detecção de padrões
 * - sql-expert: Consultas SQL avançadas
 * - planejamento: Simulações e planejamento
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';
import { 
  createGeminiClient, 
  getGeminiModel, 
  generateGeminiResponse,
  generateWithTools 
} from '../_shared/gemini-client.ts';
import { AGENT_TOOLS, createToolExecutor } from '../_shared/agent-tools.ts';
import { 
  sendDiscordEmbed, 
  createInfoEmbed,
  createErrorEmbed,
  DiscordColors,
  getDiscordWebhookFromDb
} from '../_shared/discord-notifier.ts';
import { 
  buscarEventosPeriodo,
  buscarEventosMes,
  buscarEventosSemana,
  calcularMetricasAgregadas 
} from '../_shared/eventos-data.ts';
import { 
  formatarMoeda, 
  formatarPercentual,
  formatarData,
  formatarDiaSemana 
} from '../_shared/formatters.ts';
import { 
  calcularTendencia,
  calcularMedia,
  compararPeriodos 
} from '../_shared/tendency-calculator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DispatcherRequest {
  action: string;
  bar_id?: number;
  data?: string;
  data_inicio?: string;
  data_fim?: string;
  semana?: number;
  mes?: number;
  ano?: number;
  params?: Record<string, any>;
}

/**
 * Handler principal do dispatcher
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: DispatcherRequest = await req.json();
    const { action, bar_id = 3 } = body;

    console.log(`🤖 Agente Dispatcher - Action: ${action}`);

    const hbResult = await heartbeatStart(supabase, 'agente-dispatcher', bar_id, action, 'pgcron');
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;

    let resultado;

    switch (action) {
      case 'analise-diaria':
        resultado = await analiseDiaria(supabase, bar_id, body.data);
        break;
      
      case 'analise-semanal':
        resultado = await analiseSemanal(supabase, bar_id, body.semana, body.ano);
        break;
      
      case 'analise-mensal':
        resultado = await analiseMensal(supabase, bar_id, body.mes, body.ano);
        break;
      
      case 'metas':
        resultado = await relatorioMetas(supabase, bar_id, body.semana, body.ano);
        break;
      
      case 'comparacao':
        resultado = await comparacaoPeriodos(supabase, bar_id, body.params);
        break;
      
      case 'treinamento':
        resultado = await gerarTreinamento(supabase, bar_id, body.params);
        break;
      
      case 'auditor':
        resultado = await auditarDados(supabase, bar_id, body.params);
        break;
      
      case 'chat':
        resultado = await chatSQL(supabase, bar_id, body.params);
        break;
      
      case 'custos':
        resultado = await analiseCustos(supabase, bar_id, body.data_inicio, body.data_fim);
        break;
      
      case 'padroes':
        resultado = await detectarPadroes(supabase, bar_id, body.data_inicio, body.data_fim);
        break;
      
      case 'sql-expert':
        resultado = await sqlExpert(supabase, bar_id, body.params);
        break;
      
      case 'planejamento':
        resultado = await simularPlanejamento(supabase, bar_id, body.params);
        break;
      
      case 'chat-v2': {
        const { mensagem, historico } = body.params || {};
        
        if (!mensagem) {
          throw new Error('Parâmetro "mensagem" é obrigatório para chat-v2');
        }

        const systemPrompt = `Você é o assistente de inteligência do Zykor, sistema de gestão de bares.
Você tem acesso a ferramentas para consultar dados reais do bar. USE as ferramentas para buscar dados antes de responder.

Regras:
- SEMPRE use ferramentas para buscar dados antes de responder sobre métricas
- Responda em português do Brasil
- Seja direto e objetivo
- Use formatação markdown
- Valores monetários em R$ com 2 decimais
- Quando comparar períodos, calcule variações percentuais
- Se o usuário perguntar algo que não tem ferramenta, diga o que você pode consultar

Você também pode AGIR além de consultar:
- criar_alerta: para sinalizar problemas ou oportunidades ao time
- disparar_recalculo_desempenho: se dados parecem inconsistentes
- enviar_notificacao_discord: para enviar insights urgentes ao time
- registrar_insight: para salvar padrões detectados para consulta futura

Regras de ação:
- Use ações com moderação — só quando realmente relevante
- NUNCA dispare recálculo a menos que detecte inconsistência real nos dados
- Crie alertas apenas para anomalias significativas (>20% de variação)
- Registre insights quando encontrar padrões que valem documentar

Data de hoje: ${new Date().toISOString().split('T')[0]}
Bar ID: ${bar_id}`;

        const fullPrompt = historico
          ? `${systemPrompt}\n\nHistórico:\n${historico}\n\nUsuário: ${mensagem}`
          : `${systemPrompt}\n\nUsuário: ${mensagem}`;

        const executor = createToolExecutor(supabase, bar_id);

        const resposta = await generateWithTools(
          fullPrompt,
          AGENT_TOOLS,
          executor,
          { temperature: 0.3, maxOutputTokens: 2048 }
        );

        resultado = { success: true, response: resposta };
        break;
      }

      case 'analise-diaria-v2': {
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        const dataOntem = ontem.toISOString().split('T')[0];

        const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const diaSemana = diasSemana[ontem.getDay()];

        const dataSemanaPassada = new Date(ontem.getTime() - 7 * 86400000).toISOString().split('T')[0];
        const dataDuasSemanasAtras = new Date(ontem.getTime() - 14 * 86400000).toISOString().split('T')[0];

        const systemPrompt = `Você é o analista de inteligência do Zykor, sistema de gestão de bares.
Sua tarefa: analisar o desempenho completo do dia ${dataOntem} (${diaSemana}).

INSTRUÇÕES:
1. Use consultar_faturamento para buscar dados de ontem
2. Use comparar_periodos para comparar ontem com:
   - Mesmo dia da semana passada (${dataSemanaPassada})
   - Mesmo dia há 2 semanas (${dataDuasSemanasAtras})
3. Use consultar_cmv para ver CMV recente
4. Use consultar_tendencia para ver tendência de 4 semanas
5. Use consultar_mix_vendas para ver mix do dia
6. Use consultar_tempos_producao para ver tempos de ontem
7. Use consultar_estoque para ver rupturas de ontem

FORMATO DA RESPOSTA (markdown):
## 📊 Relatório Diário — ${dataOntem} (${diaSemana})

### Faturamento
- Valor total, comparação com semana anterior (% variação)
- Público total, ticket médio

### Comparativo
- vs mesmo dia semana passada: +/- X%
- vs mesmo dia há 2 semanas: +/- X%
- Tendência: subindo/caindo/estável

### Operacional
- Mix: X% bebida, Y% drink, Z% comida
- Tempos: bar Xmin, cozinha Ymin
- Rupturas: listar top 3 se houver

### Anomalias
- Listar APENAS se algo estiver fora do padrão (>20% variação)
- Faturamento muito acima/abaixo do esperado
- CMV alto (>40%)
- Muitos atrasos

### Recomendações
- 1-3 ações concretas baseadas nos dados
- Ser específico (não genérico)

Data de hoje: ${new Date().toISOString().split('T')[0]}
Bar ID: ${bar_id}`;

        const executor = createToolExecutor(supabase, bar_id);

        const resposta = await generateWithTools(
          systemPrompt,
          AGENT_TOOLS,
          executor,
          { temperature: 0.3, maxOutputTokens: 3000 }
        );

        const webhookUrl = await getDiscordWebhookFromDb(supabase, 'agentes', bar_id);

        if (webhookUrl) {
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                embeds: [{
                  title: `📊 Relatório Diário — ${dataOntem} (${diaSemana})`,
                  description: resposta.substring(0, 4000),
                  color: 0x0099ff,
                  timestamp: new Date().toISOString(),
                  footer: { text: `Zykor AI Agent | Bar ${bar_id}` }
                }]
              })
            });
          } catch (discordError) {
            console.error('❌ Erro ao enviar para Discord:', discordError);
          }
        }

        await supabase.from('agente_insights').insert({
          bar_id,
          tipo: 'analise_diaria',
          categoria: 'relatorio',
          titulo: `Relatório Diário — ${dataOntem} (${diaSemana})`,
          descricao: resposta,
          dados_suporte: { 
            data_referencia: dataOntem,
            dia_semana: diaSemana,
            comparacoes: [dataSemanaPassada, dataDuasSemanasAtras]
          },
          created_at: new Date().toISOString()
        });

        resultado = { success: true, response: resposta, sent_to_discord: !!webhookUrl };
        break;
      }
      
      default:
        throw new Error(`Action não reconhecida: ${action}`);
    }

    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, 1, { action });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        data: resultado,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no agente dispatcher:', error);
    await heartbeatError(supabase, heartbeatId, startTime, error instanceof Error ? error : String(error));
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Análise Diária com IA
 */
async function analiseDiaria(supabase: any, barId: number, data?: string) {
  const dataAnalise = data || new Date().toISOString().split('T')[0];
  
  console.log(`📊 Análise diária para ${dataAnalise}`);
  
  // Buscar dados do evento
  const eventos = await buscarEventosPeriodo(supabase, barId, dataAnalise, dataAnalise);
  
  if (eventos.length === 0) {
    throw new Error(`Nenhum evento encontrado para ${dataAnalise}`);
  }
  
  const evento = eventos[0];
  
  // Buscar contexto histórico (últimas 4 semanas, mesmo dia da semana)
  const dataObj = new Date(dataAnalise + 'T00:00:00');
  const diaSemana = dataObj.getDay();
  
  const dataInicio = new Date(dataObj);
  dataInicio.setDate(dataInicio.getDate() - 28);
  
  const historico = await buscarEventosPeriodo(
    supabase, 
    barId, 
    dataInicio.toISOString().split('T')[0],
    dataAnalise
  );
  
  const mesmosDias = historico.filter(e => {
    const d = new Date(e.data_evento + 'T00:00:00');
    return d.getDay() === diaSemana;
  });
  
  const mediaHistorica = calcularMedia(mesmosDias.map(e => e.real_r || 0));
  const tendencia = calcularTendencia(mesmosDias.map(e => e.real_r || 0));
  
  // Gerar análise com IA
  const prompt = `
Analise o desempenho do evento de ${formatarData(dataAnalise)} (${formatarDiaSemana(dataAnalise)}):

**DADOS DO DIA:**
- Faturamento: ${formatarMoeda(evento.real_r)}
- Público: ${evento.cl_real} pessoas
- Ticket Médio: ${formatarMoeda(evento.t_medio)}
- CMV: ${formatarPercentual(evento.cmv_percentual)}

**CONTEXTO HISTÓRICO (últimas 4 semanas, mesmos dias):**
- Média histórica: ${formatarMoeda(mediaHistorica)}
- Tendência: ${tendencia.descricao} (${formatarPercentual(tendencia.percentual)})
- Variação vs média: ${formatarPercentual(((evento.real_r || 0) / mediaHistorica - 1) * 100)}

Forneça uma análise concisa (máx 200 palavras) com:
1. Avaliação do desempenho (acima/abaixo do esperado)
2. Principais destaques positivos
3. Pontos de atenção
4. Recomendação para próximos eventos similares
`;

  const analise = await generateGeminiResponse(prompt, { temperature: 0.7, maxOutputTokens: 500 });
  
  // Enviar para Discord
  await sendDiscordEmbed(
    {
      title: `📊 Análise Diária - ${formatarData(dataAnalise)}`,
      description: analise,
      color: DiscordColors.INFO,
      fields: [
        { name: '💰 Faturamento', value: formatarMoeda(evento.real_r), inline: true },
        { name: '👥 Público', value: String(evento.cl_real), inline: true },
        { name: '🎫 Ticket Médio', value: formatarMoeda(evento.t_medio), inline: true },
      ],
      timestamp: new Date().toISOString(),
    },
    'agentes'
  );
  
  return {
    data: dataAnalise,
    evento,
    contexto: {
      mediaHistorica,
      tendencia: tendencia.descricao,
      variacaoVsMedia: ((evento.real_r || 0) / mediaHistorica - 1) * 100,
    },
    analise,
  };
}

/**
 * Análise Semanal com IA
 */
async function analiseSemanal(supabase: any, barId: number, semana?: number, ano?: number) {
  const hoje = new Date();
  const semanaAnalise = semana || Math.ceil((hoje.getDate() + hoje.getDay()) / 7);
  const anoAnalise = ano || hoje.getFullYear();
  
  console.log(`📊 Análise semanal - Semana ${semanaAnalise}/${anoAnalise}`);
  
  const eventos = await buscarEventosSemana(supabase, barId, semanaAnalise, anoAnalise);
  
  if (eventos.length === 0) {
    throw new Error(`Nenhum evento encontrado para semana ${semanaAnalise}/${anoAnalise}`);
  }
  
  const metricas = calcularMetricasAgregadas(eventos);
  
  // Comparar com semana anterior
  const semanaAnterior = await buscarEventosSemana(supabase, barId, semanaAnalise - 1, anoAnalise);
  const metricasAnterior = calcularMetricasAgregadas(semanaAnterior);
  
  const comparacao = compararPeriodos(
    semanaAnterior.map(e => e.real_r || 0),
    eventos.map(e => e.real_r || 0)
  );
  
  const prompt = `
Analise o desempenho da semana ${semanaAnalise}/${anoAnalise}:

**DESEMPENHO DA SEMANA:**
- Total de eventos: ${metricas.totalEventos}
- Faturamento total: ${formatarMoeda(metricas.totalReceita)}
- Público total: ${metricas.totalClientes} pessoas
- Ticket médio: ${formatarMoeda(metricas.ticketMedio)}
- CMV médio: ${formatarPercentual(metricas.cmvMedio)}

**COMPARAÇÃO COM SEMANA ANTERIOR:**
- Variação faturamento: ${formatarPercentual(comparacao.variacaoMedia)}
- Status: ${comparacao.descricao}

Forneça uma análise executiva (máx 250 palavras) com:
1. Resumo do desempenho semanal
2. Comparação com semana anterior
3. Eventos destaque (melhores e piores)
4. Recomendações estratégicas para próxima semana
`;

  const analise = await generateGeminiResponse(prompt, { temperature: 0.7, maxOutputTokens: 600 });
  
  await sendDiscordEmbed(
    {
      title: `📊 Análise Semanal - Semana ${semanaAnalise}/${anoAnalise}`,
      description: analise,
      color: DiscordColors.PURPLE,
      fields: [
        { name: '💰 Faturamento', value: formatarMoeda(metricas.totalReceita), inline: true },
        { name: '👥 Público', value: String(metricas.totalClientes), inline: true },
        { name: '📈 vs Semana Anterior', value: formatarPercentual(comparacao.variacaoMedia), inline: true },
      ],
      timestamp: new Date().toISOString(),
    },
    'agentes'
  );
  
  return {
    semana: semanaAnalise,
    ano: anoAnalise,
    metricas,
    comparacao,
    analise,
  };
}

/**
 * Análise Mensal com IA
 */
async function analiseMensal(supabase: any, barId: number, mes?: number, ano?: number) {
  const hoje = new Date();
  const mesAnalise = mes || hoje.getMonth() + 1;
  const anoAnalise = ano || hoje.getFullYear();
  
  console.log(`📊 Análise mensal - ${mesAnalise}/${anoAnalise}`);
  
  const eventos = await buscarEventosMes(supabase, barId, mesAnalise, anoAnalise);
  
  if (eventos.length === 0) {
    throw new Error(`Nenhum evento encontrado para ${mesAnalise}/${anoAnalise}`);
  }
  
  const metricas = calcularMetricasAgregadas(eventos);
  
  const prompt = `
Analise o desempenho mensal de ${mesAnalise}/${anoAnalise}:

**RESUMO DO MÊS:**
- Total de eventos: ${metricas.totalEventos}
- Faturamento total: ${formatarMoeda(metricas.totalReceita)}
- Faturamento médio por evento: ${formatarMoeda(metricas.receitaMedia)}
- Público total: ${metricas.totalClientes} pessoas
- Ticket médio geral: ${formatarMoeda(metricas.ticketMedio)}
- CMV médio: ${formatarPercentual(metricas.cmvMedio)}

Forneça uma análise estratégica (máx 300 palavras) com:
1. Avaliação geral do mês
2. Tendências identificadas
3. Eventos destaque (top 3 melhores e 3 piores)
4. Insights para planejamento do próximo mês
5. Recomendações de melhorias
`;

  const analise = await generateGeminiResponse(prompt, { temperature: 0.7, maxOutputTokens: 700 });
  
  await sendDiscordEmbed(
    {
      title: `📊 Análise Mensal - ${mesAnalise}/${anoAnalise}`,
      description: analise,
      color: DiscordColors.GOLD,
      fields: [
        { name: '🎉 Total Eventos', value: String(metricas.totalEventos), inline: true },
        { name: '💰 Faturamento', value: formatarMoeda(metricas.totalReceita), inline: true },
        { name: '👥 Público', value: String(metricas.totalClientes), inline: true },
      ],
      timestamp: new Date().toISOString(),
    },
    'agentes'
  );
  
  return {
    mes: mesAnalise,
    ano: anoAnalise,
    metricas,
    analise,
  };
}

/**
 * Relatório de Metas
 */
async function relatorioMetas(supabase: any, barId: number, semana?: number, ano?: number) {
  console.log('🎯 Gerando relatório de metas');
  
  // Buscar metas configuradas
  const { data: metas } = await supabase
    .from('metas')
    .select('*')
    .eq('bar_id', barId)
    .eq('ativo', true);
  
  // Buscar desempenho real
  const eventos = semana && ano 
    ? await buscarEventosSemana(supabase, barId, semana, ano)
    : await buscarEventosMes(supabase, barId, new Date().getMonth() + 1, new Date().getFullYear());
  
  const metricas = calcularMetricasAgregadas(eventos);
  
  return {
    metas: metas || [],
    realizado: metricas,
    atingimento: metas?.map((meta: any) => ({
      nome: meta.nome,
      meta: meta.valor,
      realizado: metricas.totalReceita,
      percentual: (metricas.totalReceita / meta.valor) * 100,
    })) || [],
  };
}

/**
 * Comparação entre períodos
 */
async function comparacaoPeriodos(supabase: any, barId: number, params: any) {
  console.log('📊 Comparando períodos');
  
  const { periodo1_inicio, periodo1_fim, periodo2_inicio, periodo2_fim } = params;
  
  const eventos1 = await buscarEventosPeriodo(supabase, barId, periodo1_inicio, periodo1_fim);
  const eventos2 = await buscarEventosPeriodo(supabase, barId, periodo2_inicio, periodo2_fim);
  
  const comparacao = compararPeriodos(
    eventos1.map(e => e.real_r || 0),
    eventos2.map(e => e.real_r || 0)
  );
  
  return {
    periodo1: calcularMetricasAgregadas(eventos1),
    periodo2: calcularMetricasAgregadas(eventos2),
    comparacao,
  };
}

/**
 * Gerar conteúdo de treinamento
 */
async function gerarTreinamento(supabase: any, barId: number, params: any) {
  console.log('📚 Gerando conteúdo de treinamento');
  
  const { topico } = params;
  
  const prompt = `
Crie um conteúdo de treinamento sobre: ${topico}

O conteúdo deve ser prático e direto, focado em operação de bares/casas noturnas.
Inclua:
1. Conceito principal
2. Passo a passo prático
3. Dicas importantes
4. Erros comuns a evitar

Máximo 400 palavras.
`;

  const conteudo = await generateGeminiResponse(prompt, { temperature: 0.8, maxOutputTokens: 800 });
  
  return { topico, conteudo };
}

/**
 * Auditar dados
 */
async function auditarDados(supabase: any, barId: number, params: any) {
  console.log('🔍 Auditando dados');
  
  const { data_inicio, data_fim } = params;
  
  const eventos = await buscarEventosPeriodo(supabase, barId, data_inicio, data_fim);
  
  const problemas = [];
  
  for (const evento of eventos) {
    if (!evento.real_r || evento.real_r === 0) {
      problemas.push({ data: evento.data_evento, problema: 'Faturamento zerado ou nulo' });
    }
    if (!evento.cl_real || evento.cl_real === 0) {
      problemas.push({ data: evento.data_evento, problema: 'Público zerado ou nulo' });
    }
    if (evento.cmv_percentual && evento.cmv_percentual > 50) {
      problemas.push({ data: evento.data_evento, problema: `CMV alto: ${evento.cmv_percentual}%` });
    }
  }
  
  return {
    total_eventos: eventos.length,
    problemas_encontrados: problemas.length,
    problemas,
  };
}

/**
 * Chat SQL interativo
 */
async function chatSQL(supabase: any, barId: number, params: any) {
  console.log('💬 Chat SQL');
  
  const { pergunta } = params;
  
  const prompt = `
Você é um assistente SQL especializado em análise de dados de bares/casas noturnas.

Pergunta do usuário: ${pergunta}

Gere uma consulta SQL apropriada para responder a pergunta.
Considere as tabelas: eventos_base, contahub_analitico, yuzer_produtos, sympla_pedidos.

Retorne apenas o SQL, sem explicações.
`;

  const sql = await generateGeminiResponse(prompt, { temperature: 0.3, maxOutputTokens: 300 });
  
  return { pergunta, sql_gerado: sql };
}

/**
 * Análise de custos/CMV
 */
async function analiseCustos(supabase: any, barId: number, dataInicio?: string, dataFim?: string) {
  console.log('💰 Analisando custos');
  
  const inicio = dataInicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fim = dataFim || new Date().toISOString().split('T')[0];
  
  const eventos = await buscarEventosPeriodo(supabase, barId, inicio, fim);
  
  const cmvMedio = calcularMedia(eventos.map(e => e.cmv_percentual || 0));
  const tendenciaCMV = calcularTendencia(eventos.map(e => e.cmv_percentual || 0));
  
  return {
    periodo: { inicio, fim },
    total_eventos: eventos.length,
    cmv_medio: cmvMedio,
    tendencia: tendenciaCMV,
    eventos_alto_cmv: eventos.filter(e => (e.cmv_percentual || 0) > 35).length,
  };
}

/**
 * Detectar padrões
 */
async function detectarPadroes(supabase: any, barId: number, dataInicio?: string, dataFim?: string) {
  console.log('🔍 Detectando padrões');
  
  const inicio = dataInicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fim = dataFim || new Date().toISOString().split('T')[0];
  
  const eventos = await buscarEventosPeriodo(supabase, barId, inicio, fim);
  
  // Agrupar por dia da semana
  const porDiaSemana: Record<number, number[]> = {};
  
  for (const evento of eventos) {
    const dia = new Date(evento.data_evento + 'T00:00:00').getDay();
    if (!porDiaSemana[dia]) porDiaSemana[dia] = [];
    porDiaSemana[dia].push(evento.real_r || 0);
  }
  
  const padroes = Object.entries(porDiaSemana).map(([dia, valores]) => ({
    dia_semana: formatarDiaSemana(new Date(2026, 0, parseInt(dia) + 4).toISOString()),
    media: calcularMedia(valores),
    eventos: valores.length,
  }));
  
  return {
    periodo: { inicio, fim },
    padroes_por_dia: padroes.sort((a, b) => b.media - a.media),
  };
}

/**
 * SQL Expert - consultas avançadas
 */
async function sqlExpert(supabase: any, barId: number, params: any) {
  console.log('🎓 SQL Expert');
  
  const { consulta } = params;
  
  // Executar consulta (com segurança)
  const { data, error } = await supabase.rpc('execute_safe_query', {
    query: consulta,
    bar_id: barId,
  });
  
  if (error) {
    throw new Error(`Erro na consulta: ${error.message}`);
  }
  
  return { resultado: data };
}

/**
 * Simulação e planejamento
 */
async function simularPlanejamento(supabase: any, barId: number, params: any) {
  console.log('📊 Simulando planejamento');
  
  const { cenario, parametros } = params;
  
  const prompt = `
Simule um cenário de planejamento para um bar:

Cenário: ${cenario}
Parâmetros: ${JSON.stringify(parametros)}

Forneça:
1. Projeção de faturamento
2. Estimativa de público
3. Custos estimados
4. Margem esperada
5. Recomendações

Máximo 300 palavras.
`;

  const simulacao = await generateGeminiResponse(prompt, { temperature: 0.7, maxOutputTokens: 600 });
  
  return { cenario, simulacao };
}
