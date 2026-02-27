'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, 
  Save, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown,
  History,
  Calendar,
  DollarSign,
  BarChart3,
  RefreshCw,
  Filter,
  Search,
  MapPin,
  Settings,
  X
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';

interface Alerta {
  tipo: string;
  severidade: 'critico' | 'alto' | 'medio' | 'info';
  mensagem: string;
  sugestao?: string;
  dados?: any;
}

interface ContagemData {
  id: number;
  categoria: string;
  descricao: string;
  estoque_fechado: number;
  estoque_flutuante: number;
  estoque_total: number;
  preco: number;
  valor_total: number;
  data_contagem: string;
  variacao_percentual: number | null;
  alerta_variacao: boolean;
  alerta_preenchimento: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  area_id: number | null;
  // Campos de anomalia
  contagem_anomala?: boolean;
  score_anomalia?: number;
  tipo_anomalia?: string[];
  motivo_anomalia?: string;
  // Campos do histórico retroativo
  insumo_id?: number;
  insumo_codigo?: string;
  insumo_nome?: string;
  estoque_inicial?: number;
  estoque_final?: number;
  custo_unitario?: number;
}

interface Area {
  id: number;
  nome: string;
  tipo: string;
  ativo: boolean;
}

const CATEGORIAS = [
  'Bebidas',
  'Alimentos',
  'Insumos',
  'Descartáveis',
  'Limpeza',
  'Outros'
];

