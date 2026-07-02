import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // PIX é 1 lançamento por transação → pode ter muitas chamadas

/**
 * Stone -> Conta Azul: lançamento de contas a receber + taxa (execução manual, sem cron).
 *
 * Modelo (definido com o sócio):
 *  - CRÉDITO/DÉBITO: agrupados por BANDEIRA × VENCIMENTO (Visa/Master/Elo/Amex). Bandeira na
 *    descrição; categoria = Stone Crédito/Débito. Vencimento = prevision_payment_date do relatório
 *    Stone (num mesmo dia o débito pode liquidar em datas diferentes por fds/feriado).
 *  - PIX: 1 lançamento POR TRANSAÇÃO (não agrupa).
 *  - TAXA: 1 despesa POR LANÇAMENTO (espelha cada recebível) — taxa por bandeira no créd/déb,
 *    taxa por transação no pix.
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
  cliente_id: string; // CLIENTE Stone (contato das receitas)
  receitas: Record<TipoStone, { categoria_id: string; conta_financeira_id: string; label: string }>;
  taxa: { categoria_id: string; conta_financeira_id: string; fornecedor_id: string };
}

// De-para bar 3 (Ordinário): créd/déb → Ordinário BB; pix → Ordinário Stone.
const CONFIG: Record<number, BarStoneConfig> = {
  3: {
    cliente_id: 'afe2340b-9e88-40d9-acfb-0d3a71b9dcaa', // STONE INSTITUIÇÃO DE PAGAMENTO (CLIENTE)
    receitas: {
      CREDITO: { categoria_id: '0f5a3cab-0759-46a2-86b4-3a224da52a1e', conta_financeira_id: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', label: 'Crédito' },
      DEBITO: { categoria_id: '21159a4f-f665-4630-8a49-ea66b9e05965', conta_financeira_id: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', label: 'Débito' },
      PIX: { categoria_id: '44408100-c5bb-48e7-a291-64c62d12f81d', conta_financeira_id: 'd210a889-27e1-49cb-b5c0-d8cad97a6939', label: 'PIX' },
    },
    taxa: {
      categoria_id: '4374543a-57cc-42b4-a175-b9044cf83b47', // TAXA MAQUININHA
      conta_financeira_id: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', // Ordinário BB
      fornecedor_id: 'af680bf0-1970-465e-b8df-ae8e1b85a775', // STONE (FORNECEDOR)
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
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const brDate = (d: string) => d.split('-').reverse().join('/');
const txTail = (chave: string) => chave.split('|').slice(1).join('|').slice(-8);

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
  }));
}

/** Descrição do recebível/taxa (bandeira no créd/déb; identificador da transação no pix). */
function descricaoDe(l: LinhaDia, natureza: 'RECEITA' | 'TAXA'): string {
  const prefixo = natureza === 'TAXA' ? 'Taxa ' : '';
  if (l.tipo === 'PIX') return `${prefixo}PIX ${brDate(l.vencimento)} · ${txTail(l.chave)}`;
  const tipoLabel = l.tipo === 'CREDITO' ? 'Crédito' : 'Débito';
  return `${prefixo}${bandeiraLabel(l.brand_id)} ${tipoLabel} ${brDate(l.vencimento)}`;
}

