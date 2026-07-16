import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Lançador genérico de FECHAMENTO no Conta Azul (Variação Estoque, Bonificações, Consumações,
 * Impostos, Ajuste Virada). Todos são lançamentos por COMPETÊNCIA, normalmente SEM baixa (ajustes
 * contábeis que entram na DRE por competência, não no fluxo de caixa/DFC).
 *
 * Diferente do lançador de pagamentos (contaazul/lancamentos), aqui NÃO exigimos fornecedor/contato:
 * conta-a-pagar aceita payload sem `contato` (igual às saídas de caixa). Categoria é resolvida por
 * NOME (as categorias precisam existir no CA de cada bar) e falha alto se faltar — CA não tem DELETE,
 * então preferimos abortar a criar na categoria errada.
 */

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

export function getLancadorAdmin(): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const brDate = (d: string) => d.split('-').reverse().join('/');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const PREFIXO = '[Zykor] ';

export type SinalLanc = 'DESPESA' | 'RECEITA';

/**
 * Config de lançamento AUTOMÁTICO (cron) por (bar, tipo). O botão manual NÃO depende disto.
 * Sem linha na tabela = desligado (default off). `cutoff` = a partir de quando o automático atua.
 */
export async function getAutoConfig(barId: number, tipo: string): Promise<{ ativo: boolean; cutoff: string | null }> {
  const supabase = getLancadorAdmin();
  const { data } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_auto_config').select('ativo, cutoff').eq('bar_id', barId).eq('tipo', tipo).maybeSingle();
  if (!data) return { ativo: false, cutoff: null };
  return { ativo: !!(data as any).ativo, cutoff: (data as any).cutoff || null };
}

/** O automático deve lançar um item cuja data/competência é `dataItemISO` ('YYYY-MM-DD')? cutoff null = sem corte (tudo). */
export function autoDeveLancarData(cutoff: string | null, dataItemISO: string): boolean {
  if (!cutoff) return true;
  return dataItemISO >= String(cutoff).slice(0, 10);
}

/** Extrai as chaves a lançar do body do POST: `chaves: string[]` ou `chave: string`. undefined = todas as pendentes. */
export function parseChaves(body: any): string[] | undefined {
  if (Array.isArray(body?.chaves) && body.chaves.length) return body.chaves.map(String);
  if (body?.chave != null && String(body.chave) !== '') return [String(body.chave)];
  return undefined;
}

/** lower + sem acento + colapsa espaços — pra casar nome de categoria entre bares (acentuação não normalizada). */
export const normalizar = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export async function getCAToken(barId: number): Promise<{ token: string } | { error: string; status: number }> {
  const supabase = getLancadorAdmin();
  const { data: cred, error } = await supabase
    .from('api_credentials').select('access_token, expires_at')
    .eq('sistema', 'conta_azul').eq('bar_id', barId).single();
  if (error || !cred?.access_token) return { error: 'Credenciais do Conta Azul não encontradas', status: 404 };
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) return { error: 'Token CA expirado. Reconecte o Conta Azul.', status: 401 };
  return { token: cred.access_token };
}

/**
 * Resolve o UUID de uma categoria (DESPESA/RECEITA) pelo NOME, tolerante a acento/caixa.
 * Aceita 1 nome ou uma lista de candidatos (tenta na ordem; casa por igualdade normalizada). null se nenhum existir.
 */
export async function resolveCategoriaId(barId: number, nome: string | string[], tipo: SinalLanc): Promise<{ id: string; nome: string } | null> {
  const supabase = getLancadorAdmin();
  const { data } = await (supabase.schema('bronze' as any) as any)
    .from('bronze_contaazul_categorias')
    .select('contaazul_id, nome')
    .eq('bar_id', barId).eq('tipo', tipo).eq('ativo', true);
  const cats = ((data as any[]) || []).map((c) => ({ id: String(c.contaazul_id), nome: String(c.nome), norm: normalizar(c.nome) }));
  const candidatos = Array.isArray(nome) ? nome : [nome];
  for (const cand of candidatos) {
    const alvo = normalizar(cand);
    const hit = cats.find((c) => c.norm === alvo);
    if (hit) return { id: hit.id, nome: hit.nome };
  }
  return null;
}

