'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useRouter } from 'next/navigation';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  Target, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { IndicadorCard } from '@/components/visao-geral/IndicadorCard';
import { IndicadorRetencao } from '@/components/visao-geral/IndicadorRetencao';
import { 
  ModernPageLayout, 
  ModernCard, 
  ModernGrid, 
  ModernStat 
} from '@/components/layouts/ModernPageLayout';
// Toast já importado via useToast acima
import { usePushNotifications } from '@/lib/push-notifications';
import { useBackgroundSync } from '@/lib/background-sync';
import { useBadgeAPI } from '@/lib/badge-api';
import { AnimatedCounter, HoverMotion } from '@/components/ui/motion-wrapper';

interface IndicadoresAnuais {
  faturamento: {
    valor: number;
    meta: number;
    detalhes?: Record<string, number>;
  };
  pessoas: {
    valor: number;
    meta: number;
    detalhes?: Record<string, number>;
  };
  reputacao: {
    valor: number;
    meta: number;
  };
  ebitda: {
    valor: number;
    meta: number;
  };
}

interface IndicadoresTrimestrais {
  clientesAtivos: {
    valor: number;
    meta: number;
  };
  clientesTotais: {
    valor: number;
    meta: number;
  };
  retencao: {
    valor: number;
    meta: number;
  };
  cmvLimpo: {
    valor: number;
    meta: number;
  };
  cmo: {
    valor: number;
    meta: number;
  };
  artistica: {
    valor: number;
    meta: number;
  };
}

