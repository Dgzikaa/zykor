import https from 'https';
import { getInterCertificates } from './certificates';

export interface ConsultaBoletoParams {
  token: string;
  contaCorrente: string;
  /** YYYY-MM-DD */
  dataInicio: string;
  /** YYYY-MM-DD */
  dataFim: string;
  mtlsCredentials?: { cert: Buffer; key: Buffer };
}

/**
 * Consulta de PAGAMENTOS de boleto/título no Inter — GET /banking/v2/pagamento.
 * Espelha o host/mTLS do realizarPagamentoBoletoInter, trocando o método (GET) e o scope
 * (pagamento-boleto.read). Filtra por data de PAGAMENTO no período. Devolve a resposta CRUA
 * (o formato exato — nome dos campos/status — varia; por isso a rota de reconciliação lê
 * defensivamente e a rota /consultar existe pra inspecionar o retorno real).
 */
export async function consultarPagamentosBoletoInter(
  params: ConsultaBoletoParams
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { token, contaCorrente, dataInicio, dataFim, mtlsCredentials } = params;
    const { cert, key } = mtlsCredentials || getInterCertificates();

    const qs = new URLSearchParams({ dataInicio, dataFim, filtrarDataPor: 'PAGAMENTO' }).toString();
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: `/banking/v2/pagamento?${qs}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'x-conta-corrente': contaCorrente,
        Accept: 'application/json',
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
      req.end();
    });

    if (response.statusCode === 200) {
      return { success: true, data: JSON.parse(response.body || '[]') };
    }
    let msg = `Erro ${response.statusCode}`;
    if (response.body && response.body.trim()) {
      try {
        const e = JSON.parse(response.body);
        msg = e.detail ? `${e.title || msg}: ${e.detail}` : (e.title || msg);
      } catch { msg = `${msg}: ${response.body}`; }
    }
    return { success: false, error: msg };
  } catch (error: any) {
    console.error('❌ Erro ao consultar pagamentos Inter:', error);
    return { success: false, error: error?.message || 'Erro na comunicação com o Inter' };
  }
}

/**
 * Extrai a lista de pagamentos da resposta do Inter, defensivamente (pode vir como array direto
 * ou dentro de `pagamentos`/`content`/`transacoes`). Normaliza os campos que a reconciliação usa.
 */
export function normalizarPagamentosInter(data: any): Array<{
  codigoTransacao: string | null;
  status: string;
  valor: number | null;
  linhaDigitavel: string | null;
  dataPagamento: string | null;
  raw: any;
}> {
  const lista: any[] = Array.isArray(data)
    ? data
    : (data?.pagamentos || data?.content || data?.transacoes || data?.itens || []);
  return (Array.isArray(lista) ? lista : []).map((p: any) => ({
    codigoTransacao: p?.codigoTransacao || p?.codigoSolicitacao || p?.codigo || null,
    status: String(p?.statusPagamento || p?.status || '').toUpperCase().trim(),
    valor: p?.valorPagamento != null ? Number(p.valorPagamento)
      : p?.valor != null ? Number(p.valor) : null,
    linhaDigitavel: (p?.codBarra || p?.codBarraLinhaDigitavel || p?.codigoBarra || p?.linhaDigitavel || '')
      ? String(p.codBarra || p.codBarraLinhaDigitavel || p.codigoBarra || p.linhaDigitavel).replace(/\D/g, '')
      : null,
    dataPagamento: p?.dataPagamento || p?.dataVencimento || p?.dataAgendamento || null,
    raw: p,
  }));
}

// Status do Inter (módulo Pagamento) → estado local. Conservador: só marca PAGO no que é
// claramente liquidado. Os nomes exatos vêm da rota /consultar; ajustar aqui se divergir.
export function mapStatusPagamentoInter(status: string): 'pago' | 'cancelado' | 'pendente' | 'desconhecido' {
  const s = String(status || '').toUpperCase().replace(/\s+/g, '_');
  if (['PAGO', 'TITULO_PAGO', 'DEBITADO', 'LIQUIDADO', 'EFETIVADO', 'PAGAMENTO_EFETUADO', 'REALIZADO'].includes(s)) return 'pago';
  if (['CANCELADO', 'TITULO_CANCELADO', 'EXPIRADO', 'FALHA', 'ERRO', 'REJEITADO', 'NAO_PAGO', 'DEVOLVIDO'].includes(s)) return 'cancelado';
  if (['AGENDADO', 'TITULO_AGENDADO', 'AGUARDANDO_APROVACAO', 'PENDENTE', 'PROCESSANDO', 'EM_PROCESSAMENTO', 'PROCESSADO'].includes(s)) return 'pendente';
  return 'desconhecido';
}
