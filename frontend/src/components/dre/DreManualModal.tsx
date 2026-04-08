'use client'

import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Save, X, Search, Edit3 } from 'lucide-react'
import { toast } from 'sonner'

interface LancamentoManual {
  id: number
  data_competencia: string
  descricao: string
  valor: number
  categoria: string
  categoria_macro: string
  observacoes?: string
  usuario_criacao: string
  criado_em: string
  atualizado_em?: string
}

interface DreManualModalProps {
  isOpen: boolean
  onClose: () => void
  onLancamentoAdicionado?: () => void
  mesAno?: { mes: number; ano: number }
  editingLancamento?: LancamentoManual | null
  barId?: number
}

interface FormData {
  data_competencia: string
  descricao: string
  valor: string
  categoria_nome: string
  categoria_macro: string
  observacoes: string
}

interface ContaAzulCategoria {
  categoria_nome: string
  entradas: number
  saidas: number
}

interface ContaAzulCategoriasResponse {
  categorias_por_macro: Record<string, ContaAzulCategoria[]>
}

export default function DreManualModal({ 
  isOpen,
  onClose,
  onLancamentoAdicionado, 
  mesAno,
  editingLancamento,
  barId
}: DreManualModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingCategorias, setLoadingCategorias] = useState(false)
  const [categorias, setCategorias] = useState<ContaAzulCategoriasResponse | null>(null)
  const [categoriaFilter, setCategoriaFilter] = useState('')
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [formData, setFormData] = useState<FormData>(() => {
    if (editingLancamento) {
      // Inicializar com dados do lançamento sendo editado
      return {
        data_competencia: editingLancamento.data_competencia.split('T')[0], // Remover hora
        descricao: editingLancamento.descricao,
        valor: editingLancamento.valor.toString(),
        categoria_nome: editingLancamento.categoria,
        categoria_macro: editingLancamento.categoria_macro,
        observacoes: editingLancamento.observacoes || ''
      }
    } else {
      // Inicializar vazio para novo lançamento
      return {
        data_competencia: mesAno ? `${mesAno.ano}-${mesAno.mes.toString().padStart(2, '0')}-01` : '',
        descricao: '',
        valor: '',
        categoria_nome: '',
        categoria_macro: '',
        observacoes: ''
      }
    }
  })

  // Carregar categorias do Conta Azul
  const fetchCategorias = async () => {
    setLoadingCategorias(true)
    try {
      const url = barId
        ? `/api/financeiro/dre-categorias?bar_id=${barId}`
        : '/api/financeiro/dre-categorias'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Erro ao carregar categorias')
      const data = await response.json()
      setCategorias(data)
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
      toast.error('Erro ao carregar categorias do Conta Azul')
    } finally {
      setLoadingCategorias(false)
    }
  }

  // Carregar categorias quando o modal abrir
  React.useEffect(() => {
    if (isOpen && !categorias) {
      fetchCategorias()
    }
  }, [isOpen, categorias, fetchCategorias])

  // Fechar dropdown quando clicar fora
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-categoria-dropdown]')) {
        setShowCategoriaDropdown(false)
      }
    }

    if (showCategoriaDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCategoriaDropdown])

  // Função para formatar valor monetário
  const formatCurrency = (value: string) => {
    // Remove tudo que não é número
    const numericValue = value.replace(/\D/g, '')
    
    // Se vazio, retorna vazio
    if (!numericValue) return ''
    
    // Converte para número e formata
    const number = parseInt(numericValue) / 100
    return number.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // Função para converter valor formatado para número
  const parseCurrencyValue = (formattedValue: string) => {
    const numericValue = formattedValue.replace(/\D/g, '')
    return numericValue ? (parseInt(numericValue) / 100).toString() : ''
  }

  // Lista flat de categorias a partir da estrutura por macro
  const todasCategorias = useMemo(() => {
    if (!categorias?.categorias_por_macro) return []
    return Object.entries(categorias.categorias_por_macro).flatMap(([macro, cats]) =>
      cats.map(c => ({ categoria_nome: c.categoria_nome, categoria_macro: macro }))
    ).sort((a, b) => a.categoria_nome.localeCompare(b.categoria_nome))
  }, [categorias])

  // Filtrar categorias baseado no texto digitado
  const filteredCategorias = useMemo(() => {
    if (!todasCategorias.length) return []
    if (!categoriaFilter) return todasCategorias
    return todasCategorias.filter(cat =>
      cat.categoria_nome.toLowerCase().includes(categoriaFilter.toLowerCase()) ||
      cat.categoria_macro.toLowerCase().includes(categoriaFilter.toLowerCase())
    )
  }, [todasCategorias, categoriaFilter])

  const handleInputChange = (field: keyof FormData, value: string) => {
    if (field === 'valor') {
      // Para o campo valor, armazenar o valor numérico puro
      const numericValue = parseCurrencyValue(value)
      setFormData(prev => ({
        ...prev,
        [field]: numericValue
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    // Permitir sinal negativo no início
    const isNegative = inputValue.startsWith('-')
    const absoluteValue = inputValue.replace('-', '')
    
    // Formatar o valor absoluto
    const formattedValue = formatCurrency(absoluteValue)
    
    // Aplicar sinal negativo se necessário
    const finalValue = isNegative && formattedValue ? `-${formattedValue}` : formattedValue
    
    // Armazenar valor numérico puro no estado
    const numericValue = parseCurrencyValue(absoluteValue)
    const finalNumericValue = isNegative && numericValue ? `-${numericValue}` : numericValue
    
    setFormData(prev => ({
      ...prev,
      valor: finalNumericValue
    }))
    
    // Atualizar o campo visual
    e.target.value = finalValue
  }

  const handleCategoriaChange = (categoriaNome: string) => {
    const categoria = todasCategorias.find(c => c.categoria_nome === categoriaNome)
    setFormData(prev => ({
      ...prev,
      categoria_nome: categoriaNome,
      categoria_macro: categoria?.categoria_macro || ''
    }))
    setCategoriaFilter(categoriaNome)
    setShowCategoriaDropdown(false)
  }

  const handleCategoriaFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCategoriaFilter(value)
    setShowCategoriaDropdown(true)
    
    const exactMatch = todasCategorias.find(c => 
      c.categoria_nome.toLowerCase() === value.toLowerCase()
    )
    if (exactMatch) {
      setFormData(prev => ({
        ...prev,
        categoria_nome: exactMatch.categoria_nome,
        categoria_macro: exactMatch.categoria_macro
      }))
    } else {
      // Limpar seleção se não há match exato
      setFormData(prev => ({
        ...prev,
        categoria_nome: '',
        categoria_macro: ''
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.data_competencia || !formData.descricao || !formData.valor || !formData.categoria_nome) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)

    try {
      const isEditing = !!(editingLancamento && editingLancamento.id > 0)
      const url = isEditing 
        ? `/api/financeiro/dre-manual/${editingLancamento.id}`
        : '/api/financeiro/dre-simples'
      
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data_competencia: formData.data_competencia,
          descricao: formData.descricao,
          valor: parseFloat(formData.valor),
          categoria: formData.categoria_nome,
          categoria_macro: formData.categoria_macro,
          observacoes: formData.observacoes,
          usuario_criacao: 'usuario_atual',
          bar_id: barId || null,
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Erro ao ${isEditing ? 'editar' : 'adicionar'} lançamento`)
      }

      const successMessage = isEditing ? 'Lançamento editado com sucesso!' : 'Lançamento manual adicionado com sucesso!'
      toast.success(successMessage)
      
      if (isEditing) {
        // Se estiver editando, fechar o modal
        if (onClose) {
          onClose()
        }
      } else {
        // Se estiver criando, mostrar mensagem e limpar formulário
        setShowSuccessMessage(true)
        setTimeout(() => setShowSuccessMessage(false), 3000)
        
        // Reset form para permitir novo lançamento
        setFormData({
          data_competencia: mesAno ? `${mesAno.ano}-${mesAno.mes.toString().padStart(2, '0')}-01` : '',
          descricao: '',
          valor: '',
          categoria_nome: '',
          categoria_macro: '',
          observacoes: ''
        })
        setCategoriaFilter('')
        setShowCategoriaDropdown(false)
      }
      
      // Atualizar dados da página
      onLancamentoAdicionado?.()
      
      // NÃO fechar o modal - permitir múltiplos lançamentos

    } catch (error) {
      console.error('Erro ao adicionar lançamento:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar lançamento')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      data_competencia: mesAno ? `${mesAno.ano}-${mesAno.mes.toString().padStart(2, '0')}-01` : '',
      descricao: '',
      valor: '',
      categoria_nome: '',
      categoria_macro: '',
      observacoes: ''
    })
    setCategoriaFilter('')
    setShowCategoriaDropdown(false)
    setShowSuccessMessage(false)
    onClose()
  }
  
  const handleNovoLancamento = () => {
    setFormData({
      data_competencia: mesAno ? `${mesAno.ano}-${mesAno.mes.toString().padStart(2, '0')}-01` : '',
      descricao: '',
      valor: '',
      categoria_nome: '',
      categoria_macro: '',
      observacoes: ''
    })
    setCategoriaFilter('')
    setShowCategoriaDropdown(false)
    setShowSuccessMessage(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      
      <DialogContent className="modal-dark max-w-2xl w-full mx-4 max-h-[95vh] flex flex-col">
        <DialogHeader className="pb-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
              {editingLancamento ? (
                <Edit3 className="w-4 h-4 text-white" />
              ) : (
                <Plus className="w-4 h-4 text-white" />
              )}
            </div>
            {editingLancamento ? 'Editar Lançamento Manual' : 'Novo Lançamento Manual'}
          </DialogTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            {editingLancamento 
              ? 'Edite os dados do lançamento manual selecionado' 
              : 'Adicione ajustes manuais à DRE do mês selecionado. Você pode adicionar múltiplos lançamentos.'
            }
          </p>
          
          {/* Mensagem de Sucesso */}
          {showSuccessMessage && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                  ✅ Lançamento adicionado com sucesso! Adicione outro ou feche o modal.
                </p>
              </div>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
          {/* Seção: Informações Básicas */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              Informações Básicas
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Data de Competência */}
              <div className="space-y-3">
                <Label htmlFor="data_competencia" className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Data de Competência *
                </Label>
                <Input
                  id="data_competencia"
                  type="date"
                  value={formData.data_competencia}
                  onChange={(e) => handleInputChange('data_competencia', e.target.value)}
                  className="h-12 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  required
                />
              </div>

              {/* Descrição */}
              <div className="space-y-3">
                <Label htmlFor="descricao" className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Descrição *
                </Label>
                <Input
                  id="descricao"
                  type="text"
                  placeholder="Ex: Ajuste de receita, Correção de despesa..."
                  value={formData.descricao}
                  onChange={(e) => handleInputChange('descricao', e.target.value)}
                  className="h-12 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          {/* Seção: Valor e Categoria */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              Valor e Categorização
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Valor */}
              <div className="space-y-3">
                <Label htmlFor="valor" className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Valor *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <span className="text-gray-500 dark:text-gray-400 font-bold text-lg">R$</span>
                  </div>
                  <Input
                    id="valor"
                    type="text"
                    placeholder="0,00"
                    defaultValue={formData.valor ? formatCurrency(Math.abs(parseFloat(formData.valor)).toString().replace('.', '')) : ''}
                    onChange={handleValorChange}
                    className="h-12 pl-14 pr-4 text-right font-mono text-lg border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:border-green-500 dark:focus:border-green-400 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Categoria Nibo */}
              <div className="space-y-3 relative" data-categoria-dropdown>
                <Label htmlFor="categoria_nome" className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Categoria Nibo *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Search className="w-5 h-5 text-gray-400" />
                  </div>
                  <Input
                    id="categoria_nome"
                    type="text"
                    placeholder={loadingCategorias ? "Carregando..." : "Digite para buscar categoria..."}
                    value={categoriaFilter}
                    onChange={handleCategoriaFilterChange}
                    onFocus={() => setShowCategoriaDropdown(true)}
                    className="h-12 pl-12 pr-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:border-green-500 dark:focus:border-green-400 transition-colors"
                    disabled={loadingCategorias}
                    required
                  />
                </div>
                
                {/* Dropdown de categorias filtradas */}
                {showCategoriaDropdown && filteredCategorias.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                    {filteredCategorias.slice(0, 10).map((categoria) => (
                      <button
                        key={categoria.categoria_nome}
                        type="button"
                        onClick={() => handleCategoriaChange(categoria.categoria_nome)}
                        className="w-full px-4 py-4 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-all duration-200 group"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                            {categoria.categoria_nome.replace(/^\[.*?\]\s*/, '')}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                            {categoria.categoria_macro}
                          </span>
                        </div>
                      </button>
                    ))}
                    {filteredCategorias.length > 10 && (
                      <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 font-medium">
                        +{filteredCategorias.length - 10} mais categorias... Continue digitando para filtrar.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção: Macro-categoria e Observações */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              Categorização e Observações
            </h3>
            
            <div className="space-y-4">
              {/* Macro-categoria (readonly) */}
              {formData.categoria_macro && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Macro-categoria (automática)
                  </Label>
                  <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                        {formData.categoria_macro}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              <div className="space-y-3">
                <Label htmlFor="observacoes" className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Observações
                </Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações adicionais (opcional)"
                  value={formData.observacoes}
                  onChange={(e) => handleInputChange('observacoes', e.target.value)}
                  className="min-h-[80px] border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:border-purple-500 dark:focus:border-purple-400 transition-colors resize-none"
                  rows={3}
                />
              </div>
            </div>
          </div>
          </div>

          {/* Botões fixos na parte inferior */}
          <div className="flex gap-3 pt-6 border-t-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 h-12 text-sm font-semibold border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex flex-row items-center justify-center gap-2"
            >
              <X className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Cancelar</span>
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-12 text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50 disabled:cursor-not-allowed flex flex-row items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                  <span className="whitespace-nowrap">Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">
                    {editingLancamento ? 'Salvar Alterações' : 'Adicionar Lançamento'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
