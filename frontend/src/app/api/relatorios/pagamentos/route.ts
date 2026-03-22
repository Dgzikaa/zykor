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
    const meio_pagamento = searchParams.get('meio_pagamento');
    const cliente = searchParams.get('cliente');
    const usuario = searchParams.get('usuario');
    const limit = parseInt(searchParams.get('limit') || '1000');

    let query = supabase
      .from('faturamento_pagamentos' as any)
      .select('*')
      .eq('bar_id', parseInt(bar_id))
      .limit(limit);

    // Aplicar filtros
    if (data_inicio) {
      query = query.gte('data_pagamento', data_inicio);
    }
    if (data_fim) {
      query = query.lte('data_pagamento', data_fim);
    }
    if (meio_pagamento) {
      query = query.ilike('meio', `%${meio_pagamento}%`);
    }
    if (cliente) {
      query = query.ilike('cliente_nome', `%${cliente}%`);
    }
    if (usuario) {
      query = query.ilike('usr_lancou', `%${usuario}%`);
    }

    const { data: rawData, error } = await query;
    const data = (rawData || []) as any[];

    if (error) {
      console.error('❌ Erro ao buscar dados de pagamentos:', error);
      return NextResponse.json(
        { error: `Erro ao buscar dados: ${error.message}` },
        { status: 500 }
      );
    }

    // Calcular estatísticas
    const estatisticas = {
      total_registros: data.length || 0,
      total_valor: data.reduce((sum: number, item: any) => sum + (item.valor_liquido || 0), 0) || 0,
      total_valor_bruto: data.reduce((sum: number, item: any) => sum + (item.valor_bruto || 0), 0) || 0,
      total_taxas: data.reduce((sum: number, item: any) => sum + (item.taxa || 0), 0) || 0,
      clientes_unicos: [...new Set(data.map((item: any) => item.cliente_nome).filter(Boolean))].length,
      meios_unicos: [...new Set(data.map((item: any) => item.meio).filter(Boolean))].length,
      usuarios_unicos: [...new Set(data.map((item: any) => item.usr_lancou).filter(Boolean))].length
    };

    // Top meios de pagamento por valor
    const meiosPorValor = data.reduce((acc: any, item: any) => {
      const meio = item.meio || 'Sem meio';
      if (!acc[meio]) {
        acc[meio] = { valor: 0, transacoes: 0 };
      }
      acc[meio].valor += item.valor_liquido || 0;
      acc[meio].transacoes += 1;
      return acc;
    }, {} as Record<string, { valor: number; transacoes: number }>);

    const topMeios = Object.entries(meiosPorValor)
      .map(([meio, stats]) => ({
        meio,
        valor_total: (stats as { valor: number; transacoes: number }).valor,
        total_transacoes: (stats as { valor: number; transacoes: number }).transacoes
      }))
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 10);

    // Top clientes por valor
    const clientesPorValor = data.reduce((acc: any, item: any) => {
      const cliente = item.cliente_nome || 'Sem cliente';
      if (!acc[cliente]) {
        acc[cliente] = { valor: 0, transacoes: 0 };
      }
      acc[cliente].valor += item.valor_liquido || 0;
      acc[cliente].transacoes += 1;
      return acc;
    }, {} as Record<string, { valor: number; transacoes: number }>);

    const topClientes = Object.entries(clientesPorValor)
      .map(([cliente, stats]) => ({
        cliente,
        valor_total: (stats as { valor: number; transacoes: number }).valor,
        total_transacoes: (stats as { valor: number; transacoes: number }).transacoes
      }))
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 10);

    // Faturamento por dia
    const faturamentoPorDia = data.reduce((acc: any, item: any) => {
      const dia = item.data_pagamento || 'Sem data';
      if (!acc[dia]) {
        acc[dia] = { valor: 0, transacoes: 0 };
      }
      acc[dia].valor += item.valor_liquido || 0;
      acc[dia].transacoes += 1;
      return acc;
    }, {} as Record<string, { valor: number; transacoes: number }>);

    const faturamentoDiario = Object.entries(faturamentoPorDia)
      .map(([dia, stats]) => ({
        dia,
        valor_total: (stats as { valor: number; transacoes: number }).valor,
        total_transacoes: (stats as { valor: number; transacoes: number }).transacoes
      }))
      .sort((a, b) => new Date(a.dia).getTime() - new Date(b.dia).getTime());

    return NextResponse.json({
      success: true,
      tipo: 'pagamentos',
      bar_id: parseInt(bar_id),
      estatisticas,
      top_meios_pagamento: topMeios,
      top_clientes: topClientes,
      faturamento_por_dia: faturamentoDiario,
      dados: data,
      filtros: {
        data_inicio,
        data_fim,
        meio_pagamento,
        cliente,
        usuario,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Erro na API de relatórios de pagamentos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 