/** Conta financeira ativa pra amarrar o lançamento (sem baixa, é só o campo obrigatório do payload). Prefere "Caixa Dinheiro". */
export async function resolveContaPadrao(barId: number): Promise<{ id: string; nome: string } | null> {
  const supabase = getLancadorAdmin();
  const base = () => (supabase.schema('bronze' as any) as any)
    .from('bronze_contaazul_contas_financeiras').select('contaazul_id, nome').eq('bar_id', barId).eq('ativo', true);
  const { data: caixa } = await base().ilike('nome', 'Caixa Dinheiro').limit(1);
  const c = (caixa as any[])?.[0];
  if (c) return { id: String(c.contaazul_id), nome: String(c.nome) };
  const { data: qualquer } = await base().order('nome').limit(1);
  const q = (qualquer as any[])?.[0];
  return q ? { id: String(q.contaazul_id), nome: String(q.nome) } : null;
}

async function postEvento(token: string, sinal: SinalLanc, body: unknown): Promise<{ ok: boolean; protocolId: string | null; status: string | null; erro?: string }> {
  const seg = sinal === 'RECEITA' ? 'contas-a-receber' : 'contas-a-pagar';
  const url = `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/${seg}`;
  for (let tent = 1; tent <= 5; tent++) {
    const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (resp.status === 429 || resp.status === 503) {
      if (tent < 5) { const ra = Number(resp.headers.get('retry-after')); await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(1000 * 2 ** (tent - 1), 8000)); continue; }
      return { ok: false, protocolId: null, status: String(resp.status), erro: `rate limit (${resp.status})` };
    }
    const text = await resp.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { /* noop */ }
    if (!resp.ok) return { ok: false, protocolId: null, status: String(resp.status), erro: json?.message || text || 'erro' };
    if (json?.status === 'ERROR') return { ok: false, protocolId: null, status: 'ERROR', erro: 'CA rejeitou (status ERROR)' };
    return { ok: true, protocolId: json?.protocolo || json?.protocolId || json?.id || null, status: json?.status || null };
  }
  return { ok: false, protocolId: null, status: '429', erro: 'rate limit persistente' };
}

export interface CriarLancamentoInput {
  token: string;
  sinal: SinalLanc;
  competencia: string;        // 'YYYY-MM-DD'
  vencimento?: string;        // default = competencia
  valor: number;              // > 0 (o sinal define despesa/receita)
  descricao: string;          // sem prefixo — o PREFIXO é adicionado aqui
  observacao?: string;
  categoriaId: string;
  contaId: string;
  contato?: string | null;    // opcional (receitas às vezes exigem um cliente/contato)
}

/**
 * Cria 1 lançamento por competência no CA (SEM baixa). Retorna protocolo/status.
 * A idempotência (não recriar) é responsabilidade do chamador via financial.lancamento_manual_ca_log.
 */
