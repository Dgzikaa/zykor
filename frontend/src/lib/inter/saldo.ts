import https from 'https';
import { getInterCertificates } from './certificates';

/**
 * Consulta o saldo da conta no Inter (GET /banking/v2/saldo). Scope: extrato.read.
 * Espelha o mTLS dos pagamentos. Retorna o saldo disponível.
 */
export async function consultarSaldoInter(params: {
  token: string; contaCorrente: string; mtlsCredentials?: { cert: Buffer; key: Buffer };
}): Promise<{ success: boolean; saldo?: number; data?: any; error?: string }> {
  try {
    const { token, contaCorrente, mtlsCredentials } = params;
    const { cert, key } = mtlsCredentials || getInterCertificates();

    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/banking/v2/saldo',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'x-conta-corrente': contaCorrente,
        'Content-Type': 'application/json',
      },
      cert, key,
    };

    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ statusCode: res.statusCode || 500, body }));
      });
      req.on('error', reject);
      req.end();
    });

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body || '{}');
      // Inter retorna disponivel + bloqueios; usamos o disponível.
      const saldo = Number(data.disponivel ?? data.saldoDisponivel ?? 0);
      return { success: true, saldo, data };
    }
    let errorMessage = `Erro ${response.statusCode}`;
    if (response.body?.trim()) {
      try { const e = JSON.parse(response.body); errorMessage = e.detail ? `${e.title}: ${e.detail}` : (e.title || errorMessage); }
      catch { errorMessage = `Erro ${response.statusCode}: ${response.body}`; }
    }
    return { success: false, error: errorMessage };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Erro na comunicação com o Inter' };
  }
}
