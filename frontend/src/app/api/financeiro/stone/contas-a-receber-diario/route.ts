import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Stone -> Conta Azul: lançamento automático de contas a receber (fim do dia).
 *
 * Modelo B (sócio): bruto = RECEITA, taxa = DESPESA. Agrupa POR TIPO (crédito/débito/pix),
 * somando bandeiras; taxa vira 1 despesa/dia. Classificação do tipo pela janela de liquidação
 * (ver financial.stone_ca_lancamentos_dia). PIX incluído.
 *
 * - GET  : preview do dia (não escreve nada no CA). Mostra os buckets + o que já foi lançado.
 * - POST : cria os lançamentos no CA (idempotente via financial.stone_ca_lancamento_log).
 *          NÃO há cron ligado — execução é manual por enquanto (validação).
 *
 * Bar 3 primeiro. Estender CONFIG pro bar 4 depois de validar.
 */

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type TipoReceita = 'CREDITO' | 'DEBITO' | 'PIX';

interface BarStoneConfig {
  /** CLIENTE Stone no CA (contato das receitas) */
  cliente_id: string;
  receitas: Record<TipoReceita, { categoria_id: string; conta_financeira_id: string; label: string }>;
  /** Despesa da taxa (contas-a-pagar) */
  taxa: { categoria_id: string; conta_financeira_id: string; fornecedor_id: string };
}

// De-para confirmado com o sócio (bar 3 / Ordinário):
//  - Crédito e Débito caem na conta Ordinário BB; PIX na conta Ordinário Stone.
//  - Taxa: categoria TAXA MAQUININHA, fornecedor Stone, conta Ordinário BB.
const CONFIG: Record<number, BarStoneConfig> = {
  3: {
    cliente_id: 'afe2340b-9e88-40d9-acfb-0d3a71b9dcaa', // STONE INSTITUIÇÃO DE PAGAMENTO S.A. (CLIENTE)
    receitas: {
      CREDITO: {
        categoria_id: '0f5a3cab-0759-46a2-86b4-3a224da52a1e', // Stone Crédito
        conta_financeira_id: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', // Ordinário BB
        label: 'Crédito',
      },
      DEBITO: {
        categoria_id: '21159a4f-f665-4630-8a49-ea66b9e05965', // Stone Débito
        conta_financeira_id: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', // Ordinário BB
        label: 'Débito',
      },
      PIX: {
        categoria_id: '44408100-c5bb-48e7-a291-64c62d12f81d', // Stone Pix
        conta_financeira_id: 'd210a889-27e1-49cb-b5c0-d8cad97a6939', // Ordinário Stone
        label: 'PIX',
      },
    },
    taxa: {
      categoria_id: '4374543a-57cc-42b4-a175-b9044cf83b47', // TAXA MAQUININHA
      conta_financeira_id: '5e0290a7-87ed-4a31-ac8d-88f107d20d8a', // Ordinário BB
      fornecedor_id: 'af680bf0-1970-465e-b8df-ae8e1b85a775', // STONE INSTITUICAO DE PAGAMENTO (FORNECEDOR)
    },
  },
};