export default function VisaoGeralPage() {
  const { setPageTitle } = usePageTitle();
  const router = useRouter();
  const { selectedBar } = useBar();
  const toast = useToast();
  const pushNotifications = usePushNotifications();
  const backgroundSync = useBackgroundSync();
  const badgeAPI = useBadgeAPI();

  // Redirecionar para nova estrutura apenas uma vez
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/estrategico/visao-geral');
    }, 100); // Delay para evitar loops
    
    return () => clearTimeout(timer);
  }, [router]);

  const [indicadoresAnuais, setIndicadoresAnuais] = useState<IndicadoresAnuais | null>(null);
  const [indicadoresTrimestrais, setIndicadoresTrimestrais] = useState<IndicadoresTrimestrais | null>(null);
  const [loading, setLoading] = useState(true);
  const [trimestreAtual, setTrimestreAtual] = useState(3); // 2º, 3º ou 4º trimestre
  const [anualExpanded, setAnualExpanded] = useState(true);
  const [trimestralExpanded, setTrimestralExpanded] = useState(true);


  useEffect(() => {
    setPageTitle('📊 Visão Geral');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Informações dos trimestres
  const getTrimestreInfo = (trimestre: number) => {
    const info = {
      2: { nome: '2º Trimestre 2025 (Abr-Jun)', periodo: 'abril-junho' },
      3: { nome: '3º Trimestre 2025 (Jul-Set)', periodo: 'julho-setembro' },
      4: { nome: '4º Trimestre 2025 (Out-Dez)', periodo: 'outubro-dezembro' }
    };
    return info[trimestre as keyof typeof info];
  };

  // Navegação entre trimestres
  const navegarTrimestre = (direcao: 'anterior' | 'proximo') => {
    if (direcao === 'anterior' && trimestreAtual > 2) {
      setTrimestreAtual(trimestreAtual - 1);
    } else if (direcao === 'proximo' && trimestreAtual < 4) {
      setTrimestreAtual(trimestreAtual + 1);
    }
  };

  const carregarIndicadores = useCallback(async () => {
    if (!selectedBar?.id) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`/api/visao-geral/indicadores?barId=${selectedBar.id}&trimestre=${trimestreAtual}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setIndicadoresAnuais(data.data.anual);
        setIndicadoresTrimestrais(data.data.trimestral);
      } else {
        toast.toast({
          title: 'Erro',
          description: data.error || 'Erro ao carregar indicadores',
          variant: 'destructive'
        });
      }
    } catch (error) {
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Erro ao carregar indicadores:', error);
      }
      
      toast.toast({
        title: 'Erro',
        description: 'Não foi possível carregar os indicadores',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, trimestreAtual, toast]);

  useEffect(() => {
    carregarIndicadores();
  }, [carregarIndicadores]);



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Visão Geral</h1>
            <p className="text-gray-600 dark:text-gray-400">Resumo executivo do bar</p>
          </div>
        </div>

        {/* Indicadores Anuais */}
        <div className="card-dark p-4">
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => setAnualExpanded(!anualExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setAnualExpanded(!anualExpanded);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Visão Geral • Performance Anual</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Dashboard executivo • Performance estratégica desde abertura</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
            >
              {anualExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {anualExpanded && (
            <>
              {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i} className="bg-gray-50 dark:bg-gray-900">
                      <CardHeader className="pb-2">
                        <Skeleton className="h-4 w-20" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-6 w-24 mb-2" />
                        <Skeleton className="h-2 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : indicadoresAnuais ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <IndicadorCard
                    titulo="Faturamento 2025"
                    valor={indicadoresAnuais.faturamento.valor}
                    meta={indicadoresAnuais.faturamento.meta}
                    formato="moeda"
                    cor="green"
                    detalhes={indicadoresAnuais.faturamento.detalhes}
                  />
                  
                  <IndicadorCard
                    titulo="Pessoas"
                    valor={indicadoresAnuais.pessoas.valor}
                    meta={indicadoresAnuais.pessoas.meta}
                    formato="numero"
                    cor="blue"
                    detalhes={indicadoresAnuais.pessoas.detalhes}
                  />
                  
                  <IndicadorCard
                    titulo="Reputação"
                    valor={indicadoresAnuais.reputacao.valor}
                    meta={indicadoresAnuais.reputacao.meta}
                    formato="decimal"
                    cor="purple"
                    sufixo=" ⭐"
                  />
                  
                  <IndicadorCard
                    titulo="EBITDA 2025"
                    valor={indicadoresAnuais.ebitda.valor}
                    meta={indicadoresAnuais.ebitda.meta}
                    formato="moeda"
                    cor="yellow"
                  />
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-600 dark:text-gray-400">Erro ao carregar indicadores anuais</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Indicadores Trimestrais */}
        <div className="card-dark p-4">
          <div className="flex items-center justify-between mb-4">
            <div 
              className="flex items-center gap-3 cursor-pointer flex-1"
              onClick={() => setTrimestralExpanded(!trimestralExpanded)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setTrimestralExpanded(!trimestralExpanded);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{getTrimestreInfo(trimestreAtual)?.nome}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Performance operacional</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Navegação de Trimestres */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navegarTrimestre('anterior');
                  }}
                  disabled={trimestreAtual <= 2}
                  className="p-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px] text-center">
                  {trimestreAtual}º Tri
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navegarTrimestre('proximo');
                  }}
                  disabled={trimestreAtual >= 4}
                  className="p-2"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Botão Expandir/Colapsar */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTrimestralExpanded(!trimestralExpanded)}
                className="p-2"
              >
                {trimestralExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          
          {trimestralExpanded && (
            <>
              {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="bg-gray-50 dark:bg-gray-900">
                      <CardHeader className="pb-2">
                        <Skeleton className="h-4 w-20" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-6 w-24 mb-2" />
                        <Skeleton className="h-2 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : indicadoresTrimestrais ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <IndicadorCard
                    titulo="Clientes Ativos (90d)"
                    valor={indicadoresTrimestrais.clientesAtivos.valor}
                    meta={indicadoresTrimestrais.clientesAtivos.meta}
                    formato="numero"
                    cor="green"
                    periodoAnalisado="Últimos 90 dias (2+ visitas)"
                  />
                  
                  <IndicadorCard
                    titulo="Clientes Totais"
                    valor={indicadoresTrimestrais.clientesTotais.valor}
                    meta={indicadoresTrimestrais.clientesTotais.meta}
                    formato="numero"
                    cor="blue"
                    periodoAnalisado={`${getTrimestreInfo(trimestreAtual)?.periodo} 2025`}
                  />
                  
                  <IndicadorRetencao
                    meta={indicadoresTrimestrais?.retencao?.meta || 10}
                  />
                  
                  <IndicadorCard
                    titulo="CMV Limpo"
                    valor={indicadoresTrimestrais.cmvLimpo.valor}
                    meta={indicadoresTrimestrais.cmvLimpo.meta}
                    formato="percentual"
                    cor="yellow"
                    inverterProgresso={true}
                  />
                  
                  <IndicadorCard
                    titulo="CMO"
                    valor={indicadoresTrimestrais.cmo.valor}
                    meta={indicadoresTrimestrais.cmo.meta}
                    formato="percentual"
                    cor="orange"
                    inverterProgresso={true}
                  />
                  
                  <IndicadorCard
                    titulo="% Artística"
                    valor={indicadoresTrimestrais.artistica.valor}
                    meta={indicadoresTrimestrais.artistica.meta}
                    formato="percentual"
                    cor="pink"
                    inverterProgresso={true}
                  />
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-600 dark:text-gray-400">Erro ao carregar indicadores trimestrais</p>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>
  );
} 