'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Filter,
  Search,
  AlertCircle,
  ZapOff,
  BarChart3,
  Calendar,
  Package,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';

interface Anomalia {
  id: number;
  insumo_codigo: string;
  insumo_nome: string;
  data_contagem: string;
  estoque_final: number;
  estoque_inicial: number;
  contagem_anomala: boolean;
  tipo_anomalia: string[];
  score_anomalia: number;
  motivo_anomalia: string;
  custo_unitario: number;
}

interface Stats {
  total: number;
  por_tipo: Record<string, number>;
  por_gravidade: {
    critica: number;
    alta: number;
    media: number;
    baixa: number;
  };
}

const TIPO_LABELS: Record<string, string> = {
  'valor_muito_alto': '📈 Valor Muito Alto',
  'valor_muito_baixo': '📉 Valor Muito Baixo',
  'variacao_brusca_alta': '⬆️ Aumento Brusco',
  'variacao_brusca_baixa': '⬇️ Queda Brusca',
  'valor_repetido': '🔁 Valor Repetido',
  'estoque_zerado': '🚫 Estoque Zerado',
  'digitacao_suspeita': '⚠️ Digitação Suspeita',
  'estoque_branco': '📝 Não Registrado'
};

export default function AnomaliasContagemPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [anomalias, setAnomalias] = useState<Anomalia[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectando, setDetectando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [minScore, setMinScore] = useState(30);

  useEffect(() => {
    setPageTitle('🔍 Anomalias de Contagem');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    buscarAnomalias();
  }, [minScore, filtroTipo]);

  const buscarAnomalias = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        min_score: minScore.toString(),
        limit: '100'
      });
      
      if (filtroTipo) {
        params.append('tipo', filtroTipo);
      }
      
      const response = await fetch(`/api/ferramentas/contagem-estoque/anomalias?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setAnomalias(result.data || []);
        setStats(result.stats);
      } else {
        toast.error('Erro ao buscar anomalias');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao buscar anomalias');
    } finally {
      setLoading(false);
    }
  };

  const executarDeteccao = async () => {
    setDetectando(true);
    try {
      toast.loading('Detectando anomalias...', { id: 'detecting' });
      
      const response = await fetch('/api/ferramentas/contagem-estoque/anomalias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar?.id,
          data_inicio: null, // últimos 90 dias
          data_fim: null
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Detecção concluída!', { 
          id: 'detecting',
          description: `${result.resultado.total_anomalias} anomalias encontradas em ${result.resultado.total_processados} registros`
        });
        buscarAnomalias();
      } else {
        toast.error('Erro na detecção', { id: 'detecting' });
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao executar detecção', { id: 'detecting' });
    } finally {
      setDetectando(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
    if (score >= 30) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'CRÍTICO';
    if (score >= 50) return 'ALTO';
    if (score >= 30) return 'MÉDIO';
    return 'BAIXO';
  };

  const anomaliasFiltradas = anomalias.filter(a => {
    if (busca) {
      const buscaLower = busca.toLowerCase();
      return (
        a.insumo_nome.toLowerCase().includes(buscaLower) ||
        a.insumo_codigo.toLowerCase().includes(buscaLower)
      );
    }
    return true;
  });

  const formatarData = (data: string) => {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="card-dark p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="card-title-dark mb-2">🔍 Detecção de Anomalias</h1>
              <p className="card-description-dark">
                Sistema inteligente de detecção de valores anormais nas contagens
              </p>
            </div>
            <Button
              onClick={executarDeteccao}
              disabled={detectando}
              className="btn-primary-dark"
            >
              {detectando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Detectando...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  Executar Detecção
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="card-dark">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total de Anomalias</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {stats.total}
                    </p>
                  </div>
                  <AlertTriangle className="w-12 h-12 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Críticas</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                      {stats.por_gravidade.critica}
                    </p>
                  </div>
                  <AlertCircle className="w-12 h-12 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Alta Gravidade</p>
                    <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                      {stats.por_gravidade.alta}
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Média Gravidade</p>
                    <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                      {stats.por_gravidade.media}
                    </p>
                  </div>
                  <BarChart3 className="w-12 h-12 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card className="card-dark mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por insumo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="input-dark pl-10"
                />
              </div>

              <div>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="input-dark w-full"
                >
                  <option value="">Todos os tipos</option>
                  {Object.entries(TIPO_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={minScore}
                  onChange={(e) => setMinScore(parseInt(e.target.value))}
                  className="input-dark w-full"
                >
                  <option value="0">Todas as gravidades</option>
                  <option value="30">Média ou maior (≥30)</option>
                  <option value="50">Alta ou maior (≥50)</option>
                  <option value="70">Apenas críticas (≥70)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Anomalias */}
        <Card className="card-dark">
          <CardHeader>
            <CardTitle className="card-title-dark flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Anomalias Detectadas
            </CardTitle>
            <CardDescription className="card-description-dark">
              {anomaliasFiltradas.length} anomalia{anomaliasFiltradas.length !== 1 ? 's' : ''} encontrada{anomaliasFiltradas.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">Carregando anomalias...</p>
              </div>
            ) : anomaliasFiltradas.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">Nenhuma anomalia encontrada</p>
              </div>
            ) : (
              <div className="space-y-4">
                {anomaliasFiltradas.map((anomalia) => (
                  <div
                    key={anomalia.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      anomalia.score_anomalia >= 70
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : anomalia.score_anomalia >= 50
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : anomalia.score_anomalia >= 30
                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {anomalia.insumo_nome}
                          </h4>
                          <Badge className="badge-secondary text-xs">
                            {anomalia.insumo_codigo}
                          </Badge>
                          <Badge className={`text-xs font-bold ${getScoreColor(anomalia.score_anomalia)}`}>
                            {getScoreLabel(anomalia.score_anomalia)} ({anomalia.score_anomalia})
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatarData(anomalia.data_contagem)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            Estoque: {anomalia.estoque_final}
                          </div>
                          {anomalia.estoque_inicial !== null && (
                            <div className="flex items-center gap-1">
                              {anomalia.estoque_final > anomalia.estoque_inicial ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              )}
                              Anterior: {anomalia.estoque_inicial}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-2">
                          {anomalia.tipo_anomalia?.map((tipo, idx) => (
                            <Badge key={idx} className="badge-warning text-xs">
                              {TIPO_LABELS[tipo] || tipo}
                            </Badge>
                          ))}
                        </div>

                        <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                          {anomalia.motivo_anomalia}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

