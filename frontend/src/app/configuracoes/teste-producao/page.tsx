'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  ChefHat, 
  Plus, 
  Clock, 
  Scale, 
  TrendingUp, 
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Save,
  RefreshCw,
  Eye,
  PlayCircle,
  StopCircle
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';

interface Receita {
  id: number;
  receita_codigo: string;
  receita_nome: string;
  receita_categoria: string;
  tipo_local: 'bar' | 'cozinha';
  rendimento_esperado: number;
  insumo_chefe_id?: number;
  insumo_chefe_nome?: string;
}

interface Producao {
  id?: number;
  bar_id: number;
  receita_codigo: string;
  receita_nome: string;
  receita_categoria: string;
  criado_por_nome: string;
  inicio_producao: string;
  fim_producao?: string;
  peso_bruto_proteina?: number;
  peso_limpo_proteina?: number;
  rendimento_real?: number;
  rendimento_esperado: number;
  percentual_aderencia_receita?: number;
  observacoes?: string;
  insumo_chefe_id?: number;
  insumo_chefe_nome?: string;
  peso_insumo_chefe?: number;
  status: 'em_andamento' | 'concluido' | 'cancelado';
}

export default function TesteProducaoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();

  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [receitasFiltradas, setReceitasFiltradas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'bar' | 'cozinha'>('todos');
  const [busca, setBusca] = useState('');

  // Modal de novo teste
  const [modalNovoTeste, setModalNovoTeste] = useState(false);
  const [receitaSelecionada, setReceitaSelecionada] = useState<Receita | null>(null);

  // Form de teste de produção
  const [formTeste, setFormTeste] = useState({
    peso_bruto_proteina: '',
    peso_limpo_proteina: '',
    rendimento_real: '',
    peso_insumo_chefe: '',
    observacoes: ''
  });

  // Timer
  const [testeIniciado, setTesteIniciado] = useState(false);
  const [horaInicio, setHoraInicio] = useState<Date | null>(null);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);

  // Produções em andamento e histórico
  const [producoesAtivas, setProducoesAtivas] = useState<Producao[]>([]);
  const [historicoProducoes, setHistoricoProducoes] = useState<Producao[]>([]);

  useEffect(() => {
    setPageTitle('🧪 Teste de Produção');
  }, [setPageTitle]);

  useEffect(() => {
    carregarReceitas();
    carregarProducoes();
  }, [selectedBar]);

  useEffect(() => {
    // Filtrar receitas
    let filtradas = receitas;

    if (filtroTipo !== 'todos') {
      filtradas = filtradas.filter(r => r.tipo_local === filtroTipo);
    }

    if (busca) {
      const buscaLower = busca.toLowerCase();
      filtradas = filtradas.filter(
        r => r.receita_nome.toLowerCase().includes(buscaLower) ||
             r.receita_codigo.toLowerCase().includes(buscaLower)
      );
    }

    setReceitasFiltradas(filtradas);
  }, [receitas, filtroTipo, busca]);

  useEffect(() => {
    // Timer para tempo decorrido
    if (testeIniciado && horaInicio) {
      const interval = setInterval(() => {
        const agora = new Date();
        const diff = Math.floor((agora.getTime() - horaInicio.getTime()) / 1000); // segundos
        setTempoDecorrido(diff);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [testeIniciado, horaInicio]);

  const carregarReceitas = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/operacional/receitas?bar_id=${selectedBar?.id}`);
      const result = await response.json();

      if (result.success) {
        setReceitas(result.receitas || []);
      }
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
      toast.error('Erro ao carregar receitas');
    } finally {
      setLoading(false);
    }
  };

  const carregarProducoes = async () => {
    try {
      const response = await fetch(`/api/operacional/receitas/producao?bar_id=${selectedBar?.id}`);
      const result = await response.json();

      if (result.success) {
        const producoes = result.data || [];
        setProducoesAtivas(producoes.filter((p: Producao) => p.status === 'em_andamento'));
        setHistoricoProducoes(producoes.filter((p: Producao) => p.status === 'concluido').slice(0, 10));
      }
    } catch (error) {
      console.error('Erro ao carregar produções:', error);
    }
  };

  const iniciarTeste = (receita: Receita) => {
    setReceitaSelecionada(receita);
    setFormTeste({
      peso_bruto_proteina: '',
      peso_limpo_proteina: '',
      rendimento_real: '',
      peso_insumo_chefe: '',
      observacoes: ''
    });
    setHoraInicio(new Date());
    setTesteIniciado(true);
    setTempoDecorrido(0);
    setModalNovoTeste(true);
  };

  const finalizarTeste = async () => {
    if (!receitaSelecionada || !user) {
      toast.error('Dados incompletos');
      return;
    }

    // Validações
    if (!formTeste.rendimento_real || parseFloat(formTeste.rendimento_real) <= 0) {
      toast.error('Informe o rendimento real obtido');
      return;
    }

    try {
      setSalvando(true);

      const rendimentoReal = parseFloat(formTeste.rendimento_real);
      const rendimentoEsperado = receitaSelecionada.rendimento_esperado;
      const percentualAderencia = (rendimentoReal / rendimentoEsperado) * 100;

      const producao: Partial<Producao> = {
        bar_id: selectedBar?.id,
        receita_codigo: receitaSelecionada.receita_codigo,
        receita_nome: receitaSelecionada.receita_nome,
        receita_categoria: receitaSelecionada.receita_categoria,
        criado_por_nome: user.nome || user.email,
        inicio_producao: horaInicio!.toISOString(),
        fim_producao: new Date().toISOString(),
        peso_bruto_proteina: formTeste.peso_bruto_proteina ? parseFloat(formTeste.peso_bruto_proteina) : undefined,
        peso_limpo_proteina: formTeste.peso_limpo_proteina ? parseFloat(formTeste.peso_limpo_proteina) : undefined,
        rendimento_real: rendimentoReal,
        rendimento_esperado: rendimentoEsperado,
        percentual_aderencia_receita: percentualAderencia,
        observacoes: formTeste.observacoes,
        insumo_chefe_id: receitaSelecionada.insumo_chefe_id,
        insumo_chefe_nome: receitaSelecionada.insumo_chefe_nome,
        peso_insumo_chefe: formTeste.peso_insumo_chefe ? parseFloat(formTeste.peso_insumo_chefe) : undefined,
        status: 'concluido'
      };

      const response = await fetch('/api/operacional/receitas/producao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(producao)
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Teste de produção registrado com sucesso!');
        setModalNovoTeste(false);
        setTesteIniciado(false);
        setHoraInicio(null);
        carregarProducoes();
      } else {
        toast.error(result.error || 'Erro ao salvar teste');
      }
    } catch (error) {
      console.error('Erro ao salvar teste:', error);
      toast.error('Erro ao salvar teste de produção');
    } finally {
      setSalvando(false);
    }
  };

  const cancelarTeste = () => {
    setModalNovoTeste(false);
    setTesteIniciado(false);
    setHoraInicio(null);
    setReceitaSelecionada(null);
  };

  const formatarTempo = (segundos: number) => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;

    if (horas > 0) {
      return `${horas}h ${minutos}min ${segs}s`;
    } else if (minutos > 0) {
      return `${minutos}min ${segs}s`;
    }
    return `${segs}s`;
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    return data.toLocaleString('pt-BR');
  };

  const getStatusBadge = (aderencia: number) => {
    if (aderencia >= 95 && aderencia <= 105) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">✅ Excelente</Badge>;
    } else if (aderencia >= 90 && aderencia < 95) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">👍 Bom</Badge>;
    } else if (aderencia >= 85 && aderencia < 90) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">⚠️ Atenção</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">❌ Revisar</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
              <ChefHat className="h-6 w-6 text-white" />
            </div>
            Teste de Produção
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm ml-11">
            Teste fichas técnicas em produção e registre rendimentos reais
          </p>
        </div>

        {/* Filtros */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Buscar Receita</Label>
                <Input
                  placeholder="Nome ou código..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Filtro por Local</Label>
                <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800">
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="cozinha">Cozinha</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{receitasFiltradas.length}</strong> receitas disponíveis
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Produções em Andamento */}
        {producoesAtivas.length > 0 && (
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-300 dark:border-orange-700 mb-6">
            <CardHeader>
              <CardTitle className="text-orange-900 dark:text-orange-100 flex items-center gap-2">
                <PlayCircle className="w-5 h-5" />
                Produções em Andamento ({producoesAtivas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {producoesAtivas.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700"
                >
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {prod.receita_nome}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Iniciado em {formatarData(prod.inicio_producao)} por {prod.criado_por_nome}
                    </div>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                    Em andamento
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lista de Receitas */}
        {loading ? (
          <LoadingState
            title="Carregando receitas..."
            subtitle="Preparando testes de produção"
            icon={<ChefHat className="w-4 h-4" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {receitasFiltradas.map((receita) => (
              <Card
                key={receita.id}
                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base text-gray-900 dark:text-white mb-1">
                        {receita.receita_nome}
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-400 text-sm">
                        {receita.receita_codigo} • {receita.receita_categoria}
                      </CardDescription>
                    </div>
                    <Badge className={receita.tipo_local === 'cozinha' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}>
                      {receita.tipo_local === 'cozinha' ? '🍳' : '🍹'} {receita.tipo_local}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Rendimento Esperado:
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {receita.rendimento_esperado}g
                      </span>
                    </div>

                    {receita.insumo_chefe_nome && (
                      <div className="flex items-center gap-2 text-sm">
                        <Scale className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">
                          Insumo Chefe: <strong>{receita.insumo_chefe_nome}</strong>
                        </span>
                      </div>
                    )}

                    <Button
                      onClick={() => iniciarTeste(receita)}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                    >
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Iniciar Teste
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {receitasFiltradas.length === 0 && !loading && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="text-center py-12">
              <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Nenhuma receita encontrada
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {busca ? 'Tente ajustar os filtros de busca' : 'Cadastre receitas para começar os testes'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Testes */}
        {historicoProducoes.length > 0 && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mt-6">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Últimos Testes Realizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {historicoProducoes.map((prod) => {
                  const aderencia = prod.percentual_aderencia_receita || 0;
                  const tempoProducao = prod.fim_producao && prod.inicio_producao
                    ? Math.floor((new Date(prod.fim_producao).getTime() - new Date(prod.inicio_producao).getTime()) / 1000)
                    : 0;

                  return (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white mb-1">
                          {prod.receita_nome}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                          <span>{formatarData(prod.inicio_producao)}</span>
                          <span>•</span>
                          <span>{prod.criado_por_nome}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatarTempo(tempoProducao)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Rendimento: {prod.rendimento_real}g / {prod.rendimento_esperado}g
                          </div>
                          <div className={`text-sm font-semibold flex items-center gap-1 justify-end ${
                            aderencia >= 95 ? 'text-green-600' : aderencia >= 85 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {aderencia >= 95 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {aderencia.toFixed(1)}%
                          </div>
                        </div>
                        {getStatusBadge(aderencia)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de Novo Teste */}
        <Dialog open={modalNovoTeste} onOpenChange={setModalNovoTeste}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <ChefHat className="w-5 h-5" />
                Teste de Produção: {receitaSelecionada?.receita_nome}
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Registre os dados reais da produção para comparar com a ficha técnica
              </DialogDescription>
            </DialogHeader>

            {/* Timer */}
            {testeIniciado && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Teste em andamento
                    </span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">
                    {formatarTempo(tempoDecorrido)}
                  </div>
                </div>
              </div>
            )}

            {/* Info da Receita */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Código:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                    {receitaSelecionada?.receita_codigo}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Categoria:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                    {receitaSelecionada?.receita_categoria}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Rendimento Esperado:</span>
                  <span className="ml-2 font-semibold text-purple-600 dark:text-purple-400">
                    {receitaSelecionada?.rendimento_esperado}g
                  </span>
                </div>
                {receitaSelecionada?.insumo_chefe_nome && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Insumo Chefe:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                      {receitaSelecionada.insumo_chefe_nome}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Formulário de Dados */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">
                    Peso Bruto Proteína (g)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1000"
                    value={formTeste.peso_bruto_proteina}
                    onChange={(e) => setFormTeste({ ...formTeste, peso_bruto_proteina: e.target.value })}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-gray-300">
                    Peso Limpo Proteína (g)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 850"
                    value={formTeste.peso_limpo_proteina}
                    onChange={(e) => setFormTeste({ ...formTeste, peso_limpo_proteina: e.target.value })}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {receitaSelecionada?.insumo_chefe_nome && (
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">
                    Peso do Insumo Chefe: {receitaSelecionada.insumo_chefe_nome} (g)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 500"
                    value={formTeste.peso_insumo_chefe}
                    onChange={(e) => setFormTeste({ ...formTeste, peso_insumo_chefe: e.target.value })}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <Label className="text-gray-700 dark:text-gray-300">
                  Rendimento Real Obtido (g) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Esperado: ${receitaSelecionada?.rendimento_esperado}g`}
                  value={formTeste.rendimento_real}
                  onChange={(e) => setFormTeste({ ...formTeste, rendimento_real: e.target.value })}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  required
                />
                {formTeste.rendimento_real && receitaSelecionada && (
                  <div className="mt-2">
                    <div className={`text-sm font-semibold ${
                      parseFloat(formTeste.rendimento_real) >= receitaSelecionada.rendimento_esperado * 0.95
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      Aderência: {((parseFloat(formTeste.rendimento_real) / receitaSelecionada.rendimento_esperado) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-gray-700 dark:text-gray-300">
                  Observações
                </Label>
                <Textarea
                  placeholder="Registre observações sobre o teste (opcional)"
                  value={formTeste.observacoes}
                  onChange={(e) => setFormTeste({ ...formTeste, observacoes: e.target.value })}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                onClick={cancelarTeste}
                variant="outline"
                disabled={salvando}
                className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
              >
                <StopCircle className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={finalizarTeste}
                disabled={salvando || !formTeste.rendimento_real}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
              >
                {salvando ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Finalizar Teste
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

