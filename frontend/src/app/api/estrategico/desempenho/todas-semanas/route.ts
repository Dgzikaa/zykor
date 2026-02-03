import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

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
    let descontosMap = new Map<string, { valor: number; detalhes: Map<string, { valor: number; qtd: number }> }>();
    
    if (dataMin && dataMax) {
      // Conta Assinada - usar limit para pegar todos os registros
      const { data: pagamentos } = await supabase
        .from('contahub_pagamentos')
        .select('dt_gerencial, valor')
        .eq('bar_id', barId)
        .eq('meio', 'Conta Assinada')
        .gte('dt_gerencial', dataMin)
        .lte('dt_gerencial', dataMax)
        .limit(5000);

      // Agrupar por semana
      pagamentos?.forEach(p => {
        const semana = semanas?.find(s => 
          p.dt_gerencial >= s.data_inicio && p.dt_gerencial <= s.data_fim
        );
        if (semana) {
          const key = `${semana.ano}-${semana.numero_semana}`;
          contaAssinadaMap.set(key, (contaAssinadaMap.get(key) || 0) + Number(p.valor || 0));
        }
      });

      // Descontos de contahub_periodo - usar range para pegar todos os registros
      const { data: descontos } = await supabase
        .from('contahub_periodo')
        .select('dt_gerencial, vr_desconto, motivo')
        .eq('bar_id', barId)
        .gt('vr_desconto', 0)
        .gte('dt_gerencial', dataMin)
        .lte('dt_gerencial', dataMax)
        .limit(10000);

      // Agrupar por semana e por motivo
      descontos?.forEach(d => {
        const semana = semanas?.find(s => 
          d.dt_gerencial >= s.data_inicio && d.dt_gerencial <= s.data_fim
        );
        if (semana) {
          const key = `${semana.ano}-${semana.numero_semana}`;
          const valorDesconto = Number(d.vr_desconto || 0);
          const motivo = d.motivo || 'Sem motivo';
          
          if (!descontosMap.has(key)) {
            descontosMap.set(key, { valor: 0, detalhes: new Map() });
          }
          const semanaData = descontosMap.get(key)!;
          semanaData.valor += valorDesconto;
          
          // Agrupar por motivo
          if (!semanaData.detalhes.has(motivo)) {
            semanaData.detalhes.set(motivo, { valor: 0, qtd: 0 });
          }
          const motivoData = semanaData.detalhes.get(motivo)!;
          motivoData.valor += valorDesconto;
          motivoData.qtd += 1;
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
      // Converter Map de detalhes para array ordenado por valor
      const descontosDetalhes = descontosData 
        ? Array.from(descontosData.detalhes.entries())
            .map(([motivo, data]) => ({ motivo, valor: data.valor, qtd: data.qtd }))
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
