'use client';

import { useState, useEffect } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, TrendingUp, TrendingDown, Minus, Users, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CMOComparacao {
  id: string;
  ano: number;
  semana: number;
  data_inicio: string;
  data_fim: string;
  freelas: number;
  fixos_total: number;
  cma_alimentacao: number;
  pro_labore_semanal: number;
  cmo_total: number;
  funcionarios: Array<{
    funcionario_nome: string;
    tipo_contratacao: string;
    area: string;
    salario_bruto: number;
    custo_semanal: number;
    dias_trabalhados: number;
  }>;
}

export default function CMOCompararPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [semanas, setSemanas] = useState<Array<{ ano: number; semana: number; label: string }>>([]);
  
  const [semana1Id, setSemana1Id] = useState<string>('');
  const [semana2Id, setSemana2Id] = useState<string>('');
  
  const [dados1, setDados1] = useState<CMOComparacao | null>(null);
  const [dados2, setDados2] = useState<CMOComparacao | null>(null);

  // Buscar lista de semanas disponíveis
  useEffect(() => {
    if (!selectedBar?.id) return;

    const buscarSemanas = async () => {
      try {
        const res = await fetch(`/api/cmo-semanal/historico?bar_id=${selectedBar.id}`);
        const json = await res.json();

        if (json.success && json.data) {
          const lista = json.data.map((item: any) => ({
            ano: item.ano,
            semana: item.semana,
            label: `Semana ${item.semana}/${item.ano} (${new Date(item.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`,
            id: item.id,
          }));
          setSemanas(lista);

          // Selecionar as 2 últimas semanas por padrão
          if (lista.length >= 2) {
            setSemana1Id(lista[0].id);
            setSemana2Id(lista[1].id);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar semanas:', error);
      }
    };

    buscarSemanas();
  }, [selectedBar]);

  // Buscar dados quando selecionar semanas
  useEffect(() => {
    if (!semana1Id || !semana2Id) return;

    const buscarDados = async () => {
      setLoading(true);
      try {
        // Buscar semana 1
        const res1 = await fetch(`/api/cmo-semanal/detalhes?id=${semana1Id}`);
        const json1 = await res1.json();
        if (json1.success) setDados1(json1.data);

        // Buscar semana 2
        const res2 = await fetch(`/api/cmo-semanal/detalhes?id=${semana2Id}`);
        const json2 = await res2.json();
        if (json2.success) setDados2(json2.data);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao buscar dados para comparação',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    buscarDados();
  }, [semana1Id, semana2Id, toast]);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(valor);
  };

  const calcularDiferenca = (valor1: number, valor2: number) => {
    return valor1 - valor2;
  };

  const calcularVariacao = (valor1: number, valor2: number) => {
    if (valor2 === 0) return null;
    return ((valor1 - valor2) / valor2) * 100;
  };

  const renderVariacao = (valor1: number, valor2: number) => {
    const diff = calcularDiferenca(valor1, valor2);
    const variacao = calcularVariacao(valor1, valor2);

    if (diff === 0) {
      return (
        <div className="flex items-center gap-1 text-gray-500">
          <Minus className="w-4 h-4" />
          <span className="text-sm">Igual</span>
        </div>
      );
    }

    const isPositivo = diff > 0;
    const cor = isPositivo ? 'text-red-600' : 'text-green-600';
    const Icon = isPositivo ? TrendingUp : TrendingDown;

    return (
      <div className={`flex flex-col items-end ${cor}`}>
        <div className="flex items-center gap-1">
          <Icon className="w-4 h-4" />
          <span className="font-semibold">{formatarMoeda(Math.abs(diff))}</span>
        </div>
        {variacao !== null && (
          <span className="text-xs">
            {isPositivo ? '+' : ''}{variacao.toFixed(1)}%
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Comparar Simulações CMO</h1>
        <p className="text-muted-foreground mt-1">
          Compare duas semanas lado a lado para identificar variações
        </p>
      </div>

      {/* Seletor de Semanas */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Semanas para Comparar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Semana 1 (Mais Recente)</label>
              <Select value={semana1Id} onValueChange={setSemana1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma semana" />
                </SelectTrigger>
                <SelectContent>
                  {semanas.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Semana 2 (Anterior)</label>
              <Select value={semana2Id} onValueChange={setSemana2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma semana" />
                </SelectTrigger>
                <SelectContent>
                  {semanas.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparação */}
      {loading ? (
        <Card>
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : dados1 && dados2 ? (
        <div className="space-y-6">
          {/* CMO Total */}
          <Card>
            <CardHeader>
              <CardTitle>CMO Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">
                    Semana {dados1.semana}/{dados1.ano}
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {formatarMoeda(dados1.cmo_total)}
                  </div>
                </div>

                <div className="flex justify-center">
                  {renderVariacao(dados1.cmo_total, dados2.cmo_total)}
                </div>

                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">
                    Semana {dados2.semana}/{dados2.ano}
                  </div>
                  <div className="text-3xl font-bold text-gray-600">
                    {formatarMoeda(dados2.cmo_total)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Componentes do CMO */}
          <Card>
            <CardHeader>
              <CardTitle>Componentes do CMO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Freelas */}
                <div className="grid grid-cols-3 gap-4 items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">Freelas</div>
                    <div className="text-lg font-bold">{formatarMoeda(dados1.freelas)}</div>
                  </div>
                  <div className="flex justify-center">
                    {renderVariacao(dados1.freelas, dados2.freelas)}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-600">
                      {formatarMoeda(dados2.freelas)}
                    </div>
                  </div>
                </div>

                {/* Fixos */}
                <div className="grid grid-cols-3 gap-4 items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">
                      Fixos ({dados1.funcionarios.length} func.)
                    </div>
                    <div className="text-lg font-bold">{formatarMoeda(dados1.fixos_total)}</div>
                  </div>
                  <div className="flex justify-center">
                    {renderVariacao(dados1.fixos_total, dados2.fixos_total)}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-600">
                      ({dados2.funcionarios.length} func.)
                    </div>
                    <div className="text-lg font-bold text-gray-600">
                      {formatarMoeda(dados2.fixos_total)}
                    </div>
                  </div>
                </div>

                {/* Alimentação */}
                <div className="grid grid-cols-3 gap-4 items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">Alimentação</div>
                    <div className="text-lg font-bold">{formatarMoeda(dados1.cma_alimentacao)}</div>
                  </div>
                  <div className="flex justify-center">
                    {renderVariacao(dados1.cma_alimentacao, dados2.cma_alimentacao)}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-600">
                      {formatarMoeda(dados2.cma_alimentacao)}
                    </div>
                  </div>
                </div>

                {/* Pro Labore */}
                <div className="grid grid-cols-3 gap-4 items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">Pro Labore</div>
                    <div className="text-lg font-bold">{formatarMoeda(dados1.pro_labore_semanal)}</div>
                  </div>
                  <div className="flex justify-center">
                    {renderVariacao(dados1.pro_labore_semanal, dados2.pro_labore_semanal)}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-600">
                      {formatarMoeda(dados2.pro_labore_semanal)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparação de Funcionários */}
          <Card>
            <CardHeader>
              <CardTitle>Diferenças na Equipe</CardTitle>
              <CardDescription>Funcionários adicionados, removidos ou alterados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Funcionários da Semana 1 */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Semana {dados1.semana}/{dados1.ano} ({dados1.funcionarios.length} funcionários)
                  </h4>
                  <div className="space-y-2">
                    {dados1.funcionarios.map((func, idx) => {
                      const existeNaSemana2 = dados2.funcionarios.find(
                        f => f.funcionario_nome === func.funcionario_nome
                      );
                      const isNovo = !existeNaSemana2;

                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isNovo
                              ? 'bg-green-50 dark:bg-green-950/20 border-green-300'
                              : 'bg-gray-50 dark:bg-gray-900/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isNovo && (
                              <Badge variant="outline" className="bg-green-100 text-green-700">
                                NOVO
                              </Badge>
                            )}
                            <div>
                              <div className="font-medium">{func.funcionario_nome}</div>
                              <div className="text-xs text-muted-foreground">
                                {func.tipo_contratacao} • {func.area} • {func.dias_trabalhados} dias
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatarMoeda(func.custo_semanal)}</div>
                            <div className="text-xs text-muted-foreground">
                              Base: {formatarMoeda(func.salario_bruto)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Funcionários Removidos */}
                {dados2.funcionarios.some(
                  f2 => !dados1.funcionarios.find(f1 => f1.funcionario_nome === f2.funcionario_nome)
                ) && (
                  <div>
                    <h4 className="font-medium mb-3 text-red-600 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Funcionários Removidos
                    </h4>
                    <div className="space-y-2">
                      {dados2.funcionarios
                        .filter(
                          f2 => !dados1.funcionarios.find(f1 => f1.funcionario_nome === f2.funcionario_nome)
                        )
                        .map((func, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-300"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="bg-red-100 text-red-700">
                                REMOVIDO
                              </Badge>
                              <div>
                                <div className="font-medium">{func.funcionario_nome}</div>
                                <div className="text-xs text-muted-foreground">
                                  {func.tipo_contratacao} • {func.area}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-red-600">
                                -{formatarMoeda(func.custo_semanal)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resumo da Diferença */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo da Variação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <span className="font-medium">Diferença Total:</span>
                  <div className="text-right">
                    {renderVariacao(dados1.cmo_total, dados2.cmo_total)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div className="text-muted-foreground mb-1">Funcionários</div>
                    <div className="font-semibold">
                      {dados1.funcionarios.length} → {dados2.funcionarios.length}
                      <span className={dados1.funcionarios.length > dados2.funcionarios.length ? 'text-red-600' : 'text-green-600'}>
                        {' '}({dados1.funcionarios.length - dados2.funcionarios.length > 0 ? '+' : ''}
                        {dados1.funcionarios.length - dados2.funcionarios.length})
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div className="text-muted-foreground mb-1">Impacto Fixos</div>
                    <div className="font-semibold">
                      {renderVariacao(dados1.fixos_total, dados2.fixos_total)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Selecione duas semanas para comparar</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
