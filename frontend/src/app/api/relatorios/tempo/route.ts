import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');
    
    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    
    const data_inicio = searchParams.get('data_inicio');
    const data_fim = searchParams.get('data_fim');
    const produto = searchParams.get('produto');
    const grupo = searchParams.get('grupo');
    const localizacao = searchParams.get('localizacao');
    const limit = parseInt(searchParams.get('limit') || '1000');

    let query = supabase
      .from('tempos_producao' as any)
      .select('*')
      .eq('bar_id', parseInt(bar_id))
      .limit(limit);

    // Aplicar filtros
    if (data_inicio) {
      query = query.gte('data_producao', data_inicio);
    }
    if (data_fim) {
      query = query.lte('data_producao', data_fim);
    }
    if (produto) {
      query = query.ilike('produto_desc', `%${produto}%`);
    }
    if (grupo) {
      query = query.ilike('grupo_desc', `%${grupo}%`);
    }
    if (localizacao) {
      query = query.ilike('loc_desc', `%${localizacao}%`);
    }

    const { data: rawData, error } = await query;
    const data = (rawData || []) as any[];

    if (error) {
      console.error('❌ Erro ao buscar dados de tempo:', error);
      return NextResponse.json(
        { error: `Erro ao buscar dados: ${error.message}` },
        { status: 500 }
      );
    }

    // Calcular estatísticas
    const estatisticas = {
      total_registros: data.length || 0,
      tempo_medio_t0_t1: data.reduce((sum: number, item: any) => sum + (item.t0_t1 || 0), 0) / (data.length || 1) || 0,
      tempo_medio_t1_t2: data.reduce((sum: number, item: any) => sum + (item.t1_t2 || 0), 0) / (data.length || 1) || 0,
      tempo_medio_t2_t3: data.reduce((sum: number, item: any) => sum + (item.t2_t3 || 0), 0) / (data.length || 1) || 0,
      tempo_medio_total: data.reduce((sum: number, item: any) => sum + (item.t0_t3 || 0), 0) / (data.length || 1) || 0,
      produtos_unicos: [...new Set(data.map((item: any) => item.produto_desc).filter(Boolean))].length,
      grupos_unicos: [...new Set(data.map((item: any) => item.grupo_desc).filter(Boolean))].length,
      localizacoes_unicas: [...new Set(data.map((item: any) => item.local_desc).filter(Boolean))].length,
      total_itens: data.reduce((sum: number, item: any) => sum + (item.quantidade || 0), 0) || 0
    };

    // Top produtos por tempo médio
    const produtosPorTempo = data.reduce((acc: any, item: any) => {
      const produto = item.produto_desc || 'Sem descrição';
      if (!acc[produto]) {
        acc[produto] = { 
          tempo_total: 0, 
          quantidade: 0, 
          registros: 0,
          t0_t1_total: 0,
          t1_t2_total: 0,
          t2_t3_total: 0
        };
      }
      acc[produto].tempo_total += item.t0_t3 || 0;
      acc[produto].t0_t1_total += item.t0_t1 || 0;
      acc[produto].t1_t2_total += item.t1_t2 || 0;
      acc[produto].t2_t3_total += item.t2_t3 || 0;
      acc[produto].quantidade += item.quantidade || 0;
      acc[produto].registros += 1;
      return acc;
    }, {} as Record<string, { 
      tempo_total: number; 
      quantidade: number; 
      registros: number;
      t0_t1_total: number;
      t1_t2_total: number;
      t2_t3_total: number;
    }>);

    const topProdutos = Object.entries(produtosPorTempo)
      .map(([produto, stats]) => ({
        produto,
        tempo_medio_total: (stats as any).registros > 0 ? (stats as any).tempo_total / (stats as any).registros : 0,
        tempo_medio_t0_t1: (stats as any).registros > 0 ? (stats as any).t0_t1_total / (stats as any).registros : 0,
        tempo_medio_t1_t2: (stats as any).registros > 0 ? (stats as any).t1_t2_total / (stats as any).registros : 0,
        tempo_medio_t2_t3: (stats as any).registros > 0 ? (stats as any).t2_t3_total / (stats as any).registros : 0,
        quantidade_total: (stats as any).quantidade,
        total_registros: (stats as any).registros
      }))
      .sort((a, b) => b.tempo_medio_total - a.tempo_medio_total)
      .slice(0, 10);

    // Top grupos por tempo médio
    const gruposPorTempo = data.reduce((acc: any, item: any) => {
      const grupo = item.grupo_desc || 'Sem grupo';
      if (!acc[grupo]) {
        acc[grupo] = { 
          tempo_total: 0, 
          quantidade: 0, 
          registros: 0 
        };
      }
      acc[grupo].tempo_total += item.t0_t3 || 0;
      acc[grupo].quantidade += item.quantidade || 0;
      acc[grupo].registros += 1;
      return acc;
    }, {} as Record<string, { tempo_total: number; quantidade: number; registros: number }>);

    const topGrupos = Object.entries(gruposPorTempo)
      .map(([grupo, stats]) => ({
        grupo,
        tempo_medio: (stats as { tempo_total: number; quantidade: number; registros: number }).registros > 0 ? 
          (stats as { tempo_total: number; quantidade: number; registros: number }).tempo_total / 
          (stats as { tempo_total: number; quantidade: number; registros: number }).registros : 0,
        quantidade_total: (stats as { tempo_total: number; quantidade: number; registros: number }).quantidade,
        total_registros: (stats as { tempo_total: number; quantidade: number; registros: number }).registros
      }))
      .sort((a, b) => b.tempo_medio - a.tempo_medio)
      .slice(0, 10);

    // Tempo médio por dia
    const tempoPorDia = data.reduce((acc: any, item: any) => {
      const dia = item.data_producao || 'Sem data';
      if (!acc[dia]) {
        acc[dia] = { 
          tempo_total: 0, 
          registros: 0,
          quantidade: 0
        };
      }
      acc[dia].tempo_total += item.t0_t3 || 0;
      acc[dia].quantidade += item.quantidade || 0;
      acc[dia].registros += 1;
      return acc;
    }, {} as Record<string, { tempo_total: number; registros: number; quantidade: number }>);

    const tempoDiario = Object.entries(tempoPorDia)
      .map(([dia, stats]) => ({
        dia,
        tempo_medio: (stats as { tempo_total: number; registros: number; quantidade: number }).registros > 0 ? 
          (stats as { tempo_total: number; registros: number; quantidade: number }).tempo_total / 
          (stats as { tempo_total: number; registros: number; quantidade: number }).registros : 0,
        quantidade_total: (stats as { tempo_total: number; registros: number; quantidade: number }).quantidade,
        total_registros: (stats as { tempo_total: number; registros: number; quantidade: number }).registros
      }))
      .sort((a, b) => new Date(a.dia).getTime() - new Date(b.dia).getTime());

    return NextResponse.json({
      success: true,
      tipo: 'tempo',
      bar_id: parseInt(bar_id),
      estatisticas,
      top_produtos_tempo: topProdutos,
      top_grupos_tempo: topGrupos,
      tempo_por_dia: tempoDiario,
      dados: data,
      filtros: {
        data_inicio,
        data_fim,
        produto,
        grupo,
        localizacao,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Erro na API de relatórios de tempo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 
