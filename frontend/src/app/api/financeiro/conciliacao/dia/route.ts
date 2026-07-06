import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

// De-para Stone (bandeira confirmada por BIN; tipo de conta = enum padrão Stone).
const BRAND: Record<number, string> = { 1: 'Visa', 2: 'Mastercard', 3: 'Amex', 4: 'Hipercard', 171: 'Elo' };
// Confirmado por cruzamento com ContaHub (créd = acct 2+4; déb = acct 1+3).
const ACCOUNT: Record<number, string> = { 1: 'Débito', 2: 'Crédito', 3: 'Voucher', 4: 'Private Label', 5: 'Outro', 99: 'PIX' };
const brandName = (id: any) => BRAND[Number(id)] || (id == null ? '—' : `Bandeira ${id}`);
const accountName = (id: any) => ACCOUNT[Number(id)] || (id == null ? '—' : `Tipo ${id}`);

/**
 * GET /api/financeiro/conciliacao/dia?data=YYYY-MM-DD
 * Drill-down: transações Stone do dia (paginado, todas) + repasses (Payments) + resumo por bandeira.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const data = (new URL(request.url).searchParams.get('data') || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ success: false, error: 'data inválida (use YYYY-MM-DD)' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const num = (v: any) => Number(v || 0);

  // Transações: alinhar pelo DIA OPERACIONAL (corte 6h) — mesma regra do gold.
  // capture_local_dt - 6h cai no dia operacional; filtra [data 06:00, data+1 06:00).
  const ini = `${data}T06:00:00`;
  const fimDate = new Date(`${data}T06:00:00Z`);
  fimDate.setUTCDate(fimDate.getUTCDate() + 1);

  let tx: any[];
  let pagamentos: any[];
  let chPays: any[];
  try {
    tx = await paginate<any>(
      () => (supabase as any)
        .schema('silver').from('stone_transacoes')
        .select('stone_code, empresa_nome, capture_local_dt, account_type, brand_id, number_of_installments, card_number_masked, gross_amount, net_amount, fee_amount, prevision_payment_date, poi_serial_number, issuer_authorization_code, ev_chargebacks, ev_cancellations')
        .eq('bar_id', user.bar_id)
        .gte('capture_local_dt', ini)
        .lt('capture_local_dt', fimDate.toISOString())
        .order('capture_local_dt', { ascending: true }),
      { label: 'conciliacao/dia/tx' },
    );
    pagamentos = await paginate<any>(
      () => (supabase as any)
        .schema('silver').from('stone_pagamentos')
        .select('stone_code, empresa_nome, payment_id, wallet_type_id, total_amount, bank_code, bank_branch, bank_account_number')
        .eq('bar_id', user.bar_id)
        .eq('reference_date', data)
        .order('total_amount', { ascending: false }),
      { label: 'conciliacao/dia/pag' },
    );
    chPays = await paginate<any>(
      () => (supabase as any)
        .schema('silver').from('faturamento_pagamentos')
        .select('tipo, valor_bruto, cliente_nome, mesa_desc, meio, created_at')
        .eq('bar_id', user.bar_id)
        .eq('data_pagamento', data)
        .in('tipo', ['Cred', 'Deb', 'Outro'])
        .order('created_at', { ascending: true }),
      { label: 'conciliacao/dia/ch' },
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao buscar dia' }, { status: 500 });
  }

  // garçom (usr_lancou) + comanda (cli/trn) vêm do bronze do ContaHub — o silver não os carrega e
  // o origem_ref é instável, então casamos por chave natural (mesa | valor).
  let chRaw: any[] = [];
  try {
    const prox = new Date(`${data}T00:00:00Z`); prox.setUTCDate(prox.getUTCDate() + 1);
    chRaw = await paginate<any>(
      () => (supabase as any).schema('bronze').from('bronze_contahub_financeiro_pagamentosrecebidos')
        .select('mesa, valor, usr_lancou, cli, trn, dt_gerencial')
        .eq('bar_id', user.bar_id)
        .gte('dt_gerencial', data).lt('dt_gerencial', prox.toISOString().slice(0, 10)),
      { label: 'conciliacao/dia/chraw' });
  } catch { chRaw = []; }
  const rawMap = new Map<string, { garcom: string | null; comanda: string | null }[]>();
  for (const r of chRaw) {
    const k = `${String(r.mesa || '').trim()}|${num(r.valor).toFixed(2)}`;
    if (!rawMap.has(k)) rawMap.set(k, []);
    rawMap.get(k)!.push({ garcom: r.usr_lancou || null, comanda: r.cli != null ? String(r.cli) : (r.trn != null ? String(r.trn) : null) });
  }

  // Resumo por bandeira × tipo de conta
  const mapa = new Map<string, any>();
  for (const t of tx) {
    const key = `${t.brand_id}|${t.account_type}`;
    if (!mapa.has(key)) mapa.set(key, { bandeira: brandName(t.brand_id), tipo: accountName(t.account_type), qtd: 0, bruto: 0, taxa: 0, liquido: 0 });
    const a = mapa.get(key);
    a.qtd += 1; a.bruto += num(t.gross_amount); a.taxa += num(t.fee_amount); a.liquido += num(t.net_amount);
  }
  const por_bandeira = Array.from(mapa.values()).sort((a, b) => b.bruto - a.bruto);

  // Casamento Stone × ContaHub por (lado, valor): marca cada transação Stone como
  // suspeita quando não tem par no ContaHub (ContaHub não fornece NSU/autorização).
  // Lados: crédito (acct 2+4), débito (1+3) e PIX (acct 99 = Stone PIX via webhook).
  // O PIX entra pela Stone E está no ContaHub (meio 'Pix Auto') — sem casá-lo, os PIX do
  // dia caíam como "Outros" mesmo o dia batendo. Dinheiro NÃO passa pela Stone → fica fora.
  const side = (at: any) => { const n = Number(at); return [2, 4].includes(n) ? 'Cred' : [1, 3].includes(n) ? 'Deb' : n === 99 ? 'Pix' : 'Outro'; };
  const chSide = (p: any) => p.tipo === 'Cred' ? 'Cred' : p.tipo === 'Deb' ? 'Deb' : /pix/i.test(String(p.meio || '')) ? 'Pix' : null;
  const chBuckets = new Map<string, any[]>();
  for (const p of chPays) {
    const cs = chSide(p);
    if (!cs) continue; // Dinheiro e demais meios fora da Stone não entram na conciliação
    const k = `${cs}|${num(p.valor_bruto).toFixed(2)}`;
    if (!chBuckets.has(k)) chBuckets.set(k, []);
    chBuckets.get(k)!.push(p);
  }
  const transacoes = tx.map((t) => {
    const k = `${side(t.account_type)}|${num(t.gross_amount).toFixed(2)}`;
    const bucket = chBuckets.get(k);
    const matched = !!bucket && bucket.length > 0;
    if (matched) bucket!.shift(); // consome o par do ContaHub
    return {
      hora: t.capture_local_dt,
      bandeira: brandName(t.brand_id),
      tipo: accountName(t.account_type),
      parcelas: t.number_of_installments,
      cartao: t.card_number_masked,
      bruto: num(t.gross_amount),
      taxa: num(t.fee_amount),
      liquido: num(t.net_amount),
      previsao: t.prevision_payment_date,
      maquininha: t.poi_serial_number,
      autorizacao: t.issuer_authorization_code,
      chargeback: num(t.ev_chargebacks) > 0,
      cancelada: num(t.ev_cancellations) > 0,
      suspeita: !matched,
    };
  });

  const repasses = pagamentos.map((p) => ({
    payment_id: p.payment_id,
    carteira: p.wallet_type_id,
    valor: num(p.total_amount),
    conta: [p.bank_code, p.bank_branch, p.bank_account_number].filter(Boolean).join(' / ') || '—',
  }));

  // Conciliação por tipo: onde está a divergência (ContaHub × Stone).
  // Stone: crédito = account_type 2+4; débito = 1+3 (confirmado vs ContaHub).
  const stoneCred = tx.filter((t) => [2, 4].includes(Number(t.account_type))).reduce((s, t) => s + num(t.gross_amount), 0);
  const stoneDeb = tx.filter((t) => [1, 3].includes(Number(t.account_type))).reduce((s, t) => s + num(t.gross_amount), 0);
  const stonePix = tx.filter((t) => Number(t.account_type) === 99).reduce((s, t) => s + num(t.gross_amount), 0);
  const stoneBruto = tx.reduce((s, t) => s + num(t.gross_amount), 0);
  const chPix = chPays.filter((p) => /pix/i.test(String(p.meio || ''))).reduce((s, p) => s + num(p.valor_bruto), 0);

  let gold: any = null;
  const { data: gd } = await (supabase as any)
    .schema('gold').from('stone_conciliacao_diaria')
    .select('contahub_cartao, ch_credito, ch_debito, stone_bruto, diferenca, status')
    .eq('bar_id', user.bar_id).eq('data', data).maybeSingle();
  gold = gd || null;

  const chCred = num(gold?.ch_credito), chDeb = num(gold?.ch_debito), chCartao = num(gold?.contahub_cartao);
  const conciliacao = {
    status: gold?.status || null,
    linhas: [
      { tipo: 'Crédito', contahub: chCred, stone: stoneCred, dif: Number((chCred - stoneCred).toFixed(2)) },
      { tipo: 'Débito', contahub: chDeb, stone: stoneDeb, dif: Number((chDeb - stoneDeb).toFixed(2)) },
      // PIX só aparece quando houve PIX no dia (Stone acct 99 / ContaHub 'Pix Auto')
      ...(stonePix > 0 || chPix > 0 ? [{ tipo: 'PIX', contahub: Number(chPix.toFixed(2)), stone: Number(stonePix.toFixed(2)), dif: Number((chPix - stonePix).toFixed(2)) }] : []),
      { tipo: 'Total', contahub: chCartao, stone: stoneBruto, dif: Number((chCartao - stoneBruto).toFixed(2)) },
    ],
  };

  // Divergências: Stone suspeita (sem par) + ContaHub que sobrou.
  const so_stone = tx
    .map((t, i) => ({ t, susp: transacoes[i].suspeita }))
    .filter((x) => x.susp)
    .map(({ t }) => ({
      tipo: side(t.account_type), valor: num(t.gross_amount), hora: t.capture_local_dt,
      brand_id: t.brand_id, cartao: t.card_number_masked, autorizacao: t.issuer_authorization_code,
    }));
  const so_ch: any[] = [];
  for (const [, arr] of chBuckets) for (const p of arr) {
    const hit = rawMap.get(`${String(p.mesa_desc || '').trim()}|${num(p.valor_bruto).toFixed(2)}`)?.shift();
    so_ch.push({ tipo: chSide(p) || p.tipo, valor: num(p.valor_bruto), cliente: p.cliente_nome, mesa: p.mesa_desc, meio: p.meio, garcom: hit?.garcom || null, comanda: hit?.comanda || null });
  }
  so_ch.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  const divergencias = {
    so_stone, so_ch,
    resumo: {
      so_stone_qtd: so_stone.length, so_stone_valor: so_stone.reduce((s, t) => s + t.valor, 0),
      so_ch_qtd: so_ch.length, so_ch_valor: so_ch.reduce((s, t) => s + t.valor, 0),
    },
  };

  return NextResponse.json({
    success: true,
    data,
    resumo: {
      transacoes: transacoes.length,
      bruto: transacoes.reduce((s, t) => s + t.bruto, 0),
      taxa: transacoes.reduce((s, t) => s + t.taxa, 0),
      liquido: transacoes.reduce((s, t) => s + t.liquido, 0),
      chargebacks: transacoes.filter((t) => t.chargeback).length,
      repasses_qtd: repasses.length,
      repasses_total: repasses.reduce((s, r) => s + r.valor, 0),
    },
    conciliacao,
    divergencias,
    por_bandeira,
    transacoes,
    repasses,
  });
}
