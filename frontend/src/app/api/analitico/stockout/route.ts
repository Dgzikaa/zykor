import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarBarAberto } from '@/lib/helpers/calendario-helper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Função para normalizar locais - agrupa locais por categoria
function normalizarLocal(locDesc: string | null, barId: number): string {
  if (!locDesc) return 'Sem local definido';
  
  const loc = locDesc.trim();
  
  // Ordinário (bar_id = 3): agrupamentos específicos
  if (barId === 3) {
    // Cozinha agrupa: Cozinha 1, Cozinha 2
    if (loc === 'Cozinha 1' || loc === 'Cozinha 2') {
      return 'Cozinha';
    }
    // Drinks agrupa: Montados, Batidos, Shot e Dose, Mexido, Preshh
    if (['Montados', 'Batidos', 'Shot e Dose', 'Mexido', 'Preshh'].includes(loc)) {
      return 'Drinks';
    }
    // Bebidas agrupa: Bar, Baldes, Chopp
    if (['Bar', 'Baldes', 'Chopp'].includes(loc)) {
      return 'Bebidas';
    }
  }
  
  // Deboche (bar_id = 4): agrupar "Cozinha" e "Cozinha 2" como "Cozinha"
  if (barId === 4) {
    if (loc === 'Cozinha' || loc === 'Cozinha 2') {
      return 'Cozinha';
    }
  }
  
  return loc;
}

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


    // Função auxiliar para aplicar filtros base (locais e prefixos a ignorar)
    const aplicarFiltrosBase = (query: any) => {
      // LOCAIS A IGNORAR PERMANENTEMENTE
      query = query
        .neq('loc_desc', 'Pegue e Pague')
        .neq('loc_desc', 'Venda Volante')
        .not('loc_desc', 'is', null); // Excluir "Sem local definido"
      
      // PRODUTOS COM PREFIXOS A IGNORAR (usando % em ambos os lados para pegar espaços)
      query = query
        .not('prd_desc', 'ilike', '%[HH]%')  // Happy Hour (com ou sem espaços)
        .not('prd_desc', 'ilike', '%[PP]%')  // Pegue Pague
        .not('prd_desc', 'ilike', '%[DD]%')  // Dose Dupla
        .not('prd_desc', 'ilike', '%[IN]%'); // Insumos
      
      // PRODUTOS HAPPY HOUR (excluir independente do formato)
      // Esses produtos não devem entrar no stockout pois às 20h já não estão mais disponíveis
      query = query
        .not('prd_desc', 'ilike', '%Happy Hour%')
        .not('prd_desc', 'ilike', '%HappyHour%')
        .not('prd_desc', 'ilike', '%Happy-Hour%')
        .not('prd_desc', 'ilike', '% HH')       // Produtos que terminam com " HH" (ex: Debochinho HH)
        .not('prd_desc', 'ilike', '% HH %');    // Produtos com " HH " no meio
      
      // GRUPOS A IGNORAR (excluir pelo grupo, não apenas pelo nome)
      // Produtos podem pertencer a grupos específicos sem ter o nome do grupo no nome do produto
      // IMPORTANTE: Usar exatamente como está no ContaHub (case-sensitive)
      query = query
        .not('raw_data->>grp_desc', 'eq', 'Happy Hour')
        .not('raw_data->>grp_desc', 'eq', 'Chegadeira')
        .not('raw_data->>grp_desc', 'eq', 'Dose dupla')
        .not('raw_data->>grp_desc', 'eq', 'Dose Dupla')
        .not('raw_data->>grp_desc', 'eq', 'Dose dupla!')
        .not('raw_data->>grp_desc', 'eq', 'Dose Dupla!')
        .not('raw_data->>grp_desc', 'eq', 'Dose dupla sem álcool')
        .not('raw_data->>grp_desc', 'eq', 'Dose Dupla sem álcool')
        .not('raw_data->>grp_desc', 'eq', 'Grupo adicional')
        .not('raw_data->>grp_desc', 'eq', 'Grupo Adicional')
        .not('raw_data->>grp_desc', 'eq', 'Insumos')
        .not('raw_data->>grp_desc', 'eq', 'Promo chivas')
        .not('raw_data->>grp_desc', 'eq', 'Promo Chivas')
        .not('raw_data->>grp_desc', 'eq', 'Uso interno')
        .not('raw_data->>grp_desc', 'eq', 'Uso Interno');
      
      // PRODUTOS DOSE DUPLA (excluir - são variações que não devem contar no stockout)
      // Inclui "Dose Dulpa" que é um typo comum
      query = query
        .not('prd_desc', 'ilike', '%Dose Dupla%')
        .not('prd_desc', 'ilike', '%Dose Dulpa%');
      
      // CATEGORIAS A IGNORAR (por descrição do produto)
      query = query
        .not('prd_desc', 'ilike', '%Balde%')     // Baldes
        .not('prd_desc', 'ilike', '%Garrafa%');  // Garrafas
      
      return query;
    };

    // 1. Estatísticas gerais - NOVA LÓGICA: apenas produtos ativos='S' e venda='N'
    let query = supabase
      .from('contahub_stockout')
      .select('prd_ativo, prd_venda')
      .eq('data_consulta', data_selecionada)
      .eq('bar_id', bar_id) // Filtrar por bar selecionado
      .eq('prd_ativo', 'S'); // Apenas produtos ativos

    // Aplicar filtros base
    query = aplicarFiltrosBase(query);

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

    // 2. Análise por local de produção - NOVA LÓGICA: apenas produtos ativos
    let queryLocais = supabase
      .from('contahub_stockout')
      .select('loc_desc, prd_ativo, prd_venda')
      .eq('data_consulta', data_selecionada)
      .eq('bar_id', bar_id) // Filtrar por bar selecionado
      .eq('prd_ativo', 'S'); // Apenas produtos ativos

    // Aplicar filtros base
    queryLocais = aplicarFiltrosBase(queryLocais);

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

    // Processar dados por local com NOVA LÓGICA
    // Usa normalizarLocal para agrupar locais (ex: Cozinha + Cozinha 2 = Cozinha no Deboche)
    const locaisMap = new Map();
    dadosLocais?.forEach(item => {
      const local = normalizarLocal(item.loc_desc, bar_id);
      if (!locaisMap.has(local)) {
        locaisMap.set(local, { total: 0, disponiveis: 0, stockout: 0 });
      }
      const stats = locaisMap.get(local);
      stats.total++; // Total de produtos ativos neste local
      if (item.prd_venda === 'S') {
        stats.disponiveis++; // Ativos E venda='S'
      } else if (item.prd_venda === 'N') {
        stats.stockout++; // Ativos E venda='N' = STOCKOUT
      }
    });

    const analiseLocais = Array.from(locaisMap.entries()).map(([local, stats]) => ({
      local_producao: local,
      total_produtos: stats.total,
      disponiveis: stats.disponiveis,
      indisponiveis: stats.stockout, // Renomeado para manter compatibilidade
      perc_stockout: stats.total > 0 ? parseFloat(((stats.stockout / stats.total) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.perc_stockout - a.perc_stockout || b.total_produtos - a.total_produtos);

    // 3. Produtos em stockout (todos) - NOVA LÓGICA: ativos='S' E venda='N'
    let queryIndisponiveis = supabase
      .from('contahub_stockout')
      .select('prd_desc, loc_desc, prd_precovenda, prd_estoque, prd_controlaestoque, prd_validaestoquevenda')
      .eq('data_consulta', data_selecionada)
      .eq('bar_id', bar_id) // Filtrar por bar selecionado
      .eq('prd_ativo', 'S') // Apenas produtos ativos
      .eq('prd_venda', 'N') // E que não estão à venda = STOCKOUT
      .order('loc_desc')
      .order('prd_desc');

    // Aplicar filtros base
    queryIndisponiveis = aplicarFiltrosBase(queryIndisponiveis);

    // Aplicar filtros adicionais do usuário se existirem
    if (filtros.length > 0) {
      filtros.forEach(filtro => {
        if (filtro !== 'sem_local') {
          queryIndisponiveis = queryIndisponiveis.neq('loc_desc', filtro);
        }
      });
    }

    const { data: listaProdutosIndisponiveis, error: errorIndisponiveis } = await queryIndisponiveis;

    // 4. Produtos disponíveis (todos) - NOVA LÓGICA: ativos='S' E venda='S'
    let queryDisponiveis = supabase
      .from('contahub_stockout')
      .select('prd_desc, loc_desc, prd_precovenda, prd_estoque')
      .eq('data_consulta', data_selecionada)
      .eq('bar_id', bar_id) // Filtrar por bar selecionado
      .eq('prd_ativo', 'S') // Apenas produtos ativos
      .eq('prd_venda', 'S') // E que estão à venda = DISPONÍVEIS
      .order('loc_desc')
      .order('prd_desc');

    // Aplicar filtros base
    queryDisponiveis = aplicarFiltrosBase(queryDisponiveis);

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
