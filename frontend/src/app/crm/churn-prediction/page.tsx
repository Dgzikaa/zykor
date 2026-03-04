'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Minus,
  Activity,
  Filter,
  Download,
  RefreshCcw,
  Users,
  Flame,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBar } from '@/contexts/BarContext';

interface ClienteChurn {
  cliente_id: string;
  nome: string;
  telefone: string;
  ultima_visita: string;
  dias_sem_visitar: number;
  visitas_ultimos_30_dias: number;
  visitas_30_60_dias: number;
  valor_ultimos_30_dias: number;
  valor_30_60_dias: number;
  ticket_medio: number;
  total_visitas: number;
  total_gasto: number;
  tendencia_frequencia: 'crescente' | 'estavel' | 'decrescente';
  tendencia_valor: 'crescente' | 'estavel' | 'decrescente';
  score_churn: number;
  nivel_risco: 'baixo' | 'medio' | 'alto' | 'critico';
  acoes_sugeridas: string[];
}

interface Paginacao {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// Tooltips explicativos dos níveis de risco de churn
const CHURN_TOOLTIPS = {
  critico: {
    title: '🚨 Risco Crítico (Score 70-100)',
    description: 'URGENTE! Clientes que eram frequentes (2+ visitas) mas SUMIRAM há mais de 45 dias. Queda drástica na frequência e gastos. Ação imediata de reconquista necessária!'
  },
  alto: {
    title: '⚠️ Alto Risco (Score 50-69)',
    description: 'Clientes com sinais claros de abandono: não visitam há 30-45 dias, redução significativa na frequência ou gastos. Prioridade alta para reengajamento.'
  },
  medio: {
    title: '⚡ Risco Médio (Score 25-49)',
    description: 'Clientes com comportamento irregular: frequência ou gastos em queda moderada (25-50%). Oportunidade de intervenção preventiva antes de escalarem para alto risco.'
  },
  baixo: {
    title: '✅ Baixo Risco (Score 0-24)',
    description: 'Clientes estáveis ou em crescimento: visitam regularmente, mantêm ou aumentam gastos. Manter comunicação positiva e programa de fidelidade.'
  }
};

interface Stats {
  total_clientes: number;
  critico: number;
  alto: number;
  medio: number;
  baixo: number;
  score_medio: number;
  valor_total_em_risco?: number;
}

export default function ChurnPredictionPage() {
  const { selectedBar } = useBar();
  const [clientes, setClientes] = useState<ClienteChurn[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtroRisco, setFiltroRisco] = useState<string>('todos');
  const [paginacao, setPaginacao] = useState<Paginacao>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasMore: false
  });

  const fetchData = async (reset: boolean = true) => {
    if (reset) {
      setLoading(true);
      setClientes([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const page = reset ? 1 : paginacao.page + 1;
      const nivelParam = filtroRisco !== 'todos' ? `&nivel_risco=${filtroRisco}` : '';
      const url = `/api/crm/churn-prediction?page=${page}&limit=50${nivelParam}&bar_id=${selectedBar?.id}`;

      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        if (reset) {
          setClientes(result.data);
        } else {
          setClientes(prev => [...prev, ...result.data]);
        }
        setStats(result.stats);
        setPaginacao(result.paginacao);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const carregarMais = () => {
    if (!loadingMore && paginacao.hasMore) {
      fetchData(false);
    }
  };

  useEffect(() => {
    if (!selectedBar?.id) return;
    fetchData(true);
  }, [filtroRisco, selectedBar?.id]);

  const enviarWhatsApp = (telefone: string, nome: string) => {
    const mensagem = `Olá ${nome}! Sentimos sua falta aqui no bar! 🍺✨ Que tal dar uma passada?`;
    const url = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  const getNivelBadge = (nivel: string) => {
    switch (nivel) {
      case 'critico':
        return <Badge variant="outline" className="bg-muted text-foreground border-border">🚨 Crítico</Badge>;
      case 'alto':
        return <Badge variant="outline" className="bg-muted text-foreground border-border">⚠️ Alto Risco</Badge>;
      case 'medio':
        return <Badge variant="outline" className="bg-muted text-foreground border-border">⚡ Médio</Badge>;
      case 'baixo':
        return <Badge variant="outline" className="bg-muted text-foreground border-border">✅ Baixo</Badge>;
      default:
        return <Badge>-</Badge>;
    }
  };

  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'crescente':
        return <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'decrescente':
        return <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatarTelefone = (telefone: string) => {
    if (!telefone || telefone.length < 10) return telefone;
    // Formatar: (11) 99999-9999
    const ddd = telefone.substring(0, 2);
    const parte1 = telefone.substring(2, 7);
    const parte2 = telefone.substring(7);
    return `(${ddd}) ${parte1}-${parte2}`;
  };

  const exportarCSV = () => {
    const headers = ['Nome', 'Telefone', 'Nivel Risco', 'Score', 'Dias Sem Visitar', 'Ultima Visita', 'Visitas 30d', 'Total Visitas', 'Ticket Medio', 'Total Gasto', 'Acoes Sugeridas'];
    
    // Função para escapar campos CSV (evitar problemas com vírgulas e aspas)
    const escaparCSV = (valor: string | number) => {
      const str = String(valor);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Remover emojis das ações sugeridas para evitar problemas
    const removerEmojis = (texto: string) => {
      return texto.replace(/[\u{1F600}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F300}-\u{1F5FF}]/gu, '').trim();
    };

    const rows = clientes.map(c => [
      escaparCSV(c.nome),
      formatarTelefone(c.telefone),
      c.nivel_risco,
      c.score_churn,
      c.dias_sem_visitar,
      formatarData(c.ultima_visita),
      c.visitas_ultimos_30_dias,
      c.total_visitas,
      (c.ticket_medio || 0).toFixed(2).replace('.', ','),
      (c.total_gasto || 0).toFixed(2).replace('.', ','),
      escaparCSV(c.acoes_sugeridas.map(removerEmojis).join('; '))
    ]);

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    
    // Adicionar BOM UTF-8 para Excel reconhecer acentos corretamente
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `churn-prediction-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 py-4 max-w-[98vw]">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🤖 Predição de Churn com IA
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sistema inteligente de identificação de clientes em risco de abandono
          </p>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : stats ? (
          <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {/* Total Clientes */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Users className="w-4 h-4" />
                    Total Clientes
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total_clientes}</div>
                </CardContent>
              </Card>

              {/* Crítico */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                        <Flame className="w-4 h-4" />
                        Crítico
                      </div>
                      <div className="text-3xl font-bold text-foreground">{stats.critico}</div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">{CHURN_TOOLTIPS.critico.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{CHURN_TOOLTIPS.critico.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Alto Risco */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Alto Risco
                      </div>
                      <div className="text-3xl font-bold text-foreground">{stats.alto}</div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">{CHURN_TOOLTIPS.alto.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{CHURN_TOOLTIPS.alto.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Médio Risco */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        Médio Risco
                      </div>
                      <div className="text-3xl font-bold text-foreground">{stats.medio}</div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">{CHURN_TOOLTIPS.medio.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{CHURN_TOOLTIPS.medio.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Baixo Risco */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Baixo Risco
                      </div>
                      <div className="text-3xl font-bold text-foreground">{stats.baixo}</div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">{CHURN_TOOLTIPS.baixo.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{CHURN_TOOLTIPS.baixo.description}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        ) : null}

        {/* Ações Recomendadas por Nível */}
        {filtroRisco !== 'todos' && filtroRisco !== 'baixo' && (
          <Card className="bg-muted/40 border-border mb-4">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Ações Recomendadas para {filtroRisco === 'critico' ? 'Risco Crítico' : filtroRisco === 'alto' ? 'Alto Risco' : 'Risco Médio'}:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                {filtroRisco === 'critico' && (
                  <>
                    <span className="text-muted-foreground">🚨 Contato URGENTE via WhatsApp</span>
                    <span className="text-muted-foreground">💰 Cupom 20-30% de desconto</span>
                    <span className="text-muted-foreground">🎁 Convite VIP para evento especial</span>
                    <span className="text-muted-foreground">⭐ Tratamento prioritário</span>
                    <span className="text-muted-foreground">📞 Ligação de reativação</span>
                  </>
                )}
                {filtroRisco === 'alto' && (
                  <>
                    <span className="text-muted-foreground">📞 Contato esta semana</span>
                    <span className="text-muted-foreground">💳 Cupom 15% de desconto</span>
                    <span className="text-muted-foreground">📧 Campanha de reengajamento</span>
                    <span className="text-muted-foreground">🎯 Combo promocional</span>
                  </>
                )}
                {filtroRisco === 'medio' && (
                  <>
                    <span className="text-muted-foreground">📱 Mensagem personalizada</span>
                    <span className="text-muted-foreground">🎉 Convite para evento</span>
                    <span className="text-muted-foreground">💌 Newsletter semanal</span>
                    <span className="text-muted-foreground">🍽️ Novos produtos do cardápio</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros e Ações */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-4">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <Select value={filtroRisco} onValueChange={setFiltroRisco}>
                    <SelectTrigger className="w-[200px] bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder="Filtrar por risco" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Níveis</SelectItem>
                      <SelectItem value="critico">🚨 Crítico</SelectItem>
                      <SelectItem value="alto">⚠️ Alto Risco</SelectItem>
                      <SelectItem value="medio">⚡ Médio</SelectItem>
                      <SelectItem value="baixo">✅ Baixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => fetchData(true)}
                  variant="outline"
                  className="bg-white dark:bg-gray-700"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              <Button
                onClick={exportarCSV}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Clientes */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">
              Clientes em Risco ({clientes.length} de {paginacao.total})
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Ordenados por score de churn (maior risco primeiro) - Página {paginacao.page}/{paginacao.totalPages}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : clientes.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Nenhum cliente encontrado com este filtro
              </div>
            ) : (
              <div className="space-y-2">
                {clientes.map((cliente) => (
                  <div 
                    key={cliente.cliente_id}
                    className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    {/* WhatsApp Button - Ícone redondo pequeno */}
                    <button
                      onClick={() => enviarWhatsApp(cliente.telefone, cliente.nome)}
                      className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-colors"
                      title="Enviar WhatsApp"
                    >
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </button>

                    {/* Nome e Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {cliente.nome}
                        </h3>
                        {getNivelBadge(cliente.nivel_risco)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{cliente.total_visitas} visitas</span>
                        <span>•</span>
                        <span>R$ {cliente.total_gasto?.toFixed(0) || '0'} total</span>
                        <span>•</span>
                        <span>Ticket: R$ {cliente.ticket_medio?.toFixed(0) || '0'}</span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            cliente.score_churn >= 70 ? 'bg-red-500' :
                            cliente.score_churn >= 50 ? 'bg-orange-500' :
                            cliente.score_churn >= 25 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${cliente.score_churn}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white w-12 text-right">
                        {cliente.score_churn}%
                      </span>
                    </div>

                    {/* Métricas Compactas */}
                    <div className="hidden md:flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Dias</div>
                        <div className="font-semibold text-gray-900 dark:text-white">{cliente.dias_sem_visitar}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Última</div>
                        <div className="font-semibold text-gray-900 dark:text-white text-xs">{formatarData(cliente.ultima_visita)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          30d {getTendenciaIcon(cliente.tendencia_frequencia)}
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">{cliente.visitas_ultimos_30_dias}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Botão Carregar Mais */}
                {paginacao.hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={carregarMais}
                      disabled={loadingMore}
                      variant="outline"
                      className="px-8"
                    >
                      {loadingMore ? (
                        <>
                          <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          Carregar Mais ({paginacao.total - clientes.length} restantes)
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

