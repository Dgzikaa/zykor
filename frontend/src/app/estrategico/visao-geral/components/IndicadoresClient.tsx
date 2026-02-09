'use client';

import { useState, useMemo } from 'react';
import { useBar } from '@/contexts/BarContext';
import { IndicadorCard } from '@/components/visao-geral/IndicadorCard';
import { IndicadorRetencao } from '@/components/visao-geral/IndicadorRetencao';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown,
  Target,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  Wallet,
  Palette,
  Activity,
  Edit3,
  Save,
  X,
  Star,
  DollarSign,
  ClipboardList,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

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
    variacao?: number;
  };
  clientesTotais: {
    valor: number;
    meta: number;
    variacao?: number;
  };
  retencao: {
    valor: number;
    meta: number;
    variacao?: number;
  };
  retencaoReal: {
    valor: number;
    meta: number;
    variacao?: number;
  };
  cmvLimpo: {
    valor: number;
    meta: number;
    variacao?: number;
  };
  cmo: {
    valor: number;
    meta: number;
    variacao?: number;
  };
  artistica: {
    valor: number;
    meta: number;
    variacao?: number;
  };
}

interface IndicadoresClientProps {
  indicadoresAnuais: IndicadoresAnuais | null;
  indicadoresTrimestrais: IndicadoresTrimestrais | null;
  trimestreAtual: number;
}

