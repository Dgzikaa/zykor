'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, RefreshCw, Calculator, ChefHat } from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CMASemanal {
  id?: string;
  bar_id: number;
  ano: number;
  semana: number;
  data_inicio: string;
  data_fim: string;
  
  // CMA - Custo de Alimentação de Funcionários
  estoque_inicial_funcionarios: number;
  compras_alimentacao: number;
  estoque_final_funcionarios: number;
  cma_total: number;
}

// Calcular semana ISO 8601
function getWeekAndYear(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { semana: weekNo, ano: d.getUTCFullYear() };
}

// Obter segunda-feira da semana ISO
function getMondayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayJan4 = new Date(jan4);
  mondayJan4.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const targetMonday = new Date(mondayJan4);
  targetMonday.setUTCDate(mondayJan4.getUTCDate() + (week - 1) * 7);
  return targetMonday;
}

export default function CMASemanalPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscandoAutomatico, setBuscandoAutomatico] = useState(false);

  // Semana selecionada
  const [anoSelecionado, setAnoSelecionado] = useState<number>(new Date().getFullYear());
  const [semanaSelecionada, setSemanaSelecionada] = useState<number>(() => {
    const { semana } = getWeekAndYear(new Date());
    return semana;
  });

  // Dados do formulário
  const [dados, setDados] = useState<CMASemanal>({
    bar_id: selectedBar?.id || 3,
    ano: anoSelecionado,
    semana: semanaSelecionada,
    data_inicio: '',
    data_fim: '',
    estoque_inicial_funcionarios: 0,
    compras_alimentacao: 0,
    estoque_final_funcionarios: 0,
    cma_total: 0,
  });

  // Calcular datas da semana
  useEffect(() => {
    const monday = getMondayOfWeek(anoSelecionado, semanaSelecionada);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const dataInicio = monday.toISOString().split('T')[0];
    const dataFim = sunday.toISOString().split('T')[0];

    setDados(prev => ({
      ...prev,
      ano: anoSelecionado,
      semana: semanaSelecionada,
      data_inicio: dataInicio,
      data_fim: dataFim,
      bar_id: selectedBar?.id || 3,
    }));
  }, [anoSelecionado, semanaSelecionada, selectedBar]);

  // Buscar dados existentes
  const buscarDados = useCallback(async () => {
    if (!selectedBar?.id) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/cmv-semanal?bar_id=${selectedBar.id}&ano=${anoSelecionado}&semana=${semanaSelecionada}`
      );
      const json = await res.json();

      if (json.success && json.data && json.data.length > 0) {
        const dadosExistentes = json.data[0];
        setDados(prev => ({
          ...prev,
          id: dadosExistentes.id,
          estoque_inicial_funcionarios: dadosExistentes.estoque_inicial_funcionarios || 0,
          compras_alimentacao: dadosExistentes.compras_alimentacao || 0,
          estoque_final_funcionarios: dadosExistentes.estoque_final_funcionarios || 0,
          cma_total: dadosExistentes.cma_total || 0,
        }));
      } else {
        // Limpar dados se não existir
        setDados(prev => ({
          ...prev,
          id: undefined,
          estoque_inicial_funcionarios: 0,
          compras_alimentacao: 0,
          estoque_final_funcionarios: 0,
          cma_total: 0,
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar dados do CMA',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedBar, anoSelecionado, semanaSelecionada, toast]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  // Buscar dados automáticos
  const buscarDadosAutomaticos = async () => {
    if (!selectedBar?.id || !dados.data_inicio || !dados.data_fim) {
      toast({
        title: 'Erro',
        description: 'Selecione um bar e uma semana válida',
        variant: 'destructive',
      });
      return;
    }

    setBuscandoAutomatico(true);
    try {
      const res = await fetch('/api/cmv-semanal/buscar-dados-automaticos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          data_inicio: dados.data_inicio,
          data_fim: dados.data_fim,
          criterio_data: 'competencia',
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        // Atualizar apenas os campos CMA
        setDados(prev => ({
          ...prev,
          estoque_inicial_funcionarios: json.data.estoque_inicial_funcionarios || 0,
          compras_alimentacao: json.data.compras_alimentacao || 0,
          estoque_final_funcionarios: json.data.estoque_final_funcionarios || 0,
        }));

        toast({
          title: 'Sucesso',
          description: 'Dados automáticos carregados com sucesso',
        });
      } else {
        throw new Error(json.error || 'Erro ao buscar dados automáticos');
      }
    } catch (error) {
      console.error('Erro ao buscar dados automáticos:', error);
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao buscar dados automáticos',
        variant: 'destructive',
      });
    } finally {
      setBuscandoAutomatico(false);
    }
  };

  // Calcular CMA Total
  useEffect(() => {
    const cmaTotal = 
      dados.estoque_inicial_funcionarios + 
      dados.compras_alimentacao - 
      dados.estoque_final_funcionarios;

    setDados(prev => ({
      ...prev,
      cma_total: cmaTotal,
    }));
  }, [dados.estoque_inicial_funcionarios, dados.compras_alimentacao, dados.estoque_final_funcionarios]);

  // Salvar dados
  const salvarDados = async () => {
    if (!selectedBar?.id) {
      toast({
        title: 'Erro',
        description: 'Selecione um bar primeiro',
        variant: 'destructive',
      });
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        ...dados,
        bar_id: selectedBar.id,
      };

      const res = await fetch('/api/cmv-semanal', {
        method: dados.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: 'Sucesso',
          description: 'Dados salvos com sucesso',
        });
        await buscarDados();
      } else {
        throw new Error(json.error || 'Erro ao salvar dados');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao salvar dados',
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const semanas = Array.from({ length: 53 }, (_, i) => i + 1);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ChefHat className="w-8 h-8 text-amber-600" />
            CMA - Custo de Alimentação de Funcionários
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle semanal do custo de alimentação dos funcionários
          </p>
        </div>
      </div>

      {/* Seletor de Semana */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Período</CardTitle>
          <CardDescription>Escolha o ano e a semana para gerenciar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select
                value={anoSelecionado.toString()}
                onValueChange={(v) => setAnoSelecionado(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={ano.toString()}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Semana</Label>
              <Select
                value={semanaSelecionada.toString()}
                onValueChange={(v) => setSemanaSelecionada(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {semanas.map((semana) => (
                    <SelectItem key={semana} value={semana.toString()}>
                      Semana {semana}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input value={dados.data_inicio} disabled />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input value={dados.data_fim} disabled />
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={buscarDadosAutomaticos}
              disabled={buscandoAutomatico}
              className="w-full md:w-auto"
            >
              {buscandoAutomatico ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Buscar Dados Automáticos
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Formulário CMA */}
      {loading ? (
        <LoadingState
          title="Carregando CMA..."
          subtitle="Processando custos de alimentação"
          icon={<ChefHat className="w-4 h-4" />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Estoques e Compras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-600" />
                Cálculo CMA
              </CardTitle>
              <CardDescription>
                CMA = Estoque Inicial + Compras - Estoque Final
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Estoque Inicial Funcionários</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dados.estoque_inicial_funcionarios}
                  onChange={(e) =>
                    setDados({ ...dados, estoque_inicial_funcionarios: parseFloat(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Categorias: HORTIFRUTI (F), MERCADO (F), PROTEÍNA (F)
                </p>
              </div>

              <div className="space-y-2">
                <Label>(+) Compras de Alimentação</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dados.compras_alimentacao}
                  onChange={(e) =>
                    setDados({ ...dados, compras_alimentacao: parseFloat(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Categoria NIBO: Alimentação
                </p>
              </div>

              <div className="space-y-2">
                <Label>(-) Estoque Final Funcionários</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dados.estoque_final_funcionarios}
                  onChange={(e) =>
                    setDados({ ...dados, estoque_final_funcionarios: parseFloat(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Categorias: HORTIFRUTI (F), MERCADO (F), PROTEÍNA (F)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Resultado */}
          <Card>
            <CardHeader>
              <CardTitle>Resultado CMA</CardTitle>
              <CardDescription>Custo total de alimentação dos funcionários</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-950/20 p-6 rounded-lg border-2 border-amber-200 dark:border-amber-800">
                <div className="text-sm text-muted-foreground mb-2">CMA Total</div>
                <div className="text-4xl font-bold text-amber-600">
                  {formatarMoeda(dados.cma_total)}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Estoque Inicial</span>
                  <span className="font-medium">{formatarMoeda(dados.estoque_inicial_funcionarios)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">(+) Compras</span>
                  <span className="font-medium text-green-600">
                    {formatarMoeda(dados.compras_alimentacao)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">(-) Estoque Final</span>
                  <span className="font-medium text-red-600">
                    {formatarMoeda(dados.estoque_final_funcionarios)}
                  </span>
                </div>
              </div>

              <Button
                onClick={salvarDados}
                disabled={salvando}
                className="w-full"
                size="lg"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar CMA
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Informações */}
      <Card>
        <CardHeader>
          <CardTitle>Como funciona o CMA?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            O <strong>CMA (Custo de Alimentação de Funcionários)</strong> calcula quanto foi gasto
            com alimentação dos funcionários no período.
          </p>
          <p>
            <strong>Fórmula:</strong> CMA = Estoque Inicial + Compras - Estoque Final
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              <strong>Estoque Inicial/Final:</strong> Insumos das categorias HORTIFRUTI (F), MERCADO (F)
              e PROTEÍNA (F) da contagem de estoque
            </li>
            <li>
              <strong>Compras:</strong> Valores da categoria "Alimentação" do NIBO
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
