import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

// =====================================================
// GET - LISTAR METAS
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const ativas = searchParams.get('ativas') !== 'false';

    const supabase = await getAdminClient();

    // Buscar metas da coluna 'metas' da tabela bars
    const { data: bar, error } = await supabase
      .from('bars')
      .select('metas')
      .eq('id', user.bar_id)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar metas:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar metas' },
        { status: 500 }
      );
    }

    // Converter a estrutura de metas existente para o formato esperado
    const metasConvertidas = converterMetasParaFormatoEsperado(
      bar?.metas || {}
    );

    // Filtrar por categoria se especificada
    let metasFiltradas = [...metasConvertidas];
    if (categoria) {
      metasFiltradas = metasFiltradas.filter(
        (m: any) => m.categoria === categoria
      );
    }

    // Filtrar apenas metas ativas se especificado
    if (ativas) {
      metasFiltradas = metasFiltradas.filter(
        (m: any) => m.meta_ativa !== false
      );
    }

    // Organizar por categoria
    const metasOrganizadas = {
      indicadores_estrategicos:
        metasFiltradas.filter(
          (m: any) => m.categoria === 'indicadores_estrategicos'
        ) || [],
      cockpit_produtos:
        metasFiltradas.filter((m: any) => m.categoria === 'cockpit_produtos') ||
        [],
      cockpit_vendas:
        metasFiltradas.filter((m: any) => m.categoria === 'cockpit_vendas') ||
        [],
      cockpit_financeiro:
        metasFiltradas.filter(
          (m: any) => m.categoria === 'cockpit_financeiro'
        ) || [],
      cockpit_marketing:
        metasFiltradas.filter(
          (m: any) => m.categoria === 'cockpit_marketing'
        ) || [],
      indicadores_qualidade:
        metasFiltradas.filter(
          (m: any) => m.categoria === 'indicadores_qualidade'
        ) || [],
      indicadores_mensais:
        metasFiltradas.filter(
          (m: any) => m.categoria === 'indicadores_mensais'
        ) || [],
      metas_diarias:
        metasFiltradas.filter((m: any) => m.categoria === 'metas_diarias') ||
        [],
    };

    return NextResponse.json({
      success: true,
      data: metasOrganizadas,
      total: metasFiltradas.length,
    });
  } catch (error) {
    console.error('❌ Erro na API de metas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função para converter a estrutura de metas existente para o formato esperado
function converterMetasParaFormatoEsperado(metasOriginais: any): any[] {
  const metasConvertidas: any[] = [];
  let ordemExibicao = 1;

  // Converter cockpit_vendas
  if (metasOriginais.cockpit_vendas) {
    const vendas = metasOriginais.cockpit_vendas;
    if (vendas.quisabdom) {
      metasConvertidas.push({
        id: `cockpit_vendas_quisabdom`,
        categoria: 'cockpit_vendas',
        nome: 'QUI+SÁB+DOM',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: vendas.quisabdom,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (vendas.couvert_atracoes) {
      metasConvertidas.push({
        id: `cockpit_vendas_couvert_atracoes`,
        categoria: 'cockpit_vendas',
        nome: 'Couvert / Atrações',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: vendas.couvert_atracoes,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (vendas.percent_faturamento_ate_19h) {
      metasConvertidas.push({
        id: `cockpit_vendas_faturamento_19h`,
        categoria: 'cockpit_vendas',
        nome: '% Faturamento até 19h',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: vendas.percent_faturamento_ate_19h,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (vendas.venda_balcao !== undefined) {
      metasConvertidas.push({
        id: `cockpit_vendas_balcao`,
        categoria: 'cockpit_vendas',
        nome: 'Venda Balcão',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: vendas.venda_balcao,
        ordem_exibicao: ordemExibicao++,
      });
    }
  }

  // Converter cockpit_produtos
  if (metasOriginais.cockpit_produtos) {
    const produtos = metasOriginais.cockpit_produtos;
    if (produtos.stockout_comidas !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_stockout_comidas`,
        categoria: 'cockpit_produtos',
        nome: 'StockOut Comidas',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.stockout_comidas,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.stockout_drinks !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_stockout_drinks`,
        categoria: 'cockpit_produtos',
        nome: 'StockOut Drinks',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.stockout_drinks,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.stockout_bar !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_stockout_bar`,
        categoria: 'cockpit_produtos',
        nome: 'Stockout Bar',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.stockout_bar,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.percent_bebidas !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_percent_bebidas`,
        categoria: 'cockpit_produtos',
        nome: '% BEBIDAS',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.percent_bebidas,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.percent_drinks !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_percent_drinks`,
        categoria: 'cockpit_produtos',
        nome: '% DRINKS',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.percent_drinks,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.percent_comida !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_percent_comida`,
        categoria: 'cockpit_produtos',
        nome: '% COMIDA',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.percent_comida,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.percent_happyhour !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_percent_happyhour`,
        categoria: 'cockpit_produtos',
        nome: '% HappyHour',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.percent_happyhour,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.qtde_itens_bar !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_qtde_itens_bar`,
        categoria: 'cockpit_produtos',
        nome: 'Qtde Itens Bar',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.qtde_itens_bar,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.tempo_saida_bar !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_tempo_bar`,
        categoria: 'cockpit_produtos',
        nome: 'Tempo Saída Bar',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.tempo_saida_bar,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.qtde_itens_cozinha !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_qtde_itens_cozinha`,
        categoria: 'cockpit_produtos',
        nome: 'Qtde Itens Cozinha',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.qtde_itens_cozinha,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (produtos.tempo_saida_cozinha !== undefined) {
      metasConvertidas.push({
        id: `cockpit_produtos_tempo_cozinha`,
        categoria: 'cockpit_produtos',
        nome: 'Tempo Saída Cozinha',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: produtos.tempo_saida_cozinha,
        ordem_exibicao: ordemExibicao++,
      });
    }
  }

  // Converter indicadores_qualidade
  if (metasOriginais.indicadores_qualidade) {
    const qualidade = metasOriginais.indicadores_qualidade;
    if (qualidade.avaliacoes_5_google_trip !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_avaliacoes_5`,
        categoria: 'indicadores_qualidade',
        nome: 'Avaliações 5 Google/Trip',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: qualidade.avaliacoes_5_google_trip,
        meta_mensal: 0,
        valor_atual: qualidade.avaliacoes_5_google_trip,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.media_avaliacoes_google !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_media_google`,
        categoria: 'indicadores_qualidade',
        nome: 'Média Avaliações Google',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.media_avaliacoes_google,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_geral !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_geral`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Geral',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_geral,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_ambiente !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_ambiente`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Ambiente',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_ambiente,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_atendimento !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_atendimento`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Atendimento',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_atendimento,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_limpeza !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_limpeza`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Limpeza',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_limpeza,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_musica !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_musica`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Música',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_musica,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_comida !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_comida`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Comida',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_comida,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_drink !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_drink`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Drink',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_drink,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_preco !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_preco`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Preço',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_preco,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_reservas !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_reservas`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Reservas',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_reservas,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (qualidade.nps_felicidade_equipe !== undefined) {
      metasConvertidas.push({
        id: `indicadores_qualidade_nps_felicidade_equipe`,
        categoria: 'indicadores_qualidade',
        nome: 'NPS Felicidade Equipe',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: qualidade.nps_felicidade_equipe,
        ordem_exibicao: ordemExibicao++,
      });
    }
  }

  // Converter indicadores_estrategicos
  if (metasOriginais.indicadores_estrategicos) {
    const estrategicos = metasOriginais.indicadores_estrategicos;
    if (estrategicos.faturamento_total !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_faturamento_total`,
        categoria: 'indicadores_estrategicos',
        nome: 'Faturamento Total',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: estrategicos.faturamento_total,
        meta_mensal: 0,
        valor_atual: estrategicos.faturamento_total,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.faturamento_couvert !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_faturamento_couvert`,
        categoria: 'indicadores_estrategicos',
        nome: 'Faturamento Couvert',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: estrategicos.faturamento_couvert,
        meta_mensal: 0,
        valor_atual: estrategicos.faturamento_couvert,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.faturamento_bar !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_faturamento_bar`,
        categoria: 'indicadores_estrategicos',
        nome: 'Faturamento Bar',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: estrategicos.faturamento_bar,
        meta_mensal: 0,
        valor_atual: estrategicos.faturamento_bar,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.faturamento_cmovel !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_faturamento_cmovel`,
        categoria: 'indicadores_estrategicos',
        nome: 'Faturamento CMvível',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: estrategicos.faturamento_cmovel,
        meta_mensal: 0,
        valor_atual: estrategicos.faturamento_cmovel,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.cmv_rs !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_cmv_rs`,
        categoria: 'indicadores_estrategicos',
        nome: 'CMV R$',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: estrategicos.cmv_rs,
        meta_mensal: 0,
        valor_atual: estrategicos.cmv_rs,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.ticket_medio_contahub !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_ticket_medio`,
        categoria: 'indicadores_estrategicos',
        nome: 'Ticket Médio ContaHub',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.ticket_medio_contahub,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.tm_entrada !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_tm_entrada`,
        categoria: 'indicadores_estrategicos',
        nome: 'TM Entrada',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.tm_entrada,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.tm_bar !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_tm_bar`,
        categoria: 'indicadores_estrategicos',
        nome: 'TM Bar',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.tm_bar,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.cmv_limpo_percent !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_cmv_limpo_percent`,
        categoria: 'indicadores_estrategicos',
        nome: 'CMV Limpo %',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.cmv_limpo_percent,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.cmv_global_real !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_cmv_global_real`,
        categoria: 'indicadores_estrategicos',
        nome: 'CMV Global Real',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.cmv_global_real,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.cmv_teorico !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_cmv_teorico`,
        categoria: 'indicadores_estrategicos',
        nome: 'CMV Teórico',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.cmv_teorico,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.cmo_percent !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_cmo_percent`,
        categoria: 'indicadores_estrategicos',
        nome: 'CMO%',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.cmo_percent,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.atracao_faturamento !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_atracao_faturamento`,
        categoria: 'indicadores_estrategicos',
        nome: 'Atração/Faturamento',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.atracao_faturamento,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.retencao !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_retencao`,
        categoria: 'indicadores_estrategicos',
        nome: 'Retenção',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.retencao,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.clientes_atendidos !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_clientes_atendidos`,
        categoria: 'indicadores_estrategicos',
        nome: 'Clientes Atendidos',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.clientes_atendidos,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.clientes_ativos !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_clientes_ativos`,
        categoria: 'indicadores_estrategicos',
        nome: 'Clientes Ativos',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.clientes_ativos,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.reservas_totais !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_reservas_totais`,
        categoria: 'indicadores_estrategicos',
        nome: 'Reservas Totais',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.reservas_totais,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (estrategicos.reservas_presentes !== undefined) {
      metasConvertidas.push({
        id: `indicadores_estrategicos_reservas_presentes`,
        categoria: 'indicadores_estrategicos',
        nome: 'Reservas Presentes',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: estrategicos.reservas_presentes,
        ordem_exibicao: ordemExibicao++,
      });
    }
  }

  // Converter cockpit_financeiro
  if (metasOriginais.cockpit_financeiro) {
    const financeiro = metasOriginais.cockpit_financeiro;
    if (financeiro.imposto !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_imposto`,
        categoria: 'cockpit_financeiro',
        nome: 'Imposto',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.imposto,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.comissao !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_comissao`,
        categoria: 'cockpit_financeiro',
        nome: 'Comissão',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.comissao,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.cmv !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_cmv`,
        categoria: 'cockpit_financeiro',
        nome: 'CMV',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.cmv,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.cmo !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_cmo`,
        categoria: 'cockpit_financeiro',
        nome: 'CMO',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.cmo,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.pro_labore !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_pro_labore`,
        categoria: 'cockpit_financeiro',
        nome: 'PRO LABORE',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.pro_labore,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.ocupacao !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_ocupacao`,
        categoria: 'cockpit_financeiro',
        nome: 'Ocupação',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.ocupacao,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.adm_fixo !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_adm_fixo`,
        categoria: 'cockpit_financeiro',
        nome: 'Adm Fixo',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.adm_fixo,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.marketing_fixo !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_marketing_fixo`,
        categoria: 'cockpit_financeiro',
        nome: 'Marketing Fixo',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.marketing_fixo,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.escritorio_central !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_escritorio_central`,
        categoria: 'cockpit_financeiro',
        nome: 'Escritório Central',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.escritorio_central,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.adm_mkt_semana !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_adm_mkt_semana`,
        categoria: 'cockpit_financeiro',
        nome: 'Adm e Mkt da Semana',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.adm_mkt_semana,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.rh_estorno_outros_operacao !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_rh_estorno_outros_operacao`,
        categoria: 'cockpit_financeiro',
        nome: 'RH+Estorno+Outros Operação',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.rh_estorno_outros_operacao,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.materiais !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_materiais`,
        categoria: 'cockpit_financeiro',
        nome: 'Materiais',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.materiais,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.manutencao !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_manutencao`,
        categoria: 'cockpit_financeiro',
        nome: 'Manutenção',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.manutencao,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.atracoes_eventos !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_atracoes_eventos`,
        categoria: 'cockpit_financeiro',
        nome: 'Atrações/Eventos',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.atracoes_eventos,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.utensilios !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_utensilios`,
        categoria: 'cockpit_financeiro',
        nome: 'Utensílios',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.utensilios,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.consumacao_sem_socio !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_consumacao_sem_socio`,
        categoria: 'cockpit_financeiro',
        nome: 'Consumação (sem sócio)',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.consumacao_sem_socio,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (financeiro.lucro_rs !== undefined) {
      metasConvertidas.push({
        id: `cockpit_financeiro_lucro_rs`,
        categoria: 'cockpit_financeiro',
        nome: 'Lucro (R$)',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: financeiro.lucro_rs,
        ordem_exibicao: ordemExibicao++,
      });
    }
  }

  // Converter cockpit_marketing
  if (metasOriginais.cockpit_marketing) {
    const marketing = metasOriginais.cockpit_marketing;
    if (marketing.o_num_posts !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_o_num_posts`,
        categoria: 'cockpit_marketing',
        nome: '[O] Nº de Posts',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.o_num_posts,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.o_alcance !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_o_alcance`,
        categoria: 'cockpit_marketing',
        nome: '[O] Alcance',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.o_alcance,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.o_interacao !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_o_interacao`,
        categoria: 'cockpit_marketing',
        nome: '[O] Interação',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.o_interacao,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.o_compartilhamento !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_o_compartilhamento`,
        categoria: 'cockpit_marketing',
        nome: '[O] Compartilhamento',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.o_compartilhamento,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.o_engajamento !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_o_engajamento`,
        categoria: 'cockpit_marketing',
        nome: '[O] Engajamento',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.o_engajamento,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.o_num_stories !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_o_num_stories`,
        categoria: 'cockpit_marketing',
        nome: '[O] Nº Stories',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.o_num_stories,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.o_visu_stories !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_o_visu_stories`,
        categoria: 'cockpit_marketing',
        nome: '[O] Visu Stories',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.o_visu_stories,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.m_valor_investido !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_m_valor_investido`,
        categoria: 'cockpit_marketing',
        nome: '[M] Valor Investido',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.m_valor_investido,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.m_alcance !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_m_alcance`,
        categoria: 'cockpit_marketing',
        nome: '[M] Alcance',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.m_alcance,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.m_frequencia !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_m_frequencia`,
        categoria: 'cockpit_marketing',
        nome: '[M] Frequencia',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.m_frequencia,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.m_cpm !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_m_cpm`,
        categoria: 'cockpit_marketing',
        nome: '[M] CPM (Custo por Visu)',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.m_cpm,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.m_cliques !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_m_cliques`,
        categoria: 'cockpit_marketing',
        nome: '[M] Cliques',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.m_cliques,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.m_ctr !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_m_ctr`,
        categoria: 'cockpit_marketing',
        nome: '[M] CTR (Taxa de Clique)',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.m_ctr,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.m_custo_por_clique !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_m_custo_por_clique`,
        categoria: 'cockpit_marketing',
        nome: '[M] Custo por Clique',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.m_custo_por_clique,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (marketing.m_conversas_iniciadas !== undefined) {
      metasConvertidas.push({
        id: `cockpit_marketing_m_conversas_iniciadas`,
        categoria: 'cockpit_marketing',
        nome: '[M] Conversas Iniciadas',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: 0,
        valor_atual: marketing.m_conversas_iniciadas,
        ordem_exibicao: ordemExibicao++,
      });
    }
  }

  // Converter indicadores_mensais
  if (metasOriginais.indicadores_mensais) {
    const mensais = metasOriginais.indicadores_mensais;
    if (mensais.faturamento_total !== undefined) {
      metasConvertidas.push({
        id: `indicadores_mensais_faturamento_total`,
        categoria: 'indicadores_mensais',
        nome: 'Faturamento Total Mensal',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: mensais.faturamento_total,
        valor_atual: mensais.faturamento_total,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (mensais.faturamento_couvert !== undefined) {
      metasConvertidas.push({
        id: `indicadores_mensais_faturamento_couvert`,
        categoria: 'indicadores_mensais',
        nome: 'Faturamento Couvert Mensal',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: mensais.faturamento_couvert,
        valor_atual: mensais.faturamento_couvert,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (mensais.faturamento_bar !== undefined) {
      metasConvertidas.push({
        id: `indicadores_mensais_faturamento_bar`,
        categoria: 'indicadores_mensais',
        nome: 'Faturamento Bar Mensal',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: mensais.faturamento_bar,
        valor_atual: mensais.faturamento_bar,
        ordem_exibicao: ordemExibicao++,
      });
    }
    if (mensais.avaliacoes_5_google_trip !== undefined) {
      metasConvertidas.push({
        id: `indicadores_mensais_avaliacoes_5`,
        categoria: 'indicadores_mensais',
        nome: 'Avaliações 5 Google/Trip Mensal',
        meta_ativa: true,
        meta_diaria: 0,
        meta_semanal: 0,
        meta_mensal: mensais.avaliacoes_5_google_trip,
        valor_atual: mensais.avaliacoes_5_google_trip,
        ordem_exibicao: ordemExibicao++,
      });
    }
  }

  // Adicionar metas diárias por dia da semana
  const metasDiarias = [
    {
      id: 'meta_diaria_segunda',
      categoria: 'metas_diarias',
      nome: 'Segunda-feira',
      meta_ativa: true,
      meta_diaria: 5066.67,
      meta_semanal: 0,
      meta_mensal: 0,
      valor_atual: 5000.0,
      ticket_entrada: 21.0,
      ticket_bar: 82.5,
      meta_pessoas: Math.round(5066.67 / (21.0 + 82.5)), // 49 pessoas
      custo_artistico: 1500.0,
      custo_producao: 330.0,
      percent_art_fat: 36,
      ordem_exibicao: ordemExibicao++,
    },
    {
      id: 'meta_diaria_quarta',
      categoria: 'metas_diarias',
      nome: 'Quarta-feira',
      meta_ativa: true,
      meta_diaria: 38506.67,
      meta_semanal: 0,
      meta_mensal: 0,
      valor_atual: 38000.0,
      ticket_entrada: 21.0,
      ticket_bar: 87.5,
      meta_pessoas: Math.round(38506.67 / (21.0 + 87.5)), // 355 pessoas
      custo_artistico: 5776.0,
      custo_producao: 396.0,
      percent_art_fat: 16,
      ordem_exibicao: ordemExibicao++,
    },
    {
      id: 'meta_diaria_quinta',
      categoria: 'metas_diarias',
      nome: 'Quinta-feira',
      meta_ativa: true,
      meta_diaria: 18240.0,
      meta_semanal: 0,
      meta_mensal: 0,
      valor_atual: 18000.0,
      ticket_entrada: 18.0,
      ticket_bar: 82.5,
      meta_pessoas: Math.round(18240.0 / (18.0 + 82.5)), // 181 pessoas
      custo_artistico: 440.0,
      custo_producao: 680.0,
      percent_art_fat: 6,
      ordem_exibicao: ordemExibicao++,
    },
    {
      id: 'meta_diaria_sexta',
      categoria: 'metas_diarias',
      nome: 'Sexta-feira',
      meta_ativa: true,
      meta_diaria: 62826.67,
      meta_semanal: 0,
      meta_mensal: 0,
      valor_atual: 62000.0,
      ticket_entrada: 16.0,
      ticket_bar: 75.0,
      meta_pessoas: Math.round(62826.67 / (16.0 + 75.0)), // 690 pessoas
      custo_artistico: 10565.33,
      custo_producao: 396.0,
      percent_art_fat: 17,
      ordem_exibicao: ordemExibicao++,
    },
    {
      id: 'meta_diaria_sabado',
      categoria: 'metas_diarias',
      nome: 'Sábado',
      meta_ativa: true,
      meta_diaria: 52693.33,
      meta_semanal: 0,
      meta_mensal: 0,
      valor_atual: 52000.0,
      ticket_entrada: 21.0,
      ticket_bar: 75.0,
      meta_pessoas: Math.round(52693.33 / (21.0 + 75.0)), // 549 pessoas
      custo_artistico: 5500.0,
      custo_producao: 1446.0,
      percent_art_fat: 13,
      ordem_exibicao: ordemExibicao++,
    },
    {
      id: 'meta_diaria_domingo',
      categoria: 'metas_diarias',
      nome: 'Domingo',
      meta_ativa: true,
      meta_diaria: 55733.33,
      meta_semanal: 0,
      meta_mensal: 0,
      valor_atual: 55000.0,
      ticket_entrada: 21.0,
      ticket_bar: 75.0,
      meta_pessoas: Math.round(55733.33 / (21.0 + 75.0)), // 580 pessoas
      custo_artistico: 11704.0,
      custo_producao: 4000.0,
      percent_art_fat: 28,
      ordem_exibicao: ordemExibicao++,
    },
  ];

  return [...metasConvertidas, ...metasDiarias];
}

// =====================================================
// POST - CRIAR NOVA META
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const body = await request.json();
    const {
      categoria,
      subcategoria,
      nome_meta,
      tipo_valor,
      valor_semanal,
      valor_mensal,
      valor_unico,
      unidade,
      descricao,
      cor_categoria,
      icone_categoria,
    } = body;

    // Validações
    if (!categoria || !nome_meta || !tipo_valor) {
      return NextResponse.json(
        { error: 'Categoria, nome da meta e tipo do valor são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Buscar metas existentes
    const { data: bar, error: fetchError } = await supabase
      .from('bars')
      .select('metas')
      .eq('id', user.bar_id)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar metas existentes:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar metas existentes' },
        { status: 500 }
      );
    }

    // Garantir que metasExistentes seja sempre um array
    const metasExistentes = Array.isArray(bar?.metas) ? bar.metas : [];

    // Buscar próxima ordem
    const ultimaMeta =
      metasExistentes.length > 0
        ? Math.max(...metasExistentes.map((m: any) => m.ordem_exibicao || 0))
        : 0;

    const novaOrdem = ultimaMeta + 1;

    // Criar nova meta
    const novaMeta = {
      id: crypto.randomUUID(),
      categoria,
      subcategoria,
      nome_meta,
      tipo_valor,
      valor_semanal,
      valor_mensal,
      valor_unico,
      unidade,
      descricao,
      cor_categoria,
      icone_categoria,
      ordem_exibicao: novaOrdem,
      meta_ativa: true,
      criado_por: user.auth_id,
      atualizado_por: user.auth_id,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    // Adicionar nova meta ao array
    const novasMetas = [...metasExistentes, novaMeta];

    // Atualizar a coluna metas
    const { error: updateError } = await supabase
      .from('bars')
      .update({
        metas: novasMetas,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', user.bar_id);

    if (updateError) {
      console.error('❌ Erro ao criar meta:', updateError);
      return NextResponse.json(
        { error: 'Erro ao criar meta' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: novaMeta,
      message: 'Meta criada com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao criar meta:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT - ATUALIZAR METAS EM LOTE
// =====================================================
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { metas } = await request.json();

    if (!Array.isArray(metas)) {
      return NextResponse.json(
        { error: 'Formato inválido: esperado array de metas' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Buscar metas existentes
    const { data: bar, error: fetchError } = await supabase
      .from('bars')
      .select('metas')
      .eq('id', user.bar_id)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar metas existentes:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar metas existentes' },
        { status: 500 }
      );
    }

    // Garantir que metasExistentes seja sempre um array
    const metasExistentes = Array.isArray(bar?.metas) ? bar.metas : [];

    // Atualizar cada meta
    const metasAtualizadas = metasExistentes.map((metaExistente: any) => {
      const metaAtualizada = metas.find((m: any) => m.id === metaExistente.id);
      if (metaAtualizada) {
        return {
          ...metaExistente,
          valor_semanal: metaAtualizada.valor_semanal,
          valor_mensal: metaAtualizada.valor_mensal,
          valor_unico: metaAtualizada.valor_unico,
          meta_ativa: metaAtualizada.meta_ativa,
          atualizado_por: user.auth_id,
          atualizado_em: new Date().toISOString(),
        };
      }
      return metaExistente;
    });

    // Atualizar a coluna metas
    const { error: updateError } = await supabase
      .from('bars')
      .update({
        metas: metasAtualizadas,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', user.bar_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar metas:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar metas' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: metasAtualizadas,
      message: `${metas.length} metas atualizadas com sucesso`,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar metas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
