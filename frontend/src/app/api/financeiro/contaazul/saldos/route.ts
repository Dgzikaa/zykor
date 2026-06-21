import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CA = 'https://api-v2.contaazul.com';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// tipos que somam no CAIXA vs INVESTIMENTOS (cartão de crédito fica de fora)
const TIPO_CAIXA = new Set(['CONTA_CORRENTE', 'CAIXINHA', 'MEIOS_RECEBIMENTO', 'OUTROS']);
const TIPO_INVEST = new Set(['APLICACAO', 'INVESTIMENTO', 'POUPANCA']);

/**
 * GET /api/financeiro/contaazul/saldos — saldo atual de cada conta financeira do CA,
 * somado em caixa + investimentos (o que falta pro Caixa+Investimentos do Balanço).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = sb();
  const { data: cred } = await supabase.from('api_credentials')
    .select('access_token, expires_at').eq('sistema', 'conta_azul').eq('bar_id', user.bar_id).single();
  if (!cred?.access_token) return NextResponse.json({ success: false, error: 'Conta Azul não conectado' }, { status: 404 });
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
    return NextResponse.json({ success: false, error: 'Token CA expirado — reconecte o Conta Azul' }, { status: 401 });
  }
  const token = cred.access_token;

  const { data: contas } = await (supabase.schema('bronze' as any) as any)
    .from('bronze_contaazul_contas_financeiras')
    .select('contaazul_id, nome, tipo').eq('bar_id', user.bar_id).eq('ativo', true);
  if (!contas?.length) return NextResponse.json({ success: false, error: 'Nenhuma conta financeira sincronizada' }, { status: 404 });

  const detalhe: any[] = [];
  let caixa = 0, investimentos = 0;
  for (const c of contas) {
    const tipo = String(c.tipo || '').toUpperCase();
    if (tipo === 'CARTAO_CREDITO' || tipo === 'COBRANCAS_CONTA_AZUL' || tipo === 'RECEBA_FACIL_CARTAO') continue;
    try {
      const r = await fetch(`${CA}/v1/conta-financeira/${c.contaazul_id}/saldo-atual`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { detalhe.push({ nome: c.nome, tipo, saldo: null, erro: `HTTP ${r.status}` }); continue; }
      const j = await r.json();
      const saldo = Number(j?.saldo_atual || 0);
      detalhe.push({ nome: c.nome, tipo, saldo });
      if (TIPO_INVEST.has(tipo)) investimentos += saldo;
      else if (TIPO_CAIXA.has(tipo)) caixa += saldo;
      else caixa += saldo; // tipo desconhecido entra no caixa
    } catch (e: any) {
      detalhe.push({ nome: c.nome, tipo, saldo: null, erro: e?.message });
    }
  }

  return NextResponse.json({
    success: true,
    caixa: Math.round(caixa * 100) / 100,
    investimentos: Math.round(investimentos * 100) / 100,
    total: Math.round((caixa + investimentos) * 100) / 100,
    contas: detalhe.sort((a, b) => (b.saldo || 0) - (a.saldo || 0)),
  });
}