interface BucketDia {
  tipo: string;
  transacoes: number;
  bruto: number;
  taxa: number;
  liquido: number;
  vencimento: string;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Ontem em horário de Brasília (UTC-3), formato YYYY-MM-DD. */
function ontemBRT(): string {
  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
  brtNow.setUTCDate(brtNow.getUTCDate() - 1);
  return brtNow.toISOString().slice(0, 10);
}

async function getCAToken(barId: number): Promise<{ token: string } | { error: string; status: number }> {
  const supabase = getSupabaseAdmin();
  const { data: credentials, error } = await supabase
    .from('api_credentials')
    .select('access_token, expires_at')
    .eq('sistema', 'conta_azul')
    .eq('bar_id', barId)
    .single();
  if (error || !credentials?.access_token) {
    return { error: 'Credenciais do Conta Azul não encontradas', status: 404 };
  }
  if (credentials.expires_at && new Date(credentials.expires_at) < new Date()) {
    return { error: 'Token CA expirado. Reconecte o Conta Azul.', status: 401 };
  }
  return { token: credentials.access_token };
}

async function getBuckets(barId: number, data: string): Promise<BucketDia[]> {
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await (supabase.schema('financial' as any) as any).rpc(
    'stone_ca_lancamentos_dia',
    { p_bar_id: barId, p_data: data },
  );
  if (error) throw new Error(`Falha ao agregar Stone do dia: ${error.message}`);
  return ((rows as any[]) || []).map((r) => ({
    tipo: String(r.tipo),
    transacoes: Number(r.transacoes) || 0,
    bruto: Number(r.bruto) || 0,
    taxa: Number(r.taxa) || 0,
    liquido: Number(r.liquido) || 0,
    vencimento: String(r.vencimento),
  }));
}

/** Chama o CA e devolve { ok, protocolId, status, erro }. */
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
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!resp.ok) {
    return { ok: false, protocolId: null, status: String(resp.status), erro: json?.message || text || 'erro', raw: json };
  }
  const status = json?.status || null;
  if (status === 'ERROR') {
    return { ok: false, protocolId: null, status, erro: 'CA rejeitou (status ERROR)', raw: json };
  }
  // CA v2 retorna { protocolo, status, data_criacao } (async). Aceita variações por segurança.
  return { ok: true, protocolId: json?.protocolo || json?.protocolId || json?.id || null, status, raw: json };
}

function payloadReceita(cfg: BarStoneConfig, tipo: TipoReceita, b: BucketDia, dataVenda: string) {
  const valor = round2(b.bruto);
  const rc = cfg.receitas[tipo];
  const descricao = `Vendas Stone ${rc.label} ${dataVenda.split('-').reverse().join('/')}`;
  return {
    data_competencia: dataVenda,
    valor,
    observacao: `Recebível Stone (${b.transacoes} transações) lançado via Zykor`,
    descricao,
    contato: cfg.cliente_id,
    conta_financeira: rc.conta_financeira_id,
    rateio: [{ id_categoria: rc.categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [
        {
          descricao,
          data_vencimento: b.vencimento,
          nota: 'Recebível Stone lançado via Zykor',
          conta_financeira: rc.conta_financeira_id,
          detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
        },
      ],
    },
  };
}

function payloadTaxa(cfg: BarStoneConfig, totalTaxa: number, dataVenda: string) {
  const valor = round2(totalTaxa);
  const descricao = `Taxa Stone ${dataVenda.split('-').reverse().join('/')}`;
  return {
    data_competencia: dataVenda,
    valor,
    observacao: 'Taxa de maquininha Stone (dia) lançada via Zykor',
    descricao,
    contato: cfg.taxa.fornecedor_id,
    conta_financeira: cfg.taxa.conta_financeira_id,
    rateio: [{ id_categoria: cfg.taxa.categoria_id, valor }],
    condicao_pagamento: {
      parcelas: [
        {
          descricao,
          data_vencimento: dataVenda,
          nota: 'Taxa Stone lançada via Zykor',
          conta_financeira: cfg.taxa.conta_financeira_id,
          detalhe_valor: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 },
        },
      ],
    },
  };
}

