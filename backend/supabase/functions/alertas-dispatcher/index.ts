/**
 * 🚨 Alertas Dispatcher - Dispatcher Unificado para Sistema de Alertas
 * 
 * Centraliza todas as funções de alertas em um único endpoint.
 * 
 * Actions disponíveis:
 * - processar_pendentes: Processa alertas pendentes na fila
 * - relatorio_matinal: Envia relatório matinal diário
 * - analisar: Análise completa com IA (alertas-inteligentes)
 * - proativos: Análises rápidas proativas
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  sendDiscordEmbed,
  sendDiscordEmbeds,
  createSuccessEmbed,
  createWarningEmbed,
  createErrorEmbed,
  createInfoEmbed,
  DiscordColors,
  formatCurrency,
  formatPercentage
} from '../_shared/discord-notifier.ts';
import { 
  buscarEventosPeriodo,
  buscarEventosMes,
  calcularMetricasAgregadas 
} from '../_shared/eventos-data.ts';
import { 
  formatarMoeda,
  formatarPercentual,
  formatarData,
  pluralizar
} from '../_shared/formatters.ts';
import { generateGeminiResponse } from '../_shared/gemini-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DispatcherRequest {
  action: string;
  bar_id?: number;
  data?: string;
  params?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: DispatcherRequest = await req.json();
    const { action, bar_id = 3 } = body;

    console.log(`🚨 Alertas Dispatcher - Action: ${action}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let resultado;

    switch (action) {
      case 'processar_pendentes':
        resultado = await processarAlertasPendentes(supabase, bar_id);
        break;
      
      case 'relatorio_matinal':
        resultado = await relatorioMatinal(supabase, bar_id);
        break;
      
      case 'analisar':
        resultado = await alertasInteligentes(supabase, bar_id, body.params);
        break;
      
      case 'proativos':
        resultado = await alertasProativos(supabase, bar_id);
        break;
      
      default:
        throw new Error(`Action não reconhecida: ${action}`);
    }

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
    console.error('❌ Erro no alertas dispatcher:', error);
    
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
 * Processar alertas pendentes na fila
 */