export async function criarLancamentoCA(input: CriarLancamentoInput): Promise<{ ok: boolean; protocolId: string | null; status: string | null; erro?: string }> {
  const valor = round2(input.valor);
  if (!(valor > 0)) return { ok: false, protocolId: null, status: null, erro: 'valor deve ser > 0' };
  const competencia = input.competencia;
  const vencimento = input.vencimento || competencia;
  const descricao = input.descricao.startsWith(PREFIXO) ? input.descricao : `${PREFIXO}${input.descricao}`;

  const payload: Record<string, unknown> = {
    data_competencia: competencia,
    valor,
    observacao: input.observacao || `Lançamento de fechamento via Zykor`,
    descricao,
    conta_financeira: input.contaId,
    rateio: [{ id_categoria: input.categoriaId, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: vencimento,
        nota: 'Lançamento de fechamento via Zykor',
        conta_financeira: input.contaId,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };
  if (input.contato) payload.contato = input.contato;

  return postEvento(input.token, input.sinal, payload);
}

function normalizarDesc(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Dá BAIXA (quita) num evento de fechamento no CA. Acha o evento na bronze por match EXATO
 * (bar + competência + valor + descrição normalizada + sinal), pega a parcela e posta a baixa.
 * Idempotente (se já quitada, retorna ok). `nao_sincronizado` = evento recém-criado que ainda
 * não sincronizou (o chamador tenta de novo depois). `descricao` deve vir COM o prefixo [Zykor].
 */
export async function baixarEventoCA(input: {
  token: string; barId: number; sinal: SinalLanc; competencia: string; valor: number;
  descricao: string; contaId: string; dataPagamento?: string;
}): Promise<{ ok: boolean; ja_baixada?: boolean; nao_sincronizado?: boolean; erro?: string }> {
  const supabase = getLancadorAdmin();
  const valorRound = round2(input.valor);
  const { data: candidatos } = await (supabase.schema('bronze' as any) as any)
    .from('bronze_contaazul_lancamentos')
    .select('contaazul_id, descricao, valor_bruto, data_competencia, tipo, valor_pago, status')
    .eq('bar_id', input.barId).eq('data_competencia', input.competencia)
    .is('excluido_em', null).limit(100);
  const descNorm = normalizarDesc(input.descricao);
  const querReceita = input.sinal === 'RECEITA';
  const matches = ((candidatos as any[]) || []).filter((l) =>
    Math.abs(Number(l.valor_bruto || 0) - valorRound) < 0.01 &&
    normalizarDesc(l.descricao || '') === descNorm &&
    (querReceita ? String(l.tipo || '').toUpperCase() === 'RECEITA' : String(l.tipo || '').toUpperCase() !== 'RECEITA'));
  if (matches.length === 0) return { ok: false, nao_sincronizado: true, erro: 'evento ainda não sincronizado no CA' };
  if (matches.length > 1) return { ok: false, erro: 'mais de um evento bate (ambíguo) — baixa manual por segurança' };
  // IMPORTANTE: bronze.contaazul_id é o id da PARCELA (não do evento). A baixa é DIRETO na
  // parcela: /eventos-financeiros/parcelas/{id}/baixa (igual à edge contaazul-baixas). Não existe
  // GET /eventos-financeiros/{id}/parcelas p/ esses lançamentos (volta []).
  const idParcela = matches[0].contaazul_id;
  // Idempotência barata: se a bronze já mostra valor_pago, está quitado (não re-baixa).
  if (Number(matches[0].valor_pago || 0) >= valorRound - 0.01) return { ok: true, ja_baixada: true };

  const baixaUrl = `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/parcelas/${idParcela}/baixa`;
  // Idempotência forte: já existe baixa nessa parcela? (GET; 404 = sem baixa → cria)
  try {
    const chk = await fetch(baixaUrl, { headers: { Authorization: `Bearer ${input.token}` } });
    if (chk.status === 200) {
      const b = await chk.json().catch(() => null);
      const tem = Array.isArray(b) ? b.length > 0 : !!(b && (b.id || b.data_pagamento || b.itens?.length || b.baixas?.length || b.data?.length));
      if (tem) return { ok: true, ja_baixada: true };
    }
  } catch { /* segue pro POST */ }

  const baixaResp = await fetch(baixaUrl, {
    method: 'POST', headers: { Authorization: `Bearer ${input.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data_pagamento: input.dataPagamento || input.competencia,
      composicao_valor: { valor_bruto: valorRound, multa: 0, juros: 0, desconto: 0, taxa: 0 },
      conta_financeira: input.contaId,
      metodo_pagamento: 'TRANSFERENCIA_BANCARIA',
      observacao: 'Baixa automática via Zykor (consumação soma-zero, caixa neutro)',
    }),
  });
  if (!baixaResp.ok) { const t = await baixaResp.text(); return { ok: false, erro: `CA baixa HTTP ${baixaResp.status}: ${String(t).slice(0, 200)}` }; }
  return { ok: true };
}

/** 1º dia do mês (competência) a partir de ano+mes. */
export const primeiroDiaMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}-01`;
/** Último dia do mês. */
export const ultimoDiaMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, '0')}`;

/** Mês anterior ao (ano,mes) atual em BRT — retorna {ano, mes}. */
export function mesAnteriorBRT(): { ano: number; mes: number } {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000); // BRT
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
}

/** Ontem em horário de Brasília (UTC-3), 'YYYY-MM-DD'. */
export function ontemBRT(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Mês seguinte a (ano,mes). */
export function mesSeguinte(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

/**
 * Vencimento de IRPJ/CSLL (trimestrais): dia 30 do mês seguinte ao ÚLTIMO mês do trimestre.
 * Q1(1-3)->30/Abr, Q2(4-6)->30/Jul, Q3(7-9)->30/Out, Q4(10-12)->30/Jan(ano+1).
 */
export function vencimentoTrimestral(ano: number, mes: number): string {
  const ultimoMesTri = Math.ceil(mes / 3) * 3;           // 3,6,9,12
  const venc = mesSeguinte(ano, ultimoMesTri);           // Abr/Jul/Out/Jan
  return `${venc.ano}-${String(venc.mes).padStart(2, '0')}-30`;
}