export function IndicadoresClient({ 
  indicadoresAnuais, 
  indicadoresTrimestrais, 
  trimestreAtual 
}: IndicadoresClientProps) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const router = useRouter();

  // Estado local para UI
  const [anualExpanded, setAnualExpanded] = useState(true);
  const [trimestralExpanded, setTrimestralExpanded] = useState(true);
  const [modalCMVAberto, setModalCMVAberto] = useState(false);
  const [cmvPercentual, setCmvPercentual] = useState('');
  const [salvandoCMV, setSalvandoCMV] = useState(false);

  // Informações dos trimestres
  const anoAtual = new Date().getFullYear();
  const getTrimestreInfo = (trimestre: number) => {
    const info = {
      1: { nome: `1º Trimestre ${anoAtual} (Jan-Mar)`, periodo: 'janeiro-março' },
      2: { nome: `2º Trimestre ${anoAtual} (Abr-Jun)`, periodo: 'abril-junho' },
      3: { nome: `3º Trimestre ${anoAtual} (Jul-Set)`, periodo: 'julho-setembro' },
      4: { nome: `4º Trimestre ${anoAtual} (Out-Dez)`, periodo: 'outubro-dezembro' }
    };
    return info[trimestre as keyof typeof info];
  };

  const trimestreInfo = getTrimestreInfo(trimestreAtual);

  // Navegação entre trimestres via URL
  const navegarTrimestre = (direcao: 'anterior' | 'proximo') => {
    let novoTrimestre = trimestreAtual;
    if (direcao === 'anterior' && trimestreAtual > 1) {
      novoTrimestre = trimestreAtual - 1;
    } else if (direcao === 'proximo' && trimestreAtual < 4) {
      novoTrimestre = trimestreAtual + 1;
    }
    
    if (novoTrimestre !== trimestreAtual) {
      router.push(`?trimestre=${novoTrimestre}`);
    }
  };

  const salvarCMV = async () => {
    if (!selectedBar?.id || !cmvPercentual) {
      toast({
        title: 'Erro',
        description: 'Preencha o valor do CMV',
        variant: 'destructive'
      });
      return;
    }

    setSalvandoCMV(true);
    try {
      const ano = new Date().getFullYear();
      const trimestresDatas: Record<number, { inicio: string; fim: string }> = {
        2: { inicio: `${ano}-04-01`, fim: `${ano}-06-30` },
        3: { inicio: `${ano}-07-01`, fim: `${ano}-09-30` },
        4: { inicio: `${ano}-10-01`, fim: `${ano}-12-31` }
      };
      
      const periodo = trimestresDatas[trimestreAtual] || trimestresDatas[4];
      
      const response = await fetch('/api/cmv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          periodo_tipo: 'trimestral',
          periodo_inicio: periodo.inicio,
          periodo_fim: periodo.fim,
          cmv_percentual: parseFloat(cmvPercentual.replace(',', '.')),
          fonte: 'manual'
        })
      });

      if (!response.ok) throw new Error('Erro ao salvar CMV');

      toast({
        title: 'Sucesso!',
        description: `CMV salvo. Recarregando...`,
      });

      setModalCMVAberto(false);
      setCmvPercentual('');
      
      // Refresh server data
      router.refresh();
      
    } catch (error) {
      console.error('Erro ao salvar CMV:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o CMV',
        variant: 'destructive'
      });
    } finally {
      setSalvandoCMV(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Indicadores Anuais */}
      <div className="card-dark p-2">
        <div className="flex items-center justify-between mb-2">
          <div 
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => setAnualExpanded(!anualExpanded)}
            role="button"
            tabIndex={0}
          >
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Visão Geral • Performance Anual</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Dashboard executivo • Performance estratégica desde abertura</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/estrategico/organizador">
              <Button
                variant="outline"
                size="sm"
                className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/20"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                Organizador
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              onClick={() => setAnualExpanded(!anualExpanded)}
            >
              {anualExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {anualExpanded && (
          <>
            {indicadoresAnuais ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <IndicadorCard
                  titulo={`Faturamento ${anoAtual}`}
                  valor={indicadoresAnuais.faturamento.valor}
                  meta={indicadoresAnuais.faturamento.meta}
                  formato="moeda"
                  cor="green"
                  icone={DollarSign}
                  detalhes={indicadoresAnuais.faturamento.detalhes}
                />
                
                <IndicadorCard
                  titulo="Pessoas"
                  valor={indicadoresAnuais.pessoas.valor}
                  meta={indicadoresAnuais.pessoas.meta}
                  formato="numero"
                  cor="blue"
                  icone={Users}
                  detalhes={indicadoresAnuais.pessoas.detalhes}
                />
                
                <IndicadorCard
                  titulo="Reputação"
                  valor={indicadoresAnuais.reputacao.valor}
                  meta={indicadoresAnuais.reputacao.meta}
                  formato="decimal"
                  cor="purple"
                  icone={Star}
                  sufixo=" ⭐"
                />
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600 dark:text-gray-400">Carregando indicadores anuais...</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Indicadores Trimestrais */}
      <div className="card-dark p-2">
        <div className="flex items-center justify-between mb-2">
          <div 
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => setTrimestralExpanded(!trimestralExpanded)}
            role="button"
            tabIndex={0}
          >
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{trimestreInfo?.nome}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Performance operacional</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navegarTrimestre('anterior');
                }}
                disabled={trimestreAtual <= 1}
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

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTrimestralExpanded(!trimestralExpanded)}
              className="p-2"
            >
              {trimestralExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {trimestralExpanded && (
          <>
            {indicadoresTrimestrais ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <IndicadorCard
                  titulo="Clientes Ativos"
                  valor={indicadoresTrimestrais.clientesAtivos.valor}
                  meta={indicadoresTrimestrais.clientesAtivos.meta}
                  formato="numero"
                  cor="green"
                  icone={Activity}
                  tooltipTexto="Base Ativa (90 dias)"
                  periodoAnalisado="Últimos 90 dias"
                  comparacao={{
                    valor: indicadoresTrimestrais.clientesAtivos.variacao || 0,
                    label: "vs 90 dias anteriores"
                  }}
                />
                
                <IndicadorCard
                  titulo="Clientes Totais"
                  valor={indicadoresTrimestrais.clientesTotais.valor}
                  meta={indicadoresTrimestrais.clientesTotais.meta}
                  formato="numero"
                  cor="blue"
                  icone={Users}
                  tooltipTexto={`Clientes totais ${trimestreInfo?.periodo}`}
                  periodoAnalisado={`${trimestreInfo?.periodo} ${anoAtual}`}
                  comparacao={{
                    valor: indicadoresTrimestrais.clientesTotais.variacao || 0,
                    label: "vs trimestre anterior"
                  }}
                />
                
                <IndicadorRetencao
                  valor={indicadoresTrimestrais.retencao.valor}
                  meta={indicadoresTrimestrais.retencao.meta}
                  variacao={indicadoresTrimestrais.retencao.variacao || 0}
                  periodoAnalisado={`${trimestreInfo?.periodo} ${anoAtual}`}
                />
                
                <IndicadorCard
                  titulo="Retenção Real"
                  valor={indicadoresTrimestrais.retencaoReal.valor}
                  meta={indicadoresTrimestrais.retencaoReal.meta}
                  formato="percentual"
                  cor="cyan"
                  icone={RefreshCw}
                  tooltipTexto="Retenção Real vs Anterior"
                  comparacao={{
                    valor: indicadoresTrimestrais.retencaoReal.variacao || 0,
                    label: "vs trimestre anterior"
                  }}
                />
                
                <div className="relative group">
                  <IndicadorCard
                    titulo="CMV Limpo"
                    valor={indicadoresTrimestrais.cmvLimpo.valor}
                    meta={indicadoresTrimestrais.cmvLimpo.meta}
                    formato="percentual"
                    cor="orange"
                    icone={TrendingDown}
                    tooltipTexto="CMV Limpo"
                    comparacao={{
                      valor: indicadoresTrimestrais.cmvLimpo.variacao || 0,
                      label: "vs trimestre anterior"
                    }}
                    inverterProgresso={true}
                    inverterComparacao={true}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700"
                    onClick={() => {
                      setCmvPercentual(indicadoresTrimestrais.cmvLimpo.valor.toString());
                      setModalCMVAberto(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </Button>
                </div>
                
                <IndicadorCard
                  titulo="CMO"
                  valor={indicadoresTrimestrais.cmo.valor}
                  meta={indicadoresTrimestrais.cmo.meta}
                  formato="percentual"
                  cor="orange"
                  icone={Wallet}
                  tooltipTexto="CMO"
                  inverterProgresso={true}
                  inverterComparacao={true}
                  comparacao={{
                    valor: indicadoresTrimestrais.cmo.variacao || 0,
                    label: "vs trimestre anterior"
                  }}
                />
                
                <IndicadorCard
                  titulo="% Artística"
                  valor={indicadoresTrimestrais.artistica.valor}
                  meta={indicadoresTrimestrais.artistica.meta}
                  formato="percentual"
                  cor="pink"
                  icone={Palette}
                  tooltipTexto="% Artística"
                  inverterProgresso={true}
                  inverterComparacao={true}
                  comparacao={{
                    valor: indicadoresTrimestrais.artistica.variacao || 0,
                    label: "vs trimestre anterior"
                  }}
                />
              </div>
            ) : (
              <div className="text-center py-6">
                 <p className="text-gray-600 dark:text-gray-400">Carregando indicadores trimestrais...</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal para editar CMV */}
      <Dialog open={modalCMVAberto} onOpenChange={setModalCMVAberto}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              Atualizar CMV Limpo
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Insira o CMV (%) do {trimestreInfo?.nome} {new Date().getFullYear()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cmv" className="text-gray-900 dark:text-white">
                CMV Percentual (%)
              </Label>
              <div className="relative">
                <Input
                  id="cmv"
                  type="text"
                  placeholder="Ex: 32.5"
                  value={cmvPercentual}
                  onChange={(e) => setCmvPercentual(e.target.value)}
                  className="pr-8 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                  %
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Meta: abaixo de {indicadoresTrimestrais?.cmvLimpo?.meta || 34}%
              </p>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-300">
                <strong>Dica:</strong> O CMV é calculado na planilha &quot;Pedidos e Estoque&quot; 
                nas abas &quot;CMV Semanal&quot; ou &quot;CMV Mensal&quot;.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setModalCMVAberto(false);
                setCmvPercentual('');
              }}
              className="border-gray-300 dark:border-gray-600"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={salvarCMV}
              disabled={salvandoCMV || !cmvPercentual}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {salvandoCMV ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar CMV
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
