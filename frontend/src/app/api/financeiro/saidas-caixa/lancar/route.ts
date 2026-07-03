import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Saída de caixa (sangria) -> Conta Azul: conta a PAGAR + baixa imediata (o dinheiro já saiu).
 * Conta financeira travada = "Caixa Dinheiro". Categoria escolhida no combobox (despesa).
 *
 *  - GET  : opções do modal (categorias de DESPESA + conta Caixa Dinheiro).
 *  - POST : cria + baixa 1 saída. Idempotente por financial.saida_caixa_ca_log (bar,trn,num_lancamento).
 */

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const getSupabaseAdmin = () => createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const brDate = (d: string) => d.split('-').reverse().join('/');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PREFIXO = '[Zykor] ';

async function getCAToken(barId: number): Promise<{ token: string } | { error: string; status: number }> {
  const supabase = getSupabaseAdmin();
  const { data: cred, error } = await supabase
    .from('api_credentials').select('access_token, expires_at')
    .eq('sistema', 'conta_azul').eq('bar_id', barId).single();
  if (error || !cred?.access_token) return { error: 'Credenciais do Conta Azul não encontradas', status: 404 };
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) return { error: 'Token CA expirado. Reconecte o Conta Azul.', status: 401 };
  return { token: cred.access_token };
}

async function getCaixaDinheiro(barId: number): Promise<{ id: string; nome: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await (supabase.schema('bronze' as any) as any)
    .from('bronze_contaazul_contas_financeiras')
    .select('contaazul_id, nome').eq('bar_id', barId).ilike('nome', 'Caixa Dinheiro').eq('ativo', true).limit(1);
  const c = (data as any[])?.[0];
  return c ? { id: String(c.contaazul_id), nome: String(c.nome) } : null;
}

/** GET: categorias de DESPESA + conta Caixa Dinheiro (pro modal). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || Number(user.bar_id);
  const supabase = getSupabaseAdmin();
  const { data: cats } = await (supabase.schema('bronze' as any) as any)
    .from('bronze_contaazul_categorias')
    .select('contaazul_id, nome, categoria_macro')
    .eq('bar_id', barId).eq('tipo', 'DESPESA').eq('ativo', true).order('nome');
  const categorias = ((cats as any[]) || []).map((c) => ({ id: String(c.contaazul_id), nome: String(c.nome), macro: c.categoria_macro || null }));
  const conta = await getCaixaDinheiro(barId);
  return NextResponse.json({ categorias, conta });
}

async function postContaPagar(token: string, body: unknown): Promise<{ ok: boolean; protocolId: string | null; status: string | null; erro?: string }> {
  const url = `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/contas-a-pagar`;
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

async function baixar(token: string, descricao: string, data: string, valor: number, contaFin: string): Promise<{ ok: boolean; motivo?: string }> {
  let idLanc: string | null = null;
  for (let t = 0; t < 8 && !idLanc; t++) {
    if (t) await sleep(2000);
    const url = `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?pagina=1&tamanho_pagina=300&data_vencimento_de=${data}&data_vencimento_ate=${data}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) continue;
    const j: any = await r.json().catch(() => ({}));
    const itens: any[] = j.itens || j.items || [];
    const ev = itens.find((x) => String(x.descricao || '') === descricao);
    if (ev && Number(ev.pago) > 0) return { ok: true };
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
      observacao: 'Baixa automática saída de caixa via Zykor',
    }),
  });
  if (!br.ok) { const t = await br.text().catch(() => ''); return { ok: false, motivo: `baixa HTTP ${br.status}: ${t.slice(0, 120)}` }; }
  return { ok: true };
}

/** POST: cria + baixa 1 saída. Body: { bar_id, trn, num_lancamento, dt_gerencial, descricao, valor, categoria_id }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (user.role !== 'admin' && user.role !== 'financeiro') return permissionErrorResponse('Sem permissão para criar lançamentos');

  const b = await request.json().catch(() => ({} as any));
  const barId = Number(b?.bar_id) || Number(user.bar_id);
  const trn = Number(b?.trn);
  const numLanc = Number(b?.num_lancamento);
  const data = String(b?.dt_gerencial || '');
  const competencia = String(b?.data_competencia || data);
  const vencimento = String(b?.data_vencimento || data);
  const motivo = String(b?.descricao || '').trim();
  const valor = round2(Number(b?.valor));
  const categoriaId = String(b?.categoria_id || '').trim();

  if (!barId || !Number.isFinite(trn) || !Number.isFinite(numLanc) || !data || !motivo || !(valor > 0) || !categoriaId) {
    return NextResponse.json({ error: 'bar_id, trn, num_lancamento, dt_gerencial, descricao, valor e categoria_id são obrigatórios' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: jaLog } = await (supabase.schema('financial' as any) as any)
    .from('saida_caixa_ca_log').select('id, valor, ca_protocol_id').eq('bar_id', barId).eq('trn', trn).eq('num_lancamento', numLanc).maybeSingle();
  if (jaLog) return NextResponse.json({ bar_id: barId, trn, num_lancamento: numLanc, skipped: true, motivo: 'já lançado', log: jaLog }, { status: 200 });

  const conta = await getCaixaDinheiro(barId);
  if (!conta) return NextResponse.json({ error: 'Conta "Caixa Dinheiro" não encontrada no Conta Azul' }, { status: 400 });

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return NextResponse.json({ error: tokenResult.error }, { status: tokenResult.status });
  const token = tokenResult.token;

  const descricao = `${PREFIXO}${motivo}`;
  const payload = {
    data_competencia: competencia,
    valor,
    observacao: `Saída de caixa (turno ${trn}, lanç. #${numLanc}) via Zykor`,
    descricao,
    conta_financeira: conta.id,
    rateio: [{ id_categoria: categoriaId, valor }],
    condicao_pagamento: {
      parcelas: [{
        descricao,
        data_vencimento: vencimento,
        nota: 'Saída de caixa lançada via Zykor',
        conta_financeira: conta.id,
        detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
      }],
    },
  };

  const r = await postContaPagar(token, payload);
  if (!r.ok) return NextResponse.json({ bar_id: barId, trn, num_lancamento: numLanc, ok: false, erro: r.erro }, { status: 502 });

  const bx = await baixar(token, descricao, vencimento, valor, conta.id);
  await (supabase.schema('financial' as any) as any).from('saida_caixa_ca_log').insert({
    bar_id: barId, trn, num_lancamento: numLanc, dt_gerencial: data, descricao: motivo, valor,
    categoria_id: categoriaId, conta_id: conta.id, ca_protocol_id: r.protocolId, ca_status: r.status, baixado: bx.ok,
    criado_por: user.email ?? user.nome ?? null,
  });
  return NextResponse.json({ bar_id: barId, trn, num_lancamento: numLanc, ok: true, valor, protocolId: r.protocolId, baixado: bx.ok, baixa_erro: bx.motivo }, { status: bx.ok ? 200 : 207 });
}
