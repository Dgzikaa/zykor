'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/loading-state';
import { Beer, Martini, UtensilsCrossed, TrendingUp, DollarSign, ShoppingCart, RefreshCcw } from 'lucide-react';

interface VendaCategoria {
  categoria: string;
  quantidade_total: number;
  faturamento_total: number;
  num_vendas: number;
}

interface DadosVendas {
  data: VendaCategoria[];
  periodo: {
    data_inicio: string;
    data_fim: string;
    ano: string;
  };
}

export default function VendasCategoriasPage() {
  const [dados, setDados] = useState<DadosVendas | null>(null);
  const [loading, setLoading] = useState(true);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString());

  const anos = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  const fetchDados = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/relatorios/vendas-categorias?ano=${anoSelecionado}`);
      const result = await response.json();
      
      if (result.success) {
        setDados(result);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, [anoSelecionado]);

  const getIconeCategoria = (categoria: string) => {
    switch (categoria) {
      case 'DRINKS':
        return <Martini className="w-8 h-8 text-purple-600 dark:text-purple-400" />;
      case 'CERVEJAS':
        return <Beer className="w-8 h-8 text-amber-600 dark:text-amber-400" />;
      case 'COMIDAS':
        return <UtensilsCrossed className="w-8 h-8 text-green-600 dark:text-green-400" />;
      default:
        return null;
    }
  };

  const getCorCategoria = (categoria: string) => {
    switch (categoria) {
      case 'DRINKS':
        return 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700';
      case 'CERVEJAS':
        return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700';
      case 'COMIDAS':
        return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
    }
  };

  const formatarNumero = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(num));
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const calcularTotais = () => {
    if (!dados?.data) return { quantidade: 0, faturamento: 0, vendas: 0 };
    
    return dados.data.reduce((acc, item) => ({
      quantidade: acc.quantidade + item.quantidade_total,
      faturamento: acc.faturamento + item.faturamento_total,
      vendas: acc.vendas + item.num_vendas
    }), { quantidade: 0, faturamento: 0, vendas: 0 });
  };

  const totais = calcularTotais();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="card-dark p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="card-title-dark mb-2">📊 Vendas por Categoria</h1>
              <p className="card-description-dark">
                Acompanhe as vendas de Drinks, Cervejas e Comidas
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                <SelectTrigger className="input-dark w-full sm:w-[180px]">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {anos.map(ano => (
                    <SelectItem 
                      key={ano} 
                      value={ano}
                      className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                onClick={fetchDados} 
                disabled={loading}
                className="btn-primary-dark"
              >
                {loading ? (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Atualizar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState 
            title="Carregando análise..."
            subtitle="Processando vendas por categoria"
            icon={<ShoppingCart className="w-4 h-4" />}
          />
        ) : (
          <>
            {/* Cards de Totais Gerais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total de Unidades</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatarNumero(totais.quantidade)}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Faturamento Total</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatarValor(totais.faturamento)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Número de Vendas</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatarNumero(totais.vendas)}
                      </p>
                    </div>
                    <ShoppingCart className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cards de Categorias */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {dados?.data.map((item) => (
                <Card 
                  key={item.categoria}
                  className={`${getCorCategoria(item.categoria)} border-2 transition-all hover:shadow-lg`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      {getIconeCategoria(item.categoria)}
                      <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                        {item.categoria}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Quantidade */}
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Unidades Vendidas
                        </p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {formatarNumero(item.quantidade_total)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {((item.quantidade_total / totais.quantidade) * 100).toFixed(1)}% do total
                        </p>
                      </div>

                      {/* Faturamento */}
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Faturamento
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatarValor(item.faturamento_total)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {((item.faturamento_total / totais.faturamento) * 100).toFixed(1)}% do total
                        </p>
                      </div>

                      {/* Ticket Médio */}
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Preço Médio por Unidade
                        </p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatarValor(item.faturamento_total / item.quantidade_total)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {formatarNumero(item.num_vendas)} vendas registradas
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Informações do Período */}
            {dados?.periodo && (
              <div className="mt-6 card-dark p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  📅 Período: {new Date(dados.periodo.data_inicio).toLocaleDateString('pt-BR')} até{' '}
                  {new Date(dados.periodo.data_fim).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
