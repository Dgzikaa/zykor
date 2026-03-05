'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  Save, 
  AlertTriangle, 
  CheckCircle, 
  Search,
  X,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  Barcode,
  ChevronRight,
  History
} from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';

interface Insumo {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  unidade_medida: string;
  custo_unitario: number;
  tipo_local: 'bar' | 'cozinha';
  estoque_atual?: number;
  ultima_contagem?: string;
}

interface ContagemRegistro {
  insumo_id: number;
  insumo_codigo: string;
  insumo_nome: string;
  estoque_final: number;
  custo_unitario: number;
  observacoes?: string;
}

export default function ContagemRapidaPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosFiltrados, setInsumosFiltrados] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Busca e filtros
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'bar' | 'cozinha'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  
  // Contagem
  const [contagens, setContagens] = useState<ContagemRegistro[]>([]);
  const [insumoSelecionado, setInsumoSelecionado] = useState<Insumo | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [observacoes, setObservacoes] = useState('');
  
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [modoScanner, setModoScanner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPageTitle('⚡ Contagem Rápida');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    carregarInsumos();
  }, [selectedBar]);

  useEffect(() => {
    // Filtrar insumos
    let filtrados = insumos;

    if (filtroTipo !== 'todos') {
      filtrados = filtrados.filter(i => i.tipo_local === filtroTipo);
    }

    if (filtroCategoria !== 'todos') {
      filtrados = filtrados.filter(i => i.categoria === filtroCategoria);
    }

    if (busca) {
      const buscaLower = busca.toLowerCase();
      filtrados = filtrados.filter(
        i => i.nome.toLowerCase().includes(buscaLower) ||
             i.codigo.toLowerCase().includes(buscaLower) ||
             i.categoria.toLowerCase().includes(buscaLower)
      );
    }

    setInsumosFiltrados(filtrados);
  }, [insumos, filtroTipo, filtroCategoria, busca]);

  const carregarInsumos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/operacional/receitas/insumos?ativo=true');
      const result = await response.json();

      if (result.data) {
        setInsumos(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar insumos:', error);
      toast.error('Erro ao carregar insumos');
    } finally {
      setLoading(false);
    }
  };

  const selecionarInsumo = (insumo: Insumo) => {
    setInsumoSelecionado(insumo);
    setQuantidade('');
    setObservacoes('');
    setBusca('');
    setMostrarSugestoes(false);
    
    // Focar no input de quantidade
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const registrarContagem = () => {
    if (!insumoSelecionado || !quantidade || parseFloat(quantidade) < 0) {
      toast.error('Preencha a quantidade corretamente');
      return;
    }

    const qtd = parseFloat(quantidade);

    // Verificar se já existe contagem para este insumo
    const indexExistente = contagens.findIndex(c => c.insumo_id === insumoSelecionado.id);

    if (indexExistente >= 0) {
      // Atualizar contagem existente
      const novasContagens = [...contagens];
      novasContagens[indexExistente] = {
        ...novasContagens[indexExistente],
        estoque_final: qtd,
        observacoes: observacoes || undefined
      };
      setContagens(novasContagens);
      toast.success(`Contagem de ${insumoSelecionado.nome} atualizada`);
    } else {
      // Adicionar nova contagem
      const novaContagem: ContagemRegistro = {
        insumo_id: insumoSelecionado.id,
        insumo_codigo: insumoSelecionado.codigo,
        insumo_nome: insumoSelecionado.nome,
        estoque_final: qtd,
        custo_unitario: insumoSelecionado.custo_unitario,
        observacoes: observacoes || undefined
      };

      setContagens([...contagens, novaContagem]);
      toast.success(`${insumoSelecionado.nome} adicionado à contagem`);
    }

    // Limpar seleção
    setInsumoSelecionado(null);
    setQuantidade('');
    setObservacoes('');
    setBusca('');
  };

  const removerContagem = (insumo_id: number) => {
    setContagens(contagens.filter(c => c.insumo_id !== insumo_id));
    toast.info('Item removido da contagem');
  };

  const finalizarContagem = async () => {
    if (contagens.length === 0) {
      toast.error('Adicione pelo menos um item à contagem');
      return;
    }

    try {
      setSalvando(true);

      const dataContagem = new Date().toISOString().split('T')[0];
      const usuarioNome = user?.nome || user?.email || 'Sistema';

      // Salvar cada contagem
      const promises = contagens.map(async (contagem) => {
        const payload = {
          bar_id: selectedBar?.id,
          data_contagem: dataContagem,
          insumo_id: contagem.insumo_id,
          insumo_codigo: contagem.insumo_codigo,
          insumo_nome: contagem.insumo_nome,
          estoque_final: contagem.estoque_final,
          custo_unitario: contagem.custo_unitario,
          observacoes: contagem.observacoes,
          usuario_contagem: usuarioNome
        };

        const response = await fetch('/api/operacoes/contagem-estoque/insumos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        return response.json();
      });

      const resultados = await Promise.all(promises);
      
      const sucessos = resultados.filter(r => r.success).length;
      const erros = resultados.length - sucessos;

      if (sucessos > 0) {
        toast.success(`✅ ${sucessos} contagens salvas com sucesso!`);
        setContagens([]);
        carregarInsumos();
      }

      if (erros > 0) {
        toast.warning(`⚠️ ${erros} contagens com erro`);
      }
    } catch (error) {
      console.error('Erro ao finalizar contagem:', error);
      toast.error('Erro ao salvar contagens');
    } finally {
      setSalvando(false);
    }
  };

  const categorias = [...new Set(insumos.map(i => i.categoria))];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            Contagem Rápida de Estoque
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm ml-11">
            Registre contagens de estoque de forma rápida e prática
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Seleção de Insumos */}
          <div className="space-y-4">
            {/* Busca e Filtros */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white text-lg flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Buscar Insumo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Input de Busca */}
                <div className="relative">
                  <Input
                    placeholder="Digite nome ou código..."
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setMostrarSugestoes(e.target.value.length > 0);
                    }}
                    onFocus={() => setMostrarSugestoes(busca.length > 0)}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white pr-10"
                  />
                  {modoScanner && (
                    <Barcode className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 w-5 h-5" />
                  )}
                </div>

                {/* Filtros Rápidos */}
                <div className="flex gap-2">
                  <Button
                    variant={filtroTipo === 'todos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroTipo('todos')}
                    className={filtroTipo === 'todos' ? 'bg-blue-600 text-white' : ''}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={filtroTipo === 'cozinha' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroTipo('cozinha')}
                    className={filtroTipo === 'cozinha' ? 'bg-purple-600 text-white' : ''}
                  >
                    🍳 Cozinha
                  </Button>
                  <Button
                    variant={filtroTipo === 'bar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroTipo('bar')}
                    className={filtroTipo === 'bar' ? 'bg-blue-600 text-white' : ''}
                  >
                    🍹 Bar
                  </Button>
                </div>

                {/* Sugestões */}
                {mostrarSugestoes && insumosFiltrados.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                    {insumosFiltrados.slice(0, 10).map((insumo) => (
                      <button
                        key={insumo.id}
                        onClick={() => selecionarInsumo(insumo)}
                        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-gray-900 dark:text-white text-sm">
                            {insumo.nome}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {insumo.codigo} • {insumo.categoria} • {insumo.unidade_medida}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${
                            insumo.tipo_local === 'cozinha'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {insumo.tipo_local === 'cozinha' ? '🍳' : '🍹'}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Form de Registro */}
            {insumoSelecionado && (
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-300 dark:border-blue-700">
                <CardHeader>
                  <CardTitle className="text-blue-900 dark:text-blue-100 text-base flex items-center justify-between">
                    <span>Registrar Contagem</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInsumoSelecionado(null)}
                      className="text-blue-900 dark:text-blue-100"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-blue-800 dark:text-blue-200">
                    {insumoSelecionado.nome}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm bg-white dark:bg-gray-800 p-3 rounded-lg">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Código:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                        {insumoSelecionado.codigo}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Categoria:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                        {insumoSelecionado.categoria}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Unidade:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                        {insumoSelecionado.unidade_medida}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Custo:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                        R$ {insumoSelecionado.custo_unitario.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-blue-900 dark:text-blue-100">
                      Quantidade ({insumoSelecionado.unidade_medida}) *
                    </Label>
                    <Input
                      ref={inputRef}
                      type="number"
                      step="0.01"
                      placeholder="Ex: 150"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          registrarContagem();
                        }
                      }}
                      className="bg-white dark:bg-gray-700 border-blue-300 dark:border-blue-600 text-gray-900 dark:text-white text-lg font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-blue-900 dark:text-blue-100">Observações</Label>
                    <Input
                      placeholder="Opcional..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      className="bg-white dark:bg-gray-700 border-blue-300 dark:border-blue-600 text-gray-900 dark:text-white"
                    />
                  </div>

                  <Button
                    onClick={registrarContagem}
                    disabled={!quantidade || parseFloat(quantidade) < 0}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Adicionar à Contagem
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna Direita - Lista de Contagens */}
          <div className="space-y-4">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Itens Contados ({contagens.length})
                  </CardTitle>
                  {contagens.length > 0 && (
                    <Button
                      onClick={finalizarContagem}
                      disabled={salvando}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                    >
                      {salvando ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Finalizar
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {contagens.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Nenhum item adicionado ainda
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                      Busque um insumo e registre a quantidade
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contagens.map((contagem) => (
                      <div
                        key={contagem.insumo_id}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-white text-sm">
                            {contagem.insumo_nome}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-1">
                            <span>{contagem.insumo_codigo}</span>
                            <span>•</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {contagem.estoque_final} un.
                            </span>
                            <span>•</span>
                            <span>
                              R$ {(contagem.estoque_final * contagem.custo_unitario).toFixed(2)}
                            </span>
                          </div>
                          {contagem.observacoes && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              📝 {contagem.observacoes}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerContagem(contagem.insumo_id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}

                    {/* Total */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-green-900 dark:text-green-100">
                          Total Geral:
                        </span>
                        <span className="text-xl font-bold text-green-600 dark:text-green-400">
                          R$ {contagens.reduce((sum, c) => sum + (c.estoque_final * c.custo_unitario), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

