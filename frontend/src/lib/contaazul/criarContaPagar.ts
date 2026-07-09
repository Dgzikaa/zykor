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

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function admin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getCAToken(barId: number): Promise<string> {
  const { data: cred, error } = await admin()
    .from('api_credentials')
    .select('access_token, expires_at')
    .eq('sistema', 'conta_azul')
    .eq('bar_id', barId)
    .single();
  if (error || !cred?.access_token) throw new Error(`Conta Azul não conectado no bar ${barId}`);
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
    throw new Error(`Token do Conta Azul expirado no bar ${barId}. Reconecte.`);
  }
  return cred.access_token;
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
