import https from 'https';
import type { MtlsCredentials } from './certificates';

/**
 * Cliente da API de Pagamentos em Lote do Banco do Brasil.
 *
 * Modelo (diferente do PIX avulso do Inter):
 *   1. Cria um LOTE de pagamentos (transferências PIX/TED, boletos, ou guias/tributos)
 *   2. BB valida e devolve um numeroRequisicao + status
 *   3. (dependendo do convênio) liberação/efetivação do lote
 *   4. Consulta de liquidação para saber se cada lançamento foi pago
 *
 * Suporta agendamento em até 180 dias.
 *
 * Hosts:
 *   - prod:    api.bb.com.br
 *   - sandbox: api.sandbox.bb.com.br
 *
 * Toda chamada exige:
 *   - Authorization: Bearer <token>            (getBBAccessToken)
 *   - ?gw-dev-app-key=<chave do app>            (Portal Developers BB)
 *   - mTLS com Certificado A1
 *
 * ⚠️ TODO(swagger BB): os paths e os NOMES DE CAMPO do payload abaixo são a melhor
 * aproximação a partir da doc pública. Validar/ajustar contra o swagger do Portal
 * Developers BB assim que o acesso (convênio PAG) estiver liberado. A estrutura
 * (auth, mTLS, ciclo do lote, tracking) já está pronta — o ajuste é só de mapeamento.
 */

export type AmbienteBB = 'producao' | 'sandbox';

export interface BBRequestContext {
  token: string;
  gwDevAppKey: string;
  mtls: MtlsCredentials;
  ambiente: AmbienteBB;
  /** Número do convênio PAG do contrato. */
  numeroConvenio: string | number;
}

function apiBase(ambiente: AmbienteBB): string {
  return ambiente === 'sandbox' ? 'api.sandbox.bb.com.br' : 'api.bb.com.br';
}

// TODO(swagger BB): confirmar versão/raiz do serviço (ex.: /pagamentos-lote/v1).
const SERVICE_ROOT = '/pagamentos-lote/v1';

interface BBResult<T = any> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
}

/** Request genérico mTLS + Bearer + gw-dev-app-key. */
async function bbRequest<T = any>(
  ctx: BBRequestContext,
  method: 'GET' | 'POST' | 'PATCH',
  endpoint: string,
  payload?: unknown
): Promise<BBResult<T>> {
  const body = payload !== undefined ? JSON.stringify(payload) : undefined;
  const sep = endpoint.includes('?') ? '&' : '?';
  const path = `${SERVICE_ROOT}${endpoint}${sep}gw-dev-app-key=${encodeURIComponent(
    ctx.gwDevAppKey
  )}`;

  const options: https.RequestOptions = {
    hostname: apiBase(ctx.ambiente),
    port: 443,
    path,
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
      ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
    },
    cert: ctx.mtls.cert,
    key: ctx.mtls.key,
  };

  return new Promise<BBResult<T>>(resolve => {
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        const statusCode = res.statusCode || 500;
        const ok = statusCode >= 200 && statusCode < 300;
        if (!raw.trim()) {
          resolve({ success: ok, status: statusCode, error: ok ? undefined : `HTTP ${statusCode}` });
          return;
        }
        try {
          const data = JSON.parse(raw);
          resolve(
            ok
              ? { success: true, status: statusCode, data }
              : {
                  success: false,
                  status: statusCode,
                  error:
                    data?.erros?.[0]?.mensagem ||
                    data?.message ||
                    data?.title ||
                    `HTTP ${statusCode}`,
                  data,
                }
          );
        } catch {
          resolve({ success: ok, status: statusCode, error: ok ? undefined : raw, data: raw as any });
        }
      });
    });
    req.on('error', e => resolve({ success: false, status: 0, error: e.message }));
    if (body) req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de lançamento (entrada normalizada do Zykor → payload BB)
// ─────────────────────────────────────────────────────────────────────────────

export interface LancamentoBase {
  /** Identificador local do Zykor pra correlação (vai como "numeroDocumentoDebito"/seuNumero). */
  zykorId: string;
  valor: number;
  /** YYYY-MM-DD. Se futura, BB agenda (até 180 dias). */
  dataPagamento: string;
  descricao?: string;
}

export interface LancamentoPix extends LancamentoBase {
  tipo: 'pix';
  chave: string;
}

