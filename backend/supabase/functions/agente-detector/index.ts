/**
 * 🔍 DETECTOR DETERMINÍSTICO - Agent V2
 * 
 * Detecta eventos/anomalias usando REGRAS PURAS (sem LLM).
 * Compara métricas do dia com histórico e aplica thresholds.
 * 
 * Fluxo:
 * 1. Recebe { bar_id, data? } (default = ontem)
 * 2. Busca métricas do dia
 * 3. Busca comparativos (média 4 semanas, semana passada, média mensal)
 * 4. Aplica regras de detecção
 * 5. Salva eventos detectados em insight_events
 * 6. Retorna lista de eventos
 * 
 * @version 1.0.0
 * @date 2026-04-01
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, errorResponse, handleCorsOptions } from '../_shared/cors.ts';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';
import { dataHojeBrasilEdge, agoraEdgeFunction } from '../_shared/timezone.ts';
import { formatDateISO, daysAgo } from '../_shared/date-helpers.ts';

// ============================================================
// TIPOS
// ============================================================

interface DetectorRequest {
  bar_id: number;
  data?: string;
}

interface MetricasDia {
  data: string;
  faturamento: number;
  clientes: number;
  ticket_medio: number;
  reservas: number;
  custo_total: number;
  atracao?: string;
  top_produtos: { produto: string; valor: number; quantidade: number }[];
}

interface Comparativos {
  media_4sem_mesmo_dia: MetricasDia | null;
  semana_passada_mesmo_dia: MetricasDia | null;
  media_mensal: MetricasDia | null;
}

interface EventoDetectado {
  event_type: string;
  severity: 'baixa' | 'media' | 'alta';
  evidence: string[];
}

// ============================================================
// FUNÇÕES DE BUSCA DE DADOS
// ============================================================

async function buscarMetricasDia(
  supabase: any,
  barId: number,
  data: string
): Promise<MetricasDia | null> {
  const { data: evento, error } = await supabase
    .from('eventos_base')
    .select('data_evento, real_r, cl_real, t_medio, reservas, custo_total, atracao')
    .eq('bar_id', barId)
    .eq('data_evento', data)
    .maybeSingle();

  if (error || !evento) {
    console.log(`⚠️ Nenhum evento encontrado para ${data}`);
    return null;
  }

  const { data: vendas } = await supabase
    .from('vendas_item')
    .select('produto_desc, quantidade, valor')
    .eq('bar_id', barId)
    .eq('data_venda', data);

  const vendasArr = (vendas || []) as any[];
  const produtosAgrupados = vendasArr.reduce((acc: any, item: any) => {
    const key = item.produto_desc;
    if (!acc[key]) acc[key] = { produto: key, quantidade: 0, valor: 0 };
    acc[key].quantidade += item.quantidade || 0;
    acc[key].valor += item.valor || 0;
    return acc;
  }, {});

  const topProdutos = Object.values(produtosAgrupados)
    .sort((a: any, b: any) => b.valor - a.valor)
    .slice(0, 5);

  return {
    data: evento.data_evento,
    faturamento: evento.real_r || 0,
    clientes: evento.cl_real || 0,
    ticket_medio: evento.t_medio || 0,
    reservas: evento.reservas || 0,
    custo_total: evento.custo_total || 0,
    atracao: evento.atracao || undefined,
    top_produtos: topProdutos as any[],
  };
}

async function buscarComparativos(
  supabase: any,
  barId: number,
  dataReferencia: string
): Promise<Comparativos> {
  const dataRef = new Date(dataReferencia);
  const diaSemana = dataRef.getDay();

  const datas4Semanas: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date(dataRef);
    d.setDate(d.getDate() - (7 * i));
    datas4Semanas.push(formatDateISO(d));
  }

  const dataSemanaPassada = new Date(dataRef);
  dataSemanaPassada.setDate(dataRef.getDate() - 7);
  const dataSemanaPassadaStr = formatDateISO(dataSemanaPassada);

  const mesRef = dataRef.getMonth() + 1;
  const anoRef = dataRef.getFullYear();
  const dataInicioMes = `${anoRef}-${String(mesRef).padStart(2, '0')}-01`;
  const dataFimMes = new Date(anoRef, mesRef, 0);
  const dataFimMesStr = formatDateISO(dataFimMes);

  const { data: eventos4Sem } = await supabase
    .from('eventos_base')
    .select('data_evento, real_r, cl_real, t_medio, reservas, custo_total')
    .eq('bar_id', barId)
    .in('data_evento', datas4Semanas);

  const eventos4SemArr = (eventos4Sem || []) as any[];
  
  let topProdutos4Sem: any[] = [];
  if (datas4Semanas.length > 0) {
    const { data: vendas4Sem } = await supabase
      .from('vendas_item')
      .select('produto_desc, quantidade, valor')
      .eq('bar_id', barId)
      .in('data_venda', datas4Semanas);

    const vendas4SemArr = (vendas4Sem || []) as any[];
    const produtosAgrupados = vendas4SemArr.reduce((acc: any, item: any) => {
      const key = item.produto_desc;
      if (!acc[key]) acc[key] = { produto: key, quantidade: 0, valor: 0 };
      acc[key].quantidade += item.quantidade || 0;
      acc[key].valor += item.valor || 0;
      return acc;
    }, {});

    topProdutos4Sem = Object.values(produtosAgrupados)
      .sort((a: any, b: any) => b.valor - a.valor)
      .slice(0, 5);
  }
  
  const media4Sem = eventos4SemArr.length > 0 ? {
    data: 'média_4_semanas',
    faturamento: eventos4SemArr.reduce((s, e) => s + (e.real_r || 0), 0) / eventos4SemArr.length,
    clientes: eventos4SemArr.reduce((s, e) => s + (e.cl_real || 0), 0) / eventos4SemArr.length,
    ticket_medio: eventos4SemArr.reduce((s, e) => s + (e.t_medio || 0), 0) / eventos4SemArr.length,
    reservas: eventos4SemArr.reduce((s, e) => s + (e.reservas || 0), 0) / eventos4SemArr.length,
    custo_total: eventos4SemArr.reduce((s, e) => s + (e.custo_total || 0), 0) / eventos4SemArr.length,
    top_produtos: topProdutos4Sem,
  } : null;

  const semanaPassada = await buscarMetricasDia(supabase, barId, dataSemanaPassadaStr);

  const { data: eventosMes } = await supabase
    .from('eventos_base')
    .select('real_r, cl_real, t_medio, reservas, custo_total')
    .eq('bar_id', barId)
    .gte('data_evento', dataInicioMes)
    .lte('data_evento', dataFimMesStr);

  const eventosMesArr = (eventosMes || []) as any[];
  const mediaMensal = eventosMesArr.length > 0 ? {
    data: 'média_mensal',
    faturamento: eventosMesArr.reduce((s, e) => s + (e.real_r || 0), 0) / eventosMesArr.length,
    clientes: eventosMesArr.reduce((s, e) => s + (e.cl_real || 0), 0) / eventosMesArr.length,
    ticket_medio: eventosMesArr.reduce((s, e) => s + (e.t_medio || 0), 0) / eventosMesArr.length,
    reservas: eventosMesArr.reduce((s, e) => s + (e.reservas || 0), 0) / eventosMesArr.length,
    custo_total: eventosMesArr.reduce((s, e) => s + (e.custo_total || 0), 0) / eventosMesArr.length,
    top_produtos: [],
  } : null;

  return {
    media_4sem_mesmo_dia: media4Sem,
    semana_passada_mesmo_dia: semanaPassada,
    media_mensal: mediaMensal,
  };
}

// ============================================================
// REGRAS DE DETECÇÃO
// ============================================================

function aplicarRegrasDeteccao(
  metricas: MetricasDia,
  comparativos: Comparativos
): EventoDetectado[] {
  const eventos: EventoDetectado[] = [];
  const media4Sem = comparativos.media_4sem_mesmo_dia;

  if (!media4Sem) {
    console.log('⚠️ Sem dados históricos suficientes para comparação');
    return eventos;
  }

  // REGRA 1: Queda ticket médio
  if (media4Sem.ticket_medio > 0 && metricas.ticket_medio < media4Sem.ticket_medio * 0.90) {
    const variacao = ((metricas.ticket_medio - media4Sem.ticket_medio) / media4Sem.ticket_medio * 100);
    const severity = variacao < -15 ? 'alta' : 'media';
    eventos.push({
      event_type: 'queda_ticket_medio',
      severity,
      evidence: [
        `ticket_medio_dia: R$ ${metricas.ticket_medio.toFixed(2)}`,
        `media_ultimas_4_semanas: R$ ${media4Sem.ticket_medio.toFixed(2)}`,
        `variacao: ${variacao.toFixed(1)}%`,
      ],
    });
  }

  // REGRA 2: Queda faturamento
  if (media4Sem.faturamento > 0 && metricas.faturamento < media4Sem.faturamento * 0.85) {
    const variacao = ((metricas.faturamento - media4Sem.faturamento) / media4Sem.faturamento * 100);
    const severity = variacao < -20 ? 'alta' : 'media';
    eventos.push({
      event_type: 'queda_faturamento',
      severity,
      evidence: [
        `faturamento_dia: R$ ${metricas.faturamento.toFixed(2)}`,
        `media_ultimas_4_semanas: R$ ${media4Sem.faturamento.toFixed(2)}`,
        `variacao: ${variacao.toFixed(1)}%`,
      ],
    });
  }

  // REGRA 3: Queda clientes
  if (media4Sem.clientes > 0 && metricas.clientes < media4Sem.clientes * 0.80) {
    const variacao = ((metricas.clientes - media4Sem.clientes) / media4Sem.clientes * 100);
    const severity = variacao < -25 ? 'alta' : 'media';
    eventos.push({
      event_type: 'queda_clientes',
      severity,
      evidence: [
        `clientes_dia: ${metricas.clientes}`,
        `media_ultimas_4_semanas: ${media4Sem.clientes.toFixed(1)}`,
        `variacao: ${variacao.toFixed(1)}%`,
      ],
    });
  }

  // REGRA 4: Aumento custo
  if (media4Sem.custo_total > 0 && metricas.custo_total > media4Sem.custo_total * 1.15) {
    const variacao = ((metricas.custo_total - media4Sem.custo_total) / media4Sem.custo_total * 100);
    const severity = variacao > 25 ? 'alta' : 'media';
    eventos.push({
      event_type: 'aumento_custo',
      severity,
      evidence: [
        `custo_total_dia: R$ ${metricas.custo_total.toFixed(2)}`,
        `media_ultimas_4_semanas: R$ ${media4Sem.custo_total.toFixed(2)}`,
        `variacao: +${variacao.toFixed(1)}%`,
      ],
    });
  }

  // REGRA 5: Baixa reserva
  if (media4Sem.reservas > 0 && metricas.reservas < media4Sem.reservas * 0.70) {
    const variacao = ((metricas.reservas - media4Sem.reservas) / media4Sem.reservas * 100);
    const severity = variacao < -40 ? 'alta' : 'media';
    eventos.push({
      event_type: 'baixa_reserva',
      severity,
      evidence: [
        `reservas_dia: ${metricas.reservas}`,
        `media_ultimas_4_semanas: ${media4Sem.reservas.toFixed(1)}`,
        `variacao: ${variacao.toFixed(1)}%`,
      ],
    });
  }

  // REGRA 6: Performance atração boa
  if (metricas.clientes > 0 && media4Sem.clientes > 0) {
    const ticketPorCliente = metricas.faturamento / metricas.clientes;
    const ticketMedio4Sem = media4Sem.faturamento / media4Sem.clientes;
    
    if (ticketPorCliente > ticketMedio4Sem * 1.20) {
      const variacao = ((ticketPorCliente - ticketMedio4Sem) / ticketMedio4Sem * 100);
      eventos.push({
        event_type: 'performance_atracao_boa',
        severity: 'baixa',
        evidence: [
          `faturamento_por_cliente: R$ ${ticketPorCliente.toFixed(2)}`,
          `media_historica: R$ ${ticketMedio4Sem.toFixed(2)}`,
          `variacao: +${variacao.toFixed(1)}%`,
          `atracao: ${metricas.atracao || 'N/A'}`,
        ],
      });
    }
  }

  // REGRA 7: Performance atração ruim
  if (metricas.clientes > 0 && media4Sem.clientes > 0) {
    const ticketPorCliente = metricas.faturamento / metricas.clientes;
    const ticketMedio4Sem = media4Sem.faturamento / media4Sem.clientes;
    
    if (ticketPorCliente < ticketMedio4Sem * 0.80) {
      const variacao = ((ticketPorCliente - ticketMedio4Sem) / ticketMedio4Sem * 100);
      eventos.push({
        event_type: 'performance_atracao_ruim',
        severity: 'media',
        evidence: [
          `faturamento_por_cliente: R$ ${ticketPorCliente.toFixed(2)}`,
          `media_historica: R$ ${ticketMedio4Sem.toFixed(2)}`,
          `variacao: ${variacao.toFixed(1)}%`,
          `atracao: ${metricas.atracao || 'N/A'}`,
        ],
      });
    }
  }

  // REGRA 8: Produto anômalo (top produto mudou drasticamente)
  if (metricas.top_produtos.length > 0 && comparativos.media_4sem_mesmo_dia) {
    const topProdutoHoje = metricas.top_produtos[0];
    const topProduto4Sem = comparativos.media_4sem_mesmo_dia.top_produtos[0];
    
    if (topProduto4Sem && topProdutoHoje.produto !== topProduto4Sem.produto) {
      eventos.push({
        event_type: 'produto_anomalo',
        severity: 'media',
        evidence: [
          `produto_top_hoje: ${topProdutoHoje.produto} (R$ ${topProdutoHoje.valor.toFixed(2)})`,
          `produto_top_historico: ${topProduto4Sem.produto}`,
          `mudanca_detectada: true`,
        ],
      });
    }
  }

  return eventos;
}

// ============================================================
// SALVAR EVENTOS NO BANCO
// ============================================================

async function salvarEventos(
  supabase: any,
  barId: number,
  data: string,
  eventos: EventoDetectado[]
): Promise<number> {
  let salvos = 0;

  for (const evento of eventos) {
    const { error } = await supabase
      .from('insight_events')
      .insert({
        bar_id: barId,
        data,
        event_type: evento.event_type,
        severity: evento.severity,
        evidence_json: evento.evidence,
        processed: false,
      });

    if (error) {
      console.error(`❌ Erro ao salvar evento ${evento.event_type}:`, error);
    } else {
      salvos++;
      console.log(`✅ Evento salvo: ${evento.event_type} (severity: ${evento.severity})`);
    }
  }

  return salvos;
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
    const body = await req.json().catch(() => ({})) as DetectorRequest;
    const { bar_id, data } = body;

    if (!bar_id) {
      return errorResponse('bar_id é obrigatório', null, 400);
    }

    barIdForError = bar_id;

    const hbResult = await heartbeatStart(supabase, 'agente-detector', bar_id, 'detect', 'api');
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;

    const dataAnalise = data || formatDateISO(daysAgo(1));
    console.log(`🔍 Iniciando detecção para bar_id=${bar_id}, data=${dataAnalise}`);

    const metricas = await buscarMetricasDia(supabase, bar_id, dataAnalise);
    if (!metricas) {
      await heartbeatEnd(supabase, heartbeatId, 'success', startTime, 0, {
        mensagem: 'Nenhum evento encontrado para a data',
        data: dataAnalise,
      });
      return jsonResponse({
        success: true,
        eventos_detectados: [],
        mensagem: `Nenhum evento encontrado para ${dataAnalise}`,
      });
    }

    console.log(`📊 Métricas do dia: faturamento=R$ ${metricas.faturamento.toFixed(2)}, clientes=${metricas.clientes}, ticket=R$ ${metricas.ticket_medio.toFixed(2)}`);

    const comparativos = await buscarComparativos(supabase, bar_id, dataAnalise);
    console.log(`📈 Comparativos carregados: 4sem=${comparativos.media_4sem_mesmo_dia ? 'OK' : 'N/A'}, mensal=${comparativos.media_mensal ? 'OK' : 'N/A'}`);

    const eventosDetectados = aplicarRegrasDeteccao(metricas, comparativos);
    console.log(`🎯 Eventos detectados: ${eventosDetectados.length}`);

    const eventosSalvos = await salvarEventos(supabase, bar_id, dataAnalise, eventosDetectados);

    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, eventosSalvos, {
      eventos_detectados: eventosDetectados.length,
      eventos_salvos: eventosSalvos,
      data_analise: dataAnalise,
    });

    return jsonResponse({
      success: true,
      data_analise: dataAnalise,
      eventos_detectados: eventosDetectados.length,
      eventos_salvos: eventosSalvos,
      eventos: eventosDetectados.map(e => ({
        tipo: e.event_type,
        severidade: e.severity,
        evidencias: e.evidence,
      })),
    });

  } catch (error) {
    console.error('❌ Erro no detector:', error);
    await heartbeatError(supabase, heartbeatId, startTime, error as Error, {}, 'agente-detector', barIdForError);
    return errorResponse('Erro ao executar detector', error, 500);
  }
});
