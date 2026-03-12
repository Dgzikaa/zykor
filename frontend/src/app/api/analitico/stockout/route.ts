import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarBarAberto } from '@/lib/helpers/calendario-helper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// NOTA: A normalização de locais agora é feita pela view contahub_stockout_filtrado
// que inclui a coluna categoria_local já normalizada por bar

export async function POST(request: NextRequest) {
  try {
    const { data_selecionada, bar_id, filtros = [] } = await request.json();

    console.log('🔍 API Stockout - Data recebida:', data_selecionada, 'Bar ID:', bar_id, 'Filtros:', filtros);

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!data_selecionada) {
      return NextResponse.json(
        { error: 'Data é obrigatória' },
        { status: 400 }
      );
    }

    // ⚠️ VERIFICAR SE BAR ESTAVA ABERTO NESTA DATA
    const statusDia = await verificarBarAberto(data_selecionada, bar_id);
    
    if (!statusDia.aberto) {
      console.log(`⚠️ Bar fechado em ${data_selecionada}: ${statusDia.motivo}`);
      return NextResponse.json({
        success: true,
        bar_fechado: true,
        motivo: statusDia.motivo,
        fonte: statusDia.fonte,
        data: {
          data_analisada: data_selecionada,
          filtros_aplicados: filtros,
          estatisticas: {
            total_produtos: 0,
            produtos_ativos: 0,
            produtos_inativos: 0,
            percentual_stockout: '0.00%',
            percentual_disponibilidade: '100.00%'
          },
          produtos: {
            inativos: [],
            ativos: []
          },
          grupos: {
            inativos: [],
            ativos: []
          },
          analise_por_local: [],
          timestamp_consulta: new Date().toISOString()
        }
      });
    }

    console.log(`✅ Bar aberto em ${data_selecionada}: ${statusDia.motivo} (fonte: ${statusDia.fonte})`);

    // IMPORTANTE: Usar a view contahub_stockout_filtrado que já tem todos os filtros aplicados
    // Isso garante que os valores sejam idênticos ao desempenho semanal (função RPC calcular_stockout_semanal)
    // A view inclui: filtros de locais, prefixos, grupos (via JSONB), e categoria_local normalizada

    // 1. Estatísticas gerais
    let query = supabase
      .from('contahub_stockout_filtrado')
      .select('prd_venda')
      .eq('data_consulta', data_selecionada)
      .eq('bar_id', bar_id);

    // Aplicar filtros adicionais do usuário se existirem
    if (filtros.length > 0) {
      filtros.forEach(filtro => {
        if (filtro !== 'sem_local') {
          query = query.neq('loc_desc', filtro);
        }
      });
    }

    const { data: dadosGerais, error: errorEstatisticas } = await query;

    console.log('📊 Dados encontrados:', dadosGerais?.length || 0, 'produtos');

    if (errorEstatisticas) {
      console.error('❌ Erro ao buscar estatísticas:', errorEstatisticas);
      throw new Error('Erro ao buscar estatísticas gerais');
    }

    // Calcular estatísticas com NOVA LÓGICA
    const totalProdutosAtivos = dadosGerais?.length || 0; // Total de produtos ativos
    const countProdutosDisponiveis = dadosGerais?.filter(p => p.prd_venda === 'S').length || 0; // Ativos E venda='S'
    const countProdutosStockout = dadosGerais?.filter(p => p.prd_venda === 'N').length || 0; // Ativos E venda='N' = STOCKOUT
    const percentualStockout = totalProdutosAtivos > 0 ? ((countProdutosStockout / totalProdutosAtivos) * 100).toFixed(2) : '0.00';

    console.log(`📈 Total: ${totalProdutosAtivos}, Disponíveis: ${countProdutosDisponiveis}, Stockout: ${countProdutosStockout}, %: ${percentualStockout}%`);

    // 2. Análise por local de produção - usando categoria_local da view
    let queryLocais = supabase
      .from('contahub_stockout_filtrado')
      .select('categoria_local, prd_venda')
      .eq('data_consulta', data_selecionada)
      .eq('bar_id', bar_id);

    // Aplicar filtros adicionais do usuário se existirem
    if (filtros.length > 0) {
      filtros.forEach(filtro => {
        if (filtro !== 'sem_local') {
          queryLocais = queryLocais.neq('loc_desc', filtro);
        }
      });
    }

    const { data: dadosLocais, error: errorLocais } = await queryLocais;

    if (errorLocais) {
      throw new Error('Erro ao buscar dados por local');
    }

    // Processar dados por categoria_local (já normalizado pela view)
    const locaisMap = new Map();
    dadosLocais?.forEach(item => {
      const local = item.categoria_local || 'Sem local definido';
      if (!locaisMap.has(local)) {
        locaisMap.set(local, { total: 0, disponiveis: 0, stockout: 0 });
      }
      const stats = locaisMap.get(local);
      stats.total++;
      if (item.prd_venda === 'S') {
        stats.disponiveis++;
      } else if (item.prd_venda === 'N') {
        stats.stockout++;
      }
    });

    const analiseLocais = Array.from(locaisMap.entries()).map(([local, stats]) => ({
      local_producao: local,
      total_produtos: stats.total,
      disponiveis: stats.disponiveis,
      indisponiveis: stats.stockout, // Renomeado para manter compatibilidade
      perc_stockout: stats.total > 0 ? parseFloat(((stats.stockout / stats.total) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.perc_stockout - a.perc_stockout || b.total_produtos - a.total_produtos);

    // 3. Produtos em stockout (todos)
    let queryIndisponiveis = supabase
      .from('contahub_stockout_filtrado')
      .select('prd_desc, loc_desc, categoria_local, prd_precovenda, prd_estoque, prd_controlaestoque, prd_validaestoquevenda')
      .eq('data_consulta', data_selecionada)
      .eq('bar_id', bar_id)
      .eq('prd_venda', 'N')
      .order('categoria_local')
      .order('prd_desc');

    // Aplicar filtros adicionais do usuário se existirem
    if (filtros.length > 0) {
      filtros.forEach(filtro => {
        if (filtro !== 'sem_local') {
          queryIndisponiveis = queryIndisponiveis.neq('loc_desc', filtro);
        }
      });
    }

    const { data: listaProdutosIndisponiveis, error: errorIndisponiveis } = await queryIndisponiveis;

    // 4. Produtos disponíveis (todos)
    let queryDisponiveis = supabase
      .from('contahub_stockout_filtrado')
      .select('prd_desc, loc_desc, categoria_local, prd_precovenda, prd_estoque')
      .eq('data_consulta', data_selecionada)
      .eq('bar_id', bar_id)
      .eq('prd_venda', 'S')
      .order('categoria_local')
      .order('prd_desc');

    // Aplicar filtros adicionais do usuário se existirem
    if (filtros.length > 0) {
      filtros.forEach(filtro => {
        if (filtro !== 'sem_local') {
          queryDisponiveis = queryDisponiveis.neq('loc_desc', filtro);
        }
      });
    }

    const { data: listaProdutosDisponiveis, error: errorDisponiveis } = await queryDisponiveis;

    if (errorIndisponiveis || errorDisponiveis) {
      throw new Error('Erro ao buscar produtos');
    }

    return NextResponse.json({
      success: true,
      data: {
        data_analisada: data_selecionada,
        filtros_aplicados: filtros,
        estatisticas: {
          total_produtos: totalProdutosAtivos, // Total de produtos ativos
          produtos_ativos: countProdutosDisponiveis, // Ativos E venda='S'
          produtos_inativos: countProdutosStockout, // Ativos E venda='N' = STOCKOUT
          percentual_stockout: `${percentualStockout}%`,
          percentual_disponibilidade: `${(100 - parseFloat(percentualStockout)).toFixed(2)}%`
        },
        produtos: {
          inativos: listaProdutosIndisponiveis || [],
          ativos: listaProdutosDisponiveis || []
        },
        grupos: {
          inativos: (analiseLocais || []).filter((local: any) => local.perc_stockout > 0),
          ativos: (analiseLocais || []).filter((local: any) => local.perc_stockout === 0)
        },
        analise_por_local: analiseLocais || [],
        timestamp_consulta: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro na API de stockout:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
