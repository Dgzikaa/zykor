import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Entradas de caixa (dinheiro recebido) -> Conta Azul: contas a receber + baixa imediata.
 *
 * Modelo: soma o LÍQUIDO recebido em dinheiro no dia (ContaHub pagamentos meio='Dinheiro',
 * via silver.contahub_entrada_caixa_dinheiro_dia) e cria 1 conta a receber por dia, já baixada
 * (o dinheiro já entrou no caixa). Categoria "Dinheiro", cliente "Dinheiro Recebido", conta
 * "Caixa Dinheiro". Idempotente por financial.entrada_caixa_ca_log (bar, dia).
 *
 *  - GET  : preview do dia (não escreve no CA).
 *  - POST : cria + baixa (admin/financeiro).
 * Cron chama executarEntradaDiaria (12:00 BRT, dia anterior). Bar 3 primeiro; bar 4 depois.
 */

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const getSupabaseAdmin = () => createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

interface BarEntradaConfig { cliente_id: string; categoria_id: string; conta_financeira: string; }
// Categoria "Dinheiro" (RECEITA), cliente "Dinheiro Recebido", conta "Caixa Dinheiro".
const CONFIG: Record<number, BarEntradaConfig> = {
  3: {
    cliente_id: '89aec1b0-f485-45be-865d-3e6739c55826',
    categoria_id: '324eebcf-1241-4a4d-92da-a3422fa21fb4',
    conta_financeira: '5a6f513e-1002-4d8e-af1c-3a5f53c404dc',
  },
  // Bar 4 (Deboche) — IDs prontos; habilitar no cron depois de validar o bar 3.
  4: {
    cliente_id: 'cfc43a92-1ae9-47a0-9c22-36dab7e703f8',
    categoria_id: 'ffd6d24c-6947-4cc9-afde-7abf6b510a88',
    conta_financeira: 'c49de80c-cceb-44fa-b3d1-194633f4d1e4',
  },
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const brDate = (d: string) => d.split('-').reverse().join('/');
const descricaoDia = (data: string) => `[Zykor] DINHEIRO RECEBIDO ${brDate(data)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ontem em horário de Brasília (UTC-3). */
export function ontemBRT(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function getCAToken(barId: number): Promise<{ token: string } | { error: string; status: number }> {
  const supabase = getSupabaseAdmin();
  const { data: cred, error } = await supabase
    .from('api_credentials').select('access_token, expires_at')
    .eq('sistema', 'conta_azul').eq('bar_id', barId).single();
  if (error || !cred?.access_token) return { error: 'Credenciais do Conta Azul não encontradas', status: 404 };
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) return { error: 'Token CA expirado. Reconecte o Conta Azul.', status: 401 };
  return { token: cred.access_token };
}

async function getTotalDia(barId: number, data: string): Promise<{ total: number; qtd: number }> {
  const supabase = getSupabaseAdmin();
  const { data: rows } = await (supabase.schema('silver' as any) as any)
    .from('contahub_entrada_caixa_dinheiro_dia')
    .select('total_liquido, qtd_pagamentos')
    .eq('bar_id', barId).eq('dt_gerencial', data);
  const r = (rows as any[])?.[0];
  return { total: round2(Number(r?.total_liquido || 0)), qtd: Number(r?.qtd_pagamentos || 0) };
}

function payloadReceita(cfg: BarEntradaConfig, data: string, valor: number, qtd: number) {
  const descricao = descricaoDia(data);
  return {
    data_competencia: data,
    valor,
    observacao: `Dinheiro recebido no caixa (${qtd} pagamento(s)) via Zykor`,
    descricao,
    contato: cfg.cliente_id,
    conta_financeira: cfg.conta_financeira,
    rateio: [{ id_categoria: cfg.categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: data,
        nota: 'Dinheiro recebido no caixa lançado via Zykor',
        conta_financeira: cfg.conta_financeira,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };
}

async function postCA(token: string, body: unknown): Promise<{ ok: boolean; protocolId: string | null; status: string | null; erro?: string }> {
  const url = `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/contas-a-receber`;
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

/** Acha o lançamento por descrição+data (criação é assíncrona) e dá baixa (recebido no dia). */
async function baixar(token: string, descricao: string, data: string, valor: number, contaFin: string): Promise<{ ok: boolean; motivo?: string }> {
  let idLanc: string | null = null;
  for (let t = 0; t < 8 && !idLanc; t++) {
    if (t) await sleep(2000);
    const url = `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?pagina=1&tamanho_pagina=300&data_vencimento_de=${data}&data_vencimento_ate=${data}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) continue;
    const j: any = await r.json().catch(() => ({}));
    const itens: any[] = j.itens || j.items || [];
    const ev = itens.find((x) => String(x.descricao || '') === descricao);
    if (ev && Number(ev.pago) > 0) return { ok: true }; // já baixado
    if (ev?.id) idLanc = ev.id;
  }
  if (!idLanc) return { ok: false, motivo: 'lançamento não apareceu no CA p/ baixa (async)' };
  const br = await fetch(`${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/parcelas/${idLanc}/baixa`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data_pagamento: data,
      composicao_valor: { valor_bruto: round2(valor), multa: 0, juros: 0, desconto: 0, taxa: 0 },
      conta_financeira: contaFin,
      metodo_pagamento: 'DINHEIRO',
      observacao: 'Baixa automática entrada de dinheiro via Zykor',
    }),
  });
  if (!br.ok) { const t = await br.text().catch(() => ''); return { ok: false, motivo: `baixa HTTP ${br.status}: ${t.slice(0, 120)}` }; }
  return { ok: true };
}

