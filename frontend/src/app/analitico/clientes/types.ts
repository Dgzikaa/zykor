export interface Cliente {
  identificador_principal: string
  nome_principal: string
  telefone: string | null
  email: string | null
  total_visitas: number
  total_visitas_geral?: number
  visitas_formatadas?: string
  valor_total_gasto: number
  valor_total_entrada: number
  valor_total_consumo: number
  ticket_medio_geral: number
  ticket_medio_entrada: number
  ticket_medio_consumo: number
  ultima_visita: string
  tempo_medio_estadia_minutos?: number
  tempo_medio_estadia_formatado?: string
  tempos_estadia_detalhados?: number[]
  total_visitas_com_tempo?: number
}

export interface Estatisticas {
  total_clientes_unicos: number
  total_visitas_geral: number
  ticket_medio_geral: number
  ticket_medio_entrada: number
  ticket_medio_consumo: number
  valor_total_entrada: number
  valor_total_consumo: number
}

export interface ApiResponse {
  clientes: Cliente[]
  estatisticas: Estatisticas
  meta?: {
    totalPages: number
    total: number
  }
}

export interface Reservante {
  identificador_principal: string
  nome_principal: string
  telefone: string | null
  total_reservas: number
  total_visitas: number
  percentual_reservas: number
  reservas_seated: number
  reservas_confirmed: number
  reservas_pending: number
  reservas_cancelled: number
  reservas_noshow: number
  ultima_reserva: string
  percentual_presenca: number
}

export interface VisitaDetalhada {
  data: string
  couvert: number
  consumo: number
  total: number
}

export interface DetalhesResponse {
  visitas: VisitaDetalhada[]
  total_visitas: number
  dia_destaque: string
  cliente: {
    nome: string
    telefone: string
  }
}

export interface ProdutoFavorito {
  produto: string
  categoria: string
  quantidade: number
  vezes_pediu: number
}

export interface CategoriaFavorita {
  categoria: string
  quantidade: number
  valor_total: number
}

export interface PerfilConsumo {
  telefone: string
  nome: string
  total_visitas: number
  total_itens_consumidos: number
  valor_total_consumo: number
  produtos_favoritos: ProdutoFavorito[]
  categorias_favoritas: CategoriaFavorita[]
  tags: string[]
  dias_preferidos: string[]
}
