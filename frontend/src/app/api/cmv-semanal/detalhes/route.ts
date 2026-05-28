import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFatorCmv } from '@/lib/config/getFatorCmv';
import { tbl } from '@/lib/supabase/table-schemas';

// Rota dinamica (usa request.url) — cache via headers HTTP na resposta
export const dynamic = 'force-dynamic';
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
 * Buscar detalhes de consumo dos sócios (Onda 2A: recebe fator do banco)
 */
async function buscarDetalhesConsumoSocios(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  // Sócios: sócio, socio, x-socio, x-sócio, gonza, corbal, diogo, cadu, augusto, rodrigo, digao, vinicius, vini, bueno, kaizen, caisen, joão pedro, joao pedro, jp, 3v, cantucci
  const { data, error } = await supabase
    .schema('silver')
    .from('cliente_visitas')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_visita', dataInicio)
    .lte('data_visita', dataFim)
    .or('motivo_desconto.ilike.%sócio%,motivo_desconto.ilike.%socio%,motivo_desconto.ilike.%x-socio%,motivo_desconto.ilike.%x-sócio%,motivo_desconto.ilike.%gonza%,motivo_desconto.ilike.%corbal%,motivo_desconto.ilike.%diogo%,motivo_desconto.ilike.%cadu%,motivo_desconto.ilike.%augusto%,motivo_desconto.ilike.%rodrigo%,motivo_desconto.ilike.%digao%,motivo_desconto.ilike.%vinicius%,motivo_desconto.ilike.%vini%,motivo_desconto.ilike.%bueno%,motivo_desconto.ilike.%kaizen%,motivo_desconto.ilike.%caisen%,motivo_desconto.ilike.%joão pedro%,motivo_desconto.ilike.%joao pedro%,motivo_desconto.ilike.%jp%,motivo_desconto.ilike.%3v%,motivo_desconto.ilike.%cantucci%')
    .order('data_visita', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_socio',
    descricao: conta.cliente_nome || 'Conta não especificada',
    data: conta.data_visita,
    motivo: conta.motivo_desconto || '-',
    valor_produtos: parseFloat(conta.valor_produtos || 0),
    valor_desconto: parseFloat(conta.valor_desconto || 0),
    valor: (parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)) * fatorCmv,
    detalhes: `${conta.motivo_desconto || 'Consumo Sócio'} - Valor Bruto: R$ ${(parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de consumo de benefícios (Onda 2A: recebe fator do banco)
 */
async function buscarDetalhesConsumoBeneficios(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  // Clientes: aniver, anivers, aniversário, aniversario, aniversariante, niver, voucher, benefício, beneficio, mesa mágica, mágica, influencer, influ, influencia, influência, club, clube, midia, mídia, social, insta, digital, cliente, ambev, chegadeira, chegador
  const { data, error } = await supabase
    .schema('silver')
    .from('cliente_visitas')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_visita', dataInicio)
    .lte('data_visita', dataFim)
    .or('motivo_desconto.ilike.%aniver%,motivo_desconto.ilike.%anivers%,motivo_desconto.ilike.%aniversário%,motivo_desconto.ilike.%aniversario%,motivo_desconto.ilike.%aniversariante%,motivo_desconto.ilike.%niver%,motivo_desconto.ilike.%voucher%,motivo_desconto.ilike.%benefício%,motivo_desconto.ilike.%beneficio%,motivo_desconto.ilike.%mesa mágica%,motivo_desconto.ilike.%mágica%,motivo_desconto.ilike.%influencer%,motivo_desconto.ilike.%influ%,motivo_desconto.ilike.%influencia%,motivo_desconto.ilike.%influência%,motivo_desconto.ilike.%club%,motivo_desconto.ilike.%clube%,motivo_desconto.ilike.%midia%,motivo_desconto.ilike.%mídia%,motivo_desconto.ilike.%social%,motivo_desconto.ilike.%insta%,motivo_desconto.ilike.%digital%,motivo_desconto.ilike.%cliente%,motivo_desconto.ilike.%ambev%,motivo_desconto.ilike.%chegadeira%,motivo_desconto.ilike.%chegador%')
    .order('data_visita', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_beneficio',
    descricao: conta.cliente_nome || 'Conta não especificada',
    data: conta.data_visita,
    motivo: conta.motivo_desconto || '-',
    valor_produtos: parseFloat(conta.valor_produtos || 0),
    valor_desconto: parseFloat(conta.valor_desconto || 0),
    valor: (parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)) * fatorCmv,
    detalhes: `${conta.motivo_desconto || 'Benefício Cliente'} - Valor Bruto: R$ ${(parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de consumo ADM (Onda 2A: recebe fator do banco)
 */
async function buscarDetalhesConsumoAdm(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  // Funcionários: funcionários, funcionario, rh, recursos humanos, financeiro, fin, mkt, marketing, slu, adm, administrativo, prêmio, confra
  const { data, error } = await supabase
    .schema('silver')
    .from('cliente_visitas')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_visita', dataInicio)
    .lte('data_visita', dataFim)
    .or('motivo_desconto.ilike.%funcionários%,motivo_desconto.ilike.%funcionario%,motivo_desconto.ilike.%rh%,motivo_desconto.ilike.%recursos humanos%,motivo_desconto.ilike.%financeiro%,motivo_desconto.ilike.%fin%,motivo_desconto.ilike.%mkt%,motivo_desconto.ilike.%marketing%,motivo_desconto.ilike.%slu%,motivo_desconto.ilike.%adm%,motivo_desconto.ilike.%administrativo%,motivo_desconto.ilike.%prêmio%,motivo_desconto.ilike.%confra%')
    .order('data_visita', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_adm',
    descricao: conta.cliente_nome || 'Conta não especificada',
    data: conta.data_visita,
    motivo: conta.motivo_desconto || '-',
    valor_produtos: parseFloat(conta.valor_produtos || 0),
    valor_desconto: parseFloat(conta.valor_desconto || 0),
    valor: (parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)) * fatorCmv,
    detalhes: `${conta.motivo_desconto || 'Consumo ADM'} - Valor Bruto: R$ ${(parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de consumo de artista/banda (Onda 2A: recebe fator do banco)
 */
async function buscarDetalhesConsumoArtista(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  // Artistas: musico, músicos, dj, banda, artista, breno, benza, stz, zelia, tia, samba, sambadona, doze, boca, boka, pé, chão, segunda, resenha, pagode, roda, reconvexa, rodie, roudier, roudi, som, técnico, tecnico, pv, paulo victor, prod
  const { data, error } = await supabase
    .schema('silver')
    .from('cliente_visitas')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_visita', dataInicio)
    .lte('data_visita', dataFim)
    .or('motivo_desconto.ilike.%musico%,motivo_desconto.ilike.%músicos%,motivo_desconto.ilike.%dj%,motivo_desconto.ilike.%banda%,motivo_desconto.ilike.%artista%,motivo_desconto.ilike.%breno%,motivo_desconto.ilike.%benza%,motivo_desconto.ilike.%stz%,motivo_desconto.ilike.%zelia%,motivo_desconto.ilike.%tia%,motivo_desconto.ilike.%samba%,motivo_desconto.ilike.%sambadona%,motivo_desconto.ilike.%doze%,motivo_desconto.ilike.%boca%,motivo_desconto.ilike.%boka%,motivo_desconto.ilike.%pé%,motivo_desconto.ilike.%chão%,motivo_desconto.ilike.%segunda%,motivo_desconto.ilike.%resenha%,motivo_desconto.ilike.%pagode%,motivo_desconto.ilike.%roda%,motivo_desconto.ilike.%reconvexa%,motivo_desconto.ilike.%rodie%,motivo_desconto.ilike.%roudier%,motivo_desconto.ilike.%roudi%,motivo_desconto.ilike.%som%,motivo_desconto.ilike.%técnico%,motivo_desconto.ilike.%tecnico%,motivo_desconto.ilike.%pv%,motivo_desconto.ilike.%paulo victor%,motivo_desconto.ilike.%prod%')
    .order('data_visita', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_artista',
    descricao: conta.cliente_nome || 'Conta não especificada',
    data: conta.data_visita,
    motivo: conta.motivo_desconto || '-',
    valor_produtos: parseFloat(conta.valor_produtos || 0),
    valor_desconto: parseFloat(conta.valor_desconto || 0),
    valor: (parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)) * fatorCmv,
    detalhes: `${conta.motivo_desconto || 'Consumo Banda/DJ'} - Valor Bruto: R$ ${(parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de chegadeira (Onda 2A: recebe fator do banco)
 */
async function buscarDetalhesChegadeira(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  const { data, error } = await supabase
    .schema('silver')
    .from('cliente_visitas')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_visita', dataInicio)
    .lte('data_visita', dataFim)
    .ilike('motivo_desconto', '%chegadeira%')
    .order('data_visita', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'chegadeira',
    descricao: conta.cliente_nome || 'Conta não especificada',
    data: conta.data_visita,
    valor_produtos: parseFloat(conta.valor_produtos || 0),
    valor_desconto: parseFloat(conta.valor_desconto || 0),
    valor: (parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)) * fatorCmv,
    detalhes: `Chegadeira - Valor Bruto: R$ ${(parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)).toFixed(2)}`
  }));
}

/**
 * Buscar detalhes de consumo RH (Onda 2A: recebe fator do banco)
 */
async function buscarDetalhesConsumoRH(barId: number, dataInicio: string, dataFim: string, fatorCmv: number) {
  // RH: rh, recursos humanos (os demais funcionários estão em ADM)
  const { data, error } = await supabase
    .schema('silver')
    .from('cliente_visitas')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_visita', dataInicio)
    .lte('data_visita', dataFim)
    .or('motivo_desconto.ilike.%rh%,motivo_desconto.ilike.%recursos humanos%')
    .order('data_visita', { ascending: true });

  if (error || !data) return [];

  return data.map((conta: any) => ({
    tipo: 'consumo_rh',
    descricao: conta.cliente_nome || 'Conta não especificada',
    data: conta.data_visita,
    motivo: conta.motivo_desconto || '-',
    valor_produtos: parseFloat(conta.valor_produtos || 0),
    valor_desconto: parseFloat(conta.valor_desconto || 0),
    valor: (parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)) * fatorCmv,
    detalhes: `${conta.motivo_desconto || 'Consumo RH'} - Valor Bruto: R$ ${(parseFloat(conta.valor_produtos || 0) + parseFloat(conta.valor_desconto || 0)).toFixed(2)}`
  }));
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

