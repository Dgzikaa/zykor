import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getFatorCmv } from '@/lib/config/getFatorCmv';
import { tbl } from '@/lib/supabase/table-schemas';

// Rota dinamica (usa request.url) — cache via headers HTTP na resposta
export const dynamic = 'force-dynamic';
export const revalidate = 120;

const supabase = createServiceRoleClient();

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

    // Buscar fator CMV do banco uma vez (centralizado)
    const fatorCmv = await getFatorCmv(supabase, barId);

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

      // ========== CONSUMOS (Onda 2A: usa fator do banco) ==========
      case 'consumo_socios':
      case 'total_consumo_socios':
        detalhes = await buscarDetalhesConsumoSocios(barId, dataInicio, dataFim, fatorCmv);
        break;

      case 'consumo_beneficios':
      case 'mesa_beneficios_cliente':
        detalhes = await buscarDetalhesConsumoBeneficios(barId, dataInicio, dataFim, fatorCmv);
        break;

      case 'consumo_adm':
      case 'mesa_adm_casa':
        detalhes = await buscarDetalhesConsumoAdm(barId, dataInicio, dataFim, fatorCmv);
        break;

      case 'consumo_artista':
      case 'mesa_banda_dj':
        detalhes = await buscarDetalhesConsumoArtista(barId, dataInicio, dataFim, fatorCmv);
        break;

      case 'chegadeira':
        detalhes = await buscarDetalhesChegadeira(barId, dataInicio, dataFim, fatorCmv);
        break;

      case 'mesa_rh':
      case 'consumo_rh':
        detalhes = await buscarDetalhesConsumoRH(barId, dataInicio, dataFim, fatorCmv);
        break;

      // ========== VENDAS ==========
      case 'vendas_brutas':
      case 'vendas_liquidas':
      case 'faturamento_cmvivel':
        detalhes = await buscarDetalhesVendas(barId, dataInicio, dataFim, campo);
        break;

      // ========== CMV ==========
      case 'cmv_real':
      case 'cmv_percentual':
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
 * Buscar detalhes de compras do Conta Azul (bronze_contaazul_lancamentos).
 *
 * Antes lia de financial.lancamentos_financeiros (tabela legada Nibo que nem
 * existe mais) — query falhava silencioso e popup mostrava zero.
 *
 * Categorias CA por bar:
 *   Comida:  CUSTO COMIDA (Ord), CUSTO COMIDAS (Deb)
 *   Bebidas: Custo Bebidas (Ord), CUSTO BEBIDAS (Deb) — agrupa CUSTO OUTROS junto
 *            (UI n mostra linha separada — ver cmv-semanal-auto + mensal/route.ts)
 *   Drinks:  Custo Drinks (Ord), CUSTO DRINKS (Deb)
 *
 * Valor: valor_pago se >0 (efetivo) senao valor_bruto (planejado).
 * RECEITA subtrai (devolucao/credito do CA).
 */
