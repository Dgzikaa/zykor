import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizar(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * POST /api/financeiro/contaazul/baixa
 *
 * Dá baixa (quita) a conta a pagar no Conta Azul depois que o PIX foi aprovado no Inter,
 * fechando a conciliação (hoje a conta a pagar fica "em aberto" mesmo após pago).
 *
 * Fluxo:
 *   1. Acha o EVENTO da conta a pagar na bronze por match EXATO (bar + competência +
 *      valor + descrição) — só age se houver exatamente 1.
 *   2. GET /eventos-financeiros/{id_evento}/parcelas → pega a parcela.
 *   3. Se a parcela ainda está PENDENTE e sem baixa → POST cria a baixa.
 *
 * Idempotente: se a parcela já está QUITADA ou já tem baixa, retorna ok sem duplicar.
 * Se o evento ainda não sincronizou (recém-criado), retorna 409 'nao_sincronizado'
 * pra quem chamou tentar de novo depois.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const body = await request.json();
    const {
      bar_id,
      valor,
      descricao,
      data_competencia,
      data_pagamento,
      conta_financeira_id,
    } = body || {};

    const barIdNum = Number(bar_id);
    const valorNum = Number(valor);
    if (!Number.isFinite(barIdNum)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return NextResponse.json({ error: 'valor inválido' }, { status: 400 });
    }
    if (!descricao || !data_competencia || !conta_financeira_id) {
      return NextResponse.json(
        { error: 'descricao, data_competencia e conta_financeira_id são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Token CA
    const { data: cred } = await supabase
      .from('api_credentials')
      .select('access_token, expires_at')
      .eq('sistema', 'conta_azul')
      .eq('bar_id', barIdNum)
      .single();
    if (!cred?.access_token) {
      return NextResponse.json({ error: 'Credenciais CA não encontradas' }, { status: 404 });
    }
    if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token CA expirado' }, { status: 401 });
    }
    const token = cred.access_token;

    // 1) Acha o evento da conta a pagar na bronze (match exato, 1 só)
    const valorRound = Math.round(valorNum * 100) / 100;
    const { data: candidatos } = await (supabase
      .schema('bronze' as any) as any)
      .from('bronze_contaazul_lancamentos')
      .select('contaazul_id, descricao, valor_bruto, data_competencia, tipo, status')
      .eq('bar_id', barIdNum)
      .eq('data_competencia', data_competencia)
      .is('excluido_em', null)
      .limit(50);

    const descNorm = normalizar(descricao);
    const matches = ((candidatos as any[]) || []).filter(
      l =>
        Math.abs(Number(l.valor_bruto || 0) - valorRound) < 0.01 &&
        normalizar(l.descricao || '') === descNorm &&
        String(l.tipo || '').toUpperCase() !== 'RECEITA'
    );

    if (matches.length === 0) {
      // ainda não sincronizou (conta a pagar recém-criada) — caller pode tentar depois
      return NextResponse.json(
        { error: 'Conta a pagar ainda não sincronizada no Conta Azul.', code: 'nao_sincronizado' },
        { status: 409 }
      );
    }
    if (matches.length > 1) {
      return NextResponse.json(
        { error: 'Mais de uma conta a pagar bate com esses dados; baixa manual por segurança.', code: 'ambiguo' },
        { status: 409 }
      );
    }
    const idEvento = matches[0].contaazul_id;

    // 2) Pega a parcela do evento
    const parcelasResp = await fetch(
      `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/${idEvento}/parcelas`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!parcelasResp.ok) {
      const txt = await parcelasResp.text();
      return NextResponse.json(
        { error: `CA parcelas HTTP ${parcelasResp.status}: ${txt}` },
        { status: 502 }
      );
    }
    const parcelas = await parcelasResp.json();
    const lista = Array.isArray(parcelas) ? parcelas : [];
    // conta a pagar do Zykor é parcela única
    const parcela = lista[0];
    if (!parcela?.id) {
      return NextResponse.json({ error: 'Parcela não encontrada no evento' }, { status: 404 });
    }

    // Idempotência: já quitada ou já tem baixa → não duplica
    const jaQuitada =
      String(parcela.status || '').toUpperCase() === 'QUITADO' ||
      (Array.isArray(parcela.baixas) && parcela.baixas.length > 0);
    if (jaQuitada) {
      return NextResponse.json({ success: true, ja_baixada: true, id_parcela: parcela.id });
    }

    // 3) Cria a baixa (quita) via TRANSFERENCIA_BANCARIA (PIX)
    const baixaResp = await fetch(
      `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/parcelas/${parcela.id}/baixa`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_pagamento: data_pagamento || new Date().toISOString().slice(0, 10),
          composicao_valor: { valor_bruto: valorRound, multa: 0, juros: 0, desconto: 0, taxa: 0 },
          conta_financeira: conta_financeira_id,
          metodo_pagamento: 'TRANSFERENCIA_BANCARIA',
          observacao: 'Baixa automática via Zykor (PIX Inter aprovado)',
        }),
      }
    );
    const baixaText = await baixaResp.text();
    let baixaJson: any = null;
    try {
      baixaJson = baixaText ? JSON.parse(baixaText) : null;
    } catch {
      baixaJson = null;
    }
    if (!baixaResp.ok) {
      return NextResponse.json(
        { error: `CA baixa HTTP ${baixaResp.status}: ${baixaJson?.message || baixaText}` },
        { status: baixaResp.status >= 500 ? 502 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      id_evento: idEvento,
      id_parcela: parcela.id,
      id_baixa: baixaJson?.id || null,
    });
  } catch (err: any) {
    console.error('[CA-BAIXA] Erro:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}
