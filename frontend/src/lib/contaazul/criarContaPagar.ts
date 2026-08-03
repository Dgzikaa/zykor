/**
 * Cria uma conta a pagar (DESPESA) no Conta Azul para um bar ESPECÍFICO.
 *
 * Diferente de /api/financeiro/contaazul/lancamentos (que deriva o bar do usuário
 * autenticado), este helper recebe o barId explícito — necessário quando uma mesma
 * fatura de cartão mistura bar 3 e bar 4 e cada linha é lançada no seu bar.
 *
 * Requer pessoa_id (contato/fornecedor) e conta_financeira_id já resolvidos — o CA
 * exige os dois. Retorna o protocolId (async) ou lança Error com a mensagem do CA.
 */
import { createClient } from '@supabase/supabase-js';
import { getCAValidToken } from './token';

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function admin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Token do CA pro bar, RENOVANDO na hora se preciso.
 *
 * Antes esta função só LIA `api_credentials` e desistia: `access_token` vazio virava "Conta Azul
 * não conectado", e `expires_at` no passado virava "Token expirado. Reconecte" — mesmo havendo um
 * refresh_token válido guardado. O access_token do CA dura ~1h e só os bares 3 e 4 têm o
 * orquestrador de 6 min renovando; os demais chegam aqui vencidos quase sempre. Era o caso do
 * bar 6 em 03/08/2026: refresh_token na mão, token vencido às 08:50, e o lançamento da fatura de
 * cartão recusando a tarde inteira.
 *
 * `getCAValidToken` renova com o refresh_token e trata a rotação concorrente. Continua lançando
 * Error (o contrato desta função), mas agora só quando realmente não dá pra recuperar.
 */
async function getCAToken(barId: number): Promise<string> {
  const r = await getCAValidToken(admin(), barId);
  if ('error' in r) throw new Error(`Conta Azul (bar ${barId}): ${r.error}`);
  return r.token;
}

export interface CriarContaPagarParams {
  barId: number;
  data_competencia: string;   // YYYY-MM-DD
  data_vencimento: string;    // YYYY-MM-DD
  valor: number;
  descricao: string;
  categoria_id: string;
  pessoa_id: string;          // contato/fornecedor CA (obrigatório)
  conta_financeira_id: string;
  observacao?: string;
  centro_custo_id?: string;
}

export async function criarContaPagarCA(params: CriarContaPagarParams): Promise<{ contaazul_id: string | null }> {
  const {
    barId, data_competencia, data_vencimento, valor, descricao,
    categoria_id, pessoa_id, conta_financeira_id, observacao, centro_custo_id,
  } = params;

  const valorRound = Math.round(Number(valor) * 100) / 100;
  if (!Number.isFinite(valorRound) || valorRound <= 0) throw new Error('valor inválido');
  if (!categoria_id) throw new Error('categoria_id é obrigatório');
  if (!pessoa_id) throw new Error('fornecedor (pessoa_id) é obrigatório');
  if (!conta_financeira_id) throw new Error('conta pagadora é obrigatória');

  const token = await getCAToken(barId);

  const caBody = {
    data_competencia,
    valor: valorRound,
    observacao: observacao || `Lançado via Zykor — ${descricao}`,
    descricao,
    contato: pessoa_id,
    conta_financeira: String(conta_financeira_id),
    rateio: [
      {
        id_categoria: categoria_id,
        valor: valorRound,
        ...(centro_custo_id ? { rateio_centro_custo: [{ id_centro_custo: centro_custo_id, valor: valorRound }] } : {}),
      },
    ],
    condicao_pagamento: {
      parcelas: [
        {
          descricao,
          data_vencimento,
          nota: 'Despesa de cartão lançada via Zykor',
          conta_financeira: String(conta_financeira_id),
          detalhe_valor: { valor_bruto: valorRound, valor_liquido: valorRound, juros: 0, multa: 0, desconto: 0, taxa: 0 },
        },
      ],
    },
  };

  const resp = await fetch(`${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/contas-a-pagar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(caBody),
  });
  const text = await resp.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  if (!resp.ok) {
    throw new Error(`Conta Azul ${resp.status}: ${json?.message || text || 'erro'}`);
  }
  if (json?.status === 'ERROR') {
    throw new Error('Conta Azul rejeitou o lançamento (status ERROR)');
  }
  return { contaazul_id: json?.protocolId || json?.id || null };
}
