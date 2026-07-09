import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Recebíveis Sympla -> Conta Azul: conta a RECEBER (pendente, SEM baixa — o repasse cai em ~D+5,
 * a baixa é a conciliação do depósito depois). 1 lançamento por evento.
 *
 * Modelo: valor = líquido a receber (silver.sympla_recebiveis_evento, já sem cancelados).
 * competência = data do evento; vencimento = previsão de repasse (evento + 5 dias úteis).
 * Categoria "Receita de Eventos", cliente "Sympla Internet Solucoes S A", conta "Ordinário Inter".
 * Idempotente por financial.sympla_ca_log (bar, event_id).
 *
 *  - POST { bar_id?, event_id }  : lança 1 evento (admin/financeiro).
 * Cron chama lancarSymplaLote (eventos já passados de D+2, últimos dias).
 */

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const getSupabaseAdmin = () => createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

interface BarSymplaConfig { categoria_id: string; cliente_id: string; conta_financeira: string; dias_repasse: number; lancar_desde: string; }
const CONFIG: Record<number, BarSymplaConfig> = {
  3: {
    categoria_id: 'e83f28ff-452d-45c7-adf9-0b6e98aa365c', // Receita de Eventos
    cliente_id: '01587e8b-1d57-4130-b27c-89b74b825f98',   // Sympla Internet Solucoes S A
    conta_financeira: '609d7158-ffe4-4df6-9270-fc742b288dd7', // Ordinário Inter
    dias_repasse: 5,
    // O cron só lança eventos com dt_evento >= esta data (não mexe em eventos antigos,
    // já lançados por fora). Ativação: 05/07 é o 1º evento valendo. O botão MANUAL ignora isso.
    lancar_desde: '2026-07-04',
  },
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getCAToken(barId: number): Promise<{ token: string } | { error: string; status: number }> {
  const supabase = getSupabaseAdmin();
  const { data: cred, error } = await supabase
    .from('api_credentials').select('access_token, expires_at')
    .eq('sistema', 'conta_azul').eq('bar_id', barId).single();
  if (error || !cred?.access_token) return { error: 'Credenciais do Conta Azul não encontradas', status: 404 };
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) return { error: 'Token CA expirado. Reconecte o Conta Azul.', status: 401 };
  return { token: cred.access_token };
}

async function getFeriados(): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();
  const { data } = await (supabase.schema('operations' as any) as any).from('feriados_eventos').select('data');
  return new Set<string>(((data as any[]) || []).map((f) => String(f.data)));
}

function addDiasUteis(dateStr: string, n: number, feriados: Set<string>): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    const iso = d.toISOString().slice(0, 10);
    if (dow === 0 || dow === 6) continue;
    if (feriados.has(iso)) continue;
    added++;
  }
  return d.toISOString().slice(0, 10);
}

