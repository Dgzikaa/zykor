import { SupabaseClient } from '@supabase/supabase-js';
import { agora } from '@/lib/timezone';
import { getCacheKey, getFromCache, setCache, cleanupCache } from './cache';
import { EventoBase, ContaHubAnalitico, CMVSemanal } from './types';

export async function fetchDataForIntent(
  supabase: SupabaseClient,
  intent: string,
  entities: Record<string, string>,
  barId: number
): Promise<Record<string, unknown>> {
  const cacheKey = getCacheKey(intent, entities, barId);
  const cachedData = getFromCache(cacheKey);
  if (cachedData) {
    return cachedData as Record<string, unknown>;
  }
  
  cleanupCache();
  
  const hoje = agora();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  
  let result: Record<string, unknown>;

  switch (intent) {
    case 'faturamento': {
      let dataInicio = inicioSemana.toISOString().split('T')[0];
      let dataFim = hoje.toISOString().split('T')[0];
      
      if (entities.periodo === 'data_especifica' && entities.data) {
        dataInicio = entities.data;
        dataFim = entities.data;
      } else if (entities.periodo === 'ontem') {
        dataInicio = ontem.toISOString().split('T')[0];
        dataFim = ontem.toISOString().split('T')[0];
      } else if (entities.periodo === 'hoje') {
        dataInicio = hoje.toISOString().split('T')[0];
        dataFim = hoje.toISOString().split('T')[0];
      } else if (entities.periodo === 'mes_atual') {
        dataInicio = inicioMes.toISOString().split('T')[0];
      }

      const { data: eventosRaw } = await supabase
        .from('eventos_base')
        .select('data_evento, real_r, m1_r, cl_real, nome, yuzer_liquido, sympla_liquido')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', dataInicio)
        .lte('data_evento', dataFim)
        .order('data_evento', { ascending: false });

      const eventos = eventosRaw as (EventoBase & { yuzer_liquido?: number; sympla_liquido?: number })[] | null;
      const total = eventos?.reduce((acc, e) => acc + (e.real_r || 0), 0) || 0;
      const metaTotal = eventos?.reduce((acc, e) => acc + (e.m1_r || 0), 0) || 0;
      const clientesTotal = eventos?.reduce((acc, e) => acc + (e.cl_real || 0), 0) || 0;
      const diasComDados = eventos?.filter(e => (e.real_r || 0) > 0).length || 0;
      const nomeEvento = eventos?.[0]?.nome || '';

      result = {
        faturamento: total,
        meta: metaTotal,
        atingimento: metaTotal > 0 ? (total / metaTotal * 100) : 0,
        clientes: clientesTotal,
        ticketMedio: clientesTotal > 0 ? total / clientesTotal : 0,
        diasComDados,
        nomeEvento,
        eventos,
        periodo: entities.periodo || 'semana_atual',
        dataConsultada: entities.data || dataInicio
      };
      break;
    }

    case 'clientes': {
      let dataInicio = ontem.toISOString().split('T')[0];
      let dataFim = ontem.toISOString().split('T')[0];
      
      if (entities.periodo === 'data_especifica' && entities.data) {
        dataInicio = entities.data;
        dataFim = entities.data;
      } else if (entities.periodo === 'semana_atual') {
        dataInicio = inicioSemana.toISOString().split('T')[0];
        dataFim = hoje.toISOString().split('T')[0];
      } else if (entities.periodo === 'hoje') {
        dataInicio = hoje.toISOString().split('T')[0];
        dataFim = hoje.toISOString().split('T')[0];
      }

      const { data: eventosClientesRaw } = await supabase
        .from('eventos_base')
        .select('data_evento, cl_real, real_r, nome, yuzer_liquido, yuzer_ingressos, sympla_liquido, sympla_checkins, te_real, tb_real')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', dataInicio)
        .lte('data_evento', dataFim)
        .order('data_evento', { ascending: false });

      const eventosClientes = eventosClientesRaw as (EventoBase & { 
        yuzer_liquido?: number; 
        yuzer_ingressos?: number;
        sympla_liquido?: number;
        sympla_checkins?: number;
        te_real?: number;
        tb_real?: number;
      })[] | null;
      
      const clientesTotal = eventosClientes?.reduce((acc, e) => {
        const clientes = (e.cl_real || 0) > 0 ? e.cl_real : 
                        (e.yuzer_ingressos || 0) > 0 ? e.yuzer_ingressos :
                        (e.sympla_checkins || 0);
        return acc + (clientes || 0);
      }, 0) || 0;
      
      const faturamento = eventosClientes?.reduce((acc, e) => acc + (e.real_r || 0), 0) || 0;
      const ticketEntrada = eventosClientes?.[0]?.te_real || 0;
      const ticketBar = eventosClientes?.[0]?.tb_real || 0;
      const nomeEvento = eventosClientes?.[0]?.nome || '';

      result = {
        clientes: clientesTotal,
        faturamento,
        ticketMedio: clientesTotal > 0 ? faturamento / clientesTotal : 0,
        ticketEntrada,
        ticketBar,
        nomeEvento,
        eventos: eventosClientes,
        periodo: entities.periodo || 'ontem',
        dataConsultada: entities.data || dataInicio
      };
      break;
    }

    case 'cmv': {
      const { data: cmvRaw } = await supabase
        .from('cmv_semanal')
        .select('*')
        .eq('bar_id', barId)
        .order('data_inicio', { ascending: false })
        .limit(2);

      const cmv = cmvRaw as CMVSemanal[] | null;
      result = {
        cmvAtual: cmv?.[0]?.cmv_percentual || 0,
        cmvAnterior: cmv?.[1]?.cmv_percentual || 0,
        metaCMV: 34,
        custoTotal: cmv?.[0]?.custo_total || 0,
        faturamento: cmv?.[0]?.faturamento || 0
      };
      break;
    }

    case 'meta': {
      const { data: eventosMetaRaw } = await supabase
        .from('eventos_base')
        .select('real_r, m1_r')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', inicioMes.toISOString().split('T')[0])
        .lte('data_evento', hoje.toISOString().split('T')[0]);

      const eventosMeta = eventosMetaRaw as EventoBase[] | null;
      const faturamentoMes = eventosMeta?.reduce((acc, e) => acc + (e.real_r || 0), 0) || 0;
      const metaMesEventos = eventosMeta?.reduce((acc, e) => acc + (e.m1_r || 0), 0) || 0;

      // Calcular meta mensal a partir de bar_metas_periodo (metas M1 por dia da semana)
      const { data: metasPeriodoRaw } = await supabase
        .from('bar_metas_periodo')
        .select('dia_semana, m1')
        .eq('bar_id', barId)
        .eq('ativo', true);

      let metaMensalCalculada = 0;
      if (metasPeriodoRaw && metasPeriodoRaw.length > 0) {
        const metasPorDia: Record<number, number> = {};
        metasPeriodoRaw.forEach((m: { dia_semana: number; m1: number }) => {
          metasPorDia[m.dia_semana] = m.m1 || 0;
        });
        
        const diasNoMesCalc = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        for (let dia = 1; dia <= diasNoMesCalc; dia++) {
          const dataLoop = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
          const diaSemana = dataLoop.getDay();
          metaMensalCalculada += metasPorDia[diaSemana] || 0;
        }
      }

      const diasPassados = hoje.getDate();
      const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
      const diasRestantes = diasNoMes - diasPassados;
      const metaFinal = metaMensalCalculada > 0 ? metaMensalCalculada : metaMesEventos;

      result = {
        faturamentoMes,
        metaMes: metaFinal,
        atingimento: metaFinal > 0 
          ? (faturamentoMes / metaFinal * 100) 
          : 0,
        diasPassados,
        diasRestantes,
        mediaDiaria: diasPassados > 0 ? faturamentoMes / diasPassados : 0,
        necessarioPorDia: diasRestantes > 0 
          ? (metaFinal - faturamentoMes) / diasRestantes 
          : 0
      };
      break;
    }

    case 'produto': {
      const hoje = new Date();
      const { data: vendasRaw } = await supabase
        .from('vendas_item')
        .select('produto_desc, grupo_desc, quantidade, valor')
        .eq('bar_id', barId)
        .gte('data_venda', inicioSemana.toISOString().split('T')[0])
        .lte('data_venda', hoje.toISOString().split('T')[0])
        .limit(5000);

      const vendas = (vendasRaw || []).map(v => ({
        prd_desc: v.produto_desc,
        grp_desc: v.grupo_desc,
        qtd: v.quantidade,
        valorfinal: v.valor
      })) as ContaHubAnalitico[] | null;
      
      const produtosAgrupados: Record<string, { prd_desc: string; grp_desc: string; qtd: number; valorfinal: number }> = {};
      
      vendas?.forEach(v => {
        if (!v.prd_desc) return;
        const key = v.prd_desc;
        if (!produtosAgrupados[key]) {
          produtosAgrupados[key] = { prd_desc: v.prd_desc, grp_desc: v.grp_desc || '', qtd: 0, valorfinal: 0 };
        }
        produtosAgrupados[key].qtd += v.qtd || 0;
        produtosAgrupados[key].valorfinal += v.valorfinal || 0;
      });

      const topProdutos = Object.values(produtosAgrupados)
        .sort((a, b) => b.valorfinal - a.valorfinal)
        .slice(0, 10);

      result = {
        topProdutos
      };
      break;
    }

    case 'comparativo_dias': {
      const { data: eventosCompDiasRaw } = await supabase
        .from('eventos_base')
        .select('data_evento, real_r, cl_real, nome')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', inicioSemana.toISOString().split('T')[0])
        .order('data_evento', { ascending: false });

      const eventosCompDias = eventosCompDiasRaw as EventoBase[] | null;
      const diasNome = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const eventosPorDia = eventosCompDias?.map(e => ({
        ...e,
        diaSemana: diasNome[new Date((e.data_evento || '') + 'T12:00:00').getDay()],
        diaNum: new Date((e.data_evento || '') + 'T12:00:00').getDay()
      })) || [];

      const melhorDia = eventosPorDia.reduce((best, e) => 
        (e.real_r || 0) > (best?.real_r || 0) ? e : best, eventosPorDia[0]);
      const piorDia = eventosPorDia.filter(e => (e.real_r || 0) > 0).reduce((worst, e) => 
        (e.real_r || Infinity) < (worst?.real_r || Infinity) ? e : worst, eventosPorDia[0]);

      const diasMencionados = entities.dias?.split(',') || [];

      result = {
        eventos: eventosPorDia,
        melhorDia,
        piorDia,
        diasMencionados
      };
      break;
    }

    case 'comparativo_periodos': {
      const { data: semanaAtualRaw } = await supabase
        .from('eventos_base')
        .select('real_r, cl_real')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', inicioSemana.toISOString().split('T')[0]);

      const inicioSemanaPassada = new Date(inicioSemana);
      inicioSemanaPassada.setDate(inicioSemanaPassada.getDate() - 7);
      const fimSemanaPassada = new Date(inicioSemana);
      fimSemanaPassada.setDate(fimSemanaPassada.getDate() - 1);

      const { data: semanaPassadaRaw } = await supabase
        .from('eventos_base')
        .select('real_r, cl_real')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', inicioSemanaPassada.toISOString().split('T')[0])
        .lte('data_evento', fimSemanaPassada.toISOString().split('T')[0]);

      const semanaAtualData = semanaAtualRaw as EventoBase[] | null;
      const semanaPassadaData = semanaPassadaRaw as EventoBase[] | null;
      const fatAtual = semanaAtualData?.reduce((acc, e) => acc + (e.real_r || 0), 0) || 0;
      const fatPassada = semanaPassadaData?.reduce((acc, e) => acc + (e.real_r || 0), 0) || 0;
      const clientesAtual = semanaAtualData?.reduce((acc, e) => acc + (e.cl_real || 0), 0) || 0;
      const clientesPassada = semanaPassadaData?.reduce((acc, e) => acc + (e.cl_real || 0), 0) || 0;

      result = {
        semanaAtual: { faturamento: fatAtual, clientes: clientesAtual },
        semanaPassada: { faturamento: fatPassada, clientes: clientesPassada },
        variacaoFat: fatPassada > 0 ? ((fatAtual - fatPassada) / fatPassada) * 100 : 0,
        variacaoClientes: clientesPassada > 0 ? ((clientesAtual - clientesPassada) / clientesPassada) * 100 : 0
      };
      break;
    }

    case 'tendencia': {
      const quatroSemanasAtras = new Date(hoje);
      quatroSemanasAtras.setDate(quatroSemanasAtras.getDate() - 28);

      const { data: eventosTendenciaRaw } = await supabase
        .from('eventos_base')
        .select('data_evento, real_r, cl_real')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', quatroSemanasAtras.toISOString().split('T')[0])
        .order('data_evento', { ascending: true });

      const eventosTendencia = eventosTendenciaRaw as EventoBase[] | null;
      const semanas: { semana: number; faturamento: number; clientes: number; ticketMedio: number }[] = [];
      let semanaAtualNum = 0;
      let fatSemana = 0;
      let cliSemana = 0;

      eventosTendencia?.forEach((e, idx) => {
        const semanaEvento = Math.floor(idx / 7);
        if (semanaEvento !== semanaAtualNum && fatSemana > 0) {
          semanas.push({
            semana: semanaAtualNum + 1,
            faturamento: fatSemana,
            clientes: cliSemana,
            ticketMedio: cliSemana > 0 ? fatSemana / cliSemana : 0
          });
          fatSemana = 0;
          cliSemana = 0;
          semanaAtualNum = semanaEvento;
        }
        fatSemana += e.real_r || 0;
        cliSemana += e.cl_real || 0;
      });

      if (fatSemana > 0) {
        semanas.push({
          semana: semanaAtualNum + 1,
          faturamento: fatSemana,
          clientes: cliSemana,
          ticketMedio: cliSemana > 0 ? fatSemana / cliSemana : 0
        });
      }

      const ultima = semanas[semanas.length - 1];
      const penultima = semanas[semanas.length - 2];
      
      let tendenciaFat = 'estavel';
      let tendenciaTicket = 'estavel';
      
      if (ultima && penultima) {
        const varFat = ((ultima.faturamento - penultima.faturamento) / penultima.faturamento) * 100;
        const varTicket = ((ultima.ticketMedio - penultima.ticketMedio) / penultima.ticketMedio) * 100;
        
        tendenciaFat = varFat > 5 ? 'subindo' : varFat < -5 ? 'caindo' : 'estavel';
        tendenciaTicket = varTicket > 5 ? 'subindo' : varTicket < -5 ? 'caindo' : 'estavel';
      }

      result = {
        semanas,
        tendenciaFat,
        tendenciaTicket,
        ultimaSemana: ultima,
        penultimaSemana: penultima
      };
      break;
    }

    case 'meta_projecao': {
      const { data: eventosProjecaoRaw } = await supabase
        .from('eventos_base')
        .select('real_r, m1_r')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', inicioMes.toISOString().split('T')[0])
        .lte('data_evento', hoje.toISOString().split('T')[0]);

      const eventosProjecao = eventosProjecaoRaw as EventoBase[] | null;
      const faturamentoMes = eventosProjecao?.reduce((acc, e) => acc + (e.real_r || 0), 0) || 0;
      const metaMesEventos = eventosProjecao?.reduce((acc, e) => acc + (e.m1_r || 0), 0) || 0;

      // Calcular meta mensal a partir de bar_metas_periodo
      const { data: metasPeriodoProjecaoRaw } = await supabase
        .from('bar_metas_periodo')
        .select('dia_semana, m1')
        .eq('bar_id', barId)
        .eq('ativo', true);

      let metaMensalCalculada = 0;
      if (metasPeriodoProjecaoRaw && metasPeriodoProjecaoRaw.length > 0) {
        const metasPorDia: Record<number, number> = {};
        metasPeriodoProjecaoRaw.forEach((m: { dia_semana: number; m1: number }) => {
          metasPorDia[m.dia_semana] = m.m1 || 0;
        });
        
        const diasNoMesCalc = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        for (let dia = 1; dia <= diasNoMesCalc; dia++) {
          const dataLoop = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
          const diaSemana = dataLoop.getDay();
          metaMensalCalculada += metasPorDia[diaSemana] || 0;
        }
      }

      const metaMes = metaMensalCalculada > 0 ? metaMensalCalculada : metaMesEventos;
      const diasPassados = hoje.getDate();
      const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
      const diasRestantes = diasNoMes - diasPassados;
      const faltaParaMeta = Math.max(0, metaMes - faturamentoMes);
      const necessarioPorDia = diasRestantes > 0 ? faltaParaMeta / diasRestantes : 0;
      const mediaDiariaAtual = diasPassados > 0 ? faturamentoMes / diasPassados : 0;
      const projecaoFimMes = mediaDiariaAtual * diasNoMes;

      result = {
        faturamentoMes,
        metaMes,
        atingimento: metaMes > 0 ? (faturamentoMes / metaMes * 100) : 0,
        diasPassados,
        diasRestantes,
        faltaParaMeta,
        necessarioPorDia,
        mediaDiariaAtual,
        projecaoFimMes,
        vaiAtingir: projecaoFimMes >= metaMes
      };
      break;
    }

    case 'resumo': {
      const hojeResumo = agora().toISOString().split('T')[0];
      const { data: eventosRecentesRaw } = await supabase
        .from('eventos_base')
        .select('*')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .lte('data_evento', hojeResumo)
        .order('data_evento', { ascending: false })
        .limit(7);

      const eventosRecentes = eventosRecentesRaw as EventoBase[] | null;
      const fatSemana = eventosRecentes?.reduce((acc, e) => acc + (e.real_r || 0), 0) || 0;
      const clientesSemana = eventosRecentes?.reduce((acc, e) => acc + (e.cl_real || 0), 0) || 0;
      const metaSemana = eventosRecentes?.reduce((acc, e) => acc + (e.m1_r || 0), 0) || 0;

      const { data: cmvResumoRaw } = await supabase
        .from('cmv_semanal')
        .select('cmv_percentual')
        .eq('bar_id', barId)
        .order('data_inicio', { ascending: false })
        .limit(1);

      const cmvResumo = (cmvResumoRaw as CMVSemanal[] | null)?.[0]?.cmv_percentual || 0;

      result = {
        eventosRecentes,
        fatSemana,
        clientesSemana,
        metaSemana,
        atingimento: metaSemana > 0 ? (fatSemana / metaSemana * 100) : 0,
        ticketMedio: clientesSemana > 0 ? fatSemana / clientesSemana : 0,
        cmv: cmvResumo
      };
      break;
    }

    case 'ticket': {
      const { data: eventosTicketRaw } = await supabase
        .from('eventos_base')
        .select('real_r, cl_real')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', inicioSemana.toISOString().split('T')[0]);

      const eventosTicket = eventosTicketRaw as EventoBase[] | null;
      result = {
        eventos: eventosTicket || []
      };
      break;
    }

    case 'operacional': {
      result = {
        horarios: {
          quarta: '18h às 00h',
          quinta: '18h às 00h',
          sexta: '18h às 02h',
          sabado: '18h às 02h',
          domingo: '12h às 22h'
        }
      };
      break;
    }


    case 'estoque': {
      const dataConsulta = entities.data || ontem.toISOString().split('T')[0];
      
      const { data: rupturas } = await supabase
        .schema('gold')
        .from('gold_contahub_operacional_stockout')
        .select('*')
        .eq('bar_id', barId)
        .gte('data_stockout', dataConsulta)
        .order('tempo_ruptura_min', { ascending: false });

      const produtosAfetados: Record<string, { nome: string; tempoTotal: number; vezes: number }> = {};
      rupturas?.forEach(r => {
        const key = r.nome_produto || r.codigo_produto;
        if (!produtosAfetados[key]) {
          produtosAfetados[key] = { nome: key, tempoTotal: 0, vezes: 0 };
        }
        produtosAfetados[key].tempoTotal += r.tempo_ruptura_min || 0;
        produtosAfetados[key].vezes += 1;
      });

      result = {
        totalRupturas: rupturas?.length || 0,
        produtosMaisAfetados: Object.values(produtosAfetados).sort((a, b) => b.tempoTotal - a.tempoTotal).slice(0, 5),
        rupturas: rupturas || [],
        dataConsulta
      };
      break;
    }

    case 'calendario': {
      const hojeCalendario = agora().toISOString().split('T')[0];
      
      const { data: eventosFuturos } = await supabase
        .from('calendario_operacional')
        .select('*')
        .eq('bar_id', barId)
        .gte('data', hojeCalendario)
        .order('data', { ascending: true })
        .limit(10);

      const { data: eventosConcorrentes } = await supabase
        .from('eventos_concorrencia')
        .select('*')
        .eq('bar_id', barId)
        .gte('data', hojeCalendario)
        .order('data', { ascending: true })
        .limit(5);

      result = {
        eventosFuturos: eventosFuturos || [],
        eventosConcorrentes: eventosConcorrentes || [],
        proximoEvento: eventosFuturos?.[0] || null
      };
      break;
    }


    default: {
      const hojeDefault = agora().toISOString().split('T')[0];
      const { data: eventosDefaultRaw } = await supabase
        .from('eventos_base')
        .select('*')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .lte('data_evento', hojeDefault)
        .order('data_evento', { ascending: false })
        .limit(7);

      const eventosDefault = eventosDefaultRaw as EventoBase[] | null;
      result = {
        eventosRecentes: eventosDefault
      };
      break;
    }
  }

  setCache(cacheKey, result, intent);
  return result;
}
