import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken, clearInterTokenCache } from '@/lib/inter/getAccessToken';
import { realizarPagamentoBoletoInter } from '@/lib/inter/boletoPayment';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// Extrai o código rastreável da resposta do Inter (POST /banking/v2/pagamento de boleto).
// O PIX devolve codigoSolicitacao direto; o boleto varia o nome do campo entre versões/fluxos
// (e no fluxo com aprovadores o código às vezes vem aninhado). Aqui: 1) tenta os nomes conhecidos
// no topo; 2) faz uma varredura rasa procurando qualquer chave *codigo*/*transacao*/id com valor
// UUID/alfanumérico. Só cai no fallback BOL_ se realmente não houver NADA rastreável.
const RE_CODIGO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function extrairCodigoBoletoInter(data: any): string | null {
  if (!data || typeof data !== 'object') return null;
  const conhecidos = [
    data.codigoTransacao, data.codigoSolicitacao, data.codigoSolicitacaoPagamento,
    data.codigo, data.idTransacao, data.transacaoId, data.id, data.idPagamento,
  ];
  for (const c of conhecidos) if (typeof c === 'string' && c.trim()) return c.trim();
  // Varredura rasa (1 nível): chave que parece de código com valor UUID.
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string' && /codigo|transacao|solicitacao|pagamento|^id$/i.test(k) && (RE_CODIGO.test(v) || v.length >= 16)) {
      return v.trim();
    }
  }
  // Um nível aninhado (ex.: { titulo: { codigoSolicitacao } }).
  for (const v of Object.values(data)) {
    if (v && typeof v === 'object') {
      const aninhado = extrairCodigoBoletoInter(v);
      if (aninhado) return aninhado;
    }
  }
  return null;
}

async function getInterCredentials(barId: number, credentialId?: number) {
  let query = supabase.from('api_credentials').select('*').eq('bar_id', barId)
    .in('sistema', ['inter', 'banco_inter']).eq('ativo', true);
  query = credentialId ? query.eq('id', credentialId) : query.order('id', { ascending: true }).limit(1);
  const { data, error } = await query;
  if (error || !data?.[0]) { console.error('[INTER-BOLETO] credenciais:', error); return null; }
  return data[0];
}

