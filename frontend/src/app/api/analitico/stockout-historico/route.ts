import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⚡ Função otimizada para buscar dados com paginação (contorna limite de 1000 do Supabase)
// IMPORTANTE: queryBuilder deve ser uma função que retorna uma nova query a cada chamada
async function fetchAllDataWithBuilder(queryBuilder: () => any) {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  const MAX_ITERATIONS = 100; // Limitar a 100 mil registros no máximo
  let iterations = 0;
  
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    
    // Criar uma NOVA query a cada iteração (resolve problema de reutilização)
    const query = queryBuilder();
    const { data, error } = await query.range(from, from + limit - 1);
    
    if (error) {
      console.error(`❌ Erro na paginação (iteração ${iterations}):`, error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      break; // Sem mais dados
    }
    
    allData.push(...data);
    console.log(`📦 Lote ${iterations}: ${data.length} registros (total: ${allData.length})`);
    
    if (data.length < limit) {
      break; // Última página
    }
    
    from += limit;
  }
  
  if (iterations > 1) {
    console.log(`📦 ${allData.length} registros buscados em ${iterations} lote(s)`);
  }
  
  return allData;
}

// Função auxiliar para aplicar filtros base (locais e prefixos a ignorar)
// IMPORTANTE: Deve ser idêntica à função em stockout/route.ts
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
  query = query
    .not('raw_data->>grp_desc', 'eq', 'Happy Hour')
    .not('raw_data->>grp_desc', 'eq', 'Chegadeira')
    .not('raw_data->>grp_desc', 'eq', 'Dose dupla')
    .not('raw_data->>grp_desc', 'eq', 'Dose dupla!')
    .not('raw_data->>grp_desc', 'eq', 'Dose dupla sem álcool')
    .not('raw_data->>grp_desc', 'eq', 'Grupo adicional')
    .not('raw_data->>grp_desc', 'eq', 'Insumos')
    .not('raw_data->>grp_desc', 'eq', 'Promo chivas')
    .not('raw_data->>grp_desc', 'eq', 'Uso interno');
  
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

interface AnaliseStockoutHistorico {
  periodo: {
    data_inicio: string;
    data_fim: string;
  };
  bar_id: number;
  resumo: {
    total_dias: number;
    media_stockout: string;
    media_disponibilidade: string;
  };
  analise_por_dia_semana: Array<{
    dia_semana: string;
    dia_numero: number;
    total_ocorrencias: number;
    media_stockout: string;
    media_disponibilidade: string;
    melhor_dia: boolean;
    pior_dia: boolean;
  }>;
  analise_semanal: Array<{
    semana_inicio: string;
    semana_fim: string;
    numero_semana: number;
    dias_com_dados: number;
    media_stockout: string;
    media_disponibilidade: string;
  }>;
  analise_por_local: Array<{
    local: string;
    total_produtos: number;
    produtos_disponiveis: number;
    produtos_indisponiveis: number;
    percentual_stockout: string;
    percentual_disponibilidade: string;
    produtos_detalhados: {
      disponiveis: Array<{ prd_desc: string; loc_desc: string }>;
      indisponiveis: Array<{ prd_desc: string; loc_desc: string }>;
    };
    produtos_por_dia?: Array<{
      data: string;
      disponiveis: Array<{ prd_desc: string; loc_desc: string }>;
      indisponiveis: Array<{ prd_desc: string; loc_desc: string }>;
    }>;
  }>;
  historico_diario: Array<{
    data_referencia: string;
    dia_semana: string;
    total_produtos_ativos: number;
    produtos_disponiveis: number;
    produtos_stockout: number;
    percentual_stockout: string;
    percentual_disponibilidade: string;
  }>;
}

function getDiaSemana(data: string): { nome: string; numero: number } {
  const diasSemana = [
    'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
  ];
  const date = new Date(data + 'T00:00:00');
  const numero = date.getDay();
  return { nome: diasSemana[numero], numero };
}

function getNumeroSemana(data: string): number {
  // Cálculo ISO de semana (segunda a domingo)
  const date = new Date(data + 'T00:00:00');
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getInicioFimSemana(data: string): { inicio: string; fim: string } {
  const date = new Date(data + 'T00:00:00');
  const dayOfWeek = date.getDay();
  
  // Início da semana (segunda-feira)
  const inicioSemana = new Date(date);
  const diasParaSegunda = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  inicioSemana.setDate(date.getDate() + diasParaSegunda);
  
  // Fim da semana (domingo)
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 6);
  
  return {
    inicio: inicioSemana.toISOString().split('T')[0],
    fim: fimSemana.toISOString().split('T')[0]
  };
}

