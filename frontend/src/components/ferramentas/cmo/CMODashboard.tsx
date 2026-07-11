'use client';

import { useState, useEffect } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { GraficoLinha } from '@/components/graficos/Charts';
import { GraficoBase } from '@/components/graficos/GraficoBase';

interface CMOData {
  id: string;
  ano: number;
  semana: number;
  data_inicio: string;
  cmo_total: number;
  freelas: number;
  fixos_total: number;
  cma_alimentacao: number;
  pro_labore_semanal: number;
  total_funcionarios: number;
}

export default function CMODashboard() {
  const { selectedBar } = useBar();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<CMOData[]>([]);
  const [anoFiltro, setAnoFiltro] = useState<number>(new Date().getFullYear());
  const [metaCMO, setMetaCMO] = useState<number>(45000);

  useEffect(() => {
    buscarDados();
  }, [selectedBar, anoFiltro]);

  const buscarDados = async () => {
    if (!selectedBar?.id) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/cmo-semanal/historico?bar_id=${selectedBar.id}&ano=${anoFiltro}`
      );
      const json = await res.json();

      if (json.success) {
        setDados(json.data || []);
      }
    } catch (e) {
      toast({
        title: 'Erro',
        description: 'Erro ao buscar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatarMoeda = (valor: number | undefined) => {    if (valor === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(valor);
  };

  const cmoMedio = dados.length > 0 
    ? dados.reduce((sum, d) => sum + d.cmo_total, 0) / dados.length 
    : 0;

  const ultimosCMO = dados.slice(0, 2);
  const tendencia = ultimosCMO.length === 2
    ? ultimosCMO[0].cmo_total > ultimosCMO[1].cmo_total
      ? 'subindo'
      : 'descendo'
    : 'estavel';

  const semanasAcimaMeta = dados.filter(d => d.cmo_total > metaCMO).length;
  const percentualAcimaMeta = dados.length > 0 ? (semanasAcimaMeta / dados.length) * 100 : 0;

  const dadosGrafico = [...dados].reverse().map(d => ({
    semana: `S${d.semana}`,
    'CMO Total': d.cmo_total,
    'Freelas': d.freelas,
    'Fixos': d.fixos_total,
    'Alimentação': d.cma_alimentacao,
    'Pro Labore': d.pro_labore_semanal,
    'Meta': metaCMO,
    funcionarios: d.total_funcionarios,
  }));

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex gap-3 items-center justify-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Meta CMO</label>
          <input
            type="number"
            value={metaCMO}
            onChange={(e) => setMetaCMO(parseFloat(e.target.value) || 0)}
            className="px-3 py-2 border rounded-md w-32"
          />
        </div>
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

      {loading ? (
        <Card>
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : dados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum dado encontrado para {anoFiltro}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  CMO Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatarMoeda(cmoMedio)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Média de {dados.length} semanas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tendência
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {tendencia === 'subindo' ? (
                    <>
                      <TrendingUp className="w-6 h-6 text-red-600" />
                      <span className="text-2xl font-bold text-red-600">Subindo</span>
                    </>
                  ) : tendencia === 'descendo' ? (
                    <>
                      <TrendingDown className="w-6 h-6 text-green-600" />
                      <span className="text-2xl font-bold text-green-600">Descendo</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-gray-600">Estável</span>
                  )}
                </div>
                {ultimosCMO.length === 2 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatarMoeda(ultimosCMO[0].cmo_total)} vs {formatarMoeda(ultimosCMO[1].cmo_total)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Aderência à Meta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {percentualAcimaMeta < 30 ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  )}
                  <span className="text-2xl font-bold">
                    {(100 - percentualAcimaMeta).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {semanasAcimaMeta} de {dados.length} semanas acima da meta
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Última Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatarMoeda(dados[0]?.cmo_total || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Semana {dados[0]?.semana} • {dados[0]?.total_funcionarios} funcionários
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Evolução */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução do CMO</CardTitle>
              <CardDescription>Histórico semanal com meta</CardDescription>
            </CardHeader>
            <CardContent>
              <GraficoLinha
                data={dadosGrafico}
                xKey="semana"
                series={[{ key: 'CMO Total', nome: 'CMO Total', cor: '#3b82f6' }]}
                area
                height={400}
                formatV={(v) => formatarMoeda(v)}
                markLines={[{ valor: metaCMO, label: 'Meta', cor: '#ef4444' }]}
              />
            </CardContent>
          </Card>

          {/* Composição do CMO */}
          <Card>
            <CardHeader>
              <CardTitle>Composição do CMO por Semana</CardTitle>
              <CardDescription>Distribuição dos 4 componentes</CardDescription>
            </CardHeader>
            <CardContent>
              <GraficoBase
                tipo="barra"
                stacked
                data={dadosGrafico}
                xKey="semana"
                series={[
                  { key: 'Freelas', label: 'Freelas' },
                  { key: 'Fixos', label: 'Fixos' },
                  { key: 'Alimentação', label: 'Alimentação' },
                  { key: 'Pro Labore', label: 'Pro Labore' },
                ]}
                height={400}
                formatY={(v) => formatarMoeda(v)}
                cores={['#8b5cf6', '#3b82f6', '#f59e0b', '#10b981']}
              />
            </CardContent>
          </Card>

          {/* Evolução da Equipe */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução da Equipe</CardTitle>
              <CardDescription>Número de funcionários ao longo das semanas</CardDescription>
            </CardHeader>
            <CardContent>
              <GraficoLinha
                data={dadosGrafico}
                xKey="semana"
                series={[{ key: 'funcionarios', nome: 'Nº Funcionários', cor: '#3b82f6' }]}
                height={300}
              />
            </CardContent>
          </Card>

          {/* Alertas */}
          {semanasAcimaMeta > 0 && (
            <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  Alertas de Meta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-red-700">
                    <strong>{semanasAcimaMeta}</strong> semana(s) ultrapassaram a meta de{' '}
                    <strong>{formatarMoeda(metaCMO)}</strong>
                  </p>
                  <div className="space-y-2">
                    {dados
                      .filter(d => d.cmo_total > metaCMO)
                      .map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-200"
                        >
                          <div>
                            <div className="font-medium">Semana {d.semana}/{d.ano}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(d.data_inicio).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-red-600">
                              {formatarMoeda(d.cmo_total)}
                            </div>
                            <div className="text-xs text-red-600">
                              +{formatarMoeda(d.cmo_total - metaCMO)} acima
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Análise por Componente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Média por Componente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                    <span className="text-sm font-medium">Freelas</span>
                    <span className="font-bold">
                      {formatarMoeda(
                        dados.reduce((sum, d) => sum + d.freelas, 0) / dados.length
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <span className="text-sm font-medium">Fixos</span>
                    <span className="font-bold">
                      {formatarMoeda(
                        dados.reduce((sum, d) => sum + d.fixos_total, 0) / dados.length
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                    <span className="text-sm font-medium">Alimentação</span>
                    <span className="font-bold">
                      {formatarMoeda(
                        dados.reduce((sum, d) => sum + d.cma_alimentacao, 0) / dados.length
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <span className="text-sm font-medium">Pro Labore</span>
                    <span className="font-bold">
                      {formatarMoeda(
                        dados.reduce((sum, d) => sum + d.pro_labore_semanal, 0) / dados.length
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição Média</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'Freelas', valor: dados.reduce((sum, d) => sum + d.freelas, 0) / dados.length, cor: 'bg-purple-500' },
                    { label: 'Fixos', valor: dados.reduce((sum, d) => sum + d.fixos_total, 0) / dados.length, cor: 'bg-blue-500' },
                    { label: 'Alimentação', valor: dados.reduce((sum, d) => sum + d.cma_alimentacao, 0) / dados.length, cor: 'bg-amber-500' },
                    { label: 'Pro Labore', valor: dados.reduce((sum, d) => sum + d.pro_labore_semanal, 0) / dados.length, cor: 'bg-green-500' },
                  ].map((item) => {
                    const percentual = (item.valor / cmoMedio) * 100;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{item.label}</span>
                          <span className="font-medium">{percentual.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`${item.cor} h-2 rounded-full transition-all`}
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
