import type {
  ApiResponse,
  DetalhesResponse,
  PerfilConsumo,
  Reservante,
} from '../types'

const DEFAULT_CLIENTES_LIMIT = 50

function barHeaders(barId: number | string): Record<string, string> {
  return { 'x-selected-bar-id': String(barId) }
}

/** Critérios no mesmo formato usado em `page.tsx` (lista quente / segmentação). */
export interface SegmentacaoCriteriosForm {
  diasJanela: number
  // Filtro por semana ISO (opcional - quando usado, ignora diasJanela)
  semanaAno?: number | ''
  semanaNumero?: number | ''
  minVisitasTotal: number
  maxVisitasTotal?: string | number
  minVisitasDia: number
  diasDiferentes?: string | number
  ticketMedioMin?: string
  ticketMedioMax?: string
  ticketEntradaMin?: string
  ticketEntradaMax?: string
  ticketConsumoMin?: string
  ticketConsumoMax?: string
  gastoTotalMin?: string
  gastoTotalMax?: string
  ultimaVisitaMinDias?: string
  ultimaVisitaMaxDias?: string
  primeiraVisitaMaxDias?: string
  tamanhoGrupoMin?: string
  tamanhoGrupoMax?: string
  temEmail?: string
  temTelefone?: string
  mesAniversario?: string
}

/** Parâmetros para exportação CSV via `/api/crm/lista-quente`. */
export interface ExportCsvFiltros extends SegmentacaoCriteriosForm {
  /** Dia numérico `'0'`–`'6'`; omitir ou `'todos'` para não filtrar por dia. */
  diaSemana?: string
  /** Se true, envia `formato=csv_completo`. */
  completo?: boolean
}

export interface SegmentacaoApiResponse {
  success?: boolean
  error?: string
  data?: Record<string, unknown> & {
    clientes?: unknown[]
  }
}

export interface ReservantesApiResponse {
  reservantes: Reservante[]
}

export interface PerfilConsumoApiResponse {
  perfil?: PerfilConsumo
}

export interface SegmentosSalvosApiResponse {
  success: boolean
  error?: string
  data?: {
    segmentos: Record<string, unknown>[]
    total?: number
  }
}

export interface SalvarSegmentoApiResponse {
  success: boolean
  error?: string
  data?: {
    segmento: Record<string, unknown>
    mensagem?: string
  }
}

function appendListaQuenteParams(
  params: URLSearchParams,
  barId: number | string,
  c: SegmentacaoCriteriosForm,
  diaSemana?: string,
  formato?: string
): void {
  params.append('bar_id', String(barId))
  
  // Se tem semana selecionada, usa filtro por semana, senão usa janela de dias
  if (c.semanaAno && c.semanaNumero) {
    params.append('semana_ano', String(c.semanaAno))
    params.append('semana_numero', String(c.semanaNumero))
  } else {
    params.append('dias_janela', String(c.diasJanela))
  }
  
  params.append('min_visitas_total', String(c.minVisitasTotal))
  params.append('min_visitas_dia', String(c.minVisitasDia))
  if (c.maxVisitasTotal !== undefined && c.maxVisitasTotal !== '') {
    params.append('max_visitas_total', String(c.maxVisitasTotal))
  }
  if (c.diasDiferentes !== undefined && c.diasDiferentes !== '') {
    params.append('dias_diferentes', String(c.diasDiferentes))
  }
  if (c.ticketMedioMin) params.append('ticket_medio_min', c.ticketMedioMin)
  if (c.ticketMedioMax) params.append('ticket_medio_max', c.ticketMedioMax)
  if (c.ticketEntradaMin) params.append('ticket_entrada_min', c.ticketEntradaMin)
  if (c.ticketEntradaMax) params.append('ticket_entrada_max', c.ticketEntradaMax)
  if (c.ticketConsumoMin) params.append('ticket_consumo_min', c.ticketConsumoMin)
  if (c.ticketConsumoMax) params.append('ticket_consumo_max', c.ticketConsumoMax)
  if (c.gastoTotalMin) params.append('gasto_total_min', c.gastoTotalMin)
  if (c.gastoTotalMax) params.append('gasto_total_max', c.gastoTotalMax)
  if (c.ultimaVisitaMinDias) params.append('ultima_visita_min_dias', c.ultimaVisitaMinDias)
  if (c.ultimaVisitaMaxDias) params.append('ultima_visita_max_dias', c.ultimaVisitaMaxDias)
  if (c.primeiraVisitaMaxDias) params.append('primeira_visita_max_dias', c.primeiraVisitaMaxDias)
  if (c.tamanhoGrupoMin) params.append('tamanho_grupo_min', c.tamanhoGrupoMin)
  if (c.tamanhoGrupoMax) params.append('tamanho_grupo_max', c.tamanhoGrupoMax)
  if (c.temEmail) params.append('tem_email', c.temEmail)
  if (c.temTelefone) params.append('tem_telefone', c.temTelefone)
  if (c.mesAniversario) params.append('mes_aniversario', c.mesAniversario)
  if (diaSemana && diaSemana !== 'todos') params.append('dia_semana', diaSemana)
  if (formato) params.append('formato', formato)
}

