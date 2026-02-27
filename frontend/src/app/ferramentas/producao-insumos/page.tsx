'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  ChefHat,
  Plus,
  Search,
  Edit2,
  Trash2,
  Save,
  X,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';

interface Insumo {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  tipo_local: 'bar' | 'cozinha';
  unidade_medida: string;
  custo_unitario: number;
  observacoes?: string;
  ativo: boolean;
}

interface Receita {
  id: number;
  receita_codigo: string;
  receita_nome: string;
  receita_categoria: string;
  tipo_local: 'bar' | 'cozinha';
  rendimento_esperado: number;
  ativo: boolean;
  insumos_count?: number;
}

interface ReceitaCompleta extends Receita {
  insumos: Array<{
    id: number;
    codigo: string;
    nome: string;
    quantidade_necessaria: number;
    unidade_medida: string;
    is_chefe: boolean;
  }>;
}

export default function ProducaoInsumosPage() {
  const router = useRouter();
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Estados para insumos
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosSearch, setInsumosSearch] = useState('');
  const [insumosFiltro, setInsumosFiltro] = useState<'todos' | 'bar' | 'cozinha'>('todos');
  const [modalInsumo, setModalInsumo] = useState(false);
  const [insumoEdit, setInsumoEdit] = useState<Partial<Insumo> | null>(null);

  // Estados para receitas
  const [receitas, setReceitas] = useState<ReceitaCompleta[]>([]);
  const [receitasSearch, setReceitasSearch] = useState('');
  const [receitasFiltro, setReceitasFiltro] = useState<'todos' | 'bar' | 'cozinha'>('todos');
  const [modalReceita, setModalReceita] = useState(false);
  const [receitaEdit, setReceitaEdit] = useState<Partial<ReceitaCompleta> | null>(null);
  const [receitaDetalhes, setReceitaDetalhes] = useState<ReceitaCompleta | null>(null);
  const [modalDetalhes, setModalDetalhes] = useState(false);

  // Estados para histórico
  const [historico, setHistorico] = useState<any[]>([]);
  const [historicoSearch, setHistoricoSearch] = useState('');

  // Form states para insumo
  const [formInsumo, setFormInsumo] = useState({
    codigo: '',
    nome: '',
    categoria: 'cozinha',
    tipo_local: 'cozinha' as 'bar' | 'cozinha',
    unidade_medida: 'g',
    custo_unitario: 0,
    observacoes: '',
  });

  // Definir título da página
  useEffect(() => {
    setPageTitle('📦 Produção e Insumos');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Carregar dados
  useEffect(() => {
    carregarDados();
  }, [selectedBar]);

  const carregarDados = async () => {
    setLoading(true);
    await Promise.all([carregarInsumos(), carregarReceitas(), carregarHistorico()]);
    setLoading(false);
  };

  const carregarInsumos = async () => {
    try {
      const response = await fetch('/api/operacional/receitas/insumos?ativo=true');
      if (response.ok) {
        const data = await response.json();
        setInsumos(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar insumos:', error);
    }
  };

  const carregarReceitas = async () => {
    try {
      const response = await fetch(`/api/operacional/receitas?bar_id=${selectedBar?.id}`);
      if (response.ok) {
        const data = await response.json();
        const receitasProcessadas = (data.receitas || []).map((r: any) => ({
          id: r.id || 0,
          receita_codigo: r.receita_codigo,
          receita_nome: r.receita_nome,
          receita_categoria: r.receita_categoria,
          tipo_local: r.tipo_local,
          rendimento_esperado: r.rendimento_esperado || 0,
          ativo: true,
          insumos: r.insumos || [],
          insumos_count: (r.insumos || []).length,
        }));
        setReceitas(receitasProcessadas);
      }
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
    }
  };

  const carregarHistorico = async () => {
    try {
      const response = await fetch('/api/operacional/receitas/historico?limit=100');
      if (response.ok) {
        const data = await response.json();
        setHistorico(data.historico || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  // Funções de CRUD para Insumos
  const abrirModalInsumo = (insumo?: Insumo) => {
    if (insumo) {
      setInsumoEdit(insumo);
      setFormInsumo({
        codigo: insumo.codigo,
        nome: insumo.nome,
        categoria: insumo.categoria,
        tipo_local: insumo.tipo_local,
        unidade_medida: insumo.unidade_medida,
        custo_unitario: insumo.custo_unitario,
        observacoes: insumo.observacoes || '',
      });
    } else {
      setInsumoEdit(null);
      setFormInsumo({
        codigo: '',
        nome: '',
        categoria: 'cozinha',
        tipo_local: 'cozinha',
        unidade_medida: 'g',
        custo_unitario: 0,
        observacoes: '',
      });
    }
    setModalInsumo(true);
  };

  const salvarInsumo = async () => {
    try {
      const url = '/api/operacional/receitas/insumos';
      const method = insumoEdit ? 'PUT' : 'POST';
      const body = insumoEdit
        ? { ...formInsumo, id: insumoEdit.id, bar_id: selectedBar?.id }
        : { ...formInsumo, bar_id: selectedBar?.id };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await carregarInsumos();
        setModalInsumo(false);
        alert(`✅ Insumo ${insumoEdit ? 'atualizado' : 'cadastrado'} com sucesso!`);
      } else {
        const error = await response.json();
        alert(`❌ Erro: ${error.error || 'Erro ao salvar insumo'}`);
      }
    } catch (error) {
      console.error('Erro ao salvar insumo:', error);
      alert('❌ Erro ao salvar insumo');
    }
  };

  const excluirInsumo = async (insumo: Insumo) => {
    if (!confirm(`Deseja realmente desativar o insumo "${insumo.nome}"?`)) return;

    try {
      const response = await fetch('/api/operacional/receitas/insumos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: insumo.id,
          bar_id: selectedBar?.id,
          ativo: false,
        }),
      });

      if (response.ok) {
        await carregarInsumos();
        alert('✅ Insumo desativado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao excluir insumo:', error);
      alert('❌ Erro ao desativar insumo');
    }
  };

  // Funções para Receitas
  const abrirDetalhesReceita = (receita: ReceitaCompleta) => {
    setReceitaDetalhes(receita);
    setModalDetalhes(true);
  };

  const calcularCustoReceita = (receita: ReceitaCompleta): number => {
    if (!receita.insumos || receita.insumos.length === 0) return 0;
    
    return receita.insumos.reduce((total, insumoReceita) => {
      // Buscar o insumo na lista para pegar o custo
      const insumoEncontrado = insumos.find(i => 
        i.id === insumoReceita.id || 
        i.codigo === insumoReceita.codigo ||
        i.nome === insumoReceita.nome
      );
      
      if (!insumoEncontrado) return total;
      
      // Calcular custo baseado na quantidade e unidade
      const custo = insumoEncontrado.custo_unitario * insumoReceita.quantidade_necessaria;
      return total + custo;
    }, 0);
  };

  // Filtrar insumos
  const insumosFiltrados = insumos.filter((insumo) => {
    const matchSearch =
      insumosSearch === '' ||
      insumo.nome.toLowerCase().includes(insumosSearch.toLowerCase()) ||
      insumo.codigo.toLowerCase().includes(insumosSearch.toLowerCase());

    const matchFiltro =
      insumosFiltro === 'todos' || insumo.tipo_local === insumosFiltro;

    return matchSearch && matchFiltro;
  });

  // Filtrar receitas
  const receitasFiltradas = receitas.filter((receita) => {
    const matchSearch =
      receitasSearch === '' ||
      receita.receita_nome.toLowerCase().includes(receitasSearch.toLowerCase()) ||
      receita.receita_codigo.toLowerCase().includes(receitasSearch.toLowerCase());

    const matchFiltro =
      receitasFiltro === 'todos' || receita.tipo_local === receitasFiltro;

    return matchSearch && matchFiltro;
  });

  // Estatísticas
  const stats = {
    total_insumos: insumos.length,
    insumos_bar: insumos.filter((i) => i.tipo_local === 'bar').length,
    insumos_cozinha: insumos.filter((i) => i.tipo_local === 'cozinha').length,
    total_receitas: receitas.length,
    receitas_bar: receitas.filter((r) => r.tipo_local === 'bar').length,
    receitas_cozinha: receitas.filter((r) => r.tipo_local === 'cozinha').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingState
          title="Carregando produção e insumos..."
          subtitle="Processando receitas e insumos"
          icon={<Package className="w-4 h-4" />}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-400"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="insumos"
              className="data-[state=active]:bg-green-50 data-[state=active]:text-green-600 dark:data-[state=active]:bg-green-900/30 dark:data-[state=active]:text-green-400"
            >
              <Package className="w-4 h-4 mr-2" />
              Insumos ({stats.total_insumos})
            </TabsTrigger>
            <TabsTrigger
              value="receitas"
              className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-600 dark:data-[state=active]:bg-orange-900/30 dark:data-[state=active]:text-orange-400"
            >
              <ChefHat className="w-4 h-4 mr-2" />
              Receitas ({stats.total_receitas})
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-600 dark:data-[state=active]:bg-purple-900/30 dark:data-[state=active]:text-purple-400"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
            
            {/* Botão Terminal - Navega para página dedicada */}
            <button
              onClick={() => router.push('/ferramentas/terminal')}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <ChefHat className="w-4 h-4 mr-2" />
              Abrir Terminal de Produção
            </button>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card Total Insumos */}
              <Card className="card-dark">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Total de Insumos</CardTitle>
                    <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.total_insumos}
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Bar:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.insumos_bar}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Cozinha:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.insumos_cozinha}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card Total Receitas */}
              <Card className="card-dark">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Total de Receitas</CardTitle>
                    <ChefHat className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.total_receitas}
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Bar:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.receitas_bar}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Cozinha:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.receitas_cozinha}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card Ações Rápidas */}
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    onClick={() => abrirModalInsumo()}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <span className="flex flex-row items-center gap-2">
                      <Plus className="w-4 h-4" />
                      <span>Novo Insumo</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => setActiveTab('receitas')}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <span className="flex flex-row items-center gap-2">
                      <Plus className="w-4 h-4" />
                      <span>Nova Receita</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/ferramentas/terminal'}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <span className="flex flex-row items-center gap-2">
                      <ChefHat className="w-4 h-4" />
                      <span>Terminal de Produção</span>
                    </span>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Alerta se não houver dados */}
            {stats.total_insumos === 0 && (
              <Card className="card-dark border-orange-200 dark:border-orange-700">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                        Nenhum insumo cadastrado
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Para começar a usar o sistema de produção, primeiro cadastre os insumos que você utiliza na cozinha e no bar.
                      </p>
                      <Button
                        onClick={() => abrirModalInsumo()}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        Cadastrar Primeiro Insumo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Insumos Tab */}
          <TabsContent value="insumos" className="space-y-6">
            <Card className="card-dark">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Gestão de Insumos</CardTitle>
                    <CardDescription>
                      Cadastre e gerencie todos os insumos utilizados na produção
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => abrirModalInsumo()}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Insumo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filtros */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome ou código..."
                      value={insumosSearch}
                      onChange={(e) => setInsumosSearch(e.target.value)}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    />
                  </div>
                  <Select
                    value={insumosFiltro}
                    onValueChange={(value: any) => setInsumosFiltro(value)}
                  >
                    <SelectTrigger className="w-full md:w-48 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os locais</SelectItem>
                      <SelectItem value="bar">Apenas Bar</SelectItem>
                      <SelectItem value="cozinha">Apenas Cozinha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Lista de Insumos */}
                {insumosFiltrados.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {insumosSearch || insumosFiltro !== 'todos'
                        ? 'Nenhum insumo encontrado com os filtros aplicados'
                        : 'Nenhum insumo cadastrado ainda'}
                    </p>
                    {!insumosSearch && insumosFiltro === 'todos' && (
                      <Button
                        onClick={() => abrirModalInsumo()}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Cadastrar Primeiro Insumo
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {insumosFiltrados.map((insumo) => (
                      <Card
                        key={insumo.id}
                        className="card-dark hover:shadow-lg transition-shadow"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {insumo.codigo}
                                </Badge>
                                <Badge
                                  className={
                                    insumo.tipo_local === 'bar'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  }
                                >
                                  {insumo.tipo_local === 'bar' ? 'Bar' : 'Cozinha'}
                                </Badge>
                              </div>
                              <CardTitle className="text-base">{insumo.nome}</CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                Unidade:
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {insumo.unidade_medida}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                Custo Unit.:
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                R$ {insumo.custo_unitario.toFixed(2)}
                              </span>
                            </div>
                            {insumo.observacoes && (
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                {insumo.observacoes}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => abrirModalInsumo(insumo)}
                              size="sm"
                              variant="outline"
                              className="flex-1"
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              onClick={() => excluirInsumo(insumo)}
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Receitas Tab */}
          <TabsContent value="receitas" className="space-y-6">
            <Card className="card-dark">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Gestão de Receitas</CardTitle>
                    <CardDescription>
                      Crie e gerencie receitas com seus insumos
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => window.location.href = '/ferramentas/terminal'}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <ChefHat className="w-4 h-4 mr-2" />
                    Terminal de Produção
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filtros */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome ou código..."
                      value={receitasSearch}
                      onChange={(e) => setReceitasSearch(e.target.value)}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    />
                  </div>
                  <Select
                    value={receitasFiltro}
                    onValueChange={(value: any) => setReceitasFiltro(value)}
                  >
                    <SelectTrigger className="w-full md:w-48 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os locais</SelectItem>
                      <SelectItem value="bar">Apenas Bar</SelectItem>
                      <SelectItem value="cozinha">Apenas Cozinha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Lista de Receitas */}
                {receitasFiltradas.length === 0 ? (
                  <div className="text-center py-12">
                    <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {receitasSearch || receitasFiltro !== 'todos'
                        ? 'Nenhuma receita encontrada com os filtros aplicados'
                        : 'Nenhuma receita cadastrada ainda'}
                    </p>
                    {!receitasSearch && receitasFiltro === 'todos' && stats.total_insumos > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">
                          Use o Terminal de Produção para criar receitas
                        </p>
                        <Button
                          onClick={() => window.location.href = '/ferramentas/terminal'}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <ChefHat className="w-4 h-4 mr-2" />
                          Ir para Terminal de Produção
                        </Button>
                      </div>
                    )}
                    {stats.total_insumos === 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">
                          Você precisa cadastrar insumos antes de criar receitas
                        </p>
                        <Button
                          onClick={() => setActiveTab('insumos')}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Cadastrar Insumos
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {receitasFiltradas.map((receita) => (
                      <Card
                        key={receita.id || receita.receita_codigo}
                        className="card-dark hover:shadow-lg transition-shadow"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {receita.receita_codigo}
                                </Badge>
                                <Badge
                                  className={
                                    receita.tipo_local === 'bar'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  }
                                >
                                  {receita.tipo_local === 'bar' ? 'Bar' : 'Cozinha'}
                                </Badge>
                              </div>
                              <CardTitle className="text-base">
                                {receita.receita_nome}
                              </CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                Insumos:
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {receita.insumos_count || 0}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                Rendimento:
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {receita.rendimento_esperado}g
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                Custo Estimado:
                              </span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                R$ {calcularCustoReceita(receita).toFixed(2)}
                              </span>
                            </div>
                            {receita.receita_categoria && (
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                {receita.receita_categoria}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => abrirDetalhesReceita(receita)}
                              size="sm"
                              variant="outline"
                              className="flex-1"
                            >
                              <Search className="w-3 h-3 mr-1" />
                              Ver Detalhes
                            </Button>
                            <Button
                              onClick={() => window.location.href = '/ferramentas/terminal'}
                              size="sm"
                              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                            >
                              <ChefHat className="w-3 h-3 mr-1" />
                              Produzir
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Histórico Tab */}
          <TabsContent value="historico" className="space-y-6">
            <Card className="card-dark">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Histórico de Alterações</CardTitle>
                    <CardDescription>
                      Veja todas as alterações feitas nas fichas técnicas
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700">
                    {historico.length} registros
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Busca */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome ou código da receita..."
                      value={historicoSearch}
                      onChange={(e) => setHistoricoSearch(e.target.value)}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    />
                  </div>
                </div>

                {/* Lista de Histórico */}
                {historico.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Nenhuma alteração registrada
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historico
                      .filter(h => 
                        historicoSearch === '' ||
                        h.receita_nome?.toLowerCase().includes(historicoSearch.toLowerCase()) ||
                        h.receita_codigo?.toLowerCase().includes(historicoSearch.toLowerCase())
                      )
                      .map((item) => (
                        <Card key={item.id} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                          <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {item.receita_codigo}
                                  </Badge>
                                  <h3 className="font-semibold text-gray-900 dark:text-white">
                                    {item.receita_nome}
                                  </h3>
                                </div>
                                
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>
                                      {new Date(item.data_atualizacao).toLocaleDateString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                    {item.origem && (
                                      <>
                                        <span className="text-gray-400">•</span>
                                        <Badge variant="outline" className="text-xs">
                                          {item.origem === 'sheets' ? '📊 Google Sheets' : '👤 Manual'}
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {item.observacoes && (
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                      {item.observacoes}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col gap-2">
                                {item.receita_categoria && (
                                  <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                    {item.receita_categoria}
                                  </Badge>
                                )}
                                {item.versao && (
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {item.versao}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Detalhes da Receita */}
        <Dialog open={modalDetalhes} onOpenChange={setModalDetalhes}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="text-xs">
                  {receitaDetalhes?.receita_codigo}
                </Badge>
                <Badge
                  className={
                    receitaDetalhes?.tipo_local === 'bar'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }
                >
                  {receitaDetalhes?.tipo_local === 'bar' ? 'Bar' : 'Cozinha'}
                </Badge>
              </div>
              <DialogTitle className="text-gray-900 dark:text-white text-xl">
                {receitaDetalhes?.receita_nome}
              </DialogTitle>
              {receitaDetalhes?.receita_categoria && (
                <DialogDescription className="text-gray-600 dark:text-gray-400">
                  {receitaDetalhes.receita_categoria}
                </DialogDescription>
              )}
            </DialogHeader>

            {receitaDetalhes && (
              <div className="space-y-6">
                {/* Resumo da Receita */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="card-dark">
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Total de Insumos
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {receitaDetalhes.insumos?.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="card-dark">
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Rendimento
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {receitaDetalhes.rendimento_esperado}g
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="card-dark">
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Custo Total
                      </div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        R$ {calcularCustoReceita(receitaDetalhes).toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Lista de Insumos */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Insumos da Receita
                  </h3>
                  <div className="space-y-2">
                    {receitaDetalhes.insumos && receitaDetalhes.insumos.length > 0 ? (
                      receitaDetalhes.insumos.map((insumoReceita, index) => {
                        const insumoEncontrado = insumos.find(i => 
                          i.id === insumoReceita.id || 
                          i.codigo === insumoReceita.codigo ||
                          i.nome === insumoReceita.nome
                        );
                        const custoInsumo = insumoEncontrado 
                          ? insumoEncontrado.custo_unitario * insumoReceita.quantidade_necessaria
                          : 0;

                        return (
                          <Card
                            key={index}
                            className={`card-dark ${insumoReceita.is_chefe ? 'border-2 border-orange-400 dark:border-orange-600' : ''}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {insumoReceita.is_chefe && (
                                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs">
                                        Chefe
                                      </Badge>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-500">
                                      {insumoReceita.codigo}
                                    </span>
                                  </div>
                                  <div className="font-semibold text-gray-900 dark:text-white">
                                    {insumoReceita.nome}
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="font-bold text-gray-900 dark:text-white">
                                    {insumoReceita.quantidade_necessaria} {insumoReceita.unidade_medida}
                                  </div>
                                  <div className="text-sm text-green-600 dark:text-green-400">
                                    R$ {custoInsumo.toFixed(2)}
                                  </div>
                                  {insumoEncontrado && (
                                    <div className="text-xs text-gray-500 dark:text-gray-500">
                                      (R$ {insumoEncontrado.custo_unitario.toFixed(2)}/{insumoEncontrado.unidade_medida})
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-500">
                        Nenhum insumo cadastrado para esta receita
                      </div>
                    )}
                  </div>
                </div>

                {/* Análise de Custo */}
                <Card className="card-dark bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Custo por Grama
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          R$ {receitaDetalhes.rendimento_esperado > 0 
                            ? (calcularCustoReceita(receitaDetalhes) / receitaDetalhes.rendimento_esperado).toFixed(4)
                            : '0.0000'
                          }
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Custo por 100g
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          R$ {receitaDetalhes.rendimento_esperado > 0 
                            ? ((calcularCustoReceita(receitaDetalhes) / receitaDetalhes.rendimento_esperado) * 100).toFixed(2)
                            : '0.00'
                          }
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={() => setModalDetalhes(false)}
                variant="outline"
                className="mr-2"
              >
                <X className="w-4 h-4 mr-2" />
                Fechar
              </Button>
              <Button
                onClick={() => {
                  setModalDetalhes(false);
                  window.location.href = '/ferramentas/terminal';
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <ChefHat className="w-4 h-4 mr-2" />
                Produzir Receita
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Insumo */}
        <Dialog open={modalInsumo} onOpenChange={setModalInsumo}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">
                {insumoEdit ? 'Editar Insumo' : 'Novo Insumo'}
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                {insumoEdit
                  ? 'Atualize as informações do insumo'
                  : 'Preencha as informações do novo insumo'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo" className="text-gray-900 dark:text-white">
                  Código *
                </Label>
                <Input
                  id="codigo"
                  value={formInsumo.codigo}
                  onChange={(e) =>
                    setFormInsumo({ ...formInsumo, codigo: e.target.value })
                  }
                  placeholder="Ex: INS001"
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  disabled={!!insumoEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome" className="text-gray-900 dark:text-white">
                  Nome *
                </Label>
                <Input
                  id="nome"
                  value={formInsumo.nome}
                  onChange={(e) =>
                    setFormInsumo({ ...formInsumo, nome: e.target.value })
                  }
                  placeholder="Ex: Tomate"
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_local" className="text-gray-900 dark:text-white">
                  Local *
                </Label>
                <Select
                  value={formInsumo.tipo_local}
                  onValueChange={(value: 'bar' | 'cozinha') =>
                    setFormInsumo({ ...formInsumo, tipo_local: value })
                  }
                >
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cozinha">Cozinha</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria" className="text-gray-900 dark:text-white">
                  Categoria
                </Label>
                <Input
                  id="categoria"
                  value={formInsumo.categoria}
                  onChange={(e) =>
                    setFormInsumo({ ...formInsumo, categoria: e.target.value })
                  }
                  placeholder="Ex: Hortifruti"
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidade_medida" className="text-gray-900 dark:text-white">
                  Unidade de Medida *
                </Label>
                <Select
                  value={formInsumo.unidade_medida}
                  onValueChange={(value) =>
                    setFormInsumo({ ...formInsumo, unidade_medida: value })
                  }
                >
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">Gramas (g)</SelectItem>
                    <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                    <SelectItem value="ml">Mililitros (ml)</SelectItem>
                    <SelectItem value="l">Litros (l)</SelectItem>
                    <SelectItem value="unid">Unidade (unid)</SelectItem>
                    <SelectItem value="pct">Pacote (pct)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custo_unitario" className="text-gray-900 dark:text-white">
                  Custo Unitário (R$)
                </Label>
                <Input
                  id="custo_unitario"
                  type="number"
                  step="0.01"
                  value={formInsumo.custo_unitario}
                  onChange={(e) =>
                    setFormInsumo({
                      ...formInsumo,
                      custo_unitario: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observacoes" className="text-gray-900 dark:text-white">
                  Observações
                </Label>
                <Textarea
                  id="observacoes"
                  value={formInsumo.observacoes}
                  onChange={(e) =>
                    setFormInsumo({ ...formInsumo, observacoes: e.target.value })
                  }
                  placeholder="Informações adicionais sobre o insumo..."
                  rows={3}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setModalInsumo(false)}
                variant="outline"
                className="mr-2"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={salvarInsumo}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!formInsumo.codigo || !formInsumo.nome}
              >
                <Save className="w-4 h-4 mr-2" />
                {insumoEdit ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

