import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // PIX é 1 lançamento por transação → pode ter muitas chamadas

/**
 * Stone -> Conta Azul: lançamento de contas a receber + taxa (execução manual, sem cron).
 *
 * Modelo (definido com o sócio):
 *  - Lançamos o LÍQUIDO (bruto − taxa) como conta a receber, tanto cartão quanto PIX.
 *  - CRÉDITO/DÉBITO: agrupados por BANDEIRA × VENCIMENTO (Visa/Master/Elo/Amex). Bandeira na
 *    descrição; categoria = Stone Crédito/Débito. Vencimento = prevision_payment_date do relatório
 *    Stone (num mesmo dia o débito pode liquidar em datas diferentes por fds/feriado).
 *  - PIX: 1 lançamento POR TRANSAÇÃO (não agrupa).
 *  - TAXA: compila 1 valor TOTAL do dia e lança um PAR que se compensa:
 *      (a) DESPESA em TAXA MAQUININHA (total do dia);
 *      (b) RECEITA em Outras Receitas, descrição "Compensação taxa maquininha" (mesmo total).
 *    Como já lançamos o líquido, o par mantém o caixa correto (líquido) e ainda deixa a taxa
 *    visível como linha de custo.
 *
 *  - GET  : preview do dia (não escreve no CA).
 *  - POST : cria os lançamentos (idempotente por financial.stone_ca_lancamento_log: bar,dia,chave,natureza).
 *
 * Bar 3 primeiro. Estender CONFIG pro bar 4 depois de validar.
 */

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

type TipoStone = 'CREDITO' | 'DEBITO' | 'PIX';

interface BarStoneConfig {
  cliente_id: string;   // CLIENTE Stone (legado — hoje o contato é o Zykor)
  contato_zykor: string; // FORNECEDOR "Zykor" — contato de TODOS os lançamentos (marca automação)
  receitas: Record<TipoStone, { categoria_id: string; conta_financeira_id: string; label: string }>;
  taxa: { categoria_id: string; conta_financeira_id: string; fornecedor_id: string; compensacao_categoria_id: string };
}