/**
 * Pagamento de BOLETO via Inter (por linha digitável). Espelha /inter/pix.
 * Envia dinheiro real — exige financeiro/admin; bar_id vem SEMPRE do usuário.
 * Body: { valor, linha_digitavel, descricao?, destinatario?, data_pagamento?, inter_credencial_id?, agendamento_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) return authErrorResponse('Usuário não autenticado');
    if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.agendamentos, 'inserir')) return permissionErrorResponse('Sem permissão para pagar boleto');
    const bar_id = user.bar_id;
    if (!bar_id) return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });

    const body = await request.json();
    const { valor, linha_digitavel, descricao, destinatario, data_pagamento, data_vencimento, inter_credencial_id } = body;

    const codBarra = String(linha_digitavel || '').replace(/\D/g, '');
    // válido: 44 (código de barras) ou 47 (linha digitável bancária) ou 48 (convênio/tributo).
    // 45/46 = linha truncada (dígito faltando na captura) → o Inter recusa com "Boleto inválido".
    if (![44, 47, 48].includes(codBarra.length)) {
      return NextResponse.json({ success: false, error: `Código de barras/linha digitável inválido: ${codBarra.length} dígitos (esperado 44, 47 ou 48). Recapture o boleto.` }, { status: 400 });
    }
    // dataVencimento é obrigatória no Inter; se não vier, usa a data de pagamento (vencimento do pedido)
    const dataVencimento = (typeof data_vencimento === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data_vencimento))
      ? data_vencimento
      : (typeof data_pagamento === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data_pagamento) ? data_pagamento : '');
    if (!dataVencimento) {
      return NextResponse.json({ success: false, error: 'Data de vencimento do boleto é obrigatória' }, { status: 400 });
    }
    const valorNumerico = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return NextResponse.json({ success: false, error: 'Valor inválido' }, { status: 400 });
    }

    const credentialId = Number.isFinite(Number(inter_credencial_id)) ? Number(inter_credencial_id) : undefined;
    const credenciais = await getInterCredentials(bar_id, credentialId);
    if (!credenciais) return NextResponse.json({ success: false, error: 'Credenciais Inter não configuradas' }, { status: 400 });

    let resolved;
    try { resolved = await resolveInterCredential(credenciais); }
    catch (e: any) { return NextResponse.json({ success: false, error: e?.message || 'Falha ao resolver credencial Inter' }, { status: 400 }); }
    const { clientId, clientSecret, contaCorrente, mtls } = resolved;
    if (!clientId || !clientSecret || !contaCorrente) {
      return NextResponse.json({ success: false, error: 'Credenciais Inter incompletas' }, { status: 400 });
    }

    let accessToken = await getInterAccessToken(clientId, clientSecret, 'pagamento-boleto.write', mtls || undefined);
    let resultado = await realizarPagamentoBoletoInter({
      token: accessToken, contaCorrente, valor: valorNumerico, linhaDigitavel: codBarra, dataVencimento,
      dataPagamento: typeof data_pagamento === 'string' ? data_pagamento : undefined, mtlsCredentials: mtls || undefined,
    });

    // Retry se token cached era de cert antigo
    if (!resultado.success && /not bound to a valid|recognized certificate/i.test(resultado.error || '')) {
      clearInterTokenCache();
      accessToken = await getInterAccessToken(clientId, clientSecret, 'pagamento-boleto.write', mtls || undefined);
      resultado = await realizarPagamentoBoletoInter({
        token: accessToken, contaCorrente, valor: valorNumerico, linhaDigitavel: codBarra, dataVencimento,
        dataPagamento: typeof data_pagamento === 'string' ? data_pagamento : undefined, mtlsCredentials: mtls || undefined,
      });
    }

    if (!resultado.success) {
      return NextResponse.json({ success: false, error: resultado.error }, { status: 400 });
    }
    // O Inter (POST /banking/v2/pagamento) devolve o id em `codigoTransacao`. Guardamos o REAL
    // pra reconciliação de status conseguir consultar depois (GET /banking/v2/pagamento). Só cai
    // no fallback BOL_ se o Inter não devolver nenhum código.
    const codigoInter = extrairCodigoBoletoInter(resultado.data);
    const codigoSolicitacao = codigoInter || `BOL_${Date.now()}`;
    if (!codigoInter) {
      // Sem código rastreável ⇒ a reconciliação por código não vai achar (só por linha+valor).
      // Loga a resposta CRUA pra a gente descobrir em qual campo o Inter manda o código e passar
      // a capturá-lo (parando de gerar BOL_). Guardamos também no registro pra inspeção posterior.
      console.warn('[INTER-BOLETO] resposta 200 SEM código rastreável — fallback BOL_. Resposta crua:', JSON.stringify(resultado.data));
    }

    // Registro em financial.pix_enviados (mesma trilha de rastreio dos pagamentos Inter)
    await (supabase.schema('financial' as any) as any).from('pix_enviados').insert({
      txid: codigoSolicitacao,
      bar_id,
      valor: valorNumerico,
      inter_credencial_id: credentialId || null,
      inter_codigo_solicitacao: codigoSolicitacao,
      inter_status: 'ENVIADO',
      data_pagamento: typeof data_pagamento === 'string' ? data_pagamento : null,
      pagamento_zykor_id: typeof body.agendamento_id === 'string' ? body.agendamento_id : null,
      beneficiario: {
        nome: destinatario || 'Boleto', linha_digitavel: codBarra,
        descricao: descricao || 'Pagamento de boleto', tipo: 'BOLETO',
        // Resposta crua do Inter só quando NÃO veio código (diagnóstico do fallback BOL_).
        ...(codigoInter ? {} : { inter_resposta: resultado.data ?? null }),
      },
      data_envio: new Date().toISOString(),
      status: 'enviado',
    });

    return NextResponse.json({ success: true, message: 'Boleto enviado pro Inter', data: { codigoSolicitacao, valor: valorNumerico, interResponse: resultado.data } });
  } catch (error: any) {
    console.error('[INTER-BOLETO] erro:', error);
    return NextResponse.json({ success: false, error: 'Erro interno ao pagar boleto' }, { status: 500 });
  }
}
