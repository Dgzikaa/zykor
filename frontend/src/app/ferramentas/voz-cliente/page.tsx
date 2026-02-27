'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  RefreshCw,
  MessageCircle,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface Feedback {
  id: number;
  bar_id: number;
  data_feedback: string;
  semana: number;
  dia_semana: string;
  feedback: string;
  tom: 'Positivo' | 'Negativo' | 'Sugestão' | 'Neutro';
  categoria: string;
  fonte: string;
  criticidade: string;
  responsavel: string;
  status: string;
}

interface Estatisticas {
  total: number;
  positivos: number;
  negativos: number;
  sugestoes: number;
  categorias: Record<string, number>;
}

interface ResumoSemana {
  semana: number;
  positivos: number;
  negativos: number;
  sugestoes: number;
  total: number;
}

export default function VozClientePage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [resumoPorSemana, setResumoPorSemana] = useState<ResumoSemana[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('feedbacks');
  
  // Filtros
  const [filtroTom, setFiltroTom] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroSemana, setFiltroSemana] = useState('');
  const [dataInicio, setDataInicio] = useState(() => {
    const data = new Date();
    data.setDate(data.getDate() - 14); // Últimas 2 semanas
    return data.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setPageTitle('💬 Voz do Cliente');
  }, [setPageTitle]);

  const buscarFeedbacks = useCallback(async () => {
    if (!selectedBar?.id) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: selectedBar.id.toString(),
        data_inicio: dataInicio,
        data_fim: dataFim
      });

      if (filtroTom !== 'todos') params.append('tom', filtroTom);
      if (filtroCategoria !== 'todas') params.append('categoria', filtroCategoria);
      if (filtroSemana) params.append('semana', filtroSemana);

      const response = await fetch(`/api/ferramentas/voz-cliente?${params}`);
      const result = await response.json();

      if (result.success) {
        setFeedbacks(result.data);
        setEstatisticas(result.estatisticas);
      } else {
        toast.error('Erro ao buscar feedbacks');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [selectedBar, dataInicio, dataFim, filtroTom, filtroCategoria, filtroSemana]);

  const buscarResumo = useCallback(async () => {
    if (!selectedBar?.id) return;
    
    try {
      const response = await fetch('/api/ferramentas/voz-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          ano: new Date().getFullYear()
        })
      });
      const result = await response.json();

      if (result.success) {
        setResumoPorSemana(result.resumo);
      }
    } catch (error) {
      console.error('Erro ao buscar resumo:', error);
    }
  }, [selectedBar]);

  useEffect(() => {
    if (selectedBar?.id) {
      buscarFeedbacks();
      buscarResumo();
    }
  }, [selectedBar, buscarFeedbacks, buscarResumo]);

  const getTomIcon = (tom: string) => {
    switch (tom) {
      case 'Positivo':
        return <ThumbsUp className="h-4 w-4 text-green-500" />;
      case 'Negativo':
        return <ThumbsDown className="h-4 w-4 text-red-500" />;
      case 'Sugestão':
        return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      default:
        return <MessageCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTomBadge = (tom: string) => {
    switch (tom) {
      case 'Positivo':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{tom}</Badge>;
      case 'Negativo':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{tom}</Badge>;
      case 'Sugestão':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">{tom}</Badge>;
      default:
        return <Badge variant="secondary">{tom}</Badge>;
    }
  };

  const categorias = estatisticas?.categorias 
    ? Object.keys(estatisticas.categorias).sort()
    : [];

  // Função para calcular semana da última terça
  const getUltimaTerca = () => {
    const hoje = new Date();
    const diaSemana = hoje.getDay(); // 0 = Domingo, 2 = Terça
    const diasAteUltimaTerca = diaSemana >= 2 ? diaSemana - 2 : 5 + diaSemana;
    const ultimaTerca = new Date(hoje);
    ultimaTerca.setDate(hoje.getDate() - diasAteUltimaTerca);
    return ultimaTerca.toISOString().split('T')[0];
  };

  // Função para filtrar última semana (para reunião de terça)
  const filtrarUltimaSemana = () => {
    const ultimaTerca = getUltimaTerca();
    const seteDiasAntes = new Date(ultimaTerca);
    seteDiasAntes.setDate(seteDiasAntes.getDate() - 7);
    
    setDataInicio(seteDiasAntes.toISOString().split('T')[0]);
    setDataFim(ultimaTerca);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Voz do Cliente</h1>
          <p className="text-muted-foreground">
            Feedbacks positivos, negativos e sugestões dos clientes
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={filtrarUltimaSemana}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Reunião de Terça
          </Button>
          <Button onClick={buscarFeedbacks} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <MessageCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{estatisticas.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <ThumbsUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{estatisticas.positivos}</p>
                  <p className="text-sm text-muted-foreground">Positivos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <ThumbsDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{estatisticas.negativos}</p>
                  <p className="text-sm text-muted-foreground">Negativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{estatisticas.sugestoes}</p>
                  <p className="text-sm text-muted-foreground">Sugestões</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
          <TabsTrigger value="resumo">Resumo por Semana</TabsTrigger>
        </TabsList>

        <TabsContent value="feedbacks" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Tom</Label>
                  <Select value={filtroTom} onValueChange={setFiltroTom}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Positivo">Positivo</SelectItem>
                      <SelectItem value="Negativo">Negativo</SelectItem>
                      <SelectItem value="Sugestão">Sugestão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {categorias.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={buscarFeedbacks} className="w-full">
                    Buscar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de feedbacks */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <LoadingState 
                  title="Carregando feedbacks..."
                  subtitle="Processando voz do cliente"
                  icon={<MessageCircle className="w-4 h-4" />}
                />
              ) : feedbacks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
                  <p>Nenhum feedback encontrado</p>
                </div>
              ) : (
                <div className="divide-y">
                  {feedbacks.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getTomIcon(item.tom)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {getTomBadge(item.tom)}
                            {item.categoria && (
                              <Badge variant="outline">{item.categoria}</Badge>
                            )}
                            {item.criticidade && (
                              <Badge variant="secondary" className="text-xs">
                                {item.criticidade}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{item.feedback}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(item.data_feedback).toLocaleDateString('pt-BR')}
                            </span>
                            {item.dia_semana && (
                              <span>{item.dia_semana}</span>
                            )}
                            {item.semana && (
                              <span>Semana {item.semana}</span>
                            )}
                            {item.fonte && (
                              <span>Fonte: {item.fonte}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resumo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumo por Semana ({new Date().getFullYear()})</CardTitle>
            </CardHeader>
            <CardContent>
              {resumoPorSemana.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado disponível
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                    <div>Semana</div>
                    <div className="text-center">Total</div>
                    <div className="text-center text-green-600">Positivos</div>
                    <div className="text-center text-red-600">Negativos</div>
                    <div className="text-center text-yellow-600">Sugestões</div>
                  </div>
                  {resumoPorSemana.map((semana) => (
                    <div 
                      key={semana.semana} 
                      className="grid grid-cols-5 gap-4 py-2 hover:bg-muted/50 rounded cursor-pointer transition-colors"
                      onClick={() => {
                        setFiltroSemana(semana.semana.toString());
                        setTab('feedbacks');
                        buscarFeedbacks();
                      }}
                    >
                      <div className="font-medium">S{semana.semana}</div>
                      <div className="text-center">{semana.total}</div>
                      <div className="text-center text-green-600 font-medium">{semana.positivos}</div>
                      <div className="text-center text-red-600 font-medium">{semana.negativos}</div>
                      <div className="text-center text-yellow-600 font-medium">{semana.sugestoes}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de proporção */}
          <Card>
            <CardHeader>
              <CardTitle>Proporção de Feedbacks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {resumoPorSemana.slice(0, 8).map((semana) => {
                  const total = semana.total || 1;
                  const posPercent = (semana.positivos / total) * 100;
                  const negPercent = (semana.negativos / total) * 100;
                  const sugPercent = (semana.sugestoes / total) * 100;
                  
                  return (
                    <div key={semana.semana} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Semana {semana.semana}</span>
                        <span className="text-muted-foreground">{semana.total} feedbacks</span>
                      </div>
                      <div className="flex h-4 rounded-full overflow-hidden bg-muted">
                        <div 
                          className="bg-green-500 transition-all" 
                          style={{ width: `${posPercent}%` }}
                          title={`${semana.positivos} positivos`}
                        />
                        <div 
                          className="bg-red-500 transition-all" 
                          style={{ width: `${negPercent}%` }}
                          title={`${semana.negativos} negativos`}
                        />
                        <div 
                          className="bg-yellow-500 transition-all" 
                          style={{ width: `${sugPercent}%` }}
                          title={`${semana.sugestoes} sugestões`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
