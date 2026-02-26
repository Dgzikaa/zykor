'use client';

import { useState, useEffect } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, Unlock, Eye, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface CMOHistorico {
  id: string;
  bar_id: number;
  bar_nome: string;
  ano: number;
  semana: number;
  data_inicio: string;
  data_fim: string;
  freelas: number;
  fixos_total: number;
  cma_alimentacao: number;
  pro_labore_semanal: number;
  cmo_total: number;
  simulacao_salva: boolean;
  created_at: string;
  updated_at: string;
  travado_em?: string;
  criado_por_nome?: string;
  criado_por_email?: string;
  atualizado_por_nome?: string;
  travado_por_nome?: string;
  total_funcionarios: number;
}

export default function CMOHistoricoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();

  const [historico, setHistorico] = useState<CMOHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [anoFiltro, setAnoFiltro] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    buscarHistorico();
  }, [selectedBar, anoFiltro]);

  const buscarHistorico = async () => {
    if (!selectedBar?.id) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/cmo-semanal/historico?bar_id=${selectedBar.id}&ano=${anoFiltro}`
      );
      const json = await res.json();

      if (json.success) {
        setHistorico(json.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar histórico',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(valor);
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calcularVariacao = (atual: number, anterior: number) => {
    if (anterior === 0) return null;
    return ((atual - anterior) / anterior) * 100;
  };

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Histórico de Simulações CMO</h1>
          <p className="text-muted-foreground mt-1">
            Visualize e compare simulações anteriores
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            {anos.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Simulações */}
      {loading ? (
        <Card>
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : historico.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhuma simulação encontrada para {anoFiltro}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {historico.map((item, index) => {
            const anterior = historico[index + 1];
            const variacao = anterior ? calcularVariacao(item.cmo_total, anterior.cmo_total) : null;

            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">
                        Semana {item.semana} / {item.ano}
                      </CardTitle>
                      {item.simulacao_salva && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          <Lock className="w-3 h-3 mr-1" />
                          Travada
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatarMoeda(item.cmo_total)}
                      </div>
                      {variacao !== null && (
                        <div className={`text-sm flex items-center gap-1 justify-end ${variacao > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {variacao > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}% vs semana anterior
                        </div>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    {new Date(item.data_inicio).toLocaleDateString('pt-BR')} até{' '}
                    {new Date(item.data_fim).toLocaleDateString('pt-BR')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Freelas</div>
                      <div className="text-lg font-semibold">{formatarMoeda(item.freelas)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Fixos ({item.total_funcionarios} func.)
                      </div>
                      <div className="text-lg font-semibold">{formatarMoeda(item.fixos_total)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Alimentação</div>
                      <div className="text-lg font-semibold">{formatarMoeda(item.cma_alimentacao)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Pro Labore</div>
                      <div className="text-lg font-semibold">{formatarMoeda(item.pro_labore_semanal)}</div>
                    </div>
                  </div>

                  {/* Auditoria */}
                  <div className="border-t pt-3 mt-3 text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Criado por:</span>
                      <span className="font-medium">
                        {item.criado_por_nome || 'Sistema'} em {formatarData(item.created_at)}
                      </span>
                    </div>
                    {item.atualizado_por_nome && (
                      <div className="flex justify-between">
                        <span>Atualizado por:</span>
                        <span className="font-medium">
                          {item.atualizado_por_nome} em {formatarData(item.updated_at)}
                        </span>
                      </div>
                    )}
                    {item.simulacao_salva && item.travado_por_nome && (
                      <div className="flex justify-between">
                        <span>Travado por:</span>
                        <span className="font-medium text-green-600">
                          {item.travado_por_nome} em {formatarData(item.travado_em || '')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 mt-4">
                    <Link href={`/ferramentas/cmo-semanal?ano=${item.ano}&semana=${item.semana}`}>
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
