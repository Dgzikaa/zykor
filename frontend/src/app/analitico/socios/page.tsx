'use client';

import { useState, useEffect } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { Loader2, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SocioData {
  nome: string;
  totalGasto: number;
  transacoes: number;
  detalhes: {
    data: string;
    mesa: string;
    motivo: string;
    valor: number;
  }[];
}

interface ApiResponse {
  success: boolean;
  data: SocioData[];
  mes: number;
  ano: number;
  error?: string;
}

export default function SociosPage() {
  const { setPageTitle } = usePageTitle();
  const [dados, setDados] = useState<SocioData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data padrão: setembro de 2025 (onde estão os dados)
  const [mes, setMes] = useState(9); // Setembro
  const [ano, setAno] = useState(2025); // Ano dos dados

  useEffect(() => {
    setPageTitle('👥 Gastos dos Sócios');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    buscarDados();
  }, [mes, ano]);

  const buscarDados = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analitico/socios?mes=${mes}&ano=${ano}`);
      const result: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao buscar dados');
      }

      setDados(result.data);
    } catch (err) {
      console.error('Erro ao buscar dados dos sócios:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const totalGeral = dados.reduce((acc, socio) => acc + socio.totalGasto, 0);
  const totalTransacoes = dados.reduce((acc, socio) => acc + socio.transacoes, 0);

  const getSocioColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-orange-500',
      'bg-red-500',
      'bg-indigo-500'
    ];
    return colors[index % colors.length];
  };

  const formatarMesAno = (mes: number, ano: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[mes - 1]} ${ano}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header com filtros */}
        <div className="card-dark p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="card-title-dark">Gastos dos Sócios</h1>
              <p className="card-description-dark">
                Acompanhe os gastos de consumo dos sócios por mês
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex gap-2">
                <div>
                  <Label htmlFor="mes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mês
                  </Label>
                  <Input
                    id="mes"
                    type="number"
                    min="1"
                    max="12"
                    value={mes}
                    onChange={(e) => setMes(parseInt(e.target.value))}
                    className="input-dark w-20"
                  />
                </div>
                <div>
                  <Label htmlFor="ano" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Ano
                  </Label>
                  <Input
                    id="ano"
                    type="number"
                    min="2020"
                    max="2030"
                    value={ano}
                    onChange={(e) => setAno(parseInt(e.target.value))}
                    className="input-dark w-24"
                  />
                </div>
              </div>
              
              <div className="flex items-end">
                <Button 
                  onClick={buscarDados}
                  disabled={loading}
                  className="btn-primary-dark"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    'Atualizar'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="card-dark">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total Gasto
              </CardTitle>
              <DollarSign className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalGeral)}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {formatarMesAno(mes, ano)}
              </p>
            </CardContent>
          </Card>

          <Card className="card-dark">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total Transações
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalTransacoes}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Consumos registrados
              </p>
            </CardContent>
          </Card>

          <Card className="card-dark">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sócios Ativos
              </CardTitle>
              <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {dados.filter(s => s.totalGasto > 0).length}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Com gastos no período
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Loading state */}
        {loading && (
          <LoadingState 
            title="Carregando análise..."
            subtitle="Processando gastos dos sócios"
            icon={<Users className="w-4 h-4" />}
          />
        )}

        {/* Error state */}
        {error && (
          <div className="card-dark p-6 text-center">
            <p className="text-red-600 dark:text-red-400">
              Erro: {error}
            </p>
            <Button 
              onClick={buscarDados}
              className="btn-primary-dark mt-4"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Lista de sócios */}
        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dados.map((socio, index) => (
              <Card key={socio.nome} className="card-dark">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${getSocioColor(index)}`} />
                      <CardTitle className="text-lg text-gray-900 dark:text-white">
                        {socio.nome}
                      </CardTitle>
                    </div>
                    <Badge 
                      variant={socio.totalGasto > 0 ? "default" : "secondary"}
                      className={socio.totalGasto > 0 ? "badge-primary" : "badge-secondary"}
                    >
                      {socio.transacoes} transações
                    </Badge>
                  </div>
                  <CardDescription className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(socio.totalGasto)}
                  </CardDescription>
                </CardHeader>
                
                {socio.detalhes.length > 0 && (
                  <CardContent>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Últimos consumos:
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {socio.detalhes.slice(0, 5).map((detalhe, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-600 dark:text-gray-400">
                                {new Date(detalhe.data).toLocaleDateString('pt-BR')}
                              </span>
                              {detalhe.mesa && (
                                <span className="text-gray-500 dark:text-gray-500 text-xs">
                                  • {detalhe.mesa}
                                </span>
                              )}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatCurrency(detalhe.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {socio.detalhes.length > 5 && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 text-center pt-2">
                          +{socio.detalhes.length - 5} consumos adicionais
                        </p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && dados.length === 0 && (
          <div className="card-dark p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nenhum dado encontrado
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Não foram encontrados gastos de sócios para {formatarMesAno(mes, ano)}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