export interface LancamentoTransferencia extends LancamentoBase {
  tipo: 'ted';
  /** Dados bancários do favorecido. */
  banco: string; // código do banco (ISPB ou compe) — TODO(swagger): confirmar qual
  agencia: string;
  conta: string;
  cpfCnpjFavorecido: string;
  nomeFavorecido: string;
}

export interface LancamentoBoleto extends LancamentoBase {
  tipo: 'boleto';
  linhaDigitavel: string; // ou codigoBarras
}

export interface LancamentoTributo extends LancamentoBase {
  tipo: 'tributo';
  codigoBarras: string; // guia com código de barras de arrecadação
}

export type Lancamento =
  | LancamentoPix
  | LancamentoTransferencia
  | LancamentoBoleto
  | LancamentoTributo;

// ─────────────────────────────────────────────────────────────────────────────
// Operações de lote — uma por tipo (o BB separa por endpoint)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria um lote de transferências (PIX e/ou TED). No BB, PIX entra como transferência
 * com indicador de forma de pagamento.
 * TODO(swagger BB): endpoint e schema exatos.
 */
export async function criarLoteTransferencias(
  ctx: BBRequestContext,
  lancamentos: Array<LancamentoPix | LancamentoTransferencia>
): Promise<BBResult> {
  const payload = {
    numeroRequisicao: undefined, // BB pode gerar; senão usar contador próprio
    numeroConvenio: ctx.numeroConvenio,
    listaTransferencias: lancamentos.map(l => ({
      // TODO(swagger BB): mapear campos reais (data no formato ddmmaaaa em algumas APIs BB!)
      numeroDOC: l.zykorId,
      valor: Math.round(l.valor * 100) / 100,
      dataTransferencia: l.dataPagamento,
      descricaoPagamento: l.descricao || 'Pagamento Zykor',
      ...(l.tipo === 'pix'
        ? { formaIdentificacao: 'chave', chave: l.chave }
        : {
            codigoBanco: l.banco,
            numeroAgencia: l.agencia,
            numeroConta: l.conta,
            cpfCnpjBeneficiario: l.cpfCnpjFavorecido,
            nomeBeneficiario: l.nomeFavorecido,
          }),
    })),
  };
  return bbRequest(ctx, 'POST', '/lotes-transferencias', payload);
}

/** Cria um lote de boletos. TODO(swagger BB): endpoint e schema. */
export async function criarLoteBoletos(
  ctx: BBRequestContext,
  lancamentos: LancamentoBoleto[]
): Promise<BBResult> {
  const payload = {
    numeroConvenio: ctx.numeroConvenio,
    listaBoletos: lancamentos.map(l => ({
      numeroDocumento: l.zykorId,
      codigoBarras: l.linhaDigitavel,
      valorPagamento: Math.round(l.valor * 100) / 100,
      dataPagamento: l.dataPagamento,
      descricaoPagamento: l.descricao || 'Pagamento Zykor',
    })),
  };
  return bbRequest(ctx, 'POST', '/lotes-boletos', payload);
}

/** Cria um lote de guias/tributos com código de barras. TODO(swagger BB): endpoint e schema. */
export async function criarLoteTributos(
  ctx: BBRequestContext,
  lancamentos: LancamentoTributo[]
): Promise<BBResult> {
  const payload = {
    numeroConvenio: ctx.numeroConvenio,
    listaGuias: lancamentos.map(l => ({
      numeroDocumento: l.zykorId,
      codigoBarras: l.codigoBarras,
      valorPagamento: Math.round(l.valor * 100) / 100,
      dataPagamento: l.dataPagamento,
    })),
  };
  return bbRequest(ctx, 'POST', '/lotes-guias-codigo-barras', payload);
}

/**
 * Libera/efetiva um lote criado (alguns convênios exigem este passo após a criação).
 * TODO(swagger BB): confirmar se é necessário e o endpoint (ex.: PATCH /lotes/{id} com estado).
 */
export async function liberarLote(
  ctx: BBRequestContext,
  numeroRequisicao: string | number
): Promise<BBResult> {
  return bbRequest(ctx, 'PATCH', `/lotes/${numeroRequisicao}`, {
    estadoRequisicao: 2, // TODO(swagger BB): código de "liberado/efetivar"
  });
}

/**
 * Consulta o status/liquidação de um lote (substitui o webhook — BB é por consulta).
 * TODO(swagger BB): endpoint e shape da resposta.
 */
export async function consultarLote(
  ctx: BBRequestContext,
  numeroRequisicao: string | number
): Promise<BBResult> {
  return bbRequest(ctx, 'GET', `/lotes/${numeroRequisicao}`);
}
