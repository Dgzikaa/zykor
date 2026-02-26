'use client';

import { useState, useEffect } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Users, DollarSign } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface CMODashboard {
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

export default function CMODashboardPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<CMODashboard[]>([]);
  const [anoFiltro, setAnoFiltro] = useState<number>(new Date().getFullYear());
  const [metaCMO, setMetaCMO] = useState<number>(45000); // Meta padrão

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
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar dados',
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

  // Calcular KPIs
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

  // Preparar dados para gráficos
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard CMO</h1>
          <p className="text-muted-foreground mt-1">
            Análise e evolução do Custo de Mão de Obra
          </p>
        </div>
        <div className="flex gap-3 items-center">
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
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={dadosGrafico}>
                  <defs>
                    <linearGradient id="colorCMO" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="semana" />
                  <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatarMoeda(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="CMO Total"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorCMO)"
                  />
                  <Line
                    type="monotone"
                    dataKey="Meta"
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Composição do CMO */}
          <Card>
            <CardHeader>
              <CardTitle>Composição do CMO por Semana</CardTitle>
              <CardDescription>Distribuição dos 4 componentes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="semana" />
                  <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatarMoeda(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Bar dataKey="Freelas" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="Fixos" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="Alimentação" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Pro Labore" stackId="a" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Evolução da Equipe */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução da Equipe</CardTitle>
              <CardDescription>Número de funcionários ao longo das semanas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="semana" />
                  <YAxis />
                  <Tooltip labelStyle={{ color: '#000' }} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="funcionarios"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    name="Nº Funcionários"
                  />
                </LineChart>
              </ResponsiveContainer>
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