// De-para bar 3 (Ordinário): créd/déb → Ordinário BB; pix → Ordinário Stone.
const CONFIG: Record<number, BarStoneConfig> = {
  3: {
    cliente_id: 'afe2340b-9e88-40d9-acfb-0d3a71b9dcaa', // STONE INSTITUIÇÃO DE PAGAMENTO (CLIENTE, legado)
    contato_zykor: 'c8f11daf-072f-47b7-9412-0145b5f09ce2', // FORNECEDOR "Zykor" (contato de tudo — marca automação)
    receitas: {
      CREDITO: { categoria_id: '0f5a3cab-0759-46a2-86b4-3a224da52a1e', conta_financeira_id: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', label: 'Crédito' },
      DEBITO: { categoria_id: '21159a4f-f665-4630-8a49-ea66b9e05965', conta_financeira_id: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', label: 'Débito' },
      PIX: { categoria_id: '44408100-c5bb-48e7-a291-64c62d12f81d', conta_financeira_id: 'd210a889-27e1-49cb-b5c0-d8cad97a6939', label: 'PIX' },
    },
    taxa: {
      categoria_id: '4374543a-57cc-42b4-a175-b9044cf83b47', // TAXA MAQUININHA (despesa)
      conta_financeira_id: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', // Ordinário BB
      fornecedor_id: 'af680bf0-1970-465e-b8df-ae8e1b85a775', // STONE (FORNECEDOR)
      compensacao_categoria_id: 'a8a69943-af27-46de-b308-d28a51c7847f', // Outras Receitas (compensação da taxa)
    },
  },
};

// brand_id -> bandeira (inferido pelo BIN do cartão nos dados da Stone)
const BANDEIRA: Record<number, string> = { 1: 'Visa', 2: 'Mastercard', 3: 'Amex', 171: 'Elo' };
const bandeiraLabel = (id: number | null) => (id != null && BANDEIRA[id]) || (id != null ? `Bandeira ${id}` : '—');

interface LinhaDia {
  tipo: TipoStone;
  brand_id: number | null;
  vencimento: string;
  chave: string;
  transacoes: number;
  bruto: number;
  taxa: number;
  pagador: string | null; // nome do pagador (só PIX)
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const brDate = (d: string) => d.split('-').reverse().join('/');
// Código de referência do CA (coluna "nº do documento") — marca que foi lançado pelo Zykor.
const NUM_DOC = 'zykor';
// Rate limit do CA: espaça as requisições e faz retry no 429 pra não deixar lançamento pendente.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY_MS = 250; // ~4 req/s entre lançamentos (folga sob o limite do CA)

/** Ontem em horário de Brasília (UTC-3). */
function ontemBRT(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function getCAToken(barId: number): Promise<{ token: string } | { error: string; status: number }> {
  const supabase = getSupabaseAdmin();
  const { data: cred, error } = await supabase
    .from('api_credentials')
    .select('access_token, expires_at')
    .eq('sistema', 'conta_azul')
    .eq('bar_id', barId)
    .single();
  if (error || !cred?.access_token) return { error: 'Credenciais do Conta Azul não encontradas', status: 404 };
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) return { error: 'Token CA expirado. Reconecte o Conta Azul.', status: 401 };
  return { token: cred.access_token };
}

async function getLinhas(barId: number, data: string): Promise<LinhaDia[]> {
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await (supabase.schema('financial' as any) as any).rpc('stone_ca_lancamentos_dia', {
    p_bar_id: barId,
    p_data: data,
  });
  if (error) throw new Error(`Falha ao agregar Stone do dia: ${error.message}`);
  return ((rows as any[]) || []).map((r) => ({
    tipo: String(r.tipo) as TipoStone,
    brand_id: r.brand_id == null ? null : Number(r.brand_id),
    vencimento: String(r.vencimento),
    chave: String(r.chave),
    transacoes: Number(r.transacoes) || 0,
    bruto: Number(r.bruto) || 0,
    taxa: Number(r.taxa) || 0,
    pagador: r.pagador ?? null,
  }));
}

/** Descrição do recebível/taxa. Sem data (o vencimento já é coluna própria):
 *  créd/déb = "Bandeira Tipo"; PIX = "PIX · Nome do pagador" (nome vem do relatório Stone). */
function descricaoDe(l: LinhaDia, natureza: 'RECEITA' | 'TAXA'): string {
  const prefixo = natureza === 'TAXA' ? 'Taxa ' : '';
  if (l.tipo === 'PIX') return `${prefixo}PIX${l.pagador ? ` · ${l.pagador}` : ''}`;
  const tipoLabel = l.tipo === 'CREDITO' ? 'Crédito' : 'Débito';
  return `${prefixo}${bandeiraLabel(l.brand_id)} ${tipoLabel}`;
}

/** Conta a receber pelo LÍQUIDO (bruto − taxa) do recebível. */
function payloadReceita(cfg: BarStoneConfig, l: LinhaDia, dataVenda: string) {
  const valor = round2(l.bruto - l.taxa); // LÍQUIDO
  const rc = cfg.receitas[l.tipo];
  const descricao = descricaoDe(l, 'RECEITA');
  return {
    data_competencia: dataVenda,
    valor,
    numero_documento: NUM_DOC,
    observacao: `Recebível Stone líquido (${l.transacoes} transação(ões); bruto ${round2(l.bruto)} − taxa ${round2(l.taxa)}) via Zykor`,
    descricao,
    contato: cfg.contato_zykor,
    conta_financeira: rc.conta_financeira_id,
    rateio: [{ id_categoria: rc.categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: l.vencimento,
        numero_documento: NUM_DOC,
        nota: 'Recebível Stone (líquido) lançado via Zykor',
        conta_financeira: rc.conta_financeira_id,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };
}

/** DESPESA: taxa TOTAL de maquininha do dia (1 lançamento). */
function payloadTaxaTotal(cfg: BarStoneConfig, dataVenda: string, valorTotal: number) {
  const valor = round2(valorTotal);
  const descricao = `Taxa maquininha Stone ${brDate(dataVenda)}`;
  return {
    data_competencia: dataVenda,
    valor,
    numero_documento: NUM_DOC,
    observacao: 'Taxa total de maquininha Stone do dia (lançamos o líquido) via Zykor',
    descricao,
    contato: cfg.contato_zykor,
    conta_financeira: cfg.taxa.conta_financeira_id,
    rateio: [{ id_categoria: cfg.taxa.categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: dataVenda,
        numero_documento: NUM_DOC,
        nota: 'Taxa Stone (total do dia) lançada via Zykor',
        conta_financeira: cfg.taxa.conta_financeira_id,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };
}

/** RECEITA: compensação da taxa (Outras Receitas) — anula a despesa, mantém o caixa no líquido. */
function payloadCompensacao(cfg: BarStoneConfig, dataVenda: string, valorTotal: number) {
  const valor = round2(valorTotal);
  const descricao = 'Compensação taxa maquininha';
  return {
    data_competencia: dataVenda,
    valor,
    numero_documento: NUM_DOC,
    observacao: 'Compensação da taxa de maquininha Stone do dia (lançamos o líquido) via Zykor',
    descricao,
    contato: cfg.contato_zykor,
    conta_financeira: cfg.taxa.conta_financeira_id,
    rateio: [{ id_categoria: cfg.taxa.compensacao_categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: dataVenda,
        numero_documento: NUM_DOC,
        nota: 'Compensação taxa Stone (total do dia) via Zykor',
        conta_financeira: cfg.taxa.conta_financeira_id,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };
}

async function postCA(
  token: string,
  endpoint: 'contas-a-receber' | 'contas-a-pagar',
  body: unknown,
): Promise<{ ok: boolean; protocolId: string | null; status: string | null; erro?: string; raw?: unknown }> {
  const url = `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/${endpoint}`;
  const MAX = 5;
  for (let tent = 1; tent <= MAX; tent++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Rate limit (429) ou indisponibilidade momentânea (503): espera e tenta de novo
    // (respeita Retry-After; senão backoff exponencial). Evita deixar lançamento pendente.
    if (resp.status === 429 || resp.status === 503) {
      if (tent < MAX) {
        const ra = Number(resp.headers.get('retry-after'));
        const espera = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(1000 * 2 ** (tent - 1), 8000);
        await sleep(espera);
        continue;
      }
      const text = await resp.text().catch(() => '');
      return { ok: false, protocolId: null, status: String(resp.status), erro: `rate limit (${resp.status}) após ${MAX} tentativas`, raw: text };
    }
    const text = await resp.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!resp.ok) return { ok: false, protocolId: null, status: String(resp.status), erro: json?.message || text || 'erro', raw: json };
    const status = json?.status || null;
    if (status === 'ERROR') return { ok: false, protocolId: null, status, erro: 'CA rejeitou (status ERROR)', raw: json };
    return { ok: true, protocolId: json?.protocolo || json?.protocolId || json?.id || null, status, raw: json };
  }
  return { ok: false, protocolId: null, status: '429', erro: 'rate limit persistente' };
}

/** GET: preview do dia — não escreve nada no CA. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin' && user.role !== 'financeiro') return permissionErrorResponse('Sem permissão');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || Number(user.bar_id);
  const cfg = CONFIG[barId];
  if (!cfg) return NextResponse.json({ error: `Bar ${barId} ainda não configurado para Stone->CA` }, { status: 400 });
  const data = new URL(request.url).searchParams.get('data') || ontemBRT();

  try {
    const linhas = await getLinhas(barId, data);
    const supabase = getSupabaseAdmin();
    const { data: log } = await (supabase.schema('financial' as any) as any)
      .from('stone_ca_lancamento_log')
      .select('chave, natureza, valor, ca_protocol_id')
      .eq('bar_id', barId)
      .eq('data_venda', data);
    const feito = new Set(((log as any[]) || []).map((l) => `${l.chave}::${l.natureza}`));

    const recebiveis = linhas
      .filter((l) => l.bruto > 0)
      .map((l) => ({
        tipo: l.tipo,
        bandeira: bandeiraLabel(l.brand_id),
        descricao: descricaoDe(l, 'RECEITA'),
        bruto: round2(l.bruto),
        taxa: round2(l.taxa),
        valor: round2(l.bruto - l.taxa), // LÍQUIDO — é o que vai como conta a receber
        vencimento: l.vencimento,
        transacoes: l.transacoes,
        ja_lancado: feito.has(`${l.chave}::RECEITA`),
      }));

    // taxa do dia = 1 valor total → par que se compensa (despesa TAXA MAQUININHA + receita Outras Receitas)
    const taxaTotal = round2(linhas.reduce((s, l) => s + l.taxa, 0));
    const compensacao = taxaTotal > 0 ? [
      { descricao: `Taxa maquininha Stone ${brDate(data)}`, tipo: 'DESPESA', categoria: 'TAXA MAQUININHA', valor: taxaTotal, vencimento: data, ja_lancado: feito.has('TAXA_DIA::TAXA') },
      { descricao: 'Compensação taxa maquininha', tipo: 'RECEITA', categoria: 'Outras Receitas', valor: taxaTotal, vencimento: data, ja_lancado: feito.has('COMPENSACAO_DIA::COMPENSACAO') },
    ] : [];

    const totalLiquido = round2(recebiveis.reduce((s, r) => s + r.valor, 0));
    return NextResponse.json({
      bar_id: barId,
      data,
      resumo: {
        recebiveis: recebiveis.length,
        lancamentos_taxa: compensacao.length, // 0 ou 2
        total_bruto: round2(recebiveis.reduce((s, r) => s + r.bruto, 0)),
        total_taxa: taxaTotal,
        total_liquido: totalLiquido,
        // efeito no caixa = líquido dos recebíveis (despesa e compensação da taxa se anulam)
        efeito_caixa: totalLiquido,
      },
      recebiveis,
      compensacao,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro no preview' }, { status: 500 });
  }
}

/** POST: cria os lançamentos no CA. Idempotente por (bar, dia, chave, natureza). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin' && user.role !== 'financeiro') return permissionErrorResponse('Sem permissão para criar lançamentos');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const cfg = CONFIG[barId];
  if (!cfg) return NextResponse.json({ error: `Bar ${barId} ainda não configurado para Stone->CA` }, { status: 400 });

  const data: string = body?.data || ontemBRT();

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return NextResponse.json({ error: tokenResult.error }, { status: tokenResult.status });
  const token = tokenResult.token;
  const supabase = getSupabaseAdmin();

  let linhas: LinhaDia[];
  try {
    linhas = await getLinhas(barId, data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao agregar' }, { status: 500 });
  }

  const { data: log } = await (supabase.schema('financial' as any) as any)
    .from('stone_ca_lancamento_log')
    .select('chave, natureza')
    .eq('bar_id', barId)
    .eq('data_venda', data);
  const feito = new Set(((log as any[]) || []).map((l) => `${l.chave}::${l.natureza}`));

  const resultados: any[] = [];

  async function enviar(
    chave: string,
    natureza: 'RECEITA' | 'TAXA' | 'COMPENSACAO',
    valor: number,
    endpoint: 'contas-a-receber' | 'contas-a-pagar',
    payload: unknown,
    meta: { tipo?: TipoStone | null; brand_id?: number | null; vencimento?: string | null },
  ) {
    if (valor <= 0) return;
    if (feito.has(`${chave}::${natureza}`)) {
      resultados.push({ chave, natureza, skipped: true, motivo: 'já lançado' });
      return;
    }
    const r = await postCA(token, endpoint, payload);
    await sleep(DELAY_MS); // espaça o próximo POST (respeita o rate limit do CA)
    if (r.ok) {
      await (supabase.schema('financial' as any) as any).from('stone_ca_lancamento_log').insert({
        bar_id: barId,
        data_venda: data,
        chave,
        natureza,
        tipo: meta.tipo ?? null,
        brand_id: meta.brand_id ?? null,
        vencimento: meta.vencimento ?? data,
        valor: round2(valor),
        ca_protocol_id: r.protocolId,
        ca_status: r.status,
        criado_por: user!.email ?? user!.nome ?? null,
      });
    }
    resultados.push({ chave, natureza, ok: r.ok, valor: round2(valor), protocolId: r.protocolId, erro: r.erro });
  }

  // Sequencial pra respeitar o rate limit do CA (PIX pode ter muitas linhas).
  // 1) Taxa do dia PRIMEIRO (só 2 lançamentos) → garante que o par de taxa nunca fica de fora
  //    quando o lote de recebíveis é grande/lento (era o que deixava a taxa "pendente").
  const taxaTotal = round2(linhas.reduce((s, l) => s + l.taxa, 0));
  if (taxaTotal > 0) {
    await enviar('TAXA_DIA', 'TAXA', taxaTotal, 'contas-a-pagar', payloadTaxaTotal(cfg, data, taxaTotal), { vencimento: data });
    await enviar('COMPENSACAO_DIA', 'COMPENSACAO', taxaTotal, 'contas-a-receber', payloadCompensacao(cfg, data, taxaTotal), { vencimento: data });
    // A baixa (marcar paga/recebida) NÃO é feita aqui: o CA só expõe a parcela depois de
    // sincronizar o evento (o id da parcela não existe logo após criar). Fica pra um passo
    // pós-sync (watchdog/baixa dedicada).
  }
  // 2) Recebíveis pelo LÍQUIDO (bruto − taxa).
  for (const l of linhas) {
    await enviar(l.chave, 'RECEITA', round2(l.bruto - l.taxa), 'contas-a-receber', payloadReceita(cfg, l, data), { tipo: l.tipo, brand_id: l.brand_id, vencimento: l.vencimento });
  }

  const houveErro = resultados.some((r) => r.ok === false);
  return NextResponse.json(
    { bar_id: barId, data, sucesso: !houveErro, total: resultados.length, resultados },
    { status: houveErro ? 207 : 200 },
  );
}
