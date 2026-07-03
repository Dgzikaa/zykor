import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

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

// Conta financeira (banco) de destino por CNPJ × tipo. Cada bar fatura em 2 CNPJs (2 StoneCodes)
// e cada CNPJ tem contas bancárias próprias no MESMO Conta Azul — por isso o roteamento é por
// stone_code. `taxa` = conta onde o par despesa+compensação da maquininha daquele CNPJ é lançado.
interface CnpjContas {
  nome: string; // rótulo curto (vai na descrição, distingue os 2 CNPJs no CA)
  CREDITO: string;
  DEBITO: string;
  PIX: string;
  taxa: string;
}
interface BarStoneConfig {
  cliente_id: string; // CLIENTE Stone (contato dos recebíveis e da compensação)
  // categorias são as MESMAS entre os CNPJs do bar (só a conta financeira muda)
  categorias: Record<TipoStone, { categoria_id: string; label: string }>;
  taxa: { categoria_id: string; fornecedor_id: string; compensacao_categoria_id: string };
  contasPorCnpj: Record<string, CnpjContas>; // chave = stone_code
}

// De-para bar 3: Ordinário (142630205) créd/déb→Ordinário BB, pix→Ordinário Stone; taxa→Ordinário BB.
//               Ordibar   (149840567) créd/déb→OrdiBar Inter, pix→OrdiBar Stone; taxa→OrdiBar Inter.
// De-para bar 4: Deboche/Descubra (144417776) créd/déb→Descubra BB, pix→Descubra Stone; taxa→Descubra BB.
//               DSCBR            (115466500) créd/déb→DSCBR Inter, pix→DSCBR Stone; taxa→DSCBR Inter.
const CONFIG: Record<number, BarStoneConfig> = {
  3: {
    cliente_id: 'afe2340b-9e88-40d9-acfb-0d3a71b9dcaa', // STONE INSTITUIÇÃO DE PAGAMENTO (CLIENTE)
    categorias: {
      CREDITO: { categoria_id: '0f5a3cab-0759-46a2-86b4-3a224da52a1e', label: 'Crédito' },
      DEBITO: { categoria_id: '21159a4f-f665-4630-8a49-ea66b9e05965', label: 'Débito' },
      PIX: { categoria_id: '44408100-c5bb-48e7-a291-64c62d12f81d', label: 'PIX' },
    },
    taxa: {
      categoria_id: '4374543a-57cc-42b4-a175-b9044cf83b47', // TAXA MAQUININHA (despesa)
      fornecedor_id: 'af680bf0-1970-465e-b8df-ae8e1b85a775', // STONE (FORNECEDOR)
      compensacao_categoria_id: 'a8a69943-af27-46de-b308-d28a51c7847f', // Outras Receitas (compensação)
    },
    contasPorCnpj: {
      '142630205': { // Ordinário Bar
        nome: 'Ordinário',
        CREDITO: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', // Ordinário BB
        DEBITO: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', // Ordinário BB
        PIX: 'd210a889-27e1-49cb-b5c0-d8cad97a6939', // Ordinário Stone
        taxa: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', // Ordinário BB
      },
      '149840567': { // Ordibar
        nome: 'Ordibar',
        CREDITO: '86213fcf-52aa-4c2e-9359-79a8641397a2', // OrdiBar Inter
        DEBITO: '86213fcf-52aa-4c2e-9359-79a8641397a2', // OrdiBar Inter
        PIX: '892449d4-a328-4b73-a6a2-38aa243983f3', // OrdiBar Stone
        taxa: '86213fcf-52aa-4c2e-9359-79a8641397a2', // OrdiBar Inter
      },
    },
  },
  4: {
    cliente_id: '3c3ce70e-6f22-4754-af56-8d93f71a4c9e', // STONE (Cliente) — perfil ["Cliente"]
    categorias: {
      CREDITO: { categoria_id: '93b908a2-75f1-48d8-84bf-bd823c7a7b80', label: 'Crédito' }, // Stone Crédito
      DEBITO: { categoria_id: '157b823c-b0b5-4755-8889-ab28ef6dff6e', label: 'Débito' }, // Stone Débito
      PIX: { categoria_id: 'bc079760-cca7-49df-8219-79c59074f7fb', label: 'PIX' }, // Stone Pix
    },
    taxa: {
      categoria_id: 'b1bc192b-3afa-45d0-8a72-752ca229872d', // TAXA MAQUININHA (despesa)
      fornecedor_id: 'ec8f40bb-17d8-4af3-aeb2-25a3f3682ab9', // STONE (Fornecedor) — perfil ["Fornecedor"]
      compensacao_categoria_id: 'f0f84a9e-933e-4648-995d-66210e24ecbf', // Outras Receitas (compensação)
    },
    contasPorCnpj: {
      '144417776': { // Deboche / Descubra Bar e Restaurante — CNPJ 40.433.371/0001-81
        nome: 'Deboche',
        CREDITO: '113908af-35fb-447e-a9c4-9532e9f289ba', // Descubra BB
        DEBITO: '113908af-35fb-447e-a9c4-9532e9f289ba', // Descubra BB
        PIX: 'a910f4dd-0491-4d61-bbb7-feaa54f81c72', // Descubra Stone
        taxa: '113908af-35fb-447e-a9c4-9532e9f289ba', // Descubra BB
      },
      '115466500': { // DSCBR
        nome: 'DSCBR',
        CREDITO: 'bd5e3685-b9eb-49b0-a8f3-30dba4598a6c', // DSCBR Inter
        DEBITO: 'bd5e3685-b9eb-49b0-a8f3-30dba4598a6c', // DSCBR Inter
        PIX: 'c00c234f-1df4-437b-bdb2-17a2ebb72eaf', // DSCBR Stone
        taxa: 'bd5e3685-b9eb-49b0-a8f3-30dba4598a6c', // DSCBR Inter
      },
    },
  },
};

