import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =====================================================
// ONDA 2C: Buscar mapeamento de locais do banco
// SEM FALLBACK: Se não encontrar, retornar erro 500
// =====================================================
interface LocalMapeamento {
  bebidas: string[];
  comidas: string[];
  drinks: string[];
  excluidos: string[];
  produtos_excluidos_stockout: string[];
}

let cachedLocais: Record<number, LocalMapeamento> = {};
let cacheTimestamp: Record<number, number> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getLocaisMapeamento(barId: number): Promise<LocalMapeamento | null> {
  const agora = Date.now();
  
  // Cache hit válido
  if (cachedLocais[barId] && (agora - (cacheTimestamp[barId] || 0)) < CACHE_TTL_MS) {
    return cachedLocais[barId];
  }
  
  const { data, error } = await supabase
    .from('bar_local_mapeamento')
    .select('categoria, locais, produtos_excluidos_stockout')
    .eq('bar_id', barId)
    .eq('ativo', true);
  
  if (error || !data || data.length === 0) {
    console.error(`❌ [ERRO CONFIG] Mapeamento de locais não encontrado para bar ${barId}. Configure bar_local_mapeamento.`);
    return null;
  }
  
  const mapeamento: LocalMapeamento = {
    bebidas: [],
    comidas: [],
    drinks: [],
    excluidos: [],
    produtos_excluidos_stockout: []
  };
  
  for (const row of data) {
    if (row.categoria === 'bebidas') mapeamento.bebidas = row.locais || [];
    else if (row.categoria === 'comidas') mapeamento.comidas = row.locais || [];
    else if (row.categoria === 'drinks') mapeamento.drinks = row.locais || [];
    else if (row.categoria === 'excluidos') {
      mapeamento.excluidos = row.locais || [];
      mapeamento.produtos_excluidos_stockout = row.produtos_excluidos_stockout || [];
    }
  }

  cachedLocais[barId] = mapeamento;
  cacheTimestamp[barId] = agora;
  return mapeamento;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Autenticação
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const eventoId = parseInt(id);
    if (!eventoId) {
      return NextResponse.json({ error: 'ID do evento inválido' }, { status: 400 });
    }

    // Dados do corpo da requisição - com correção para double encoding
    const rawBody = await request.text();
    
    let body;
    try {
      const firstParse = JSON.parse(rawBody);
      
      if (typeof firstParse === 'string') {
        // Double encoding detectado - fazer segundo parse
        body = JSON.parse(firstParse);
      } else {
        body = firstParse;
      }
    } catch (e) {
      console.error('❌ Erro ao fazer parse do JSON:', e);
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }
    
    // Extrair valores diretamente do body para evitar problemas de desestruturação
    const real_r = body.real_r;
    const cl_real = body.cl_real;
    const te_real = body.te_real;
    const tb_real = body.tb_real;
    const t_medio = body.t_medio;
    const res_tot = body.res_tot;
    const res_p = body.res_p;
    const c_art = body.c_art;
    const c_prod = body.c_prod;
    const percent_b = body.percent_b;
    const percent_d = body.percent_d;
    const percent_c = body.percent_c;
    const t_coz = body.t_coz;
    const t_bar = body.t_bar;
    const observacoes = body.observacoes;

    // Verificar se o evento existe e pertence ao bar do usuário
    const { data: evento, error: eventoError } = await supabase
      .from('eventos_base')
      .select('id, nome, bar_id')
      .eq('id', eventoId)
      .eq('bar_id', user.bar_id)
      .single();

    if (eventoError || !evento) {
      console.error('❌ Evento não encontrado:', eventoError);
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    // Atualizar os valores reais na tabela eventos_base
    const updateData: any = {
      real_r: body.real_r || 0,
      cl_real: body.cl_real || 0,
      te_real: body.te_real || 0,
      tb_real: body.tb_real || 0,
      t_medio: body.t_medio || 0,
      res_tot: body.res_tot || 0,
      res_p: body.res_p || 0,
      c_art: body.c_art || 0,
      c_prod: body.c_prod || 0,
      // NUNCA salvar percent_b, percent_d, percent_c - sempre recalcular do Contahub
      // percent_b, percent_d, percent_c serão recalculados pela função calculate_evento_metrics
      t_coz: body.t_coz || 0,
      t_bar: body.t_bar || 0,
      observacoes: body.observacoes || '',
      atualizado_em: new Date().toISOString(),
      // Marcar que os valores foram editados manualmente
      calculado_em: new Date().toISOString(),
      precisa_recalculo: false, // Não precisa recalcular pois foi editado manualmente
      versao_calculo: 999 // Versão especial para indicar edição manual
    };

    // Adicionar campos manuais se fornecidos
    if (body.faturamento_couvert_manual !== undefined) {
      updateData.faturamento_couvert_manual = body.faturamento_couvert_manual;
    }
    if (body.faturamento_bar_manual !== undefined) {
      updateData.faturamento_bar_manual = body.faturamento_bar_manual;
    }

    const { data: eventoAtualizado, error: updateError } = await supabase
      .from('eventos_base')
      .update(updateData)
      .eq('id', eventoId)
      .eq('bar_id', user.bar_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar valores reais:', updateError);
      return NextResponse.json({ 
        error: 'Erro ao salvar valores reais',
        details: updateError.message 
      }, { status: 500 });
    }

    // 🔄 RECALCULAR PERCENTUAIS E STOCKOUT DO CONTAHUB (SEMPRE ATUALIZAR)
    // Os percentuais %B, %D, %C e %S (stockout) vêm do Contahub e devem sempre estar atualizados
    try {
      // Buscar dados do evento para pegar a data
      const { data: eventoData } = await supabase
        .from('eventos_base')
        .select('data_evento')
        .eq('id', eventoId)
        .single();

      if (!eventoData) {
        throw new Error('Evento não encontrado');
      }

      // Buscar dados do vendas_item para recalcular percentuais
      // Excluir categorias de compras/estoque
      const { data: contahubData, error: contahubError } = await supabase
        .from('vendas_item')
        .select('valor, local_desc, grupo_desc')
        .eq('data_venda', eventoData.data_evento)
        .eq('bar_id', user.bar_id)
        .not('grupo_desc', 'in', '("Mercadorias- Compras","Insumos","Uso Interno")');

      if (!contahubError && contahubData && contahubData.length > 0) {
        // Calcular totais por categoria
        let valor_bebidas = 0;
        let valor_comidas = 0;
        let valor_drinks = 0;
        let valor_outros = 0;
        let total_valorfinal = 0;

        // ONDA 2C: Buscar mapeamento de locais do banco - erro se não configurado
        const locaisMapeamento = await getLocaisMapeamento(user.bar_id);
        if (!locaisMapeamento) {
          return NextResponse.json(
            { error: `Configuração ausente: mapeamento de locais para bar ${user.bar_id}. Configure bar_local_mapeamento.` },
            { status: 500 }
          );
        }
        const locaisBebidas = locaisMapeamento.bebidas;
        const locaisComidas = locaisMapeamento.comidas;
        const locaisDrinks = locaisMapeamento.drinks;

        contahubData.forEach(item => {
          const valor = item.valor || 0;
          const loc = item.local_desc || '';
          total_valorfinal += valor;

          if (locaisBebidas.includes(loc)) {
            valor_bebidas += valor;
          }
          else if (locaisComidas.includes(loc)) {
            valor_comidas += valor;
          }
          else if (locaisDrinks.includes(loc)) {
            valor_drinks += valor;
          }
          else {
            valor_outros += valor;
          }
        });

        // Calcular percentuais
        let percent_b = 0;
        let percent_c = 0;
        let percent_d = 0;

        if (total_valorfinal > 0) {
          percent_b = ((valor_bebidas + valor_outros) / total_valorfinal) * 100;
          percent_c = (valor_comidas / total_valorfinal) * 100;
          percent_d = (valor_drinks / total_valorfinal) * 100;
        }

        // 🔄 BUSCAR DADOS DE STOCKOUT COM OS MESMOS FILTROS DO ANALÍTICO
        // ONDA 2C: Locais excluídos agora vêm do banco
        const locaisExcluidos = locaisMapeamento.excluidos;

        const { data: stockoutData, error: stockoutError } = await supabase
          .from('contahub_stockout')
          .select('prd_ativo, prd_venda, loc_desc, prd_desc')
          .eq('data_consulta', eventoData.data_evento)
          .eq('bar_id', user.bar_id)
          .eq('prd_ativo', 'S') // Apenas produtos ativos
          .not('loc_desc', 'is', null); // Excluir "Sem local definido"
        
        // Aplicar filtro de locais manualmente
        const stockoutComLocais = stockoutData?.filter(item => 
          !locaisExcluidos.includes(item.loc_desc || '')
        ) || [];

        let percent_stockout = 0;

        if (!stockoutError && stockoutComLocais && stockoutComLocais.length > 0) {
          // =====================================================
          // REGRA RESIDUAL: Filtros de texto de produtos
          // Estes filtros são baseados em padrões de nomenclatura do ContaHub
          // e NÃO pertencem ao escopo de mapeamento de locais.
          // Mantidos como filtro textual até que uma solução de config exista.
          // =====================================================
          const produtosExcluidos = locaisMapeamento.produtos_excluidos_stockout || [];
          const stockoutFiltrado = stockoutComLocais.filter(item => {
            const desc = (item.prd_desc || '').toLowerCase();
            
            // Prefixos especiais - excluir produtos marcados
            // [HH] = Happy Hour, [PP] = Pegue e Pague, [DD] = Dose Dupla, [IN] = Uso Interno
            if (desc.startsWith('[hh]') || desc.startsWith('[pp]') || 
                desc.startsWith('[dd]') || desc.startsWith('[in]')) {
              return false;
            }
            
            // Filtros de produtos excluídos (config por bar em bar_local_mapeamento)
            if (produtosExcluidos.some(excl => desc.includes(excl))) {
              return false;
            }
            
            return true;
          });

          const total_ativos = stockoutFiltrado.length;
          const stockout_count = stockoutFiltrado.filter(item => item.prd_venda === 'N').length;
          percent_stockout = total_ativos > 0 ? (stockout_count / total_ativos) * 100 : 0;
        }

        // Atualizar percentuais no banco (incluindo stockout)
        const updateData: any = {
          percent_b: parseFloat(percent_b.toFixed(2)),
          percent_d: parseFloat(percent_d.toFixed(2)),
          percent_c: parseFloat(percent_c.toFixed(2)),
          percent_stockout: parseFloat(percent_stockout.toFixed(2))
        };

        // Atualizar todos os percentuais (incluindo stockout) no banco
        const { error: updatePercentError } = await supabase
          .from('eventos_base')
          .update(updateData)
          .eq('id', eventoId)
          .eq('bar_id', user.bar_id);

        if (updatePercentError) {
          console.warn('⚠️ Erro ao atualizar percentuais:', updatePercentError);
        }
      } else {
        // Mesmo sem dados analíticos, tentar calcular stockout COM FILTROS
        try {
          // ONDA 2C: Locais excluídos agora vêm do banco - se não configurado, usar []
          const locaisMapeamentoFallback = await getLocaisMapeamento(user.bar_id);
          const locaisExcluidosStockout = locaisMapeamentoFallback?.excluidos || [];
          
          const { data: dadosStockout } = await supabase
            .from('contahub_stockout')
            .select('prd_ativo, prd_venda, loc_desc, prd_desc')
            .eq('prd_ativo', 'S')
            .eq('data_consulta', eventoData.data_evento)
            .eq('bar_id', user.bar_id)
            .not('loc_desc', 'is', null);
          
          // Aplicar filtro de locais manualmente
          const dadosStockoutComLocais = dadosStockout?.filter(item => 
            !locaisExcluidosStockout.includes(item.loc_desc || '')
          ) || [];

          if (dadosStockoutComLocais && dadosStockoutComLocais.length > 0) {
            const produtosExcluidosFallback = locaisMapeamentoFallback?.produtos_excluidos_stockout || [];
            const stockoutFiltrado = dadosStockoutComLocais.filter(item => {
              const desc = (item.prd_desc || '').toLowerCase();
              
              // Prefixos especiais
              if (desc.startsWith('[hh]') || desc.startsWith('[pp]') || 
                  desc.startsWith('[dd]') || desc.startsWith('[in]')) {
                return false;
              }
              
              // Filtros de produtos excluídos (config por bar)
              if (produtosExcluidosFallback.some(excl => desc.includes(excl))) {
                return false;
              }
              
              return true;
            });

            const total_ativos = stockoutFiltrado.length;
            const stockout_count = stockoutFiltrado.filter(item => item.prd_venda === 'N').length;
            const percent_stockout = total_ativos > 0 ? 
              ((stockout_count / total_ativos) * 100) : 0;

            await supabase
              .from('eventos_base')
              .update({ percent_stockout: parseFloat(percent_stockout.toFixed(2)) })
            .eq('id', eventoId)
            .eq('bar_id', user.bar_id);
          }
        } catch (err) {
          console.warn('⚠️ Erro ao calcular stockout:', err);
        }
      }
    } catch (percentError) {
      console.warn('⚠️ Erro ao recalcular percentuais e stockout:', percentError);
      // Não falhar a requisição por causa disso
    }

    return NextResponse.json({
      success: true,
      message: 'Valores reais atualizados com sucesso',
      data: eventoAtualizado
    });

  } catch (error) {
    console.error('❌ Erro na API de edição de valores reais:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
