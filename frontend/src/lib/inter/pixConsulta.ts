import https from 'https';

/**
 * Consulta o status REAL de um PIX no Inter — GET /banking/v2/pix/{codigoSolicitacao}
 * (scope pagamento-pix.read). Usado pela reconciliação: o webhook do Inter NÃO dispara
 * quando o sócio aprova um PIX AGENDADO (só quando efetiva, na data). Então varremos os
 * pedidos "aguardando_socio"/"agendado" e lemos o status direto do banco.
 */
export async function consultarPixInter(params: {
  token: string;
  contaCorrente: string;
  codigo: string;
  mtlsCredentials?: { cert: Buffer; key: Buffer };
}): Promise<{ success: boolean; httpStatus: number; status?: string | null; data?: any; error?: string }> {
  try {
    const { token, contaCorrente, codigo, mtlsCredentials } = params;
    const { cert, key } = mtlsCredentials || ({} as any);

    const resp = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'cdpj.partners.bancointer.com.br',
          port: 443,
          path: `/banking/v2/pix/${encodeURIComponent(codigo)}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            'x-conta-corrente': contaCorrente,
            'Content-Type': 'application/json',
          },
          cert,
          key,
        },
        (r) => {
          let buf = '';
          r.on('data', (c) => (buf += c));
          r.on('end', () => resolve({ statusCode: r.statusCode || 500, body: buf }));
        }
      );
      req.on('error', reject);
      req.end();
    });

    let data: any = null;
    try { data = JSON.parse(resp.body); } catch { data = resp.body; }

    if (resp.statusCode !== 200) {
      return { success: false, httpStatus: resp.statusCode, data, error: `Inter HTTP ${resp.statusCode}` };
    }

    return { success: true, httpStatus: resp.statusCode, status: extrairStatusPix(data), data };
  } catch (e: any) {
    return { success: false, httpStatus: 0, error: e?.message || 'Falha na consulta PIX' };
  }
}

// O status pode vir em lugares diferentes conforme o formato da resposta — procura em ordem.
export function extrairStatusPix(data: any): string | null {
  if (!data || typeof data !== 'object') return null;
  const direto =
    data.status ||
    data.transacaoPix?.status ||
    data.pagamento?.status ||
    data.transacao?.status;
  if (direto) return String(direto);
  // Alguns formatos trazem um histórico — o último evento é o estado atual.
  const hist = data.historico || data.transacaoPix?.historico;
  if (Array.isArray(hist) && hist.length) {
    const ult = hist[hist.length - 1];
    if (ult?.status) return String(ult.status);
  }
  return null;
}

/**
 * Mapeia o status do Inter → status local do PEDIDO. Só o "caminho feliz" e os finais;
 * status desconhecido devolve null (a reconciliação NÃO mexe no pedido). Advance-only é
 * garantido por quem chama (nunca regride estado terminal).
 */
export function mapStatusPixParaPedido(status?: string | null): string | null {
  const s = String(status || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (!s) return null;
  if (['EFETIVADO', 'EXECUTADO', 'PAGO', 'CONCLUIDO', 'REALIZADO', 'COMPLETED', 'LIQUIDADO'].includes(s)) return 'pago';
  if (['REPROVADO', 'REJEITADO', 'NAO_APROVADO', 'RECUSADO'].includes(s)) return 'reprovado';
  if (['CANCELADO', 'CANCELLED', 'ESTORNADO'].includes(s)) return 'cancelado';
  if (['APROVACAO_EXPIRADA', 'EXPIRADO', 'EXPIRED', 'FALHOU', 'ERRO', 'FAILED', 'NAO_REALIZADO'].includes(s)) return 'erro_inter';
  // Sócio aprovou / pagamento marcado pra sair na data → "agendado" (aba Finalizado).
  if (['AGENDADO', 'A_PAGAR', 'APROVADO', 'A_LANCAR', 'SCHEDULED', 'A_ENVIAR'].includes(s)) return 'agendado';
  // Ainda pendente da aprovação do sócio → mantém "aguardando_socio".
  if (['AGUARDANDO_APROVACAO', 'PENDENTE_APROVACAO', 'EM_APROVACAO', 'PENDENTE', 'PENDING', 'ENVIADO', 'TRANSACAO_CRIADA'].includes(s)) return 'aguardando_socio';
  return null;
}