function payloadReceita(cfg: BarStoneConfig, l: LinhaDia, dataVenda: string) {
  const valor = round2(l.bruto);
  const rc = cfg.receitas[l.tipo];
  const descricao = descricaoDe(l, 'RECEITA');
  return {
    data_competencia: dataVenda,
    valor,
    observacao: `Recebível Stone (${l.transacoes} transação(ões)) lançado via Zykor`,
    descricao,
    contato: cfg.cliente_id,
    conta_financeira: rc.conta_financeira_id,
    rateio: [{ id_categoria: rc.categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: l.vencimento,
        nota: 'Recebível Stone lançado via Zykor',
        conta_financeira: rc.conta_financeira_id,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };
}

function payloadTaxa(cfg: BarStoneConfig, l: LinhaDia, dataVenda: string) {
  const valor = round2(l.taxa);
  const descricao = descricaoDe(l, 'TAXA');
  return {
    data_competencia: dataVenda,
    valor,
    observacao: 'Taxa de maquininha Stone (por lançamento) lançada via Zykor',
    descricao,
    contato: cfg.taxa.fornecedor_id,
    conta_financeira: cfg.taxa.conta_financeira_id,
    rateio: [{ id_categoria: cfg.taxa.categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: l.vencimento,
        nota: 'Taxa Stone lançada via Zykor',
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
  const resp = await fetch(`${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!resp.ok) return { ok: false, protocolId: null, status: String(resp.status), erro: json?.message || text || 'erro', raw: json };
  const status = json?.status || null;
  if (status === 'ERROR') return { ok: false, protocolId: null, status, erro: 'CA rejeitou (status ERROR)', raw: json };
  return { ok: true, protocolId: json?.protocolo || json?.protocolId || json?.id || null, status, raw: json };
}

/** GET: preview do dia — não escreve nada no CA. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin' && user.role !== 'financeiro') return permissionErrorResponse('Sem permissão');
  const barId = Number(user.bar_id);
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
        valor: round2(l.bruto),
        vencimento: l.vencimento,
        transacoes: l.transacoes,
        ja_lancado: feito.has(`${l.chave}::RECEITA`),
      }));
    const taxas = linhas
      .filter((l) => l.taxa > 0)
      .map((l) => ({
        descricao: descricaoDe(l, 'TAXA'),
        valor: round2(l.taxa),
        vencimento: l.vencimento,
        ja_lancado: feito.has(`${l.chave}::TAXA`),
      }));

    return NextResponse.json({
      bar_id: barId,
      data,
      resumo: {
        recebiveis: recebiveis.length,
        taxas: taxas.length,
        total_bruto: round2(recebiveis.reduce((s, r) => s + r.valor, 0)),
        total_taxa: round2(taxas.reduce((s, t) => s + t.valor, 0)),
      },
      recebiveis,
      taxas,
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
  const barId = Number(user.bar_id);
  const cfg = CONFIG[barId];
  if (!cfg) return NextResponse.json({ error: `Bar ${barId} ainda não configurado para Stone->CA` }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
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

  async function criar(l: LinhaDia, natureza: 'RECEITA' | 'TAXA', valor: number) {
    if (valor <= 0) return;
    if (feito.has(`${l.chave}::${natureza}`)) {
      resultados.push({ chave: l.chave, natureza, skipped: true, motivo: 'já lançado' });
      return;
    }
    const endpoint = natureza === 'RECEITA' ? 'contas-a-receber' : 'contas-a-pagar';
    const payload = natureza === 'RECEITA' ? payloadReceita(cfg, l, data) : payloadTaxa(cfg, l, data);
    const r = await postCA(token, endpoint, payload);
    if (r.ok) {
      await (supabase.schema('financial' as any) as any).from('stone_ca_lancamento_log').insert({
        bar_id: barId,
        data_venda: data,
        chave: l.chave,
        natureza,
        tipo: l.tipo,
        brand_id: l.brand_id,
        vencimento: l.vencimento,
        valor: round2(valor),
        ca_protocol_id: r.protocolId,
        ca_status: r.status,
        criado_por: user!.email ?? user!.nome ?? null,
      });
    }
    resultados.push({ chave: l.chave, natureza, ok: r.ok, valor: round2(valor), protocolId: r.protocolId, erro: r.erro });
  }

  // Sequencial pra não estourar rate limit do CA (PIX pode ter muitas linhas).
  for (const l of linhas) {
    await criar(l, 'RECEITA', l.bruto);
    await criar(l, 'TAXA', l.taxa);
  }

  const houveErro = resultados.some((r) => r.ok === false);
  return NextResponse.json(
    { bar_id: barId, data, sucesso: !houveErro, total: resultados.length, resultados },
    { status: houveErro ? 207 : 200 },
  );
}
