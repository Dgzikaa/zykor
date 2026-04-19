import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { filtrarDiasAbertos } from '@/lib/helpers/calendario-helper';

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
    const tipo = searchParams.get('tipo');
    const bar_id = searchParams.get('bar_id') || '3';
    const data_inicio = searchParams.get('data_inicio');
    const data_fim = searchParams.get('data_fim');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query;
    let result;

    // Cast supabase para any para contornar tipos ainda não atualizados
    const sb = supabase as any;

    switch (tipo) {
      case 'analitico':
        // MIGRADO: vendas_item (domain table)
        query = sb
          .from('vendas_item')
          .select('*')
          .eq('bar_id', parseInt(bar_id))
          .not('grupo_desc', 'in', '("Mercadorias- Compras","Insumos","Uso Interno")')
          .limit(limit);

        if (data_inicio) {
          query = query.gte('data_venda', data_inicio);
        }
        if (data_fim) {
          query = query.lte('data_venda', data_fim);
        }

        result = await query;
        break;

      case 'pagamentos':
        // MIGRADO: faturamento_pagamentos (domain table)
        query = sb
          .from('faturamento_pagamentos')
          .select('*')
          .eq('bar_id', parseInt(bar_id))
          .limit(limit);

        if (data_inicio) {
          query = query.gte('data_pagamento', data_inicio);
        }
        if (data_fim) {
          query = query.lte('data_pagamento', data_fim);
        }

        result = await query;
        break;

      case 'periodo':
        // MIGRADO: visitas (domain table)
        query = sb
          .schema('silver')
          .from('cliente_visitas')
          .select('*')
          .eq('bar_id', parseInt(bar_id))
          .limit(limit);

        if (data_inicio) {
          query = query.gte('data_visita', data_inicio);
        }
        if (data_fim) {
          query = query.lte('data_visita', data_fim);
        }

        result = await query;
        break;

      case 'tempo':
        // MIGRADO: tempos_producao (domain table)
        query = sb
          .from('tempos_producao')
          .select('*')
          .eq('bar_id', parseInt(bar_id))
          .limit(limit);

        if (data_inicio) {
          query = query.gte('data_producao', data_inicio);
        }
        if (data_fim) {
          query = query.lte('data_producao', data_fim);
        }

        result = await query;
        break;

      case 'fatporhora':
        // MIGRADO: faturamento_hora (domain table)
        query = sb
          .from('faturamento_hora')
          .select('*')
          .eq('bar_id', parseInt(bar_id))
          .limit(limit);

        if (data_inicio) {
          query = query.gte('data_venda', data_inicio);
        }
        if (data_fim) {
          query = query.lte('data_venda', data_fim);
        }

        result = await query;
        break;

      case 'resumo': {
        // Resumo geral de todas as tabelas - MIGRADO para domain tables
        const [analitico, pagamentos, periodo, tempo, fatporhora] = await Promise.all([
          sb
            .from('vendas_item')
            .select('*')
            .eq('bar_id', parseInt(bar_id))
            .limit(1000),
          sb
            .from('faturamento_pagamentos')
            .select('*')
            .eq('bar_id', parseInt(bar_id))
            .limit(1000),
          sb
            .schema('silver')
            .from('cliente_visitas')
            .select('*')
            .eq('bar_id', parseInt(bar_id))
            .limit(1000),
          sb
            .from('tempos_producao')
            .select('*')
            .eq('bar_id', parseInt(bar_id))
            .limit(1000),
          sb
            .from('faturamento_hora')
            .select('*')
            .eq('bar_id', parseInt(bar_id))
            .limit(1000)
        ]);

        result = {
          data: {
            analitico: {
              total_registros: analitico.data?.length || 0,
              amostra: analitico.data?.slice(0, 5) || []
            },
            pagamentos: {
              total_registros: pagamentos.data?.length || 0,
              amostra: pagamentos.data?.slice(0, 5) || []
            },
            periodo: {
              total_registros: periodo.data?.length || 0,
              amostra: periodo.data?.slice(0, 5) || []
            },
            tempo: {
              total_registros: tempo.data?.length || 0,
              amostra: tempo.data?.slice(0, 5) || []
            },
            fatporhora: {
              total_registros: fatporhora.data?.length || 0,
              amostra: fatporhora.data?.slice(0, 5) || []
            }
          },
          error: null
        };
        break;
      }

      default:
        return NextResponse.json(
          { 
            error: 'Tipo de relatório inválido',
            tipos_disponiveis: ['analitico', 'pagamentos', 'periodo', 'tempo', 'fatporhora', 'resumo']
          },
          { status: 400 }
        );
    }

    if (result.error) {
      console.error(`❌ Erro ao buscar dados ${tipo}:`, result.error);
      return NextResponse.json(
        { error: `Erro ao buscar dados: ${result.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tipo,
      bar_id: parseInt(bar_id),
      total_registros: Array.isArray(result.data) ? result.data.length : 'N/A',
      dados: result.data,
      filtros: {
        data_inicio,
        data_fim,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Erro na API de relatórios:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}