import { EventoConcorrenciaBD } from '../data/constants'

interface NovoEvento {
  nome: string
  local_nome: string
  local_endereco: string
  data_evento: string
  horario_inicio: string
  tipo: string
  impacto: string
  url_fonte: string
  notas: string
}

interface ApiResponse<T = unknown> {
  success: boolean
  eventos?: T
  error?: string
}

export async function buscarEventosConcorrencia(): Promise<EventoConcorrenciaBD[]> {
  try {
    const response = await fetch('/api/concorrencia?status=ativo')
    const data: ApiResponse<EventoConcorrenciaBD[]> = await response.json()
    
    if (data.success && data.eventos) {
      return data.eventos
    }
    return []
  } catch (error) {
    console.error('Erro ao buscar eventos:', error)
    return []
  }
}

export async function adicionarEventoManual(novoEvento: NovoEvento): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/concorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoEvento)
    })
    const data: ApiResponse = await response.json()
    
    return { success: data.success, error: data.error }
  } catch (error) {
    console.error('Erro ao adicionar evento:', error)
    return { success: false, error: 'Erro ao adicionar evento' }
  }
}

export async function removerEvento(id: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`/api/concorrencia?id=${id}`, {
      method: 'DELETE'
    })
    const data: ApiResponse = await response.json()
    
    return { success: data.success }
  } catch (error) {
    console.error('Erro ao remover evento:', error)
    return { success: false }
  }
}