async function postContaReceber(token: string, body: unknown): Promise<{ ok: boolean; protocolId: string | null; status: string | null; erro?: string }> {
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

/** Lança 1 evento Sympla como conta a receber (pendente). Idempotente. */
export async function lancarSymplaEvento(barId: number, eventId: number, criadoPor: string | null, feriados?: Set<string>): Promise<{ status: number; body: any }> {
  const cfg = CONFIG[barId];
  if (!cfg) return { status: 400, body: { error: `Bar ${barId} ainda não configurado para Sympla->CA` } };
  const supabase = getSupabaseAdmin();

  const { data: jaLog } = await (supabase.schema('financial' as any) as any)
    .from('sympla_ca_log').select('id, valor, ca_protocol_id').eq('bar_id', barId).eq('event_id', eventId).maybeSingle();
  if (jaLog) return { status: 200, body: { event_id: eventId, skipped: true, motivo: 'já lançado', log: jaLog } };

  const { data: ev } = await (supabase.schema('silver' as any) as any)
    .from('sympla_recebiveis_evento').select('nome_evento, dt_evento, liquido, pedidos').eq('bar_id', barId).eq('event_id', eventId).maybeSingle();
  if (!ev) return { status: 404, body: { event_id: eventId, error: 'evento não encontrado nos recebíveis' } };
  const valor = round2(Number(ev.liquido));
  if (!(valor > 0)) return { status: 200, body: { event_id: eventId, skipped: true, motivo: 'líquido zero' } };
  if (!ev.dt_evento) return { status: 400, body: { event_id: eventId, error: 'evento sem data' } };

  const fer = feriados ?? await getFeriados();
  const previsao = addDiasUteis(ev.dt_evento, cfg.dias_repasse, fer);
  const nome = String(ev.nome_evento || `Evento ${eventId}`).slice(0, 90);
  const descricao = `[Zykor] Sympla · ${nome}`;

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };

  const payload = {
    data_competencia: ev.dt_evento,
    valor,
    observacao: `Repasse Sympla (${ev.pedidos} pedido(s)) — evento ${new Date(`${ev.dt_evento}T12:00:00Z`).toLocaleDateString('pt-BR')} via Zykor`,
    descricao,
    contato: cfg.cliente_id,
    conta_financeira: cfg.conta_financeira,
    rateio: [{ id_categoria: cfg.categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: previsao,
        nota: 'Repasse Sympla (previsão) lançado via Zykor',
        conta_financeira: cfg.conta_financeira,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };

  const r = await postContaReceber(tokenResult.token, payload);
  if (!r.ok) return { status: 502, body: { event_id: eventId, ok: false, erro: r.erro, valor } };

  await (supabase.schema('financial' as any) as any).from('sympla_ca_log').insert({
    bar_id: barId, event_id: eventId, dt_evento: ev.dt_evento, valor, previsao_repasse: previsao,
    descricao, ca_protocol_id: r.protocolId, ca_status: r.status, criado_por: criadoPor,
  });
  return { status: 200, body: { event_id: eventId, ok: true, valor, previsao_repasse: previsao, protocolId: r.protocolId } };
}

/** Lote: eventos já passados de D+2 (janela [hoje-8, hoje-2]) com líquido>0 e ainda não lançados. */
export async function lancarSymplaLote(barId: number, criadoPor: string | null): Promise<any[]> {
  const cfg = CONFIG[barId];
  if (!cfg) return [];
  const supabase = getSupabaseAdmin();
  const hoje = new Date(Date.now() - 3 * 3600 * 1000);
  const ate = new Date(hoje); ate.setUTCDate(ate.getUTCDate() - 2);
  const de = new Date(hoje); de.setUTCDate(de.getUTCDate() - 8);
  const ateStr = ate.toISOString().slice(0, 10);
  let deStr = de.toISOString().slice(0, 10);
  // trava: nunca antes de lancar_desde (não re-lança eventos antigos já tratados por fora)
  if (cfg.lancar_desde && cfg.lancar_desde > deStr) deStr = cfg.lancar_desde;

  const { data: evs } = await (supabase.schema('silver' as any) as any)
    .from('sympla_recebiveis_evento').select('event_id, dt_evento, liquido')
    .eq('bar_id', barId).gte('dt_evento', deStr).lte('dt_evento', ateStr).gt('liquido', 0);
  const feriados = await getFeriados();
  const out: any[] = [];
  for (const e of (evs as any[]) || []) {
    const r = await lancarSymplaEvento(barId, Number(e.event_id), criadoPor, feriados);
    out.push({ event_id: e.event_id, dt_evento: e.dt_evento, ...r.body });
    await sleep(250);
  }
  return out;
}

/** POST: lança 1 evento (admin/financeiro). Body: { bar_id?, event_id }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.receitas, 'inserir')) return permissionErrorResponse('Sem permissão para criar lançamentos');
  const b = await request.json().catch(() => ({} as any));
  const barId = Number(b?.bar_id) || Number(user.bar_id);
  const eventId = Number(b?.event_id);
  if (!Number.isFinite(eventId)) return NextResponse.json({ error: 'event_id obrigatório' }, { status: 400 });
  const r = await lancarSymplaEvento(barId, eventId, user.email ?? user.nome ?? null);
  return NextResponse.json(r.body, { status: r.status });
}