async function buscarDetalhesCompras(barId: number, dataInicio: string, dataFim: string, campo: string) {
  const { data, error } = await (supabase as any)
    .schema('bronze')
    .from('bronze_contaazul_lancamentos')
    .select('valor_bruto, valor_pago, categoria_nome, tipo, data_competencia, descricao, pessoa_nome, status_traduzido, numero_documento')
    .eq('bar_id', barId)
    .in('tipo', ['DESPESA', 'RECEITA'])
    .is('excluido_em', null)
    .or('categoria_nome.ilike.%custo comida%,categoria_nome.ilike.%custo bebida%,categoria_nome.ilike.%custo drink%,categoria_nome.ilike.%custo outros%')
    .gte('data_competencia', dataInicio)
    .lte('data_competencia', dataFim)
    .order('data_competencia', { ascending: true });

  if (error) {
    console.error('[cmv-semanal/detalhes] Erro ao buscar compras:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  const detalhes: any[] = [];

  for (const r of data as any[]) {
    const valorBruto = parseFloat(String(r.valor_bruto || 0)) || 0;
    const valorPago = parseFloat(String(r.valor_pago || 0)) || 0;
    const valorEfetivo = valorPago > 0 ? valorPago : valorBruto;
    const tipo = String(r.tipo || '').toUpperCase();
    const sinal = tipo === 'RECEITA' ? -1 : 1;
    const valor = valorEfetivo * sinal;

    const categoria = String(r.categoria_nome || '');
    const catLower = categoria.toLowerCase();
    const isComida = catLower.includes('custo comida');
    const isBebida = catLower.includes('custo bebida');
    const isDrink = catLower.includes('custo drink');
    const isOutros = catLower.includes('custo outros');

    let incluir = false;
    if (campo === 'compras_periodo') {
      incluir = true;
    } else if (campo === 'compras_custo_comida' && isComida) {
      incluir = true;
    } else if (campo === 'compras_custo_bebidas' && (isBebida || isOutros)) {
      // Custo Outros agrupado em Bebidas (mesma logica do mensal + edge fn)
      incluir = true;
    } else if (campo === 'compras_custo_drinks' && isDrink) {
      incluir = true;
    } else if (campo === 'compras_custo_outros' && isOutros) {
      // Mantido p/ caso o sócio queira ver isolado mesmo agrupado na soma
      incluir = true;
    }

    if (!incluir) continue;

    const fornecedor = r.pessoa_nome || 'Fornecedor não especificado';
    const descricao = r.descricao || categoria;

    detalhes.push({
      tipo: 'compra',
      descricao,
      fornecedor,
      data: r.data_competencia,
      categoria,
      documento: r.numero_documento || '-',
      status: r.status_traduzido || (tipo === 'RECEITA' ? 'Receita' : 'Despesa'),
      valor,
      valor_bruto: valorBruto,
      valor_pago: valorPago,
      detalhes: `${fornecedor} - ${categoria}${tipo === 'RECEITA' ? ' (Devolução)' : ''}`,
    });
  }

  // Ordenar por valor decrescente (em modulo, pra devolucao aparecer junto)
  detalhes.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

  return detalhes;
}

/**
 * Categorias canonicas de insumos (sincronizado com buscar-dados-automaticos)
 * Cada bar tem cadastro proprio + typos historicos. Listas hard mas pelo menos
 * unica fonte de verdade — se uma categoria nova aparecer, atualizar nos 2 lados.
 */
const CATEGORIAS_COZINHA_CANONICAS = [
  'cozinha',           // genericos (~280 no Ord)
  'ARMAZÉM (C)', 'HORTIFRUTI (C)', 'MERCADO (C)', 'Mercado (S)',
  'PÃES', 'PEIXE', 'PROTEÍNA', 'PROTEÍNA (C)', 'PROTEÍNA - FEIJOADA',
  'MERCADO (B)', 'ARMAZÉM (B)', 'HORTIFRUTI (B)',
  'tempero', 'hortifruti', 'líquido', 'Categoria',
];
const CATEGORIAS_DRINKS_CANONICAS = [
  'ARMAZÉM B', 'DESTILADOS', 'DESTILADO', 'DESTILADOS LOG', 'DESTILADOS (LOG)',
  'HORTIFRUTI B', 'IMPÉRIO', 'MERCADO B', 'POLPAS', 'POLPA',
  'OUTROS', 'IMPÉRIO',
];
const CATEGORIAS_BEBIDAS_CANONICAS = [
  'Retornáveis', 'retornáveis', 'Retornável',
  'Vinhos', 'Long Neck', 'Lata', 'Artesanal', 'Chopp', 'Chicles',
  'polpa', 'fruta',
];
const CATEGORIAS_EXCLUIR = [
  'HORTIFRUTI (F)', 'MERCADO (F)', 'PROTEÍNA (F)',  // Funcionarios (CMA)
  'Descartáveis', 'Limpeza', 'Material de Escritório', 'Uniformes',
];

type CategoriaMix = 'cozinha' | 'drinks' | 'bebidas' | null;

function classificarInsumoMix(insumo: { tipo_local?: string; categoria?: string }, codigo?: string): CategoriaMix {
  const cat = insumo.categoria || '';
  if (CATEGORIAS_EXCLUIR.includes(cat)) return null;

  // BEBIDAS: tipo_local = 'bar'
  if (insumo.tipo_local === 'bar') return 'bebidas';

  // PRODUCAO: codigo pd* = drinks, pc* = cozinha (override de categoria)
  if (codigo?.startsWith('pd')) return 'drinks';
  if (codigo?.startsWith('pc')) return 'cozinha';

  if (insumo.tipo_local === 'cozinha') {
    if (CATEGORIAS_DRINKS_CANONICAS.includes(cat)) return 'drinks';
    if (CATEGORIAS_COZINHA_CANONICAS.includes(cat)) return 'cozinha';
    if (cat === 'Não-alcóolicos') return 'drinks';  // bebida do tipo_local cozinha
  }
  // Bebidas canonicas (categoria veio do bar mas pode aparecer marcada em cozinha)
  if (CATEGORIAS_BEBIDAS_CANONICAS.includes(cat)) return 'bebidas';

  return null;
}

/**
 * Buscar a data da contagem relevante p/ o periodo + montar detalhes de estoque.
 * Lógica canonica espelhada de cmv-semanal/buscar-dados-automaticos:
 *   - inicial: ultima contagem ANTES de dataInicio
 *   - final:   ultima contagem ATE dataFim
 * Categorias via classificarInsumoMix. Valor = estoque_final * custo_unitario
 * da CONTAGEM (preco congelado no momento, n usa preco atual do insumo).
 */
async function buscarDetalhesEstoqueInicial(barId: number, dataInicio: string, dataFim: string, campo: string) {
  return buscarDetalhesEstoqueGeneric(barId, dataInicio, dataFim, campo, 'inicial');
}

async function buscarDetalhesEstoque(barId: number, dataInicio: string, dataFim: string, campo: string) {
  return buscarDetalhesEstoqueGeneric(barId, dataInicio, dataFim, campo, 'final');
}

async function buscarDetalhesEstoqueGeneric(
  barId: number,
  dataInicio: string,
  dataFim: string,
  campo: string,
  momento: 'inicial' | 'final',
) {
  // 1. Achar a contagem relevante
  let qContagem = (supabase as any)
    .schema('operations')
    .from('contagem_estoque_insumos')
    .select('data_contagem')
    .eq('bar_id', barId)
    .order('data_contagem', { ascending: false })
    .limit(1);
  qContagem = momento === 'inicial'
    ? qContagem.lt('data_contagem', dataInicio)
    : qContagem.lte('data_contagem', dataFim);

  const { data: ultimaContagemArr } = await qContagem;
  const ultimaContagem = ultimaContagemArr?.[0];
  if (!ultimaContagem) {
    return [{
      tipo: 'aviso',
      descricao: `Nenhuma contagem de estoque encontrada ${momento === 'inicial' ? 'antes desse' : 'ate o fim desse'} periodo`,
      valor: 0,
    }];
  }
  const dataContagem = ultimaContagem.data_contagem;

  // 2. Insumos do bar (lookup map)
  const { data: insumos } = await (supabase as any)
    .schema('operations')
    .from('insumos')
    .select('id, nome, tipo_local, categoria, unidade_medida, codigo')
    .eq('bar_id', barId);
  if (!insumos) return [];
  const insumosMap = new Map<number, any>(insumos.map((i: any) => [i.id, i]));

  // 3. Contagens dessa data (com custo congelado)
  const { data: contagens } = await (supabase as any)
    .schema('operations')
    .from('contagem_estoque_insumos')
    .select('insumo_id, insumo_codigo, estoque_final, custo_unitario')
    .eq('bar_id', barId)
    .eq('data_contagem', dataContagem);
  if (!contagens) return [];

  const campoPrefix = momento === 'inicial' ? 'estoque_inicial' : 'estoque_final';
  const detalhes: any[] = [];

  for (const c of contagens as any[]) {
    const insumo = insumosMap.get(c.insumo_id);
    if (!insumo) continue;

    const quantidade = parseFloat(String(c.estoque_final || 0)) || 0;
    const custoUnitario = parseFloat(String(c.custo_unitario || 0)) || 0;
    const valor = quantidade * custoUnitario;
    if (valor === 0) continue;

    const mix = classificarInsumoMix(insumo, c.insumo_codigo);
    if (mix === null) continue;

    let incluir = false;
    if (campo === campoPrefix) {
      incluir = true;
    } else if (campo === `${campoPrefix}_cozinha` && mix === 'cozinha') {
      incluir = true;
    } else if (campo === `${campoPrefix}_drinks` && mix === 'drinks') {
      incluir = true;
    } else if (campo === `${campoPrefix}_bebidas` && mix === 'bebidas') {
      incluir = true;
    }
    if (!incluir) continue;

    const unidade = insumo.unidade_medida || 'un';
    detalhes.push({
      tipo: 'estoque',
      descricao: insumo.nome,
      data: dataContagem,
      categoria: insumo.categoria,
      local: insumo.tipo_local === 'cozinha' ? 'Cozinha' : 'Bar',
      mix,
      quantidade,
      unidade,
      custo_unitario: custoUnitario,
      valor,
      detalhes: `${quantidade.toFixed(2)} ${unidade} × R$ ${custoUnitario.toFixed(2)}`,
    });
  }

  detalhes.sort((a, b) => b.valor - a.valor);
  return detalhes;
}

/**
 * Buscar detalhes de consumos classificados via RPC canonica.
 *
 * Antes: 6 handlers separados usavam silver.cliente_visitas + ILIKE hardcoded em
 * motivo_desconto — divergia do cell pq cmv-semanal-auto usa
 * public.classificar_consumo() (data-driven via financial.consumos_keywords).
 *
 * Agora: chama get_consumos_detalhes_semana (mesma logica do
 * get_consumos_classificados_semana). Bate na virgula com cmv_semanal.
 *
 * Categoria RPC → handler/cell:
 *   socios                  → buscarDetalhesConsumoSocios     (total_consumo_socios)
 *   clientes                → buscarDetalhesConsumoBeneficios (mesa_beneficios_cliente)
 *   funcionarios_escritorio → buscarDetalhesConsumoAdm        (mesa_adm_casa)
 *   funcionarios_operacao   → buscarDetalhesConsumoRH         (mesa_rh)
 *   artistas                → buscarDetalhesConsumoArtista    (mesa_banda_dj)
 *
 * Chegadeira eh subset de 'clientes' filtrado por motivo ILIKE %chegadeira%.
 */
async function buscarDetalhesConsumoClassificado(
  barId: number,
  dataInicio: string,
  dataFim: string,
  categoria: 'socios' | 'clientes' | 'funcionarios_escritorio' | 'funcionarios_operacao' | 'artistas',
  fatorCmv: number,
  filtroMotivo?: string,
) {
  const { data, error } = await (supabase as any).rpc('get_consumos_detalhes_semana', {
    input_bar_id: barId,
    input_data_inicio: dataInicio,
    input_data_fim: dataFim,
    input_categoria: categoria,
  });

  if (error) {
    console.error('[cmv-semanal/detalhes] erro RPC get_consumos_detalhes_semana:', error);
    return [];
  }
  if (!data) return [];

  const rotulo: Record<typeof categoria, string> = {
    socios: 'Consumo Sócio',
    clientes: 'Benefício Cliente',
    funcionarios_escritorio: 'Consumo ADM',
    funcionarios_operacao: 'Consumo RH',
    artistas: 'Consumo Banda/DJ',
  };

  const filtroLower = filtroMotivo?.toLowerCase();
  const detalhes: any[] = [];

  for (const r of data as any[]) {
    const motivo = r.motivo || '';
    if (filtroLower && !motivo.toLowerCase().includes(filtroLower)) continue;

    const desconto = parseFloat(String(r.valor_desconto || 0)) || 0;
    const qtd = parseFloat(String(r.qtd || 0)) || 0;
    // CELL eh BRUTO (cmv-semanal-auto guarda sem fator — fator entra so no cmv_real).
    // Popup soma `valor` na UI, entao valor = desconto bruto p/ fechar com cell.
    // `valor_cmv` exposto p/ inspecao do custo efetivo (bruto × fator).
    const valor = desconto;
    const valorCmv = desconto * fatorCmv;

    detalhes.push({
      tipo: filtroMotivo ? 'chegadeira' : `consumo_${categoria}`,
      descricao: r.prd_desc || rotulo[categoria],
      data: r.data,
      mesa: r.mesa || '-',
      motivo: motivo || '-',
      quantidade: qtd,
      valor_desconto: desconto,         // bruto (== valor, mantido p/ compat)
      valor,                              // bruto — soma == cell value
      valor_cmv: valorCmv,                // efetivo apos fator (p/ tooltip/debug)
      detalhes: `${motivo || rotulo[categoria]} — Mesa ${r.mesa ?? '-'} — Bruto R$ ${desconto.toFixed(2)} (CMV apos fator ${fatorCmv.toFixed(2)}: R$ ${valorCmv.toFixed(2)})`,
    });
  }

  // Ja vem ordenado por (data DESC, desconto DESC) do RPC, mas o filtro pode
  // ter mudado a distribuicao — reordena por valor decrescente p/ destacar maiores.
  detalhes.sort((a, b) => b.valor - a.valor);
  return detalhes;
}

async function buscarDetalhesConsumoSocios(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  return buscarDetalhesConsumoClassificado(barId, dataInicio, dataFim, 'socios', fatorCmv);
}

async function buscarDetalhesConsumoBeneficios(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  return buscarDetalhesConsumoClassificado(barId, dataInicio, dataFim, 'clientes', fatorCmv);
}

async function buscarDetalhesConsumoAdm(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  return buscarDetalhesConsumoClassificado(barId, dataInicio, dataFim, 'funcionarios_escritorio', fatorCmv);
}

async function buscarDetalhesConsumoArtista(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  return buscarDetalhesConsumoClassificado(barId, dataInicio, dataFim, 'artistas', fatorCmv);
}

async function buscarDetalhesChegadeira(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  // Subset de 'clientes' filtrado por motivo ILIKE %chegadeira%
  return buscarDetalhesConsumoClassificado(barId, dataInicio, dataFim, 'clientes', fatorCmv, 'chegadeira');
}

async function buscarDetalhesConsumoRH(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  // RH = funcionarios_operacao na classificacao canonica
  return buscarDetalhesConsumoClassificado(barId, dataInicio, dataFim, 'funcionarios_operacao', fatorCmv);
}

/**
 * Buscar detalhes de vendas (agregado por dia)
 */
async function buscarDetalhesVendas(barId: number, dataInicio: string, dataFim: string, campo: string) {
  const { data, error } = await supabase
    .schema('silver')
    .from('cliente_visitas')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_visita', dataInicio)
    .lte('data_visita', dataFim)
    .order('data_visita', { ascending: true });

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
    const dia = conta.data_visita;
    const valorProdutos = parseFloat(conta.valor_produtos || 0);
    const valorServicos = 0; // visitas não tem vr_servicos
    const valorDesconto = parseFloat(conta.valor_desconto || 0);
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
  const { data: cmv } = await tbl(supabase, 'cmv_semanal')
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

