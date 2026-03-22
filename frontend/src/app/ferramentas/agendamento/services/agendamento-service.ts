/**
 * Chamadas HTTP da página de agendamento (NIBO / Inter / fluxos auxiliares).
 * Mantém respostas tipadas e erros normalizados sem depender de UI (toast).
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

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
  nibo: boolean;
  inter: boolean;
  mensagem?: string;
  error?: string;
}

export interface NiboCategoria {
  id: string;
  nibo_id?: string | null;
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
  nibo_id?: string;
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
      nibo: false,
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
        nibo: Boolean(json.nibo),
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
  if (!barId) {
    return { ok: false, error: 'bar_id é obrigatório' };
  }

  try {
    const url = `/api/financeiro/nibo/categorias?bar_id=${encodeURIComponent(String(barId))}&somente_pagamento=true`;
    const res = await fetch(url);
    const json = (await safeJson<{
      success?: boolean;
      categorias?: NiboCategoria[];
      error?: string;
    }>(res)) ?? { categorias: [] };

    if (!res.ok || json.success === false) {
      return {
        ok: false,
        error: json.error || `Erro ${res.status} ao carregar categorias`,
        status: res.status,
      };
    }

    return { ok: true, data: json.categorias ?? [] };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao carregar categorias',
    };
  }
}

export async function loadCentrosCusto(
  barId: number
): Promise<AgendamentoResult<NiboCentroCusto[]>> {
  if (!barId) {
    return { ok: false, error: 'bar_id é obrigatório' };
  }

  try {
    const res = await fetch(
      `/api/financeiro/nibo/centros-custo?bar_id=${encodeURIComponent(String(barId))}`
    );
    const json = (await safeJson<{
      success?: boolean;
      centrosCusto?: NiboCentroCusto[];
      error?: string;
    }>(res)) ?? { centrosCusto: [] };

    if (!res.ok || json.success === false) {
      return {
        ok: false,
        error: json.error || `Erro ${res.status} ao carregar centros de custo`,
        status: res.status,
      };
    }

    return { ok: true, data: json.centrosCusto ?? [] };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao carregar centros de custo',
    };
  }
}

export async function loadInterCredenciais(
  barId: number
): Promise<AgendamentoResult<InterCredencial[]>> {
  if (!barId) {
    return { ok: false, error: 'bar_id é obrigatório' };
  }

  try {
    const res = await fetch(
      `/api/financeiro/inter/credenciais?bar_id=${encodeURIComponent(String(barId))}`
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

export async function carregarRevisaoNIBO(
  barId: number,
  offset: number,
  limit: number
): Promise<AgendamentoResult<CarregarRevisaoNiboData>> {
  if (!barId) {
    return { ok: false, error: 'bar_id é obrigatório' };
  }

  try {
    const params = new URLSearchParams({
      bar_id: String(barId),
      sem_competencia: 'true',
      offset: String(offset),
      limit: String(limit),
    });
    const res = await fetch(`/api/financeiro/nibo/schedules?${params.toString()}`);
    const json = await safeJson<{
      success?: boolean;
      data?: RevisaoNiboItem[];
      total?: number;
      hasMore?: boolean;
      offset?: number;
      limit?: number;
      error?: string;
    }>(res);

    if (!json || json.success === false) {
      return {
        ok: false,
        error: json?.error || `Erro ${res.status} ao carregar revisão NIBO`,
        status: res.status,
      };
    }

    const items = json.data ?? [];
    return {
      ok: true,
      data: {
        items,
        total: json.total ?? items.length,
        hasMore: json.hasMore ?? false,
        offset: json.offset ?? offset,
        limit: json.limit ?? limit,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao carregar revisão NIBO',
    };
  }
}

export async function buscarStakeholder(
  document: string
): Promise<AgendamentoResult<StakeholderNibo[]>> {
  const documentoLimpo = limparDocumento(document);
  if (!documentoLimpo || documentoLimpo.length < 11) {
    return { ok: false, error: 'CPF/CNPJ inválido ou incompleto' };
  }

  try {
    const res = await fetch(
      `/api/financeiro/nibo/stakeholders?q=${encodeURIComponent(documentoLimpo)}`
    );
    const json = (await safeJson<{
      success?: boolean;
      data?: StakeholderNibo[];
      error?: string;
    }>(res)) ?? { data: [] };

    if (!res.ok) {
      return {
        ok: false,
        error: json.error || `Erro ${res.status} ao buscar stakeholder`,
        status: res.status,
      };
    }

    if (json.success === false) {
      return {
        ok: false,
        error: json.error || 'Falha ao buscar stakeholder',
        status: res.status,
      };
    }

    return { ok: true, data: json.data ?? [] };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao buscar stakeholder',
    };
  }
}

export async function criarStakeholder(
  data: CriarStakeholderParams
): Promise<AgendamentoResult<CriarStakeholderData>> {
  try {
    const res = await fetch('/api/agendamento/criar-supplier', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        nome: data.nome,
        chave_pix: data.chave_pix,
        bar_id: data.bar_id,
      }),
    });

    const json = (await safeJson<{
      success?: boolean;
      supplier?: CriarStakeholderSupplier;
      error?: string;
      jaExistia?: boolean;
      pixIncluido?: boolean;
      message?: string;
    }>(res)) ?? { success: false, error: 'Resposta inválida' };

    if (!res.ok || !json.success || !json.supplier) {
      return {
        ok: false,
        error: json.error || `Erro ${res.status} ao criar supplier`,
        status: res.status,
      };
    }

    return {
      ok: true,
      data: {
        supplier: json.supplier,
        jaExistia: json.jaExistia,
        pixIncluido: json.pixIncluido,
        message: json.message,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao criar stakeholder',
    };
  }
}

export async function agendarPagamentoNoNibo(
  agendamento: AgendamentoNiboParams
): Promise<AgendamentoResult<AgendamentoNiboCriado>> {
  try {
    const res = await fetch('/api/financeiro/nibo/schedules', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(agendamento),
    });

    const json = (await safeJson<{
      success?: boolean;
      data?: AgendamentoNiboCriado;
      error?: string;
    }>(res)) ?? { success: false };

    if (!res.ok) {
      return {
        ok: false,
        error: json.error || `Erro ${res.status}: ${res.statusText}`,
        status: res.status,
      };
    }

    if (!json.success || !json.data?.id) {
      return {
        ok: false,
        error: json.error || 'Resposta inválida do NIBO ao agendar',
        status: res.status,
      };
    }

    return { ok: true, data: json.data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao agendar no NIBO',
    };
  }
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
  if (!stakeholderId) {
    return { ok: false, error: 'stakeholderId é obrigatório' };
  }

  try {
    const body: Record<string, unknown> = {
      name: data.name,
      document: data.document,
      pixKey: data.pixKey,
      pixKeyType: data.pixKeyType,
    };
    if (data.bar_id != null) {
      body.bar_id = data.bar_id;
    }

    const res = await fetch(`/api/financeiro/nibo/stakeholders/${encodeURIComponent(stakeholderId)}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });

    const json = (await safeJson<{
      success?: boolean;
      data?: AtualizarStakeholderPixData;
      error?: string;
    }>(res)) ?? { success: false };

    if (!res.ok || !json.success) {
      return {
        ok: false,
        error: json.error || `Erro ${res.status} ao atualizar chave PIX`,
        status: res.status,
      };
    }

    return { ok: true, data: json.data ?? {} };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha de rede ao atualizar chave PIX',
    };
  }
}
