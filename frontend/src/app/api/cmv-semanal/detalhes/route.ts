import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cache por 2 minutos para detalhes de CMV
export const revalidate = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET - Buscar detalhes granulares de um campo específico do CMV Semanal
 * 
 * Params:
 * - bar_id: ID do bar
 * - data_inicio: Data de início da semana
 * - data_fim: Data de fim da semana
 * - campo: Campo que se deseja detalhar
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const campo = searchParams.get('campo');

    if (!dataInicio || !dataFim || !campo) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: data_inicio, data_fim, campo' },
        { status: 400 }
      );
    }

    console.log(`🔍 Buscando detalhes de ${campo} para ${dataInicio} - ${dataFim}`);

    let detalhes: any[] = [];
    let subtotais: any = {};

    switch (campo) {
      // ========== COMPRAS ==========
      case 'compras_periodo':
      case 'compras_custo_comida':
      case 'compras_custo_bebidas':
      case 'compras_custo_drinks':
      case 'compras_custo_outros':
        detalhes = await buscarDetalhesCompras(barId, dataInicio, dataFim, campo);
        break;

      // ========== ESTOQUE INICIAL ==========
      case 'estoque_inicial':
      case 'estoque_inicial_cozinha':
      case 'estoque_inicial_bebidas':
      case 'estoque_inicial_drinks':
        detalhes = await buscarDetalhesEstoqueInicial(barId, dataInicio, dataFim, campo);
        break;

      // ========== ESTOQUE FINAL ==========
      case 'estoque_final':
      case 'estoque_final_cozinha':
      case 'estoque_final_bebidas':
      case 'estoque_final_drinks':
        detalhes = await buscarDetalhesEstoque(barId, dataInicio, dataFim, campo);
        break;

      // ========== CONSUMOS ==========
      case 'consumo_socios':
      case 'total_consumo_socios':
        detalhes = await buscarDetalhesConsumoSocios(barId, dataInicio, dataFim);
        break;

      case 'consumo_beneficios':
      case 'mesa_beneficios_cliente':
        detalhes = await buscarDetalhesConsumoBeneficios(barId, dataInicio, dataFim);
        break;

      case 'consumo_adm':
      case 'mesa_adm_casa':
        detalhes = await buscarDetalhesConsumoAdm(barId, dataInicio, dataFim);
        break;

      case 'consumo_artista':
      case 'mesa_banda_dj':
        detalhes = await buscarDetalhesConsumoArtista(barId, dataInicio, dataFim);
        break;

      case 'chegadeira':
        detalhes = await buscarDetalhesChegadeira(barId, dataInicio, dataFim);
        break;

      case 'mesa_rh':
      case 'consumo_rh':
        detalhes = await buscarDetalhesConsumoRH(barId, dataInicio, dataFim);
        break;

      // ========== VENDAS ==========
      case 'vendas_brutas':
      case 'vendas_liquidas':
      case 'faturamento_cmvivel':
        detalhes = await buscarDetalhesVendas(barId, dataInicio, dataFim, campo);
        break;

      // ========== CMV ==========
      case 'cmv_real':
        detalhes = await buscarDetalhesCMVReal(barId, dataInicio, dataFim);
        break;

      default:
        return NextResponse.json(
          { error: 'Campo não suportado para drill down', campo },
          { status: 400 }
        );
    }

    const total = detalhes.reduce((sum, item) => sum + (item.valor || 0), 0);

    return NextResponse.json({
      success: true,
      campo,
      data_inicio: dataInicio,
      data_fim: dataFim,
      detalhes,
      total,
      quantidade: detalhes.length,
      subtotais
    });

  } catch (error) {
    console.error('Erro ao buscar detalhes:', error);
    return NextResponse.json(
      { error: 'Erro interno ao buscar detalhes', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Buscar detalhes de compras do Nibo
 */
async function buscarDetalhesCompras(barId: number, dataInicio: string, dataFim: string, campo: string) {
  const { data, error } = await supabase
    .from('nibo_agendamentos')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_vencimento', dataInicio)
    .lte('data_vencimento', dataFim)
    .eq('tipo', 'Debit')
    .order('data_vencimento', { ascending: true });

  if (error) {
    console.error('Erro ao buscar compras:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Mapear categorias - baseado nas categorias reais do Nibo
  const categoriasCozinha = ['Custo Comida', 'Custo Cozinha', 'COMIDA', 'ALIMENTAÇÃO'];
  const categoriasBebidas = ['Custo Bebidas', 'BEBIDAS', 'Cerveja', 'Vinho'];
  const categoriasDrinks = ['Custo Drinks', 'DESTILADOS', 'DRINKS'];

  let detalhes: any[] = [];

  data.forEach((agendamento: any) => {
    const valor = parseFloat(agendamento.valor || 0);
    const categoria = agendamento.categoria_nome || '';
    const fornecedor = agendamento.stakeholder_nome || 'Fornecedor não especificado';
    const descricao = agendamento.descricao || agendamento.titulo || categoria;

    // Filtrar por campo específico
    let incluir = false;
    if (campo === 'compras_periodo') {
      // Todas as compras
      incluir = true;
    } else if (campo === 'compras_custo_comida' && categoriasCozinha.some(c => categoria.toUpperCase().includes(c.toUpperCase()))) {
      incluir = true;
    } else if (campo === 'compras_custo_bebidas' && categoriasBebidas.some(c => categoria.toUpperCase().includes(c.toUpperCase()))) {
      incluir = true;
    } else if (campo === 'compras_custo_drinks' && categoriasDrinks.some(c => categoria.toUpperCase().includes(c.toUpperCase()))) {
      incluir = true;
    } else if (campo === 'compras_custo_outros') {
      // Outros = tudo que não é comida/bebida/drinks
      const isComida = categoriasCozinha.some(c => categoria.toUpperCase().includes(c.toUpperCase()));
      const isBebida = categoriasBebidas.some(c => categoria.toUpperCase().includes(c.toUpperCase()));
      const isDrink = categoriasDrinks.some(c => categoria.toUpperCase().includes(c.toUpperCase()));
      incluir = !isComida && !isBebida && !isDrink;
    }

    if (!incluir) return;

    detalhes.push({
      tipo: 'compra',
      descricao: descricao,
      fornecedor: fornecedor,
      data: agendamento.data_vencimento || agendamento.data_pagamento,
      categoria: categoria,
      documento: agendamento.numero_documento || '-',
      status: agendamento.status || 'Pendente',
      valor: valor,
      detalhes: `${fornecedor} - ${categoria}`
    });
  });

  // Ordenar por valor decrescente
  detalhes.sort((a, b) => b.valor - a.valor);

  return detalhes;
}

/**
 * Buscar detalhes de estoque inicial
 */
async function buscarDetalhesEstoqueInicial(barId: number, dataInicio: string, dataFim: string, campo: string) {
  // Buscar a contagem mais recente ANTES do período
  const { data: ultimaContagem } = await supabase
    .from('contagem_estoque_insumos')
    .select('data_contagem')
    .eq('bar_id', barId)
    .lt('data_contagem', dataInicio)
    .order('data_contagem', { ascending: false })
    .limit(1)
    .single();

  if (!ultimaContagem) {
    return [{
      tipo: 'aviso',
      descricao: 'Nenhuma contagem de estoque encontrada antes deste período',
      valor: 0
    }];
  }

  const dataContagem = ultimaContagem.data_contagem;

  // Buscar insumos
  const { data: insumos } = await supabase
    .from('insumos')
    .select('id, nome, tipo_local, categoria, custo_unitario, unidade')
    .eq('bar_id', barId);

  if (!insumos) return [];

  // Buscar contagens
  const { data: contagens } = await supabase
    .from('contagem_estoque_insumos')
    .select('insumo_id, estoque_final')
    .eq('bar_id', barId)
    .eq('data_contagem', dataContagem);

  if (!contagens) return [];

  const insumosMap = new Map(insumos.map((i: any) => [i.id, i]));
  const categoriasCozinha = ['ARMAZÉM (C)', 'HORTIFRUTI (C)', 'MERCADO (C)', 'PÃES', 'PEIXE', 'PROTEÍNA', 'Mercado (S)', 'tempero', 'hortifruti', 'líquido'];
  const categoriasDrinks = ['ARMAZÉM B', 'DESTILADOS', 'DESTILADOS LOG', 'HORTIFRUTI B', 'IMPÉRIO', 'MERCADO B', 'POLPAS', 'Não-alcóolicos', 'OUTROS', 'polpa', 'fruta'];
  const categoriasExcluir = ['Descartáveis', 'Limpeza', 'Material de Escritório', 'Uniformes'];

  let detalhes: any[] = [];

  contagens.forEach((contagem: any) => {
    const insumo = insumosMap.get(contagem.insumo_id);
    if (!insumo || categoriasExcluir.includes(insumo.categoria)) return;

    const quantidade = parseFloat(contagem.estoque_final || 0);
    const custoUnitario = parseFloat(insumo.custo_unitario || 0);
    const valor = quantidade * custoUnitario;

    if (valor === 0) return;

    // Filtrar por campo específico
    let incluir = false;
    if (campo === 'estoque_inicial') {
      incluir = true;
    } else if (campo === 'estoque_inicial_cozinha' && insumo.tipo_local === 'cozinha' && categoriasCozinha.includes(insumo.categoria)) {
      incluir = true;
    } else if (campo === 'estoque_inicial_drinks' && insumo.tipo_local === 'cozinha' && categoriasDrinks.includes(insumo.categoria)) {
      incluir = true;
    } else if (campo === 'estoque_inicial_bebidas' && insumo.tipo_local === 'bar') {
      incluir = true;
    }

    if (!incluir) return;

    detalhes.push({
      tipo: 'estoque',
      descricao: insumo.nome,
      data: dataContagem,
      categoria: insumo.categoria,
      local: insumo.tipo_local === 'cozinha' ? 'Cozinha' : 'Bar',
      quantidade: quantidade,
      unidade: insumo.unidade || 'un',
      custo_unitario: custoUnitario,
      valor: valor,
      detalhes: `${quantidade.toFixed(2)} ${insumo.unidade || 'un'} × R$ ${custoUnitario.toFixed(2)}`
    });
  });

  // Ordenar por valor decrescente
  detalhes.sort((a, b) => b.valor - a.valor);

  return detalhes;
}

/**
 * Buscar detalhes de estoque
 */
async function buscarDetalhesEstoque(barId: number, dataInicio: string, dataFim: string, campo: string) {
  // Buscar a última contagem do período
  const { data: ultimaContagem } = await supabase
    .from('contagem_estoque_insumos')
    .select('data_contagem')
    .eq('bar_id', barId)
    .lte('data_contagem', dataFim)
    .order('data_contagem', { ascending: false })
    .limit(1)
    .single();

  if (!ultimaContagem) {
    return [{
      tipo: 'aviso',
      descricao: 'Nenhuma contagem de estoque encontrada para este período',
      valor: 0
    }];
  }

  const dataContagem = ultimaContagem.data_contagem;

  // Buscar insumos
  const { data: insumos } = await supabase
    .from('insumos')
    .select('id, nome, tipo_local, categoria, custo_unitario, unidade')
    .eq('bar_id', barId);

  if (!insumos) return [];

  // Buscar contagens
  const { data: contagens } = await supabase
    .from('contagem_estoque_insumos')
    .select('insumo_id, estoque_final')
    .eq('bar_id', barId)
    .eq('data_contagem', dataContagem);

  if (!contagens) return [];

  const insumosMap = new Map(insumos.map((i: any) => [i.id, i]));
  const categoriasCozinha = ['ARMAZÉM (C)', 'HORTIFRUTI (C)', 'MERCADO (C)', 'PÃES', 'PEIXE', 'PROTEÍNA', 'Mercado (S)', 'tempero', 'hortifruti', 'líquido'];
  const categoriasDrinks = ['ARMAZÉM B', 'DESTILADOS', 'DESTILADOS LOG', 'HORTIFRUTI B', 'IMPÉRIO', 'MERCADO B', 'POLPAS', 'Não-alcóolicos', 'OUTROS', 'polpa', 'fruta'];
  const categoriasExcluir = ['Descartáveis', 'Limpeza', 'Material de Escritório', 'Uniformes'];

  let detalhes: any[] = [];

  contagens.forEach((contagem: any) => {
    const insumo = insumosMap.get(contagem.insumo_id);
    if (!insumo || categoriasExcluir.includes(insumo.categoria)) return;

    const quantidade = parseFloat(contagem.estoque_final || 0);
    const custoUnitario = parseFloat(insumo.custo_unitario || 0);
    const valor = quantidade * custoUnitario;

    if (valor === 0) return;

    // Filtrar por campo específico
    let incluir = false;
    if (campo === 'estoque_final') {
      incluir = true;
    } else if (campo === 'estoque_final_cozinha' && insumo.tipo_local === 'cozinha' && categoriasCozinha.includes(insumo.categoria)) {
      incluir = true;
    } else if (campo === 'estoque_final_drinks' && insumo.tipo_local === 'cozinha' && categoriasDrinks.includes(insumo.categoria)) {
      incluir = true;
    } else if (campo === 'estoque_final_bebidas' && insumo.tipo_local === 'bar') {
      incluir = true;
    }

    if (!incluir) return;

    detalhes.push({
      tipo: 'estoque',
      descricao: insumo.nome,
      data: dataContagem,
      categoria: insumo.categoria,
      local: insumo.tipo_local === 'cozinha' ? 'Cozinha' : 'Bar',
      quantidade: quantidade,
      unidade: insumo.unidade || 'un',
      custo_unitario: custoUnitario,
      valor: valor,
      detalhes: `${quantidade.toFixed(2)} ${insumo.unidade || 'un'} × R$ ${custoUnitario.toFixed(2)}`
    });
  });

  // Ordenar por valor decrescente
  detalhes.sort((a, b) => b.valor - a.valor);

  return detalhes;
}

/**
 * Buscar detalhes de consumo dos sócios
 */
async function buscarDetalhesConsumoSocios(barId: number, dataInicio: string, dataFim: string) {
  const { data, error } = await supabase
    .from('contahub_periodo')
    .select('*')
    .eq('bar_id', barId)
    .gte('dt_gerencial', dataInicio)
    .lte('dt_gerencial', dataFim)
    .or('motivo.ilike.%sócio%,motivo.ilike.%socio%,motivo.ilike.%x-socio%,motivo.ilike.%x-sócio%,motivo.ilike.%gonza%,motivo.ilike.%corbal%,motivo.ilike.%diogo%,motivo.ilike.%cadu%,motivo.ilike.%augusto%,motivo.ilike.%rodrigo%,motivo.ilike.%digao%,motivo.ilike.%vinicius%,motivo.ilike.%vini%,motivo.ilike.%bueno%,motivo.ilike.%3v%,motivo.ilike.%cantucci%,motivo.ilike.%joão pedro%,motivo.ilike.%joao pedro%,motivo.ilike.%jp%')
    .order('dt_gerencial', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_socio',
    descricao: conta.nm_conta || 'Conta não especificada',
    data: conta.dt_gerencial,
    motivo: conta.motivo || '-',
    valor_produtos: parseFloat(conta.vr_produtos || 0),
    valor_desconto: parseFloat(conta.vr_desconto || 0),
    valor: (parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)) * 0.35, // CMV 35%
    detalhes: `${conta.motivo || 'Consumo Sócio'} - Valor Bruto: R$ ${(parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de consumo de benefícios
 */
async function buscarDetalhesConsumoBeneficios(barId: number, dataInicio: string, dataFim: string) {
  const { data, error } = await supabase
    .from('contahub_periodo')
    .select('*')
    .eq('bar_id', barId)
    .gte('dt_gerencial', dataInicio)
    .lte('dt_gerencial', dataFim)
    .or('motivo.ilike.%aniver%,motivo.ilike.%anivers%,motivo.ilike.%aniversário%,motivo.ilike.%aniversario%,motivo.ilike.%aniversariante%,motivo.ilike.%voucher%,motivo.ilike.%benefício%,motivo.ilike.%beneficio%')
    .order('dt_gerencial', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_beneficio',
    descricao: conta.nm_conta || 'Conta não especificada',
    data: conta.dt_gerencial,
    motivo: conta.motivo || '-',
    valor_produtos: parseFloat(conta.vr_produtos || 0),
    valor_desconto: parseFloat(conta.vr_desconto || 0),
    valor: (parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)) * 0.33, // CMV 33%
    detalhes: `${conta.motivo || 'Benefício Cliente'} - Valor Bruto: R$ ${(parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de consumo ADM
 */
async function buscarDetalhesConsumoAdm(barId: number, dataInicio: string, dataFim: string) {
  const { data, error } = await supabase
    .from('contahub_periodo')
    .select('*')
    .eq('bar_id', barId)
    .gte('dt_gerencial', dataInicio)
    .lte('dt_gerencial', dataFim)
    .or('motivo.ilike.%adm%,motivo.ilike.%administrativo%,motivo.ilike.%casa%')
    .order('dt_gerencial', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_adm',
    descricao: conta.nm_conta || 'Conta não especificada',
    data: conta.dt_gerencial,
    motivo: conta.motivo || '-',
    valor_produtos: parseFloat(conta.vr_produtos || 0),
    valor_desconto: parseFloat(conta.vr_desconto || 0),
    valor: (parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)) * 0.35, // CMV 35%
    detalhes: `${conta.motivo || 'Consumo ADM'} - Valor Bruto: R$ ${(parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de consumo de artista/banda
 */
async function buscarDetalhesConsumoArtista(barId: number, dataInicio: string, dataFim: string) {
  const { data, error } = await supabase
    .from('contahub_periodo')
    .select('*')
    .eq('bar_id', barId)
    .gte('dt_gerencial', dataInicio)
    .lte('dt_gerencial', dataFim)
    .or('motivo.ilike.%banda%,motivo.ilike.%dj%,motivo.ilike.%artista%,motivo.ilike.%músic%,motivo.ilike.%music%')
    .order('dt_gerencial', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_artista',
    descricao: conta.nm_conta || 'Conta não especificada',
    data: conta.dt_gerencial,
    motivo: conta.motivo || '-',
    valor_produtos: parseFloat(conta.vr_produtos || 0),
    valor_desconto: parseFloat(conta.vr_desconto || 0),
    valor: (parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)) * 0.35, // CMV 35%
    detalhes: `${conta.motivo || 'Consumo Banda/DJ'} - Valor Bruto: R$ ${(parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de chegadeira
 */
async function buscarDetalhesChegadeira(barId: number, dataInicio: string, dataFim: string) {
  const { data, error } = await supabase
    .from('contahub_periodo')
    .select('*')
    .eq('bar_id', barId)
    .gte('dt_gerencial', dataInicio)
    .lte('dt_gerencial', dataFim)
    .ilike('motivo', '%chegadeira%')
    .order('dt_gerencial', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'chegadeira',
    descricao: conta.nm_conta || 'Conta não especificada',
    data: conta.dt_gerencial,
    valor_produtos: parseFloat(conta.vr_produtos || 0),
    valor_desconto: parseFloat(conta.vr_desconto || 0),
    valor: (parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)) * 0.33, // CMV 33%
    detalhes: `Chegadeira - Valor Bruto: R$ ${(parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de consumo RH
 */
async function buscarDetalhesConsumoRH(barId: number, dataInicio: string, dataFim: string) {
  const { data, error } = await supabase
    .from('contahub_periodo')
    .select('*')
    .eq('bar_id', barId)
    .gte('dt_gerencial', dataInicio)
    .lte('dt_gerencial', dataFim)
    .or('motivo.ilike.%rh%,motivo.ilike.%recursos humanos%,motivo.ilike.%funcionário%,motivo.ilike.%funcionario%')
    .order('dt_gerencial', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_rh',
    descricao: conta.nm_conta || 'Conta não especificada',
    data: conta.dt_gerencial,
    motivo: conta.motivo || '-',
    valor_produtos: parseFloat(conta.vr_produtos || 0),
    valor_desconto: parseFloat(conta.vr_desconto || 0),
    valor: (parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)) * 0.35, // CMV 35%
    detalhes: `${conta.motivo || 'Consumo RH'} - Valor Bruto: R$ ${(parseFloat(conta.vr_produtos || 0) + parseFloat(conta.vr_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de vendas (agregado por dia)
 */
async function buscarDetalhesVendas(barId: number, dataInicio: string, dataFim: string, campo: string) {
  const { data, error } = await supabase
    .from('contahub_periodo')
    .select('*')
    .eq('bar_id', barId)
    .gte('dt_gerencial', dataInicio)
    .lte('dt_gerencial', dataFim)
    .order('dt_gerencial', { ascending: true });

  if (error || !data) return [];

  // Agrupar por dia
  const vendasPorDia = new Map<string, {
    totalBruto: number;
    totalLiquido: number;
    totalProdutos: number;
    totalServicos: number;
    totalDesconto: number;
    quantidadeContas: number;
  }>();

  data.forEach((conta: any) => {
    const dia = conta.dt_gerencial;
    const valorProdutos = parseFloat(conta.vr_produtos || 0);
    const valorServicos = parseFloat(conta.vr_servicos || 0);
    const valorDesconto = parseFloat(conta.vr_desconto || 0);
    const valorBruto = valorProdutos + valorServicos;
    const valorLiquido = valorBruto - valorDesconto;

    if (!vendasPorDia.has(dia)) {
      vendasPorDia.set(dia, {
        totalBruto: 0,
        totalLiquido: 0,
        totalProdutos: 0,
        totalServicos: 0,
        totalDesconto: 0,
        quantidadeContas: 0
      });
    }

    const agregado = vendasPorDia.get(dia)!;
    agregado.totalBruto += valorBruto;
    agregado.totalLiquido += valorLiquido;
    agregado.totalProdutos += valorProdutos;
    agregado.totalServicos += valorServicos;
    agregado.totalDesconto += valorDesconto;
    agregado.quantidadeContas += 1;
  });

  // Converter para array de detalhes
  const detalhes: any[] = [];

  vendasPorDia.forEach((agregado, dia) => {
    // Formatar data para exibição
    const dataFormatada = new Date(dia + 'T00:00:00').toLocaleDateString('pt-BR', { 
      weekday: 'short', 
      day: '2-digit', 
      month: '2-digit' 
    });

    if (campo === 'vendas_brutas') {
      detalhes.push({
        tipo: 'venda_dia',
        descricao: dataFormatada,
        data: dia,
        valor: agregado.totalBruto,
        quantidade_contas: agregado.quantidadeContas,
        valor_produtos: agregado.totalProdutos,
        valor_servicos: agregado.totalServicos,
        detalhes: `${agregado.quantidadeContas} conta(s) - Produtos: R$ ${agregado.totalProdutos.toFixed(2)} + Serviços: R$ ${agregado.totalServicos.toFixed(2)}`
      });
    } else if (campo === 'vendas_liquidas') {
      detalhes.push({
        tipo: 'venda_dia',
        descricao: dataFormatada,
        data: dia,
        valor: agregado.totalLiquido,
        quantidade_contas: agregado.quantidadeContas,
        valor_bruto: agregado.totalBruto,
        valor_desconto: agregado.totalDesconto,
        detalhes: `${agregado.quantidadeContas} conta(s) - Bruto: R$ ${agregado.totalBruto.toFixed(2)} - Desconto: R$ ${agregado.totalDesconto.toFixed(2)}`
      });
    } else if (campo === 'faturamento_cmvivel') {
      detalhes.push({
        tipo: 'venda_dia',
        descricao: dataFormatada,
        data: dia,
        valor: agregado.totalProdutos,
        quantidade_contas: agregado.quantidadeContas,
        detalhes: `${agregado.quantidadeContas} conta(s) - Produtos (sem serviços): R$ ${agregado.totalProdutos.toFixed(2)}`
      });
    }
  });

  // Ordenar por data
  detalhes.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  return detalhes;
}

/**
 * Buscar detalhes de CMV Real (composição)
 */
async function buscarDetalhesCMVReal(barId: number, dataInicio: string, dataFim: string) {
  // CMV Real é uma composição, então vamos mostrar os componentes
  // Isso requer buscar o registro CMV da semana
  const { data: cmv } = await supabase
    .from('cmv_semanal')
    .select('*')
    .eq('bar_id', barId)
    .eq('data_inicio', dataInicio)
    .eq('data_fim', dataFim)
    .single();

  if (!cmv) return [];

  return [
    {
      tipo: 'componente',
      descricao: 'Estoque Inicial',
      sinal: '+',
      valor: parseFloat(cmv.estoque_inicial || 0),
      detalhes: 'Base para cálculo do CMV'
    },
    {
      tipo: 'componente',
      descricao: 'Compras do Período',
      sinal: '+',
      valor: parseFloat(cmv.compras_periodo || 0),
      detalhes: 'Total de compras realizadas'
    },
    {
      tipo: 'componente',
      descricao: 'Estoque Final',
      sinal: '-',
      valor: -parseFloat(cmv.estoque_final || 0),
      detalhes: 'Estoque não consumido'
    },
    {
      tipo: 'componente',
      descricao: 'Consumo Sócios',
      sinal: '-',
      valor: -parseFloat(cmv.consumo_socios || 0),
      detalhes: 'Consumo dos sócios (35% do valor)'
    },
    {
      tipo: 'componente',
      descricao: 'Consumo Benefícios',
      sinal: '-',
      valor: -parseFloat(cmv.consumo_beneficios || 0),
      detalhes: 'Cortesias e benefícios (33% do valor)'
    },
    {
      tipo: 'componente',
      descricao: 'Consumo ADM',
      sinal: '-',
      valor: -parseFloat(cmv.consumo_adm || 0),
      detalhes: 'Consumo administrativo (35% do valor)'
    },
    {
      tipo: 'componente',
      descricao: 'Consumo RH',
      sinal: '-',
      valor: -parseFloat(cmv.consumo_rh || 0),
      detalhes: 'Consumo RH e funcionários (35% do valor)'
    },
    {
      tipo: 'componente',
      descricao: 'Consumo Artista',
      sinal: '-',
      valor: -parseFloat(cmv.consumo_artista || 0),
      detalhes: 'Consumo banda/DJ (35% do valor)'
    },
    {
      tipo: 'componente',
      descricao: 'Outros Ajustes',
      sinal: cmv.outros_ajustes >= 0 ? '-' : '+',
      valor: -parseFloat(cmv.outros_ajustes || 0),
      detalhes: 'Ajustes manuais diversos'
    },
    {
      tipo: 'componente',
      descricao: 'Ajuste Bonificações',
      sinal: '+',
      valor: parseFloat(cmv.ajuste_bonificacoes || 0),
      detalhes: 'Bonificações recebidas de fornecedores'
    },
  ].filter(item => item.valor !== 0);
}