function buildListaQuenteUrl(
  barId: number | string,
  c: SegmentacaoCriteriosForm,
  diaSemana?: string,
  formato?: string
): string {
  const params = new URLSearchParams()
  appendListaQuenteParams(params, barId, c, diaSemana, formato)
  return `/api/crm/lista-quente?${params.toString()}`
}

export async function fetchClientes(
  barId: number | string,
  page: number,
  busca: string,
  diaSemana: string,
  options?: { limit?: number; signal?: AbortSignal }
): Promise<ApiResponse> {
  const params = new URLSearchParams()
  if (diaSemana && diaSemana !== 'todos') {
    params.append('dia_semana', diaSemana)
  }
  if (busca.trim()) {
    params.append('busca', busca.trim())
  }
  params.append('page', String(page))
  params.append('limit', String(options?.limit ?? DEFAULT_CLIENTES_LIMIT))
  const qs = params.toString()
  const url = `/api/analitico/clientes${qs ? `?${qs}` : ''}`
  const response = await fetch(url, {
    headers: barHeaders(barId),
    signal: options?.signal,
  })
  if (!response.ok) {
    throw new Error('Erro ao carregar dados dos clientes')
  }
  return response.json() as Promise<ApiResponse>
}

export async function fetchReservantes(
  barId: number | string,
  diaSemana: string,
  options?: { signal?: AbortSignal }
): Promise<Reservante[]> {
  const params = new URLSearchParams()
  if (diaSemana && diaSemana !== 'todos') {
    params.append('dia_semana', diaSemana)
  }
  const qs = params.toString()
  const url = `/api/analitico/reservantes${qs ? `?${qs}` : ''}`
  const response = await fetch(url, {
    headers: barHeaders(barId),
    signal: options?.signal,
  })
  if (!response.ok) {
    throw new Error('Erro ao carregar dados dos reservantes')
  }
  const data = (await response.json()) as ReservantesApiResponse
  return data.reservantes ?? []
}

export async function fetchVisitasDetalhadas(
  telefone: string,
  barId: number | string,
  options?: { signal?: AbortSignal }
): Promise<DetalhesResponse> {
  const url = `/api/analitico/clientes/detalhes?telefone=${encodeURIComponent(telefone)}`
  const response = await fetch(url, {
    headers: barHeaders(barId),
    signal: options?.signal,
  })
  if (!response.ok) {
    throw new Error('Erro ao carregar detalhes das visitas')
  }
  return response.json() as Promise<DetalhesResponse>
}

export async function fetchPerfilConsumo(
  telefone: string,
  barId: number | string,
  options?: { signal?: AbortSignal }
): Promise<PerfilConsumo | null> {
  const url = `/api/analitico/clientes/perfil-consumo?telefone=${encodeURIComponent(telefone)}`
  const response = await fetch(url, {
    headers: barHeaders(barId),
    signal: options?.signal,
  })
  if (!response.ok) {
    return null
  }
  const data = (await response.json()) as PerfilConsumoApiResponse
  return data.perfil ?? null
}

export async function exportCSV(
  barId: number | string,
  filtros: ExportCsvFiltros,
  options?: { signal?: AbortSignal }
): Promise<Blob> {
  const formato = filtros.completo ? 'csv_completo' : 'csv'
  const {
    completo: _c,
    diaSemana,
    ...criterios
  } = filtros
  const url = buildListaQuenteUrl(barId, criterios, diaSemana, formato)
  const response = await fetch(url, { signal: options?.signal })
  if (!response.ok) {
    throw new Error('Erro ao baixar CSV')
  }
  return response.blob()
}

export async function fetchSegmentacao(
  barId: number | string,
  criterios: SegmentacaoCriteriosForm,
  diaSemana?: string,
  options?: { signal?: AbortSignal }
): Promise<SegmentacaoApiResponse> {
  const url = buildListaQuenteUrl(barId, criterios, diaSemana)
  const response = await fetch(url, { signal: options?.signal })
  if (!response.ok) {
    throw new Error('Erro ao buscar segmentação')
  }
  return response.json() as Promise<SegmentacaoApiResponse>
}

export async function salvarSegmento(
  barId: number | string,
  nome: string,
  criterios: SegmentacaoCriteriosForm,
  options?: { descricao?: string; signal?: AbortSignal }
): Promise<SalvarSegmentoApiResponse> {
  const response = await fetch('/api/crm/lista-quente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options?.signal,
    body: JSON.stringify({
      bar_id: barId,
      nome_segmento: nome,
      descricao:
        options?.descricao ??
        `Criado em ${new Date().toLocaleDateString('pt-BR')}`,
      criterios,
    }),
  })
  const data = (await response.json()) as SalvarSegmentoApiResponse
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao salvar segmento')
  }
  return data
}

export async function fetchSegmentosSalvos(
  barId: number | string,
  options?: { signal?: AbortSignal }
): Promise<Record<string, unknown>[]> {
  const response = await fetch(`/api/crm/segmentos?bar_id=${encodeURIComponent(String(barId))}`, {
    signal: options?.signal,
  })
  const data = (await response.json()) as SegmentosSalvosApiResponse
  if (data.success && data.data?.segmentos) {
    return data.data.segmentos
  }
  return []
}
