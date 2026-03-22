'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  RefreshCcw,
  Plus,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Trash2,
  Music,
  CalendarDays,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EventoConcorrenciaBD, DATAS_CONCORRENCIA_2026 } from '../data/constants'
import { adicionarEventoManual, removerEvento as removerEventoService } from '../services/comercial-service'

interface EventosTabProps {
  eventosConcorrenciaBD: EventoConcorrenciaBD[]
  loadingEventos: boolean
  onRefresh: () => Promise<void>
}

const EVENTO_INICIAL = {
  nome: '',
  local_nome: '',
  local_endereco: '',
  data_evento: '',
  horario_inicio: '',
  tipo: 'samba',
  impacto: 'medio',
  url_fonte: '',
  notas: ''
}

export function EventosTab({ eventosConcorrenciaBD, loadingEventos, onRefresh }: EventosTabProps) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [salvandoEvento, setSalvandoEvento] = useState(false)
  const [novoEvento, setNovoEvento] = useState(EVENTO_INICIAL)

  const handleAdicionarEvento = async () => {
    if (!novoEvento.nome || !novoEvento.local_nome || !novoEvento.data_evento) {
      alert('Preencha pelo menos: Nome, Local e Data do evento')
      return
    }
    
    setSalvandoEvento(true)
    const result = await adicionarEventoManual(novoEvento)
    
    if (result.success) {
      setNovoEvento(EVENTO_INICIAL)
      setMostrarFormulario(false)
      await onRefresh()
    } else {
      alert('Erro ao adicionar evento: ' + result.error)
    }
    setSalvandoEvento(false)
  }
  
  const handleRemoverEvento = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este evento?')) return
    
    const result = await removerEventoService(id)
    if (result.success) {
      await onRefresh()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200 dark:border-red-800">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Users className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-300">Monitoramento de Concorrência</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  🤖 O agente busca automaticamente eventos de samba/pagode em Brasília todo dia às 6h.
                  <br />
                  <span className="text-xs">Você também pode adicionar eventos manualmente.</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onRefresh}
                disabled={loadingEventos}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                {loadingEventos ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="w-4 h-4 mr-2" />
                )}
                Atualizar
              </Button>
              <Button
                onClick={() => setMostrarFormulario(!mostrarFormulario)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Evento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulário para Adicionar Evento Manual */}
      {mostrarFormulario && (
        <Card className="card-dark border-2 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Plus className="w-5 h-5 text-red-500" />
              Adicionar Evento de Concorrência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome do Evento *</label>
                <Input
                  placeholder="Ex: Samba do Fulano"
                  value={novoEvento.nome}
                  onChange={(e) => setNovoEvento({...novoEvento, nome: e.target.value})}
                  className="bg-white dark:bg-gray-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Local *</label>
                <Input
                  placeholder="Ex: Bar do Zé - Asa Sul"
                  value={novoEvento.local_nome}
                  onChange={(e) => setNovoEvento({...novoEvento, local_nome: e.target.value})}
                  className="bg-white dark:bg-gray-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data *</label>
                <Input
                  type="date"
                  value={novoEvento.data_evento}
                  onChange={(e) => setNovoEvento({...novoEvento, data_evento: e.target.value})}
                  className="bg-white dark:bg-gray-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Horário</label>
                <Input
                  type="time"
                  value={novoEvento.horario_inicio}
                  onChange={(e) => setNovoEvento({...novoEvento, horario_inicio: e.target.value})}
                  className="bg-white dark:bg-gray-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
                <select
                  value={novoEvento.tipo}
                  onChange={(e) => setNovoEvento({...novoEvento, tipo: e.target.value})}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="samba">🥁 Samba</option>
                  <option value="pagode">🎤 Pagode</option>
                  <option value="forro">🎻 Forró</option>
                  <option value="sertanejo">🤠 Sertanejo</option>
                  <option value="outro">🎵 Outro</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Impacto Esperado</label>
                <select
                  value={novoEvento.impacto}
                  onChange={(e) => setNovoEvento({...novoEvento, impacto: e.target.value})}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="alto">🔴 Alto - Vai afetar muito</option>
                  <option value="medio">🟡 Médio - Pode afetar</option>
                  <option value="baixo">🟢 Baixo - Pouco impacto</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Link do Evento (opcional)</label>
                <Input
                  placeholder="https://sympla.com.br/evento..."
                  value={novoEvento.url_fonte}
                  onChange={(e) => setNovoEvento({...novoEvento, url_fonte: e.target.value})}
                  className="bg-white dark:bg-gray-700"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observações</label>
                <Input
                  placeholder="Ex: Grupo famoso, entrada gratuita, etc."
                  value={novoEvento.notas}
                  onChange={(e) => setNovoEvento({...novoEvento, notas: e.target.value})}
                  className="bg-white dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setMostrarFormulario(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAdicionarEvento}
                disabled={salvandoEvento}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {salvandoEvento ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Salvar Evento
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Eventos Identificados pelo Agente */}
      <Card className="card-dark">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Próximos Eventos de Concorrência
              {loadingEventos && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              {eventosConcorrenciaBD.length} eventos ativos
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventosConcorrenciaBD.length === 0 ? (
            <div className="text-center py-8">
              <Music className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum evento de concorrência identificado ainda.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Clique em &quot;Executar Agente&quot; para buscar eventos em Sympla, Ingresse e outros sites.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {eventosConcorrenciaBD.map((evento) => {
                const dataEvento = new Date(evento.data_evento + 'T12:00:00')
                const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dataEvento.getDay()]
                
                return (
                  <motion.div
                    key={evento.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-4 rounded-lg border flex items-start gap-4 ${
                      evento.impacto === 'alto'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : evento.impacto === 'medio'
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {/* Data */}
                    <div className="text-center min-w-[60px]">
                      <p className={`text-lg font-bold ${
                        evento.impacto === 'alto' ? 'text-red-600 dark:text-red-400' :
                        evento.impacto === 'medio' ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        {dataEvento.getDate()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][dataEvento.getMonth()]}
                      </p>
                      <p className="text-xs text-gray-400">{diaSemana}</p>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>
                              {evento.tipo === 'samba' ? '🥁' :
                               evento.tipo === 'pagode' ? '🎤' :
                               evento.tipo === 'forro' ? '🎻' : '🎵'}
                            </span>
                            {evento.nome}
                            {evento.verificado && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            📍 {evento.local_nome}
                            {evento.local_endereco && ` • ${evento.local_endereco}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            evento.impacto === 'alto'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                              : evento.impacto === 'medio'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {evento.impacto}
                          </span>
                          {evento.url_fonte && (
                            <a
                              href={evento.url_fonte}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-blue-500"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleRemoverEvento(evento.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Remover evento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{evento.tipo}</span>
                        <span>via {evento.fonte}</span>
                        {evento.preco_minimo && (
                          <span>R$ {evento.preco_minimo.toFixed(0)}{evento.preco_maximo && ` - ${evento.preco_maximo.toFixed(0)}`}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Datas Específicas de Concorrência 2026 */}
      {DATAS_CONCORRENCIA_2026.length > 0 && (
        <Card className="card-dark">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <CalendarDays className="w-5 h-5 text-red-500" />
              Datas de Concorrência em 2026
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DATAS_CONCORRENCIA_2026.map((data, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {new Date(data.data + 'T12:00:00').getDate()}
                    </p>
                    <p className="text-xs text-red-500">
                      {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][new Date(data.data + 'T12:00:00').getMonth()]}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{data.nome}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{data.dica}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full">
                    {data.diaSemana}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
