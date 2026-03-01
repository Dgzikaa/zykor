import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log('🔄 API Edição Valores Reais - Evento ID:', id);

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

    console.log('📝 Dados recebidos para edição:', {
      eventoId,
      real_r: body.real_r,
      cl_real: body.cl_real,
      te_real: body.te_real,
      tb_real: body.tb_real,
      t_medio: body.t_medio,
      res_tot: body.res_tot,
      res_p: body.res_p
    });

    console.log('🔍 Debug - Body completo recebido:', body);
    console.log('🔍 Debug - JSON.stringify do body:', JSON.stringify(body));
    console.log('🔍 Debug - Object.keys do body:', Object.keys(body));
    console.log('🔍 Debug - body.real_r diretamente:', body.real_r);
    console.log('🔍 Debug - body["real_r"] com colchetes:', body["real_r"]);
    console.log('🔍 Debug - Tipo de cada valor:', {
      real_r: typeof body.real_r,
      cl_real: typeof body.cl_real,
      te_real: typeof body.te_real,
      tb_real: typeof body.tb_real,
      t_medio: typeof body.t_medio,
      res_tot: typeof body.res_tot,
      res_p: typeof body.res_p
    });

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

    console.log('✅ Evento encontrado:', evento.nome);

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

    console.log('✅ Valores reais atualizados com sucesso para evento:', evento.nome);

    // 🔄 RECALCULAR PERCENTUAIS E STOCKOUT DO CONTAHUB (SEMPRE ATUALIZAR)
    // Os percentuais %B, %D, %C e %S (stockout) vêm do Contahub e devem sempre estar atualizados
    console.log('🔄 Recalculando percentuais e stockout do Contahub para evento:', eventoId);
    try {
      // Buscar dados do evento para pegar a data
      const { data: eventoData } = await supabase
        .from('eventos_base')
        .select('data_evento')
        .eq('id', eventoId)
        .single();

      if (!eventoData) {
        console.log('⚠️ Evento não encontrado para recalcular percentuais');
        throw new Error('Evento não encontrado');
      }

      // Buscar dados do Contahub Analítico para recalcular percentuais
      // Excluir categorias de compras/estoque
      const { data: contahubData, error: contahubError } = await supabase
        .from('contahub_analitico')
        .select('valorfinal, loc_desc, grp_desc')
        .eq('trn_dtgerencial', eventoData.data_evento)
        .eq('bar_id', user.bar_id)
        .not('grp_desc', 'in', '("Mercadorias- Compras","Insumos","Uso Interno")');

      if (!contahubError && contahubData && contahubData.length > 0) {
        // Calcular totais por categoria
        let valor_bebidas = 0;
        let valor_comidas = 0;
        let valor_drinks = 0;
        let valor_outros = 0;
        let total_valorfinal = 0;

        // Classificação específica por bar
        const locaisBebidas = ['Chopp', 'Baldes', 'Pegue e Pague', 'PP', 'Venda Volante', 'Bar'];
        const locaisComidas = ['Cozinha', 'Cozinha 1', 'Cozinha 2'];
        const locaisDrinksBase = ['Preshh', 'Drinks', 'Drinks Autorais', 'Mexido', 'Shot e Dose', 'Batidos', 'Montados'];
        const locaisDrinks = user.bar_id === 4 ? [...locaisDrinksBase, 'Salao'] : locaisDrinksBase;

        contahubData.forEach(item => {
          const valor = item.valorfinal || 0;
          const loc = item.loc_desc || '';
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
        // Filtros de locais específicos por bar
        const locaisExcluidos = user.bar_id === 4 
          ? ['Pegue e Pague', 'Shot e Dose', 'Venda Volante'] // Deboche: exclui Shot e Dose
          : ['Pegue e Pague', 'Venda Volante', 'Baldes']; // Ordinário: inclui Shot e Dose, exclui Baldes

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
          // Aplicar filtros de prefixo manualmente (case-insensitive)
          const stockoutFiltrado = stockoutComLocais.filter(item => {
            const desc = (item.prd_desc || '').toLowerCase();
            
            // Filtros comuns para ambos os bares
            if (desc.startsWith('[hh]') || desc.startsWith('[pp]') || 
                desc.startsWith('[dd]') || desc.startsWith('[in]')) {
              return false;
            }
            
            // Filtros específicos do Deboche (bar_id = 4)
            if (user.bar_id === 4) {
              if (desc.includes('dose dupla') || desc.includes('dose dulpa') ||
                  desc.includes('chegadeira') || desc.includes('sem álcool') ||
                  desc.includes('sem alcool') || desc.includes('grupo adicional') ||
                  desc.includes('promo chivas') || desc.includes('uso interno')) {
                return false;
              }
            }
            
            return true;
          });

          const total_ativos = stockoutFiltrado.length;
          const stockout_count = stockoutFiltrado.filter(item => item.prd_venda === 'N').length;
          percent_stockout = total_ativos > 0 ? (stockout_count / total_ativos) * 100 : 0;
          console.log(`✅ Stockout calculado (com filtros do analítico): ${stockout_count}/${total_ativos} = ${percent_stockout.toFixed(1)}%`);
        } else {
          console.log('⚠️ Sem dados de stockout para esta data');
        }

        // Atualizar percentuais no banco (incluindo stockout)
        const updateData: any = {
          percent_b: parseFloat(percent_b.toFixed(2)),
          percent_d: parseFloat(percent_d.toFixed(2)),
          percent_c: parseFloat(percent_c.toFixed(2)),
          percent_stockout: parseFloat(percent_stockout.toFixed(2))
        };

        console.log(`✅ Percentuais calculados: %B=${percent_b.toFixed(1)}%, %D=${percent_d.toFixed(1)}%, %C=${percent_c.toFixed(1)}%, %S=${percent_stockout.toFixed(1)}%`);
        
        // Atualizar todos os percentuais (incluindo stockout) no banco
        const { error: updatePercentError } = await supabase
          .from('eventos_base')
          .update(updateData)
          .eq('id', eventoId)
          .eq('bar_id', user.bar_id);

        if (updatePercentError) {
          console.warn('⚠️ Erro ao atualizar percentuais:', updatePercentError);
        } else {
          console.log(`✅ Todos os percentuais atualizados no banco`);
        }
      } else {
        console.log('⚠️ Sem dados do Contahub Analítico para recalcular percentuais');
        
        // Mesmo sem dados analíticos, tentar calcular stockout COM FILTROS
        try {
          console.log('🔄 Tentando calcular apenas stockout...');
          
          // Filtros de locais específicos por bar
          const locaisExcluidosStockout = user.bar_id === 4 
            ? ['Pegue e Pague', 'Shot e Dose', 'Venda Volante']
            : ['Pegue e Pague', 'Venda Volante', 'Baldes'];
          
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
            // Aplicar filtros de prefixo (case-insensitive)
            const stockoutFiltrado = dadosStockoutComLocais.filter(item => {
              const desc = (item.prd_desc || '').toLowerCase();
              
              // Filtros comuns
              if (desc.startsWith('[hh]') || desc.startsWith('[pp]') || 
                  desc.startsWith('[dd]') || desc.startsWith('[in]')) {
                return false;
              }
              
              // Filtros específicos do Deboche
              if (user.bar_id === 4) {
                if (desc.includes('dose dupla') || desc.includes('dose dulpa') ||
                    desc.includes('chegadeira') || desc.includes('sem álcool') ||
                    desc.includes('sem alcool') || desc.includes('grupo adicional') ||
                    desc.includes('promo chivas') || desc.includes('uso interno')) {
                  return false;
                }
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

            console.log(`✅ Stockout calculado (com filtros do analítico): ${percent_stockout.toFixed(1)}%`);
          }
        } catch (err) {
          console.warn('⚠️ Erro ao calcular stockout:', err);
        }
      }
    } catch (percentError) {
      console.warn('⚠️ Erro ao recalcular percentuais e stockout:', percentError);
      // Não falhar a requisição por causa disso
    }

    // Log da operação para auditoria
    console.log('📊 Valores salvos:', {
      evento_id: eventoId,
      evento_nome: evento.nome,
      real_r: body.real_r,
      cl_real: body.cl_real,
      te_real: body.te_real,
      tb_real: body.tb_real,
      t_medio: body.t_medio,
      usuario: user.email,
      timestamp: new Date().toISOString()
    });

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