// brand_id -> bandeira (inferido pelo BIN do cartão nos dados da Stone)
const BANDEIRA: Record<number, string> = { 1: 'Visa', 2: 'Mastercard', 3: 'Amex', 171: 'Elo' };
const bandeiraLabel = (id: number | null) => (id != null && BANDEIRA[id]) || (id != null ? `Bandeira ${id}` : '—');

interface LinhaDia {
  stone_code: string; // CNPJ (StoneCode) de origem — roteia a conta financeira
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
// Marca do que o Zykor lança: prefixo "[Zykor] " na DESCRIÇÃO (não mexe no contato/fornecedor,
// que fica livre pros módulos de pagamento mapearem o fornecedor real).
const PREFIXO_ZYKOR = '[Zykor] ';
// Descrições da taxa levam o nome do CNPJ p/ (a) distinguir os 2 CNPJs no CA e (b) a baixa achar
// o lançamento certo pelo match exato de descrição (baixarTaxa busca por descrição).
const descTaxaDia = (nome: string, dataVenda: string) => `${PREFIXO_ZYKOR}Taxa maquininha Stone ${nome} ${brDate(dataVenda)}`;
const descCompensacao = (nome: string) => `${PREFIXO_ZYKOR}Compensação taxa maquininha ${nome}`;
// nome curto do CNPJ (StoneCode) p/ descrição; fallback no próprio code se não mapeado.
const nomeCnpj = (cfg: BarStoneConfig, stoneCode: string) => cfg.contasPorCnpj[stoneCode]?.nome ?? stoneCode;
// Rate limit do CA: espaça as requisições e faz retry no 429 pra não deixar lançamento pendente.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY_MS = 250; // ~4 req/s entre lançamentos (folga sob o limite do CA)

/** Ontem em horário de Brasília (UTC-3). */
export function ontemBRT(): string {
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
    stone_code: String(r.stone_code),
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

/** Descrição do recebível, com prefixo "[Zykor] " + nome do CNPJ (distingue os 2 no CA). Sem data
 *  (o vencimento já é coluna): créd/déb = "[Zykor] Nome · Bandeira Tipo"; PIX = "[Zykor] Nome · PIX · Pagador". */
function descricaoDe(cfg: BarStoneConfig, l: LinhaDia): string {
  const nome = nomeCnpj(cfg, l.stone_code);
  if (l.tipo === 'PIX') return `${PREFIXO_ZYKOR}${nome} · PIX${l.pagador ? ` · ${l.pagador}` : ''}`;
  const tipoLabel = l.tipo === 'CREDITO' ? 'Crédito' : 'Débito';
  return `${PREFIXO_ZYKOR}${nome} · ${bandeiraLabel(l.brand_id)} ${tipoLabel}`;
}

/** Conta a receber pelo LÍQUIDO (bruto − taxa), na conta financeira do CNPJ×tipo. */
function payloadReceita(cfg: BarStoneConfig, l: LinhaDia, dataVenda: string) {
  const valor = round2(l.bruto - l.taxa); // LÍQUIDO
  const contas = cfg.contasPorCnpj[l.stone_code];
  const contaFin = contas[l.tipo];
  const categoriaId = cfg.categorias[l.tipo].categoria_id;
  const descricao = descricaoDe(cfg, l);
  return {
    data_competencia: dataVenda,
    valor,
    observacao: `Recebível Stone líquido (${l.transacoes} transação(ões); bruto ${round2(l.bruto)} − taxa ${round2(l.taxa)}) via Zykor`,
    descricao,
    contato: cfg.cliente_id,
    conta_financeira: contaFin,
    rateio: [{ id_categoria: categoriaId, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: l.vencimento,
        nota: 'Recebível Stone (líquido) lançado via Zykor',
        conta_financeira: contaFin,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };
}

/** DESPESA: taxa TOTAL de maquininha do dia, POR CNPJ (1 lançamento por CNPJ). */
function payloadTaxaTotal(cfg: BarStoneConfig, dataVenda: string, valorTotal: number, contaFin: string, descricao: string) {
  const valor = round2(valorTotal);
  return {
    data_competencia: dataVenda,
    valor,
    observacao: 'Taxa total de maquininha Stone do dia por CNPJ (lançamos o líquido) via Zykor',
    descricao,
    contato: cfg.taxa.fornecedor_id,
    conta_financeira: contaFin,
    rateio: [{ id_categoria: cfg.taxa.categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: dataVenda,
        nota: 'Taxa Stone (total do dia por CNPJ) lançada via Zykor',
        conta_financeira: contaFin,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };
}

/** RECEITA: compensação da taxa (Outras Receitas) POR CNPJ — anula a despesa, mantém o caixa no líquido. */
function payloadCompensacao(cfg: BarStoneConfig, dataVenda: string, valorTotal: number, contaFin: string, descricao: string) {
  const valor = round2(valorTotal);
  return {
    data_competencia: dataVenda,
    valor,
    observacao: 'Compensação da taxa de maquininha Stone do dia por CNPJ (lançamos o líquido) via Zykor',
    descricao,
    contato: cfg.cliente_id,
    conta_financeira: contaFin,
    rateio: [{ id_categoria: cfg.taxa.compensacao_categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: dataVenda,
        nota: 'Compensação taxa Stone (total do dia por CNPJ) via Zykor',
        conta_financeira: contaFin,
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

/**
 * Baixa (marca PAGA/RECEBIDA) o lançamento da taxa. O CA usa o PRÓPRIO id do lançamento como
 * id da parcela: POST /parcelas/{id}/baixa. Acha o id via buscar (com retry, pois a criação é
 * assíncrona — o evento leva alguns segundos pra aparecer). Se já está pago, não baixa de novo.
 */
async function baixarTaxa(
  token: string,
  tipo: 'contas-a-pagar' | 'contas-a-receber',
  descricao: string,
  dataVenda: string,
  valor: number,
  contaFinId: string,
): Promise<{ ok: boolean; motivo?: string }> {
  let idLanc: string | null = null;
  for (let t = 0; t < 8 && !idLanc; t++) {
    if (t) await sleep(2000);
    const url = `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/${tipo}/buscar?pagina=1&tamanho_pagina=300&data_vencimento_de=${dataVenda}&data_vencimento_ate=${dataVenda}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) continue;
    const j: any = await r.json().catch(() => ({}));
    const itens: any[] = j.itens || j.items || [];
    const ev = itens.find((x) => String(x.descricao || '') === descricao);
    if (ev && Number(ev.pago) > 0) return { ok: true }; // já baixado (idempotência)
    if (ev?.id) idLanc = ev.id;
  }
  if (!idLanc) return { ok: false, motivo: 'lançamento não apareceu no CA p/ baixa (async)' };
  // o próprio id do lançamento é o id da parcela (lançamento de parcela única)
  const br = await fetch(`${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/parcelas/${idLanc}/baixa`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data_pagamento: dataVenda,
      composicao_valor: { valor_bruto: round2(valor), multa: 0, juros: 0, desconto: 0, taxa: 0 },
      conta_financeira: contaFinId,
      metodo_pagamento: 'TRANSFERENCIA_BANCARIA',
      observacao: 'Baixa automática Stone→CA via Zykor',
    }),
  });
  if (!br.ok) { const t = await br.text().catch(() => ''); return { ok: false, motivo: `baixa HTTP ${br.status}: ${t.slice(0, 120)}` }; }
  return { ok: true };
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

    // Nome amigável da conta financeira (UUID -> "Ordinário BB", "OrdiBar Inter"…) p/ o preview
    // mostrar o destino no CA antes de enviar. Fonte: sync das contas do Conta Azul.
    const { data: contasCA } = await (supabase.schema('bronze' as any) as any)
      .from('bronze_contaazul_contas_financeiras')
      .select('contaazul_id, nome')
      .eq('bar_id', barId);
    const nomeConta = new Map<string, string>();
    for (const c of (contasCA as any[]) || []) nomeConta.set(String(c.contaazul_id), String(c.nome));
    const contaLabel = (uuid: string | null) => (uuid && nomeConta.get(uuid)) || uuid || '—';

    const recebiveis = linhas
      .filter((l) => l.bruto > 0)
      .map((l) => {
        const contaFin = cfg.contasPorCnpj[l.stone_code]?.[l.tipo] ?? null;
        return {
          empresa: nomeCnpj(cfg, l.stone_code),
          stone_code: l.stone_code,
          conta_financeira: contaFin,
          conta: contaLabel(contaFin), // nome amigável do banco no CA
          tipo: l.tipo,
          bandeira: bandeiraLabel(l.brand_id),
          descricao: descricaoDe(cfg, l),
          bruto: round2(l.bruto),
          taxa: round2(l.taxa),
          valor: round2(l.bruto - l.taxa), // LÍQUIDO — é o que vai como conta a receber
          vencimento: l.vencimento,
          transacoes: l.transacoes,
          ja_lancado: feito.has(`${l.chave}::RECEITA`),
        };
      });

    // taxa POR CNPJ: 1 par que se compensa (despesa TAXA MAQUININHA + receita Outras Receitas) por CNPJ
    const taxaPorCnpj = new Map<string, number>();
    for (const l of linhas) taxaPorCnpj.set(l.stone_code, round2((taxaPorCnpj.get(l.stone_code) ?? 0) + l.taxa));
    const compensacao = [...taxaPorCnpj.entries()]
      .filter(([, v]) => v > 0)
      .flatMap(([sc, v]) => {
        const nome = nomeCnpj(cfg, sc);
        const contaTaxa = cfg.contasPorCnpj[sc]?.taxa ?? null;
        return [
          { empresa: nome, stone_code: sc, conta_financeira: contaTaxa, conta: contaLabel(contaTaxa), descricao: descTaxaDia(nome, data), tipo: 'DESPESA', categoria: 'TAXA MAQUININHA', valor: v, vencimento: data, ja_lancado: feito.has(`TAXA_DIA|${sc}::TAXA`) },
          { empresa: nome, stone_code: sc, conta_financeira: contaTaxa, conta: contaLabel(contaTaxa), descricao: descCompensacao(nome), tipo: 'RECEITA', categoria: 'Outras Receitas', valor: v, vencimento: data, ja_lancado: feito.has(`COMPENSACAO_DIA|${sc}::COMPENSACAO`) },
        ];
      });
    const taxaTotal = round2([...taxaPorCnpj.values()].reduce((s, v) => s + v, 0));

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

/**
 * Executa o lançamento diário Stone→CA (idempotente por bar/dia/chave/natureza).
 * Reutilizado pelo POST (usuário autenticado) e pelo cron (06:00 BRT). Não faz auth — quem
 * chama garante a autorização. Devolve { status, body } pra virar NextResponse.
 */
export async function executarStoneDiario(
  barId: number,
  data: string,
  criadoPor: string | null,
): Promise<{ status: number; body: any }> {
  const cfg = CONFIG[barId];
  if (!cfg) return { status: 400, body: { error: `Bar ${barId} ainda não configurado para Stone->CA` } };

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };
  const token = tokenResult.token;
  const supabase = getSupabaseAdmin();

  let linhas: LinhaDia[];
  try {
    linhas = await getLinhas(barId, data);
  } catch (e: any) {
    return { status: 500, body: { error: e?.message || 'Erro ao agregar' } };
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
    meta: { tipo?: TipoStone | null; brand_id?: number | null; vencimento?: string | null; stone_code?: string | null },
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
        stone_code: meta.stone_code ?? null,
        tipo: meta.tipo ?? null,
        brand_id: meta.brand_id ?? null,
        vencimento: meta.vencimento ?? data,
        valor: round2(valor),
        ca_protocol_id: r.protocolId,
        ca_status: r.status,
        criado_por: criadoPor,
      });
    }
    resultados.push({ chave, natureza, ok: r.ok, valor: round2(valor), protocolId: r.protocolId, erro: r.erro });
  }

  // Trava anti-mis-book: se aparecer um StoneCode sem conta no CONFIG do bar, NÃO lança (sinaliza).
  const cnpjSemConta = [...new Set(linhas.map((l) => l.stone_code))].filter((sc) => !cfg.contasPorCnpj[sc]);
  for (const sc of cnpjSemConta) {
    resultados.push({ chave: sc, natureza: 'CONFIG', ok: false, erro: `StoneCode ${sc} sem conta financeira no CONFIG do bar ${barId}` });
  }
  const linhasOk = linhas.filter((l) => cfg.contasPorCnpj[l.stone_code]);

  // Taxa POR CNPJ (par despesa+compensação, cada um na conta do cartão daquele CNPJ).
  const taxaPorCnpj = new Map<string, number>();
  for (const l of linhasOk) taxaPorCnpj.set(l.stone_code, round2((taxaPorCnpj.get(l.stone_code) ?? 0) + l.taxa));

  // Sequencial pra respeitar o rate limit do CA (PIX pode ter muitas linhas).
  // 1) Taxa PRIMEIRO (2 lançamentos por CNPJ) → garante que o par de taxa nunca fica de fora.
  for (const [sc, valor] of taxaPorCnpj) {
    if (valor <= 0) continue;
    const nome = nomeCnpj(cfg, sc);
    const contaTaxa = cfg.contasPorCnpj[sc].taxa;
    await enviar(`TAXA_DIA|${sc}`, 'TAXA', valor, 'contas-a-pagar', payloadTaxaTotal(cfg, data, valor, contaTaxa, descTaxaDia(nome, data)), { vencimento: data, stone_code: sc });
    await enviar(`COMPENSACAO_DIA|${sc}`, 'COMPENSACAO', valor, 'contas-a-receber', payloadCompensacao(cfg, data, valor, contaTaxa, descCompensacao(nome)), { vencimento: data, stone_code: sc });
  }
  // 2) Recebíveis pelo LÍQUIDO (bruto − taxa), na conta do CNPJ×tipo.
  for (const l of linhasOk) {
    await enviar(l.chave, 'RECEITA', round2(l.bruto - l.taxa), 'contas-a-receber', payloadReceita(cfg, l, data), { tipo: l.tipo, brand_id: l.brand_id, vencimento: l.vencimento, stone_code: l.stone_code });
  }
  // 3) Baixa das taxas por CNPJ (marca despesa PAGA e compensação RECEBIDA). Por último de propósito:
  //    a criação é assíncrona e o lote de receitas acima já deu o tempo do evento aparecer no CA.
  for (const [sc, valor] of taxaPorCnpj) {
    if (valor <= 0) continue;
    const nome = nomeCnpj(cfg, sc);
    const contaTaxa = cfg.contasPorCnpj[sc].taxa;
    const bDesp = await baixarTaxa(token, 'contas-a-pagar', descTaxaDia(nome, data), data, valor, contaTaxa);
    resultados.push({ chave: `TAXA_DIA|${sc}`, natureza: 'BAIXA', ok: bDesp.ok, erro: bDesp.motivo });
    const bComp = await baixarTaxa(token, 'contas-a-receber', descCompensacao(nome), data, valor, contaTaxa);
    resultados.push({ chave: `COMPENSACAO_DIA|${sc}`, natureza: 'BAIXA', ok: bComp.ok, erro: bComp.motivo });
  }

  const houveErro = resultados.some((r) => r.ok === false);
  return {
    status: houveErro ? 207 : 200,
    body: { bar_id: barId, data, sucesso: !houveErro, total: resultados.length, resultados },
  };
}

/** POST: cria os lançamentos no CA (usuário admin/financeiro). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (user.role !== 'admin' && user.role !== 'financeiro') return permissionErrorResponse('Sem permissão para criar lançamentos');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const data: string = body?.data || ontemBRT();
  const r = await executarStoneDiario(barId, data, user.email ?? user.nome ?? null);
  return NextResponse.json(r.body, { status: r.status });
}
