import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CA = 'https://api-v2.contaazul.com';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const TIPO_INVEST = new Set(['APLICACAO', 'INVESTIMENTO', 'POUPANCA']);
const SKIP = new Set(['CARTAO_CREDITO', 'COBRANCAS_CONTA_AZUL', 'RECEBA_FACIL_CARTAO']);

/**
 * POST /api/financeiro/contaazul/saldos/snapshot — SISTEMA (Authorization Bearer service role key).
 * Captura o saldo-atual de todas as contas do CA por bar e grava em saldo_snapshot_mensal
 * (mês corrente). Chamado por cron diário → o mês fecha com o saldo do último dia.
 */
export async function POST(request: NextRequest) {
  await authenticateUser(request);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceKey || request.headers.get('authorization') !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ success: false, error: 'não autorizado' }, { status: 401 });
  }
  const supabase = sb();
  const agora = new Date();
  const ano = agora.getFullYear(), mes = agora.getMonth() + 1;

  const { data: creds } = await supabase.from('api_credentials')
    .select('bar_id, access_token, expires_at').eq('sistema', 'conta_azul');

  const resultado: any[] = [];
  for (const cred of (creds || [])) {
    if (!cred.access_token || (cred.expires_at && new Date(cred.expires_at) < agora)) {
      resultado.push({ bar_id: cred.bar_id, erro: 'token expirado/ausente' }); continue;
    }
    const { data: contas } = await (supabase.schema('bronze' as any) as any)
      .from('bronze_contaazul_contas_financeiras')
      .select('contaazul_id, nome, tipo').eq('bar_id', cred.bar_id).eq('ativo', true);

    let caixa = 0, invest = 0; const det: any[] = [];
    for (const c of (contas || [])) {
      const tipo = String(c.tipo || '').toUpperCase();
      if (SKIP.has(tipo)) continue;
      try {
        const r = await fetch(`${CA}/v1/conta-financeira/${c.contaazul_id}/saldo-atual`, { headers: { Authorization: `Bearer ${cred.access_token}` } });
        if (!r.ok) continue;
        const saldo = Number((await r.json())?.saldo_atual || 0);
        det.push({ nome: c.nome, tipo, saldo });
        if (TIPO_INVEST.has(tipo)) invest += saldo; else caixa += saldo;
      } catch { /* ignora conta com falha */ }
    }
    const total = Math.round((caixa + invest) * 100) / 100;
    await (supabase.schema('financial' as any) as any).from('saldo_snapshot_mensal').upsert({
      bar_id: cred.bar_id, ano, mes,
      caixa: Math.round(caixa * 100) / 100, investimentos: Math.round(invest * 100) / 100, total,
      detalhe: det, capturado_em: new Date().toISOString(),
    }, { onConflict: 'bar_id,ano,mes' });
    resultado.push({ bar_id: cred.bar_id, caixa: Math.round(caixa * 100) / 100, investimentos: Math.round(invest * 100) / 100, total, contas: det.length });
  }
  return NextResponse.json({ success: true, ano, mes, resultado });
}
