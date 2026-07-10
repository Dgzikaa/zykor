import https from 'https';
import { getInterCertificates } from './certificates';
import crypto from 'crypto';

interface BoletoPaymentParams {
  token: string;
  contaCorrente: string;
  valor: number;
  /** Linha digitável (47) ou código de barras (44/48), só dígitos. */
  linhaDigitavel: string;
  /** Vencimento do título (YYYY-MM-DD). OBRIGATÓRIO na API do Inter — sem ele = "Dados inválidos". */
  dataVencimento: string;
  /** YYYY-MM-DD. Se >= hoje (fuso SP), Inter agenda; senão paga no próximo dia útil. */
  dataPagamento?: string;
  mtlsCredentials?: { cert: Buffer; key: Buffer };
}

function isFutureScheduleDate(dataPagamento: string | undefined): boolean {
  if (!dataPagamento || !/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) return false;
  const hojeIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return dataPagamento > hojeIso;
}

/**
 * Pagamento de boleto/título via Inter (POST /banking/v2/pagamento).
 * Espelha realizarPagamentoPixInter (mesmo host/mTLS/idempotência), trocando o endpoint
 * e o payload (linha digitável em vez de chave PIX). Scope: pagamento-boleto.write.
 */
export async function realizarPagamentoBoletoInter(
  params: BoletoPaymentParams
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { token, contaCorrente, valor, linhaDigitavel, dataVencimento, dataPagamento, mtlsCredentials } = params;
    const { cert, key } = mtlsCredentials || getInterCertificates();

    const codBarra = String(linhaDigitavel || '').replace(/\D/g, '');
    if (![44, 47, 48].includes(codBarra.length)) {
      return { success: false, error: `Linha digitável/código de barras inválido: ${codBarra.length} dígitos (esperado 44, 47 ou 48)` };
    }
    if (!dataVencimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataVencimento)) {
      return { success: false, error: 'Data de vencimento do boleto é obrigatória (YYYY-MM-DD)' };
    }

    const agendar = isFutureScheduleDate(dataPagamento);
    const payload: Record<string, unknown> = {
      // doc do Inter: valorPagar é STRING com 2 casas; dataVencimento é obrigatório
      valorPagar: (Math.round(valor * 100) / 100).toFixed(2),
      codBarraLinhaDigitavel: codBarra,
      dataVencimento,
    };
    if (agendar && dataPagamento) payload.dataPagamento = dataPagamento;

    const payloadStr = JSON.stringify(payload);

    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/banking/v2/pagamento',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
        'x-conta-corrente': contaCorrente,
        'x-id-idempotente': crypto.randomUUID(),
        'Content-Length': Buffer.byteLength(payloadStr),
      },
      cert,
      key,
    };

    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ statusCode: res.statusCode || 500, body }));
      });
      req.on('error', reject);
      req.write(payloadStr);
      req.end();
    });

    if (response.statusCode === 200) {
      return { success: true, data: JSON.parse(response.body || '{}') };
    }
    let errorMessage = `Erro ${response.statusCode}`;
    if (response.body && response.body.trim()) {
      try {
        const e = JSON.parse(response.body);
        const title = e.title || `Erro ${response.statusCode}`;
        errorMessage = e.detail ? `${title}: ${e.detail}` : title;
      } catch { errorMessage = `Erro ${response.statusCode}: ${response.body}`; }
    }
    return { success: false, error: errorMessage };
  } catch (error: any) {
    console.error('❌ Erro ao pagar boleto Inter:', error);
    return { success: false, error: 'Erro na comunicação com o banco' };
  }
}
