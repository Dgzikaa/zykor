import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Helper para buscar todos os registros com paginação
async function fetchAllPaginated<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  filters: { column: string; operator: string; value: any }[],
  pageSize: number = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    // Aplicar filtros
    for (const filter of filters) {
      if (filter.operator === 'eq') query = query.eq(filter.column, filter.value);
      else if (filter.operator === 'gt') query = query.gt(filter.column, filter.value);
      else if (filter.operator === 'gte') query = query.gte(filter.column, filter.value);
      else if (filter.operator === 'lte') query = query.lte(filter.column, filter.value);
      else if (filter.operator === 'lt') query = query.lt(filter.column, filter.value);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Erro ao buscar ${table}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as T[]);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get('ano'); // opcional - se não passar, busca todos
    
    // Obter bar_id do header
    const userDataHeader = request.headers.get('x-user-data');
    let barId = 3; // Default
    
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader));
        if (userData.bar_id) barId = userData.bar_id;
      } catch (e) {
        console.warn('Erro ao parsear user data:', e);
      }
    }

    // Buscar todas as semanas do bar, ordenadas por ano e semana
    let query = supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', barId)
      .order('ano', { ascending: true })
      .order('numero_semana', { ascending: true });
    
    if (ano) {
      query = query.eq('ano', parseInt(ano));
    }

    const { data: semanas, error } = await query;

    if (error) {
      console.error('Erro ao buscar semanas:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    // Buscar dados de marketing para mesclar
    let marketingQuery = supabase
      .from('marketing_semanal')
      .select('*')
      .eq('bar_id', barId);
    
    if (ano) {
      marketingQuery = marketingQuery.eq('ano', parseInt(ano));
    }

    const { data: marketingData } = await marketingQuery;

    // Criar mapa de marketing por semana/ano
    const marketingMap = new Map<string, any>();
    marketingData?.forEach(m => {
      marketingMap.set(`${m.ano}-${m.semana}`, m);
    });

    // Buscar dados de Conta Assinada para todas as semanas
    // Primeiro, obter as datas min/max das semanas
    const datas = semanas?.map(s => ({ inicio: s.data_inicio, fim: s.data_fim })) || [];
    const dataMin = datas.length > 0 ? datas.reduce((min, d) => d.inicio < min ? d.inicio : min, datas[0].inicio) : null;
    const dataMax = datas.length > 0 ? datas.reduce((max, d) => d.fim > max ? d.fim : max, datas[0].fim) : null;

    // Buscar todos os pagamentos de Conta Assinada no período
    let contaAssinadaMap = new Map<string, number>();
    // Buscar todos os descontos no período
    let descontosMap = new Map<string, { 
      valor: number; 
      detalhes: Map<string, { 
        motivo_exibicao: string;
        valor: number; 
        qtd: number;
        por_dia: Map<string, { valor: number; qtd: number }>
      }> 
    }>();
    
    if (dataMin && dataMax) {
      // Conta Assinada - buscar com paginação
      const pagamentos = await fetchAllPaginated<{ dt_gerencial: string; valor: number }>(
        supabase,
        'contahub_pagamentos',
        'dt_gerencial, valor',
        [
          { column: 'bar_id', operator: 'eq', value: barId },
          { column: 'meio', operator: 'eq', value: 'Conta Assinada' },
          { column: 'dt_gerencial', operator: 'gte', value: dataMin },
          { column: 'dt_gerencial', operator: 'lte', value: dataMax },
        ]
      );

      // Agrupar por semana
      pagamentos.forEach(p => {
        const semana = semanas?.find(s => 
          p.dt_gerencial >= s.data_inicio && p.dt_gerencial <= s.data_fim
        );
        if (semana) {
          const key = `${semana.ano}-${semana.numero_semana}`;
          contaAssinadaMap.set(key, (contaAssinadaMap.get(key) || 0) + Number(p.valor || 0));
        }
      });

      // Descontos de contahub_periodo - buscar com paginação
      const descontos = await fetchAllPaginated<{ dt_gerencial: string; vr_desconto: number; motivo: string }>(
        supabase,
        'contahub_periodo',
        'dt_gerencial, vr_desconto, motivo',
        [
          { column: 'bar_id', operator: 'eq', value: barId },
          { column: 'vr_desconto', operator: 'gt', value: 0 },
          { column: 'dt_gerencial', operator: 'gte', value: dataMin },
          { column: 'dt_gerencial', operator: 'lte', value: dataMax },
        ]
      );

      // Agrupar por semana, por motivo (case-insensitive) e por dia da semana
      descontos?.forEach(d => {
        const semana = semanas?.find(s => 
          d.dt_gerencial >= s.data_inicio && d.dt_gerencial <= s.data_fim
        );
        if (semana) {
          const key = `${semana.ano}-${semana.numero_semana}`;
          const valorDesconto = Number(d.vr_desconto || 0);
          const motivoOriginal = d.motivo || 'Sem motivo';
          // Normalizar motivo para case-insensitive (trim + lowercase)
          const motivoNormalizado = motivoOriginal.trim().toLowerCase();
          
          // Dia da semana
          const data = new Date(d.dt_gerencial + 'T00:00:00');
          const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
          const diaSemana = diasSemana[data.getDay()];
          
          if (!descontosMap.has(key)) {
            descontosMap.set(key, { valor: 0, detalhes: new Map() });
          }
          const semanaData = descontosMap.get(key)!;
          semanaData.valor += valorDesconto;
          
          // Agrupar por motivo normalizado
          if (!semanaData.detalhes.has(motivoNormalizado)) {
            semanaData.detalhes.set(motivoNormalizado, { 
              motivo_exibicao: motivoOriginal, // Manter primeiro motivo original para exibição
              valor: 0, 
              qtd: 0,
              por_dia: new Map()
            });
          }
          const motivoData = semanaData.detalhes.get(motivoNormalizado)!;
          motivoData.valor += valorDesconto;
          motivoData.qtd += 1;
          
          // Agrupar por dia da semana
          if (!motivoData.por_dia.has(diaSemana)) {
            motivoData.por_dia.set(diaSemana, { valor: 0, qtd: 0 });
          }
          const diaData = motivoData.por_dia.get(diaSemana)!;
          diaData.valor += valorDesconto;
          diaData.qtd += 1;
        }
      });
    }

    // Mesclar dados
    const semanasCompletas = semanas?.map(s => {
      const marketing = marketingMap.get(`${s.ano}-${s.numero_semana}`);
      const key = `${s.ano}-${s.numero_semana}`;
      
      // Conta Assinada
      const contaAssinadaValor = contaAssinadaMap.get(key) || 0;
      const contaAssinadaPerc = s.faturamento_total && s.faturamento_total > 0 
        ? (contaAssinadaValor / s.faturamento_total) * 100 
        : 0;
      
      // Descontos
      const descontosData = descontosMap.get(key);
      const descontosValor = descontosData?.valor || 0;
      const descontosPerc = s.faturamento_total && s.faturamento_total > 0 
        ? (descontosValor / s.faturamento_total) * 100 
        : 0;
      // Converter Map de detalhes para array ordenado por valor, com separação por dia
      const descontosDetalhes = descontosData 
        ? Array.from(descontosData.detalhes.entries())
            .map(([motivoNormalizado, data]) => ({ 
              motivo: data.motivo_exibicao, // Usar motivo original para exibição
              valor: data.valor, 
              qtd: data.qtd,
              por_dia: Array.from(data.por_dia.entries())
                .map(([dia, diaData]) => ({ 
                  dia_semana: dia, 
                  valor: diaData.valor, 
                  qtd: diaData.qtd 
                }))
                .sort((a, b) => {
                  // Ordenar por dia da semana (Domingo primeiro)
                  const ordem = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                  return ordem.indexOf(a.dia_semana) - ordem.indexOf(b.dia_semana);
                })
            }))
            .sort((a, b) => b.valor - a.valor)
        : [];
      
      return {
        ...s,
        conta_assinada_valor: contaAssinadaValor,
        conta_assinada_perc: contaAssinadaPerc,
        descontos_valor: descontosValor,
        descontos_perc: descontosPerc,
        descontos_detalhes: descontosDetalhes,
        ...(marketing ? {
          o_num_posts: marketing.o_num_posts,
          o_alcance: marketing.o_alcance,
          o_interacao: marketing.o_interacao,
          o_compartilhamento: marketing.o_compartilhamento,
          o_engajamento: marketing.o_engajamento,
          o_num_stories: marketing.o_num_stories,
          o_visu_stories: marketing.o_visu_stories,
          m_valor_investido: marketing.m_valor_investido,
          m_alcance: marketing.m_alcance,
          m_frequencia: marketing.m_frequencia,
          m_cpm: marketing.m_cpm,
          m_cliques: marketing.m_cliques,
          m_ctr: marketing.m_ctr,
          m_custo_por_clique: marketing.m_cpc,
          m_conversas_iniciadas: marketing.m_conversas_iniciadas,
        } : {})
      };
    }) || [];

    // Calcular semana atual ISO
    const hoje = new Date();
    const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semanaAtual = Math.ceil((((d.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7);
    const anoAtual = d.getUTCFullYear();

    return NextResponse.json({
      success: true,
      semanas: semanasCompletas,
      semanaAtual,
      anoAtual,
      totalSemanas: semanasCompletas.length,
      barId
    });

  } catch (error) {
    console.error('Erro na API de todas semanas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