async function processarAlertasPendentes(supabase: any, barId: number) {
  console.log('📬 Processando alertas pendentes');
  
  const { data: alertas, error } = await supabase
    .from('alertas_enviados')
    .select('*')
    .eq('bar_id', barId)
    .eq('enviado_discord', false)
    .order('criado_em', { ascending: true })
    .limit(10);

  if (error || !alertas || alertas.length === 0) {
    console.log('✅ Nenhum alerta pendente');
    return { alertas_enviados: 0 };
  }

  const { data: webhook } = await supabase
    .from('discord_webhooks')
    .select('webhook_url')
    .eq('bar_id', barId)
    .eq('tipo', 'alertas')
    .eq('ativo', true)
    .single();

  if (!webhook?.webhook_url) {
    throw new Error('Webhook de alertas não configurado');
  }

  let enviados = 0;

  for (const alerta of alertas) {
    const colorMap: Record<string, number> = {
      critico: DiscordColors.ERROR,
      erro: 0xff6600,
      aviso: DiscordColors.WARNING,
      info: DiscordColors.INFO,
      sucesso: DiscordColors.SUCCESS,
    };

    const emojiMap: Record<string, string> = {
      critico: '🚨',
      erro: '❌',
      aviso: '⚠️',
      info: 'ℹ️',
      sucesso: '✅',
    };

    const embed = {
      title: `${emojiMap[alerta.tipo] || 'ℹ️'} ${alerta.titulo}`,
      description: alerta.mensagem,
      color: colorMap[alerta.tipo] || DiscordColors.NEUTRAL,
      fields: [
        { name: 'Categoria', value: alerta.categoria, inline: true },
        { name: 'Tipo', value: alerta.tipo, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Zykor - Sistema de Alertas' },
    };

    try {
      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (response.ok) {
        await supabase
          .from('alertas_enviados')
          .update({ enviado_discord: true })
          .eq('id', alerta.id);
        
        enviados++;
      }
    } catch (error) {
      console.error(`Erro ao enviar alerta ${alerta.id}:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { alertas_enviados: enviados, total_processados: alertas.length };
}

/**
 * Relatório matinal diário
 */
async function relatorioMatinal(supabase: any, barId: number) {
  console.log('☀️ Gerando relatório matinal');
  
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const dataOntem = ontem.toISOString().split('T')[0];
  
  // Dados de ontem
  const eventosOntem = await buscarEventosPeriodo(supabase, barId, dataOntem, dataOntem);
  const metricasOntem = calcularMetricasAgregadas(eventosOntem);
  
  // Dados do mês
  const eventosMes = await buscarEventosMes(supabase, barId, hoje.getMonth() + 1, hoje.getFullYear());
  const metricasMes = calcularMetricasAgregadas(eventosMes);
  
  // Buscar meta do mês
  const { data: meta } = await supabase
    .from('metas')
    .select('valor')
    .eq('bar_id', barId)
    .eq('mes', hoje.getMonth() + 1)
    .eq('ano', hoje.getFullYear())
    .eq('tipo', 'faturamento')
    .single();
  
  const metaMes = meta?.valor || 0;
  const percentualMeta = metaMes > 0 ? (metricasMes.totalReceita / metaMes) * 100 : 0;
  
  // Alertas pendentes
  const { count: alertasPendentes } = await supabase
    .from('alertas_enviados')
    .select('*', { count: 'exact', head: true })
    .eq('bar_id', barId)
    .eq('enviado_discord', false);
  
  // Status geral
  let statusGeral: 'verde' | 'amarelo' | 'vermelho' = 'verde';
  if (percentualMeta < 70) statusGeral = 'vermelho';
  else if (percentualMeta < 85) statusGeral = 'amarelo';
  
  const statusEmoji = {
    verde: '🟢',
    amarelo: '🟡',
    vermelho: '🔴',
  };
  
  const embed = {
    title: `☀️ Relatório Matinal - ${formatarData(hoje.toISOString())}`,
    description: `${statusEmoji[statusGeral]} Status geral: **${statusGeral.toUpperCase()}**`,
    color: statusGeral === 'verde' ? DiscordColors.SUCCESS : statusGeral === 'amarelo' ? DiscordColors.WARNING : DiscordColors.ERROR,
    fields: [
      { 
        name: '📅 Ontem', 
        value: `${formatarMoeda(metricasOntem.totalReceita)} | ${metricasOntem.totalClientes} pessoas`, 
        inline: false 
      },
      { 
        name: '📊 Mês Atual', 
        value: `${formatarMoeda(metricasMes.totalReceita)} | ${eventosMes.length} eventos`, 
        inline: true 
      },
      { 
        name: '🎯 Meta do Mês', 
        value: `${formatarPercentual(percentualMeta)} de ${formatarMoeda(metaMes)}`, 
        inline: true 
      },
      { 
        name: '🔔 Alertas Pendentes', 
        value: String(alertasPendentes || 0), 
        inline: true 
      },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Zykor - Relatório Automático' },
  };
  
  await sendDiscordEmbed(embed, 'alertas');
  
  return {
    ontem: metricasOntem,
    mes: metricasMes,
    meta: { valor: metaMes, percentual: percentualMeta },
    status: statusGeral,
    alertas_pendentes: alertasPendentes || 0,
  };
}

/**
 * Alertas inteligentes com IA
 */
async function alertasInteligentes(supabase: any, barId: number, params: any) {
  console.log('🧠 Gerando alertas inteligentes');
  
  const { data_inicio, data_fim } = params || {};
  
  const fim = data_fim || new Date().toISOString().split('T')[0];
  const inicio = data_inicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const eventos = await buscarEventosPeriodo(supabase, barId, inicio, fim);
  const metricas = calcularMetricasAgregadas(eventos);
  
  const prompt = `
Analise os dados da última semana e identifique alertas importantes:

**MÉTRICAS DA SEMANA:**
- Total eventos: ${metricas.totalEventos}
- Faturamento: ${formatarMoeda(metricas.totalReceita)}
- Público: ${metricas.totalClientes}
- Ticket médio: ${formatarMoeda(metricas.ticketMedio)}
- CMV médio: ${formatarPercentual(metricas.cmvMedio)}

Identifique:
1. Anomalias ou problemas críticos
2. Oportunidades de melhoria
3. Tendências preocupantes
4. Ações recomendadas

Retorne em formato JSON:
{
  "alertas": [
    {
      "tipo": "critico|aviso|info",
      "titulo": "Título curto",
      "mensagem": "Descrição detalhada",
      "acao_recomendada": "O que fazer"
    }
  ]
}
`;

  const resposta = await generateGeminiResponse(prompt, { temperature: 0.6, maxOutputTokens: 800 });
  
  let alertasGerados;
  try {
    const cleaned = resposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    alertasGerados = JSON.parse(cleaned);
  } catch (error) {
    console.error('Erro ao parsear resposta da IA:', error);
    alertasGerados = { alertas: [] };
  }
  
  // Inserir alertas no banco
  for (const alerta of alertasGerados.alertas || []) {
    await supabase.from('alertas_enviados').insert({
      bar_id: barId,
      tipo: alerta.tipo,
      categoria: 'ia_inteligente',
      titulo: alerta.titulo,
      mensagem: `${alerta.mensagem}\n\n💡 **Ação recomendada:** ${alerta.acao_recomendada}`,
      dados: { periodo: { inicio, fim }, metricas },
      enviado_discord: false,
    });
  }
  
  return {
    periodo: { inicio, fim },
    alertas_gerados: alertasGerados.alertas?.length || 0,
    alertas: alertasGerados.alertas || [],
  };
}

/**
 * Alertas proativos (análises rápidas)
 */
async function alertasProativos(supabase: any, barId: number) {
  console.log('⚡ Gerando alertas proativos');
  
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const dataOntem = ontem.toISOString().split('T')[0];
  
  const alertas = [];
  
  // 1. Verificar meta do dia
  const eventosOntem = await buscarEventosPeriodo(supabase, barId, dataOntem, dataOntem);
  
  if (eventosOntem.length > 0) {
    const evento = eventosOntem[0];
    const faturamento = evento.real_r || 0;
    
    // Buscar meta diária
    const { data: meta } = await supabase
      .from('metas_diarias')
      .select('valor')
      .eq('bar_id', barId)
      .eq('data', dataOntem)
      .single();
    
    if (meta && meta.valor > 0) {
      const percentual = (faturamento / meta.valor) * 100;
      
      if (percentual < 70) {
        alertas.push({
          tipo: 'critico',
          categoria: 'meta',
          titulo: '🎯 Meta Diária Não Atingida',
          mensagem: `Ontem (${formatarData(dataOntem)}) atingimos apenas ${formatarPercentual(percentual)} da meta.\n\nRealizado: ${formatarMoeda(faturamento)}\nMeta: ${formatarMoeda(meta.valor)}`,
        });
      } else if (percentual >= 120) {
        alertas.push({
          tipo: 'sucesso',
          categoria: 'meta',
          titulo: '🎉 Meta Superada!',
          mensagem: `Ontem (${formatarData(dataOntem)}) superamos a meta em ${formatarPercentual(percentual - 100)}!\n\nRealizado: ${formatarMoeda(faturamento)}\nMeta: ${formatarMoeda(meta.valor)}`,
        });
      }
    }
    
    // 2. Verificar CMV alto
    if (evento.cmv_percentual && evento.cmv_percentual > 40) {
      alertas.push({
        tipo: 'aviso',
        categoria: 'cmv',
        titulo: '⚠️ CMV Elevado',
        mensagem: `O CMV de ontem ficou em ${formatarPercentual(evento.cmv_percentual)}, acima do ideal (35%).\n\nRevisar custos e precificação.`,
      });
    }
    
    // 3. Verificar ticket médio baixo
    const { data: historico } = await supabase
      .from('eventos_base')
      .select('t_medio')
      .eq('bar_id', barId)
      .gte('data_evento', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lt('data_evento', dataOntem);
    
    if (historico && historico.length > 0) {
      const mediaTicket = historico.reduce((sum: number, e: any) => sum + (e.t_medio || 0), 0) / historico.length;
      const ticketOntem = evento.t_medio || 0;
      
      if (ticketOntem < mediaTicket * 0.8) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'ticket_medio',
          titulo: '📉 Ticket Médio Abaixo da Média',
          mensagem: `Ticket médio de ontem: ${formatarMoeda(ticketOntem)}\nMédia histórica: ${formatarMoeda(mediaTicket)}\n\nVariação: ${formatarPercentual((ticketOntem / mediaTicket - 1) * 100)}`,
        });
      }
    }
  }
  
  // 4. Verificar faturamento mensal vs meta
  const eventosMes = await buscarEventosMes(supabase, barId, hoje.getMonth() + 1, hoje.getFullYear());
  const metricasMes = calcularMetricasAgregadas(eventosMes);
  
  const { data: metaMes } = await supabase
    .from('metas')
    .select('valor')
    .eq('bar_id', barId)
    .eq('mes', hoje.getMonth() + 1)
    .eq('ano', hoje.getFullYear())
    .eq('tipo', 'faturamento')
    .single();
  
  if (metaMes && metaMes.valor > 0) {
    const percentualMes = (metricasMes.totalReceita / metaMes.valor) * 100;
    const diasRestantes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate() - hoje.getDate();
    
    if (percentualMes < 50 && diasRestantes < 10) {
      alertas.push({
        tipo: 'critico',
        categoria: 'meta_mensal',
        titulo: '🚨 Risco de Não Atingir Meta Mensal',
        mensagem: `Estamos em ${formatarPercentual(percentualMes)} da meta com apenas ${diasRestantes} dias restantes.\n\nRealizado: ${formatarMoeda(metricasMes.totalReceita)}\nMeta: ${formatarMoeda(metaMes.valor)}\nFalta: ${formatarMoeda(metaMes.valor - metricasMes.totalReceita)}`,
      });
    }
  }
  
  // Inserir alertas no banco
  for (const alerta of alertas) {
    await supabase.from('alertas_enviados').insert({
      bar_id: barId,
      tipo: alerta.tipo,
      categoria: alerta.categoria,
      titulo: alerta.titulo,
      mensagem: alerta.mensagem,
      dados: { data_referencia: dataOntem },
      enviado_discord: false,
    });
  }
  
  return {
    alertas_gerados: alertas.length,
    alertas,
  };
}