/** Executa o lançamento diário das entradas de dinheiro (idempotente por bar/dia). Sem auth — quem chama garante. */
export async function executarEntradaDiaria(barId: number, data: string, criadoPor: string | null): Promise<{ status: number; body: any }> {
  const cfg = CONFIG[barId];
  if (!cfg) return { status: 400, body: { error: `Bar ${barId} ainda não configurado para Entradas->CA` } };

  const supabase = getSupabaseAdmin();
  const { data: jaLog } = await (supabase.schema('financial' as any) as any)
    .from('entrada_caixa_ca_log').select('id, baixado, valor').eq('bar_id', barId).eq('dt_gerencial', data).maybeSingle();
  if (jaLog) return { status: 200, body: { bar_id: barId, data, skipped: true, motivo: 'já lançado', valor: jaLog.valor } };

  const { total, qtd } = await getTotalDia(barId, data);
  if (total <= 0) return { status: 200, body: { bar_id: barId, data, skipped: true, motivo: 'sem dinheiro no dia', valor: 0 } };

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };
  const token = tokenResult.token;

  const descricao = descricaoDia(data);
  const r = await postCA(token, payloadReceita(cfg, data, total, qtd));
  if (!r.ok) return { status: 502, body: { bar_id: barId, data, ok: false, erro: r.erro, valor: total } };

  const b = await baixar(token, descricao, data, total, cfg.conta_financeira);
  await (supabase.schema('financial' as any) as any).from('entrada_caixa_ca_log').insert({
    bar_id: barId, dt_gerencial: data, valor: total, ca_protocol_id: r.protocolId, ca_status: r.status, baixado: b.ok, criado_por: criadoPor,
  });
  return { status: b.ok ? 200 : 207, body: { bar_id: barId, data, ok: true, valor: total, qtd, protocolId: r.protocolId, baixado: b.ok, baixa_erro: b.motivo } };
}

/** GET: preview do dia — não escreve nada. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin' && user.role !== 'financeiro') return permissionErrorResponse('Sem permissão');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || Number(user.bar_id);
  const data = new URL(request.url).searchParams.get('data') || ontemBRT();
  if (!CONFIG[barId]) return NextResponse.json({ error: `Bar ${barId} ainda não configurado` }, { status: 400 });

  const { total, qtd } = await getTotalDia(barId, data);
  const supabase = getSupabaseAdmin();
  const { data: log } = await (supabase.schema('financial' as any) as any)
    .from('entrada_caixa_ca_log').select('valor, baixado, ca_protocol_id').eq('bar_id', barId).eq('dt_gerencial', data).maybeSingle();
  return NextResponse.json({ bar_id: barId, data, descricao: descricaoDia(data), valor: total, qtd_pagamentos: qtd, ja_lancado: !!log, log: log || null });
}

/** POST: cria + baixa (admin/financeiro). Body: { bar_id?, data? }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (user.role !== 'admin' && user.role !== 'financeiro') return permissionErrorResponse('Sem permissão para criar lançamentos');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const data: string = body?.data || ontemBRT();
  const r = await executarEntradaDiaria(barId, data, user.email ?? user.nome ?? null);
  return NextResponse.json(r.body, { status: r.status });
}