/** GET: preview do dia — não escreve nada no CA. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin' && user.role !== 'financeiro') {
    return permissionErrorResponse('Sem permissão');
  }
  const barId = Number(user.bar_id);
  const cfg = CONFIG[barId];
  if (!cfg) {
    return NextResponse.json({ error: `Bar ${barId} ainda não configurado para Stone->CA` }, { status: 400 });
  }
  const data = new URL(request.url).searchParams.get('data') || ontemBRT();

  try {
    const buckets = await getBuckets(barId, data);
    const supabase = getSupabaseAdmin();
    const { data: log } = await (supabase.schema('financial' as any) as any)
      .from('stone_ca_lancamento_log')
      .select('tipo, valor, ca_protocol_id, criado_em')
      .eq('bar_id', barId)
      .eq('data_venda', data);
    const jaLancado = new Set(((log as any[]) || []).map((l) => l.tipo));

    const totalTaxa = round2(buckets.reduce((s, b) => s + b.taxa, 0));
    const previewReceitas = buckets
      .filter((b) => (['CREDITO', 'DEBITO', 'PIX'] as string[]).includes(b.tipo) && b.bruto > 0)
      .map((b) => ({
        tipo: b.tipo,
        valor: round2(b.bruto),
        vencimento: b.vencimento,
        transacoes: b.transacoes,
        categoria: cfg.receitas[b.tipo as TipoReceita]?.label,
        ja_lancado: jaLancado.has(b.tipo),
      }));

    return NextResponse.json({
      bar_id: barId,
      data,
      receitas: previewReceitas,
      taxa: totalTaxa > 0 ? { valor: totalTaxa, vencimento: data, ja_lancado: jaLancado.has('TAXA') } : null,
      lancamentos_existentes: (log as any[]) || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro no preview' }, { status: 500 });
  }
}

/** POST: cria os lançamentos no CA. Idempotente por (bar, dia, tipo). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin' && user.role !== 'financeiro') {
    return permissionErrorResponse('Sem permissão para criar lançamentos');
  }
  const barId = Number(user.bar_id);
  const cfg = CONFIG[barId];
  if (!cfg) {
    return NextResponse.json({ error: `Bar ${barId} ainda não configurado para Stone->CA` }, { status: 400 });
  }

  const body = await request.json().catch(() => ({} as any));
  const data: string = body?.data || ontemBRT();

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) {
    return NextResponse.json({ error: tokenResult.error }, { status: tokenResult.status });
  }
  const token = tokenResult.token;
  const supabase = getSupabaseAdmin();

  let buckets: BucketDia[];
  try {
    buckets = await getBuckets(barId, data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao agregar' }, { status: 500 });
  }

  // tipos já lançados (idempotência)
  const { data: log } = await (supabase.schema('financial' as any) as any)
    .from('stone_ca_lancamento_log')
    .select('tipo')
    .eq('bar_id', barId)
    .eq('data_venda', data);
  const jaLancado = new Set(((log as any[]) || []).map((l) => l.tipo));

  const resultados: any[] = [];

  async function registrar(tipo: string, valor: number, r: Awaited<ReturnType<typeof postCA>>) {
    if (r.ok) {
      const { error: errLog } = await (supabase.schema('financial' as any) as any)
        .from('stone_ca_lancamento_log')
        .insert({
          bar_id: barId,
          data_venda: data,
          tipo,
          valor: round2(valor),
          ca_protocol_id: r.protocolId,
          ca_status: r.status,
          criado_por: user!.email ?? user!.nome ?? null,
        });
      if (errLog) {
        resultados.push({ tipo, ok: true, protocolId: r.protocolId, warn: `Lançado no CA mas falhou o log: ${errLog.message}` });
        return;
      }
    }
    resultados.push({ tipo, ok: r.ok, valor: round2(valor), protocolId: r.protocolId, status: r.status, erro: r.erro, ca: r.raw });
  }

  // Receitas por tipo
  for (const tipo of ['CREDITO', 'DEBITO', 'PIX'] as TipoReceita[]) {
    const b = buckets.find((x) => x.tipo === tipo);
    if (!b || b.bruto <= 0) continue;
    if (jaLancado.has(tipo)) {
      resultados.push({ tipo, ok: true, skipped: true, motivo: 'já lançado' });
      continue;
    }
    const r = await postCA(token, 'contas-a-receber', payloadReceita(cfg, tipo, b, data));
    await registrar(tipo, b.bruto, r);
  }

  // Taxa (1 despesa/dia)
  const totalTaxa = round2(buckets.reduce((s, b) => s + b.taxa, 0));
  if (totalTaxa > 0) {
    if (jaLancado.has('TAXA')) {
      resultados.push({ tipo: 'TAXA', ok: true, skipped: true, motivo: 'já lançado' });
    } else {
      const r = await postCA(token, 'contas-a-pagar', payloadTaxa(cfg, totalTaxa, data));
      await registrar('TAXA', totalTaxa, r);
    }
  }

  const houveErro = resultados.some((r) => r.ok === false);
  return NextResponse.json(
    { bar_id: barId, data, sucesso: !houveErro, resultados },
    { status: houveErro ? 207 : 200 },
  );
}