export default function ContagemEstoquePage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar, isLoading: barLoading } = useBar();

  // Estados do formulário
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [estoqueFechado, setEstoqueFechado] = useState('');
  const [estoqueFlutuante, setEstoqueFlutuante] = useState('');
  const [preco, setPreco] = useState('');
  const [dataContagem, setDataContagem] = useState(new Date().toISOString().split('T')[0]);
  const [observacoes, setObservacoes] = useState('');
  const [areaId, setAreaId] = useState<string>('');

  // Estados de controle
  const [loading, setLoading] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [contagens, setContagens] = useState<ContagemData[]>([]);
  const [loadingContagens, setLoadingContagens] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  
  // Estados para seleção rápida de produtos
  const [produtosSugeridos, setProdutosSugeridos] = useState<Array<{descricao: string; preco: number}>>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  
  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroAlerta, setFiltroAlerta] = useState(false);
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [busca, setBusca] = useState('');

  // Tab ativa
  const [activeTab, setActiveTab] = useState('registrar');
  
  // Sincronização Google Sheets
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncData, setSyncData] = useState(new Date().toISOString().split('T')[0]);

  // Definir título da página
  useEffect(() => {
    setPageTitle('📦 Contagem de Estoque');
  }, [setPageTitle]);

  // Buscar áreas ao carregar ou trocar de bar
  useEffect(() => {
    if (selectedBar?.id) {
      buscarAreas();
    }
  }, [selectedBar?.id]);

  // Carregar contagens ao mudar de tab ou trocar de bar
  useEffect(() => {
    if (activeTab === 'lista' && selectedBar?.id) {
      buscarContagens();
    }
  }, [activeTab, filtroCategoria, filtroAlerta, filtroArea, selectedBar?.id]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#descricao') && !target.closest('.absolute')) {
        setMostrarSugestoes(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buscarAreas = async () => {
    if (!selectedBar?.id) return;
    
    try {
      const response = await fetch(`/api/operacoes/areas-contagem?ativas=true&bar_id=${selectedBar.id}`);
      const result = await response.json();
      if (result.success) {
        setAreas(result.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar áreas:', error);
    }
  };

  const buscarProdutosPorCategoria = async (cat: string) => {
    if (!cat || !selectedBar?.id) {
      setProdutosSugeridos([]);
      setMostrarSugestoes(false);
      return;
    }

    setLoadingProdutos(true);
    try {
      const response = await fetch(`/api/operacoes/contagem-estoque/produtos?categoria=${encodeURIComponent(cat)}&bar_id=${selectedBar.id}`);
      const result = await response.json();

      if (result.success) {
        setProdutosSugeridos(result.data || []);
        setMostrarSugestoes((result.data || []).length > 0);
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    } finally {
      setLoadingProdutos(false);
    }
  };

  const selecionarProduto = (produto: {descricao: string; preco: number}) => {
    setDescricao(produto.descricao);
    setPreco(produto.preco.toString());
    setMostrarSugestoes(false);
    // Focar no campo de estoque fechado
    setTimeout(() => {
      const input = document.querySelector('input[type="number"]') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  };

  const buscarContagens = async () => {
    if (!selectedBar?.id) {
      console.log('Bar não selecionado, aguardando...');
      return;
    }
    
    setLoadingContagens(true);
    try {
      const params = new URLSearchParams({
        bar_id: selectedBar.id.toString(),
        limit: '200'  // Aumentar limite para ver mais insumos
      });
      
      if (filtroData) {
        params.append('data_inicio', filtroData);
        params.append('data_fim', filtroData);
      }
      
      if (filtroArea && filtroArea !== 'todas') {
        params.append('tipo_local', filtroArea);
      }

      // Usar rota de INSUMOS (sincronizados do Google Sheets)
      const response = await fetch(`/api/operacoes/contagem-estoque/insumos?${params}`);
      const result = await response.json();

      if (result.success) {
        setContagens(result.data || []);
      } else {
        toast.error('Erro ao buscar contagens');
      }
    } catch (error) {
      console.error('Erro ao buscar contagens:', error);
      toast.error('Erro ao buscar contagens');
    } finally {
      setLoadingContagens(false);
    }
  };

  const validarPreenchimento = () => {
    const alertasTemp: Alerta[] = [];

    // Validação 1: Campos obrigatórios
    if (!categoria) {
      alertasTemp.push({
        tipo: 'campo_obrigatorio',
        severidade: 'critico',
        mensagem: 'Categoria é obrigatória'
      });
    }

    if (!descricao) {
      alertasTemp.push({
        tipo: 'campo_obrigatorio',
        severidade: 'critico',
        mensagem: 'Descrição é obrigatória'
      });
    }

    // Validação 2: Valores numéricos
    const fechado = parseFloat(estoqueFechado) || 0;
    const flutuante = parseFloat(estoqueFlutuante) || 0;
    const precoNum = parseFloat(preco) || 0;
    const total = fechado + flutuante;

    // Validação 3: Detectar possível erro de digitação (muitos zeros)
    const totalStr = total.toString();
    if (totalStr.length > 4 && /0{3,}/.test(totalStr)) {
      alertasTemp.push({
        tipo: 'erro_digitacao',
        severidade: 'alto',
        mensagem: '⚠️ Valor suspeito: muitos zeros consecutivos',
        sugestao: `Você quis dizer ${(total / 1000).toFixed(2)}?`
      });
    }

    // Validação 4: Número muito alto
    if (total > 10000) {
      alertasTemp.push({
        tipo: 'valor_alto',
        severidade: 'medio',
        mensagem: '⚠️ Estoque muito alto',
        sugestao: 'Confirme se o valor está correto'
      });
    }

    // Validação 5: Preço zerado com estoque
    if (total > 0 && precoNum === 0) {
      alertasTemp.push({
        tipo: 'preco_zerado',
        severidade: 'medio',
        mensagem: 'Produto com estoque mas sem preço',
        sugestao: 'Considere informar o preço'
      });
    }

    setAlertas(alertasTemp);
    return alertasTemp.filter(a => a.severidade === 'critico').length === 0;
  };

  const salvarContagem = async () => {
    // Validar antes de enviar
    if (!validarPreenchimento()) {
      toast.error('Corrija os erros antes de salvar');
      return;
    }
    
    if (!selectedBar?.id) {
      toast.error('Selecione um bar antes de salvar');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/operacoes/contagem-estoque', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          categoria,
          descricao,
          estoque_fechado: parseFloat(estoqueFechado) || 0,
          estoque_flutuante: parseFloat(estoqueFlutuante) || 0,
          preco: parseFloat(preco) || 0,
          data_contagem: dataContagem,
          area_id: areaId ? parseInt(areaId) : null,
          observacoes: observacoes || null,
          usuario_nome: 'Usuário Sistema'
        })
      });

      const result = await response.json();

      if (result.success) {
        // Mostrar alertas da API se houver
        if (result.alertas && result.alertas.length > 0) {
          setAlertas(result.alertas);
          
          const alertasCriticos = result.alertas.filter((a: Alerta) => a.severidade === 'critico');
          if (alertasCriticos.length > 0) {
            toast.warning(`Contagem salva com ${alertasCriticos.length} alerta(s) crítico(s)`, {
              description: 'Verifique os alertas abaixo'
            });
          } else {
            toast.success('Contagem salva com sucesso!');
          }
        } else {
          toast.success('Contagem salva com sucesso!');
          limparFormulario();
        }
      } else {
        toast.error(result.error || 'Erro ao salvar contagem');
      }
    } catch (error) {
      console.error('Erro ao salvar contagem:', error);
      toast.error('Erro ao salvar contagem');
    } finally {
      setLoading(false);
    }
  };

  const limparFormulario = () => {
    setCategoria('');
    setDescricao('');
    setEstoqueFechado('');
    setEstoqueFlutuante('');
    setPreco('');
    setAreaId('');
    setObservacoes('');
    setAlertas([]);
    setProdutosSugeridos([]);
    setMostrarSugestoes(false);
  };

  const formatarData = (data: string) => {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const contagensFiltradas = contagens.filter(c => {
    // Filtro de data
    if (filtroData && c.data_contagem) {
      const dataContagem = new Date(c.data_contagem).toISOString().split('T')[0];
      if (dataContagem !== filtroData) {
        return false;
      }
    }

    // Filtro de busca
    if (busca) {
      const buscaLower = busca.toLowerCase();
      if (!(c.descricao.toLowerCase().includes(buscaLower) ||
            c.categoria.toLowerCase().includes(buscaLower))) {
        return false;
      }
    }

    // Filtro de categoria
    if (filtroCategoria && c.categoria !== filtroCategoria) {
      return false;
    }

    // Filtro de alertas (anomalias)
    if (filtroAlerta && !c.contagem_anomala) {
      return false;
    }

    return true;
  });

  // Mostrar loading enquanto o bar está sendo carregado
  if (barLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingState
          title="Carregando contagem de estoque..."
          subtitle="Preparando dados de inventário"
          icon={<Package className="w-4 h-4" />}
        />
      </div>
    );
  }

  // Mostrar aviso se nenhum bar foi selecionado
  if (!selectedBar?.id) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">Selecione um bar para continuar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="card-dark p-3 sm:p-6 mb-4 sm:mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
              <TabsList className="tabs-list-dark w-full sm:w-auto">
                <TabsTrigger value="registrar" className="tabs-trigger-dark flex-1 sm:flex-none">
                  <Package className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Registrar</span>
                  <span className="xs:hidden">Registrar</span>
                </TabsTrigger>
                <TabsTrigger value="lista" className="tabs-trigger-dark flex-1 sm:flex-none">
                  <History className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Histórico</span>
                  <span className="xs:hidden">Histórico</span>
                </TabsTrigger>
                <TabsTrigger value="anomalias" className="tabs-trigger-dark flex-1 sm:flex-none">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Anomalias</span>
                  <span className="xs:hidden">Anomalias</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Link href="/ferramentas/areas-contagem" className="flex-1 sm:flex-none">
                  <Button 
                    variant="outline" 
                    className="btn-outline-dark w-full sm:w-auto text-xs sm:text-sm"
                    size="sm"
                    leftIcon={<Settings className="h-4 w-4" />}
                  >
                    <span className="hidden sm:inline">Gerenciar Áreas</span>
                    <span className="sm:hidden">Áreas</span>
                  </Button>
                </Link>
                <Link href="/ferramentas/contagem-estoque/consolidado" className="flex-1 sm:flex-none">
                  <Button 
                    className="btn-primary-dark w-full sm:w-auto text-xs sm:text-sm"
                    size="sm"
                    leftIcon={<BarChart3 className="h-4 w-4" />}
                  >
                    <span className="hidden sm:inline">Ver Consolidado</span>
                    <span className="sm:hidden">Consolidado</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* TAB: REGISTRAR CONTAGEM */}
            <TabsContent value="registrar" className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Formulário */}
                <div className="lg:col-span-2">
                  <Card className="card-dark">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="card-title-dark text-base sm:text-lg">Dados da Contagem</CardTitle>
                      <CardDescription className="card-description-dark text-xs sm:text-sm">
                        Preencha os dados do produto e estoque
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Categoria */}
                        <div className="space-y-2">
                          <Label htmlFor="categoria" className="text-gray-700 dark:text-gray-300">
                            Categoria *
                          </Label>
                          <Select 
                            value={categoria} 
                            onValueChange={(value) => {
                              setCategoria(value);
                              buscarProdutosPorCategoria(value);
                            }}
                          >
                            <SelectTrigger className="input-dark">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIAS.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Área */}
                        <div className="space-y-2">
                          <Label htmlFor="area" className="text-gray-700 dark:text-gray-300">
                            Área
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                              (Opcional)
                            </span>
                          </Label>
                          <Select value={areaId} onValueChange={setAreaId}>
                            <SelectTrigger className="input-dark">
                              <SelectValue placeholder="Sem área específica" />
                            </SelectTrigger>
                            <SelectContent>
                              {areas.map(area => (
                                <SelectItem key={area.id} value={area.id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3" />
                                    {area.nome}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Data */}
                        <div className="space-y-2">
                          <Label htmlFor="data" className="text-gray-700 dark:text-gray-300">
                            Data da Contagem
                          </Label>
                          <Input
                            type="date"
                            value={dataContagem}
                            onChange={(e) => setDataContagem(e.target.value)}
                            className="input-dark"
                          />
                        </div>
                      </div>

                      {/* Descrição */}
                      <div className="space-y-2 relative">
                        <Label htmlFor="descricao" className="text-gray-700 dark:text-gray-300">
                          Descrição do Produto *
                        </Label>
                        <Input
                          id="descricao"
                          placeholder={categoria ? "Digite para buscar o produto..." : "Selecione uma categoria primeiro"}
                          value={descricao}
                          onChange={(e) => {
                            setDescricao(e.target.value);
                            if (e.target.value.length > 0) {
                              setMostrarSugestoes(true);
                            }
                          }}
                          onFocus={() => {
                            if (descricao.length > 0 && produtosSugeridos.length > 0) {
                              setMostrarSugestoes(true);
                            }
                          }}
                          className="input-dark"
                          disabled={!categoria}
                          autoComplete="off"
                        />
                        
                        {/* Dropdown de Sugestões (Autocomplete) */}
                        {mostrarSugestoes && descricao.length > 0 && produtosSugeridos.filter(p => 
                          p.descricao.toLowerCase().includes(descricao.toLowerCase())
                        ).length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {produtosSugeridos
                              .filter(p => p.descricao.toLowerCase().includes(descricao.toLowerCase()))
                              .slice(0, 10)
                              .map((produto, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    selecionarProduto(produto);
                                    setMostrarSugestoes(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                                >
                                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                                    {produto.descricao}
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    R$ {produto.preco.toFixed(2)}
                                  </div>
                                </button>
                              ))
                            }
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Estoque Fechado */}
                        <div className="space-y-2">
                          <Label htmlFor="fechado" className="text-gray-700 dark:text-gray-300">
                            Estoque Fechado
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                              (Depósito)
                            </span>
                          </Label>
                          <Input
                            id="fechado"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={estoqueFechado}
                            onChange={(e) => {
                              setEstoqueFechado(e.target.value);
                              setTimeout(validarPreenchimento, 300);
                            }}
                            className="input-dark"
                          />
                        </div>

                        {/* Estoque Flutuante */}
                        <div className="space-y-2">
                          <Label htmlFor="flutuante" className="text-gray-700 dark:text-gray-300">
                            Estoque Flutuante
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                              (Bar/Salão)
                            </span>
                          </Label>
                          <Input
                            id="flutuante"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={estoqueFlutuante}
                            onChange={(e) => {
                              setEstoqueFlutuante(e.target.value);
                              setTimeout(validarPreenchimento, 300);
                            }}
                            className="input-dark"
                          />
                        </div>

                        {/* Preço */}
                        <div className="space-y-2">
                          <Label htmlFor="preco" className="text-gray-700 dark:text-gray-300">
                            Preço Unitário (R$)
                          </Label>
                          <Input
                            id="preco"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={preco}
                            onChange={(e) => {
                              setPreco(e.target.value);
                              setTimeout(validarPreenchimento, 300);
                            }}
                            className="input-dark"
                          />
                        </div>
                      </div>

                      {/* Total Calculado */}
                      {(estoqueFechado || estoqueFlutuante || preco) && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
                            <div>
                              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Estoque Total:</p>
                              <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                                {((parseFloat(estoqueFechado) || 0) + (parseFloat(estoqueFlutuante) || 0)).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Preço:</p>
                              <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                                {formatarValor(parseFloat(preco) || 0)}
                              </p>
                            </div>
                            <div className="xs:col-span-2 sm:col-span-1">
                              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Valor Total:</p>
                              <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">
                                {formatarValor(
                                  ((parseFloat(estoqueFechado) || 0) + (parseFloat(estoqueFlutuante) || 0)) * 
                                  (parseFloat(preco) || 0)
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Observações */}
                      <div className="space-y-2">
                        <Label htmlFor="observacoes" className="text-gray-700 dark:text-gray-300">
                          Observações
                        </Label>
                        <Textarea
                          id="observacoes"
                          placeholder="Informações adicionais sobre a contagem..."
                          value={observacoes}
                          onChange={(e) => setObservacoes(e.target.value)}
                          className="textarea-dark min-h-[80px]"
                        />
                      </div>

                      {/* Botões */}
                      <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 pt-4">
                        <Button
                          onClick={salvarContagem}
                          disabled={loading}
                          loading={loading}
                          className="btn-primary-dark flex-1"
                          leftIcon={!loading ? <Save className="w-4 w-4" /> : undefined}
                        >
                          {loading ? 'Salvando...' : 'Salvar Contagem'}
                        </Button>
                        <Button
                          onClick={limparFormulario}
                          variant="outline"
                          className="btn-outline-dark xs:w-auto w-full"
                        >
                          Limpar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Alertas */}
                <div className="space-y-3 sm:space-y-4">
                  <Card className="card-dark">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="card-title-dark text-sm sm:text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
                        Validações
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      {alertas.length === 0 ? (
                        <div className="text-center py-6">
                          <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Nenhum alerta no momento
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {alertas.map((alerta, index) => (
                            <div
                              key={index}
                              className={`p-3 rounded-lg border-l-4 ${
                                alerta.severidade === 'critico'
                                  ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                                  : alerta.severidade === 'alto'
                                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500'
                                  : alerta.severidade === 'medio'
                                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                              }`}
                            >
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {alerta.mensagem}
                              </p>
                              {alerta.sugestao && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  💡 {alerta.sugestao}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Legenda */}
                  <Card className="card-dark">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="card-title-dark text-xs sm:text-sm">
                        Severidade dos Alertas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs p-4 sm:p-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded flex-shrink-0"></div>
                        <span className="text-gray-700 dark:text-gray-300">Crítico - Revisar obrigatoriamente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded flex-shrink-0"></div>
                        <span className="text-gray-700 dark:text-gray-300">Alto - Atenção especial</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded flex-shrink-0"></div>
                        <span className="text-gray-700 dark:text-gray-300">Médio - Verificar se possível</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded flex-shrink-0"></div>
                        <span className="text-gray-700 dark:text-gray-300">Info - Apenas informativo</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* TAB: HISTÓRICO */}
            <TabsContent value="lista" className="space-y-6">
              {/* Filtros */}
              <Card className="card-dark">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Primeira linha: Data e Busca */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="w-full sm:w-auto">
                        <Input
                          type="date"
                          value={filtroData}
                          onChange={(e) => setFiltroData(e.target.value)}
                          className="input-dark w-full sm:w-[200px]"
                          placeholder="Filtrar por data"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Buscar por descrição ou categoria..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="input-dark pl-10"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Segunda linha: Filtros e Ações */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                          <SelectTrigger className="input-dark w-[200px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Todas categorias" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {filtroCategoria && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFiltroCategoria('')}
                            className="h-10 px-2"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <Button
                        variant={filtroAlerta ? 'default' : 'outline'}
                        onClick={() => setFiltroAlerta(!filtroAlerta)}
                        className={filtroAlerta ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'btn-outline-dark'}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Apenas com Alertas
                      </Button>

                      {filtroData && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFiltroData('')}
                          className="btn-outline-dark"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Limpar Data
                        </Button>
                      )}

                      <Button
                        onClick={buscarContagens}
                        disabled={loadingContagens}
                        className="btn-primary-dark"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingContagens ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Contagens */}
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Histórico de Contagens
                  </CardTitle>
                  <CardDescription className="card-description-dark">
                    {contagensFiltradas.length} contagen{contagensFiltradas.length !== 1 ? 's' : ''} encontrada{contagensFiltradas.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingContagens ? (
                    <LoadingState
                      title="Carregando histórico..."
                      subtitle="Buscando contagens anteriores"
                      icon={<History className="w-4 h-4" />}
                    />
                  ) : contagensFiltradas.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-600 dark:text-gray-400">Nenhuma contagem encontrada</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contagensFiltradas.map((contagem) => (
                        <div
                          key={contagem.id}
                          className={`p-4 rounded-lg border ${
                            contagem.contagem_anomala
                              ? (contagem.score_anomalia ?? 0) >= 50
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                  {contagem.insumo_nome || contagem.descricao}
                                </h4>
                                <Badge className="badge-secondary text-xs">
                                  {contagem.categoria}
                                </Badge>
                                {contagem.contagem_anomala && (
                                  <>
                                    <Badge className={`text-xs ${
                                      (contagem.score_anomalia ?? 0) >= 70 ? 'bg-red-600 text-white' :
                                      (contagem.score_anomalia ?? 0) >= 40 ? 'bg-orange-600 text-white' :
                                      'bg-yellow-600 text-white'
                                    }`}>
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Anomalia {contagem.score_anomalia}%
                                    </Badge>
                                    {contagem.tipo_anomalia && contagem.tipo_anomalia.map((tipo, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {tipo.replace(/_/g, ' ')}
                                      </Badge>
                                    ))}
                                  </>
                                )}
                                {(contagem.alerta_variacao || contagem.alerta_preenchimento) && !contagem.contagem_anomala && (
                                  <Badge className="badge-warning text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Alerta
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Motivo da Anomalia */}
                              {contagem.contagem_anomala && contagem.motivo_anomalia && (
                                <div className="mb-3 p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500">
                                  <p className="text-xs text-gray-700 dark:text-gray-300">
                                    <strong>⚠️ Motivo:</strong> {contagem.motivo_anomalia}
                                  </p>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-600 dark:text-gray-400">Data:</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {contagem.data_contagem ? new Date(contagem.data_contagem).toLocaleDateString('pt-BR') : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-600 dark:text-gray-400">Fechado:</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {Number(contagem.estoque_fechado || contagem.estoque_final || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-600 dark:text-gray-400">Flutuante:</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {Number(contagem.estoque_flutuante || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-600 dark:text-gray-400">Total:</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {Number(contagem.estoque_total || contagem.estoque_final || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-600 dark:text-gray-400">Valor:</p>
                                  <p className="font-medium text-green-600 dark:text-green-400">
                                    {formatarValor(Number(contagem.valor_total || ((contagem.estoque_final ?? 0) * (contagem.custo_unitario ?? 0)) || 0))}
                                  </p>
                                </div>
                              </div>

                              {contagem.variacao_percentual !== null && contagem.variacao_percentual !== undefined && (
                                <div className="mt-2 flex items-center gap-2">
                                  {contagem.variacao_percentual > 0 ? (
                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 text-red-500" />
                                  )}
                                  <span className={`text-sm font-medium ${
                                    contagem.variacao_percentual > 0 
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    {contagem.variacao_percentual > 0 ? '+' : ''}{contagem.variacao_percentual.toFixed(1)}% vs última contagem
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="text-right ml-4">
                              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-1">
                                <Calendar className="h-4 w-4" />
                                {formatarData(contagem.data_contagem)}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                {new Date(contagem.created_at).toLocaleDateString('pt-BR')} às{' '}
                                {new Date(contagem.created_at).toLocaleTimeString('pt-BR', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          </div>

                          {contagem.observacoes && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                📝 {contagem.observacoes}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: ANOMALIAS */}
            <TabsContent value="anomalias" className="space-y-6">
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Detecção de Anomalias
                  </CardTitle>
                  <CardDescription className="card-description-dark">
                    Sistema inteligente que detecta valores anormais automaticamente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-orange-500" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Anomalias Detectadas Automaticamente
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
                      O sistema detecta automaticamente valores suspeitos nas contagens, incluindo:
                      valores muito altos/baixos, variações bruscas, valores repetidos, possíveis erros de digitação e mais.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-3xl mx-auto">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <div className="text-2xl mb-1">📈</div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Valores Fora da Curva</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Detecta automaticamente</p>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                        <div className="text-2xl mb-1">⚠️</div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Erros de Digitação</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Ex: 1000 ao invés de 10</p>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                        <div className="text-2xl mb-1">🔁</div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Valores Repetidos</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Mesmo valor por 5+ dias</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                        <div className="text-2xl mb-1">🚫</div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Variações Bruscas</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Mudanças +200% ou -70%</p>
                      </div>
                    </div>
                    <Link href="/ferramentas/contagem-estoque/anomalias">
                      <Button className="btn-primary-dark">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Ver Todas as Anomalias Detectadas
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