// Locais são agrupados por categoria - cada bar tem suas próprias regras
// Deboche (bar_id=4): Bar, Cozinha (agrupa Cozinha + Cozinha 2), Salao
// Ordinário (bar_id=3): Cozinha (agrupa Cozinha 1 + Cozinha 2), Drinks (Montados, Batidos, Shot e Dose, Mexido, Preshh), Bebidas (Bar, Baldes, Chopp)

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

// Função para obter o local normalizado (usa o loc_desc diretamente)
// Mantida para compatibilidade - use normalizarLocal quando tiver bar_id disponível
function obterLocal(locDesc: string | null): string {
  if (!locDesc) return 'Sem local definido';
  return locDesc.trim();
}

export async function POST(request: NextRequest) {
  try {
    const { data_inicio, data_fim, bar_id, filtros = [] } = await request.json();

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!data_inicio || !data_fim) {
      return NextResponse.json(
        { error: 'Data de início e fim são obrigatórias' },
        { status: 400 }
      );
    }

    console.log(`🔍 Buscando histórico de stockout: ${data_inicio} até ${data_fim}`);

    // ⚡ QueryBuilder: função que cria uma nova query a cada chamada
    // Isso é necessário porque o Supabase não permite reutilizar queries com .range()
    const createQuery = () => {
      let query = supabase
        .from('contahub_stockout')
        .select('data_consulta, prd_ativo, prd_venda, loc_desc, prd_desc')
        .eq('prd_ativo', 'S') // Apenas produtos ativos
        .gte('data_consulta', data_inicio)
        .lte('data_consulta', data_fim)
        .eq('bar_id', bar_id)
        .order('data_consulta', { ascending: true });

      // Aplicar filtros base
      query = aplicarFiltrosBase(query);

      // Aplicar filtros adicionais do usuário se existirem
      if (filtros.length > 0) {
        filtros.forEach((filtro: string) => {
          if (filtro !== 'sem_local') {
            query = query.neq('loc_desc', filtro);
          }
        });
      }
      
      return query;
    };

    // Buscar todos os dados com paginação automática
    const dadosHistoricos = await fetchAllDataWithBuilder(createQuery);

    if (!dadosHistoricos || dadosHistoricos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum dado encontrado para o período especificado',
        data: null
      });
    }

    // ⚠️ NOTA: Não usar filtrarDiasAbertos aqui porque os próprios dados de stockout
    // já indicam que o bar estava operando naquele dia (sistema coletou dados).
    // O filtro dependia de contahub_analitico que pode ter delay de sync.
    const dadosValidosFiltrados = dadosHistoricos;

    // Verificar quais datas únicas temos
    const datasUnicas = [...new Set(dadosValidosFiltrados.map(item => item.data_consulta))].sort();
    console.log(`📦 Total de registros: ${dadosValidosFiltrados.length} em ${datasUnicas.length} dias`);

    // Agrupar dados por data (usando apenas dados válidos)
    const dadosPorData = new Map();
    dadosValidosFiltrados.forEach(item => {
      const data = item.data_consulta;
      if (!dadosPorData.has(data)) {
        dadosPorData.set(data, {
          total_ativos: 0,
          disponiveis: 0,
          stockout: 0
        });
      }
      const stats = dadosPorData.get(data);
      stats.total_ativos++;
      if (item.prd_venda === 'S') {
        stats.disponiveis++;
      } else if (item.prd_venda === 'N') {
        stats.stockout++;
      }
    });

    // Processar histórico diário
    const historicoDiario = Array.from(dadosPorData.entries()).map(([data, stats]) => {
      const diaSemana = getDiaSemana(data);
      const percentualStockout = stats.total_ativos > 0 ? 
        ((stats.stockout / stats.total_ativos) * 100).toFixed(2) : '0.00';
      
      return {
        data_referencia: data,
        dia_semana: diaSemana.nome,
        total_produtos_ativos: stats.total_ativos,
        produtos_disponiveis: stats.disponiveis,
        produtos_stockout: stats.stockout,
        percentual_stockout: `${percentualStockout}%`,
        percentual_disponibilidade: `${(100 - parseFloat(percentualStockout)).toFixed(2)}%`
      };
    }).sort((a, b) => a.data_referencia.localeCompare(b.data_referencia));

    // Análise por dia da semana
    const dadosPorDiaSemana = new Map();
    historicoDiario.forEach(dia => {
      const diaSemana = getDiaSemana(dia.data_referencia);
      if (!dadosPorDiaSemana.has(diaSemana.numero)) {
        dadosPorDiaSemana.set(diaSemana.numero, {
          nome: diaSemana.nome,
          ocorrencias: [],
          soma_stockout: 0
        });
      }
      const stats = dadosPorDiaSemana.get(diaSemana.numero);
      const percentual = parseFloat(dia.percentual_stockout.replace('%', ''));
      stats.ocorrencias.push(percentual);
      stats.soma_stockout += percentual;
    });

    const analisePorDiaSemana = Array.from(dadosPorDiaSemana.entries()).map(([numero, stats]) => {
      const mediaStockout = stats.ocorrencias.length > 0 ? 
        (stats.soma_stockout / stats.ocorrencias.length).toFixed(2) : '0.00';
      
      return {
        dia_semana: stats.nome,
        dia_numero: numero,
        total_ocorrencias: stats.ocorrencias.length,
        media_stockout: `${mediaStockout}%`,
        media_disponibilidade: `${(100 - parseFloat(mediaStockout)).toFixed(2)}%`,
        melhor_dia: false, // Será definido depois
        pior_dia: false    // Será definido depois
      };
    }).sort((a, b) => a.dia_numero - b.dia_numero);

    // Identificar melhor e pior dia
    if (analisePorDiaSemana.length > 0) {
      const melhorDia = analisePorDiaSemana.reduce((prev, curr) => 
        parseFloat(prev.media_stockout) < parseFloat(curr.media_stockout) ? prev : curr
      );
      const piorDia = analisePorDiaSemana.reduce((prev, curr) => 
        parseFloat(prev.media_stockout) > parseFloat(curr.media_stockout) ? prev : curr
      );
      
      melhorDia.melhor_dia = true;
      piorDia.pior_dia = true;
    }

    // Análise semanal
    const dadosPorSemana = new Map();
    historicoDiario.forEach(dia => {
      const numeroSemana = getNumeroSemana(dia.data_referencia);
      const { inicio, fim } = getInicioFimSemana(dia.data_referencia);
      
      if (!dadosPorSemana.has(numeroSemana)) {
        dadosPorSemana.set(numeroSemana, {
          inicio,
          fim,
          dias: [],
          soma_stockout: 0
        });
      }
      const stats = dadosPorSemana.get(numeroSemana);
      const percentual = parseFloat(dia.percentual_stockout.replace('%', ''));
      stats.dias.push(percentual);
      stats.soma_stockout += percentual;
    });

    const analiseSemanal = Array.from(dadosPorSemana.entries()).map(([numero, stats]) => {
      const mediaStockout = stats.dias.length > 0 ? 
        (stats.soma_stockout / stats.dias.length).toFixed(2) : '0.00';
      
      return {
        semana_inicio: stats.inicio,
        semana_fim: stats.fim,
        numero_semana: numero,
        dias_com_dados: stats.dias.length,
        media_stockout: `${mediaStockout}%`,
        media_disponibilidade: `${(100 - parseFloat(mediaStockout)).toFixed(2)}%`
      };
    }).sort((a, b) => a.numero_semana - b.numero_semana);

    // Análise por local/categoria (médias do período)
    interface ProdutoDetalhado {
      prd_desc: string;
      loc_desc: string;
    }

    interface ProdutosPorDia {
      data: string;
      disponiveis: Map<string, ProdutoDetalhado>;
      indisponiveis: Map<string, ProdutoDetalhado>;
    }

    interface StatsCategoria {
      total_produtos: number;
      disponiveis: number;
      indisponiveis: number;
      produtos_disponiveis: Map<string, ProdutoDetalhado>;
      produtos_indisponiveis: Map<string, ProdutoDetalhado>;
      produtos_por_dia: Map<string, ProdutosPorDia>;
    }

    const dadosPorCategoria = new Map<string, StatsCategoria>();
    dadosValidosFiltrados.forEach(item => {
      const categoria = normalizarLocal(item.loc_desc, bar_id);
      const dataConsulta = item.data_consulta;
      
      if (!dadosPorCategoria.has(categoria)) {
        dadosPorCategoria.set(categoria, {
          total_produtos: 0,
          disponiveis: 0,
          indisponiveis: 0,
          produtos_disponiveis: new Map<string, ProdutoDetalhado>(),
          produtos_indisponiveis: new Map<string, ProdutoDetalhado>(),
          produtos_por_dia: new Map<string, ProdutosPorDia>()
        });
      }
      
      const stats = dadosPorCategoria.get(categoria)!;
      stats.total_produtos++;
      
      // Inicializar dados do dia se ainda não existir
      if (!stats.produtos_por_dia.has(dataConsulta)) {
        stats.produtos_por_dia.set(dataConsulta, {
          data: dataConsulta,
          disponiveis: new Map<string, ProdutoDetalhado>(),
          indisponiveis: new Map<string, ProdutoDetalhado>()
        });
      }
      
      const produtosDoDia = stats.produtos_por_dia.get(dataConsulta)!;
      
      if (item.prd_venda === 'S') {
        stats.disponiveis++;
        // Adicionar produto à lista de disponíveis geral
        if (!stats.produtos_disponiveis.has(item.prd_desc)) {
          stats.produtos_disponiveis.set(item.prd_desc, {
            prd_desc: item.prd_desc,
            loc_desc: item.loc_desc || 'Sem local'
          });
        }
        // Adicionar produto ao dia específico
        if (!produtosDoDia.disponiveis.has(item.prd_desc)) {
          produtosDoDia.disponiveis.set(item.prd_desc, {
            prd_desc: item.prd_desc,
            loc_desc: item.loc_desc || 'Sem local'
          });
        }
      } else if (item.prd_venda === 'N') {
        stats.indisponiveis++;
        // Adicionar produto à lista de indisponíveis geral
        if (!stats.produtos_indisponiveis.has(item.prd_desc)) {
          stats.produtos_indisponiveis.set(item.prd_desc, {
            prd_desc: item.prd_desc,
            loc_desc: item.loc_desc || 'Sem local'
          });
        }
        // Adicionar produto ao dia específico
        if (!produtosDoDia.indisponiveis.has(item.prd_desc)) {
          produtosDoDia.indisponiveis.set(item.prd_desc, {
            prd_desc: item.prd_desc,
            loc_desc: item.loc_desc || 'Sem local'
          });
        }
      }
    });

    // Calcular médias por local (dividir pelo número de dias)
    const analisePorLocal = Array.from(dadosPorCategoria.entries())
      .filter(([local]) => local !== 'Sem local definido') // Remover locais sem definição
      .map(([local, stats]) => {
        const totalDiasAnalise = historicoDiario.length;
        const mediaTotalProdutos = Math.round(stats.total_produtos / totalDiasAnalise);
        const mediaDisponiveis = Math.round(stats.disponiveis / totalDiasAnalise);
        const mediaIndisponiveis = Math.round(stats.indisponiveis / totalDiasAnalise);
        
        const percentualStockout = mediaTotalProdutos > 0 ? 
          ((mediaIndisponiveis / mediaTotalProdutos) * 100).toFixed(2) : '0.00';
        
        return {
          local: local, // Usar o nome do local diretamente
          total_produtos: mediaTotalProdutos,
          produtos_disponiveis: mediaDisponiveis,
          produtos_indisponiveis: mediaIndisponiveis,
          percentual_stockout: `${percentualStockout}%`,
          percentual_disponibilidade: `${(100 - parseFloat(percentualStockout)).toFixed(2)}%`,
          produtos_detalhados: {
            disponiveis: Array.from(stats.produtos_disponiveis.values()),
            indisponiveis: Array.from(stats.produtos_indisponiveis.values())
          },
          produtos_por_dia: Array.from(stats.produtos_por_dia.values()).map(dia => ({
            data: dia.data,
            disponiveis: Array.from(dia.disponiveis.values()),
            indisponiveis: Array.from(dia.indisponiveis.values())
          })).sort((a, b) => a.data.localeCompare(b.data))
        };
      })
      .sort((a, b) => 
        parseFloat(b.percentual_stockout.replace('%', '')) - 
        parseFloat(a.percentual_stockout.replace('%', ''))
      );

    console.log(`📍 Análise por local/categoria: ${analisePorLocal.length} categorias processadas`);
    console.log(`📅 Total de dias processados: ${historicoDiario.length}`);

    // Resumo geral
    const totalDias = historicoDiario.length;
    const somaStockout = historicoDiario.reduce((sum, dia) => 
      sum + parseFloat(dia.percentual_stockout.replace('%', '')), 0
    );
    const mediaStockout = totalDias > 0 ? (somaStockout / totalDias).toFixed(2) : '0.00';

    const resultado: AnaliseStockoutHistorico = {
      periodo: {
        data_inicio,
        data_fim
      },
      bar_id,
      resumo: {
        total_dias: totalDias,
        media_stockout: `${mediaStockout}%`,
        media_disponibilidade: `${(100 - parseFloat(mediaStockout)).toFixed(2)}%`
      },
      analise_por_dia_semana: analisePorDiaSemana,
      analise_semanal: analiseSemanal,
      analise_por_local: analisePorLocal,
      historico_diario: historicoDiario
    };

    console.log(`✅ Análise histórica concluída: ${totalDias} dias, média ${mediaStockout}% stockout`);

    return NextResponse.json({
      success: true,
      data: resultado
    });

  } catch (error) {
    console.error('Erro na análise histórica de stockout:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
