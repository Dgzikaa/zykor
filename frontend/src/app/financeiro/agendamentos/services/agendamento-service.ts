/**
 * Chamadas HTTP da página de agendamento (Inter / fluxos auxiliares).
 * Mantém respostas tipadas e erros normalizados sem depender de UI (toast).
 */

import type { PagamentoAgendamento } from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/** Header obrigatório p/ as rotas derivarem o bar do usuário (override seguro). */
const barHeaders = (barId: number) => ({ 'x-selected-bar-id': String(barId) });

export type AgendamentoResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

function limparDocumento(document: string): string {
  return document.replace(/\D/g, '');
}

async function safeJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// --- Tipos de domínio (API / página) ---

export interface VerificarCredenciaisData {
  success?: boolean;
  bar_id?: number;
  
  inter: boolean;
  mensagem?: string;
  error?: string;
}

export interface NiboCategoria {
  id: string;
  
  bar_id?: number;
  categoria_nome?: string;
  categoria_macro?: string | null;
  ativo?: boolean;
  name?: string;
  nome?: string;
  [key: string]: unknown;
}

export interface NiboCentroCusto {
  id: string;
  nome: string;
  name?: string;
  [key: string]: unknown;
}

export interface InterCredencial {
  id: number;
  nome: string;
  cnpj?: string | null;
  conta_corrente?: string | null;
}

export interface RevisaoNiboItem {
  [key: string]: unknown;
}

export interface CarregarRevisaoNiboData {
  items: RevisaoNiboItem[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

export interface StakeholderNibo {
  id: string;
  name: string;
  document: string;
  documentType?: string;
  email?: string;
  phone?: string;
  type?: string;
  pixKey?: string | null;
  pixKeyType?: number | null;
  isArchived?: boolean;
  isDeleted?: boolean;
}

export interface CriarStakeholderParams {
  nome: string;
  chave_pix?: string;
  bar_id: number;
}

export interface CriarStakeholderSupplier {
  id: string;
  name: string;
  document: string;
  pixKey?: string | null;
}

export interface CriarStakeholderData {
  supplier: CriarStakeholderSupplier;
  jaExistia?: boolean;
  pixIncluido?: boolean;
  message?: string;
}

export interface AgendamentoNiboParams {
  stakeholderId?: string;
  stakeholder_nome: string;
  stakeholder_document?: string;
  stakeholder_pix_key?: string;
  dueDate: string;
  scheduleDate: string;
  categoria_id: string;
  categoria_nome?: string;
  centro_custo_id?: string | null;
  centro_custo_nome?: string;
  accrualDate: string;
  value: number;
  description: string;
  reference?: string;
  bar_id: number;
  bar_nome?: string;
  criado_por_id?: string;
  criado_por_nome?: string;
}

export interface AgendamentoNiboCriado {
  id: string;
  local_id?: string;
  
  [key: string]: unknown;
}

export interface EnviarInterParams {
  valor: string;
  descricao: string;
  destinatario: string;
  chave: string;
  data_pagamento: string;
  bar_id: number;
  inter_credencial_id: number | null;
  agendamento_id?: string;
}

export interface EnviarInterCredencialDebug {
  credencial_id?: number;
  cert_file?: string | null;
  key_file?: string | null;
  [key: string]: unknown;
}

export interface EnviarInterData {
  codigoSolicitacao?: string;
  valor?: number;
  chave?: string;
  tipoChave?: string;
  status?: string;
  destinatario?: string;
  interResponse?: unknown;
  credencial?: EnviarInterCredencialDebug;
  [key: string]: unknown;
}

export interface PixKeyParams {
  name: string;
  document: string;
  pixKey: string;
  pixKeyType: number;
  /** Opcional; a rota PUT usa padrão 3 se omitido */
  bar_id?: number;
}

export interface AtualizarStakeholderPixData {
  [key: string]: unknown;
}

// --- Funções ---

export async function verificarCredenciais(
  barId: number
): Promise<AgendamentoResult<VerificarCredenciaisData>> {
  if (!barId) {
    return { ok: false, error: 'bar_id é obrigatório' };
  }

  try {
    const res = await fetch(
      `/api/financeiro/verificar-credenciais?bar_id=${encodeURIComponent(String(barId))}`
    );
    const json = (await safeJson<VerificarCredenciaisData>(res)) ?? {
            inter: false,
      error: 'Resposta vazia',
    };

    if (!res.ok) {
      return {
        ok: false,
        error: json.error || `Erro ${res.status}`,
        status: res.status,
      };
    }

    return {
      ok: true,
      data: {
        ...json,
                inter: Boolean(json.inter),
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao verificar credenciais',
    };
  }
}

export async function loadCategorias(
  barId: number
): Promise<AgendamentoResult<NiboCategoria[]>> {
    return { ok: false, error: 'Funcionalidade não disponível nesta versão.' };
}

export async function loadCentrosCusto(
  barId: number
): Promise<AgendamentoResult<NiboCentroCusto[]>> {
    return { ok: false, error: 'Funcionalidade não disponível nesta versão.' };
}

export async function loadInterCredenciais(
  barId: number
): Promise<AgendamentoResult<InterCredencial[]>> {
  if (!barId) {
    return { ok: false, error: 'bar_id é obrigatório' };
  }

  try {
    // A rota deriva o bar do usuário autenticado (user.bar_id), não do query param —
    // o header x-selected-bar-id é obrigatório pra refletir o bar selecionado.
    const res = await fetch(
      `/api/financeiro/inter/credenciais?bar_id=${encodeURIComponent(String(barId))}`,
      { headers: { 'x-selected-bar-id': String(barId) } }
    );
    const json = (await safeJson<{
      success?: boolean;
      credenciais?: InterCredencial[];
      error?: string;
    }>(res)) ?? { credenciais: [] };

    if (!res.ok || json.success === false) {
      return {
        ok: false,
        error: json.error || `Erro ${res.status} ao carregar credenciais Inter`,
        status: res.status,
      };
    }

    return { ok: true, data: json.credenciais ?? [] };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao carregar credenciais Inter',
    };
  }
}

export async function carregarRevisaoAgendamento(
  barId: number,
  offset: number,
  limit: number
): Promise<AgendamentoResult<CarregarRevisaoNiboData>> {
    return { ok: false, error: 'Funcionalidade não disponível nesta versão.' };
}

export async function buscarStakeholder(
  document: string
): Promise<AgendamentoResult<StakeholderNibo[]>> {
    return { ok: false, error: 'Funcionalidade não disponível nesta versão.' };
}

export async function criarStakeholder(
  data: CriarStakeholderParams
): Promise<AgendamentoResult<CriarStakeholderData>> {
    return { ok: false, error: 'Funcionalidade não disponível nesta versão.' };
}

export async function agendarPagamento(
  agendamento: AgendamentoNiboParams
): Promise<AgendamentoResult<AgendamentoNiboCriado>> {
    return { ok: false, error: 'Funcionalidade não disponível nesta versão.' };
}

export async function enviarParaInter(
  dados: EnviarInterParams
): Promise<AgendamentoResult<EnviarInterData>> {
  try {
    const res = await fetch('/api/financeiro/inter/pix', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(dados),
    });

    const json = (await safeJson<{
      success?: boolean;
      data?: EnviarInterData;
      error?: string;
      credencial?: EnviarInterCredencialDebug;
    }>(res)) ?? { success: false };

    if (!res.ok) {
      const msg =
        json.error ||
        `Erro ${res.status}: ${res.statusText}`;
      return { ok: false, error: msg, status: res.status };
    }

    if (!json.success) {
      const credInfo = json.credencial
        ? ` [credencial_id=${json.credencial.credencial_id}, cert=${json.credencial.cert_file || 'n/a'}, key=${json.credencial.key_file || 'n/a'}]`
        : '';
      return {
        ok: false,
        error: (json.error || 'Erro ao enviar PIX') + credInfo,
        status: res.status,
      };
    }

    return { ok: true, data: json.data ?? {} };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao enviar PIX Inter',
    };
  }
}

export async function atualizarChavePix(
  stakeholderId: string,
  data: PixKeyParams
): Promise<AgendamentoResult<AtualizarStakeholderPixData>> {
    return { ok: false, error: 'Funcionalidade não disponível nesta versão.' };
}

// ============================================================
// Lista de pagamentos pendentes — persistida no banco (financial.pagamentos_pendentes)
// e COMPARTILHADA por bar. Substitui o antigo localStorage por-navegador.
// ============================================================

/** Carrega a lista de pendentes do bar (o que qualquer pessoa do bar subiu). */
export async function listarPendentes(
  barId: number
): Promise<AgendamentoResult<PagamentoAgendamento[]>> {
  if (!barId) return { ok: false, error: 'bar_id é obrigatório' };
  try {
    const res = await fetch('/api/financeiro/agendamentos/pendentes', {
      headers: barHeaders(barId),
    });
    const json =
      (await safeJson<{ success?: boolean; pagamentos?: PagamentoAgendamento[]; error?: string }>(res)) ??
      {};
    if (!res.ok || json.success === false) {
      return { ok: false, error: json.error || `Erro ${res.status}`, status: res.status };
    }
    return { ok: true, data: json.pagamentos ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede' };
  }
}

/** Upsert idempotente — grava/atualiza os pagamentos informados. Nunca apaga. */
export async function salvarPendentes(
  barId: number,
  pagamentos: PagamentoAgendamento[]
): Promise<AgendamentoResult<{ salvos: number }>> {
  if (!barId) return { ok: false, error: 'bar_id é obrigatório' };
  try {
    const res = await fetch('/api/financeiro/agendamentos/pendentes', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...barHeaders(barId) },
      body: JSON.stringify({ pagamentos }),
    });
    const json = (await safeJson<{ success?: boolean; salvos?: number; error?: string }>(res)) ?? {};
    if (!res.ok || json.success === false) {
      return { ok: false, error: json.error || `Erro ${res.status}`, status: res.status };
    }
    return { ok: true, data: { salvos: json.salvos ?? 0 } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede' };
  }
}

/** Remove pagamentos por id; se `all` for true, limpa a lista do bar. */
export async function removerPendentes(
  barId: number,
  opts: { ids?: string[]; all?: boolean }
): Promise<AgendamentoResult<true>> {
  if (!barId) return { ok: false, error: 'bar_id é obrigatório' };
  try {
    const res = await fetch('/api/financeiro/agendamentos/pendentes', {
      method: 'DELETE',
      headers: { ...JSON_HEADERS, ...barHeaders(barId) },
      body: JSON.stringify(opts),
    });
    const json = (await safeJson<{ success?: boolean; error?: string }>(res)) ?? {};
    if (!res.ok || json.success === false) {
      return { ok: false, error: json.error || `Erro ${res.status}`, status: res.status };
    }
    return { ok: true, data: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede' };
  }
}


