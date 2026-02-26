'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, RefreshCw, Calculator, Users, Plus, Trash2, Lock, Unlock, TrendingUp, History, AlertTriangle, Bell } from 'lucide-react';
import { calcularCustoFuncionario, calcularProLaboreSemanal, calcularCMOTotal, type DadosFuncionario } from '@/lib/calculos-folha';
import Link from 'next/link';

interface CMOSemanal {
  id?: string;
  bar_id: number;
  ano: number;
  semana: number;
  data_inicio: string;
  data_fim: string;
  freelas: number;
  fixos_total: number;
  cma_alimentacao: number;
  pro_labore_mensal: number;
  pro_labore_semanal: number;
  cmo_total: number;
  simulacao_salva: boolean;
  meta_cmo?: number;
  acima_meta?: boolean;
  observacoes?: string;
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

export default function CMOSemanalPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscandoAutomatico, setBuscandoAutomatico] = useState(false);

  // Semana selecionada (pode vir da URL)
  const [anoSelecionado, setAnoSelecionado] = useState<number>(() => {
    const anoUrl = searchParams.get('ano');
    return anoUrl ? parseInt(anoUrl) : new Date().getFullYear();
  });
  const [semanaSelecionada, setSemanaSelecionada] = useState<number>(() => {
    const semanaUrl = searchParams.get('semana');
    if (semanaUrl) return parseInt(semanaUrl);
    const { semana } = getWeekAndYear(new Date());
    return semana;
  });

  // Dados do CMO
  const [dados, setDados] = useState<CMOSemanal>({
    bar_id: selectedBar?.id || 3,
    ano: anoSelecionado,
    semana: semanaSelecionada,
    data_inicio: '',
    data_fim: '',
    freelas: 0,
    fixos_total: 0,
    cma_alimentacao: 0,
    pro_labore_mensal: 0,
    pro_labore_semanal: 0,
    cmo_total: 0,
    simulacao_salva: false,
    meta_cmo: 45000,
  });

  // Funcionários da simulação
  const [funcionarios, setFuncionarios] = useState<DadosFuncionario[]>([]);

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
        `/api/cmo-semanal?bar_id=${selectedBar.id}&ano=${anoSelecionado}&semana=${semanaSelecionada}`
      );
      const json = await res.json();

      if (json.success && json.data) {
        setDados(prev => ({ ...prev, ...json.data.cmo }));
        setFuncionarios(json.data.funcionarios || []);
      } else {
        // Limpar se não existir
        setFuncionarios([]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBar, anoSelecionado, semanaSelecionada]);

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
      const res = await fetch('/api/cmo-semanal/buscar-automatico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          data_inicio: dados.data_inicio,
          data_fim: dados.data_fim,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDados(prev => ({
          ...prev,
          freelas: json.data.freelas || 0,
          cma_alimentacao: json.data.cma_alimentacao || 0,
        }));

        toast({
          title: 'Sucesso',
          description: 'Dados automáticos carregados',
        });
      }
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar dados automáticos',
        variant: 'destructive',
      });
    } finally {
      setBuscandoAutomatico(false);
    }
  };

  // Adicionar funcionário
  const adicionarFuncionario = () => {
    setFuncionarios([
      ...funcionarios,
      {
        nome: '',
        tipo_contratacao: 'CLT',
        area: 'Salão',
        vale_transporte: 0,
        salario_bruto: 1750.68,
        adicional: 0,
        adicional_aviso_previo: 0,
        dias_trabalhados: 7,
      },
    ]);
  };

  // Remover funcionário
  const removerFuncionario = (index: number) => {
    setFuncionarios(funcionarios.filter((_, i) => i !== index));
  };

  // Atualizar funcionário
  const atualizarFuncionario = (index: number, campo: keyof DadosFuncionario, valor: any) => {
    const novos = [...funcionarios];
    novos[index] = { ...novos[index], [campo]: valor };
    setFuncionarios(novos);
  };

  // Calcular totais
  useEffect(() => {
    const fixosTotal = funcionarios.reduce((sum, func) => {
      const resultado = calcularCustoFuncionario(func);
      return sum + resultado.custo_semanal;
    }, 0);

    const proLaboreSemanal = calcularProLaboreSemanal(dados.pro_labore_mensal, 7);

    const cmoTotal = calcularCMOTotal({
      freelas: dados.freelas,
      fixosTotal,
      cmaAlimentacao: dados.cma_alimentacao,
      proLaboreSemanal,
    });

    const acimaMeta = dados.meta_cmo ? cmoTotal > dados.meta_cmo : false;

    setDados(prev => ({
      ...prev,
      fixos_total: fixosTotal,
      pro_labore_semanal: proLaboreSemanal,
      cmo_total: cmoTotal,
      acima_meta: acimaMeta,
    }));
  }, [funcionarios, dados.freelas, dados.cma_alimentacao, dados.pro_labore_mensal, dados.meta_cmo]);

  // Salvar simulação
  const salvarSimulacao = async () => {
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
        cmo: dados,
        funcionarios,
      };

      const res = await fetch('/api/cmo-semanal', {
        method: dados.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: 'Sucesso',
          description: 'Simulação salva com sucesso',
        });
        await buscarDados();
      } else {
        throw new Error(json.error || 'Erro ao salvar');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  // Travar/Destravar simulação
  const toggleTravarSimulacao = async () => {
    if (!dados.id) {
      toast({
        title: 'Aviso',
        description: 'Salve a simulação primeiro',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(`/api/cmo-semanal/${dados.id}/travar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulacao_salva: !dados.simulacao_salva }),
      });

      const json = await res.json();

      if (json.success) {
        setDados(prev => ({ ...prev, simulacao_salva: !prev.simulacao_salva }));
        toast({
          title: 'Sucesso',
          description: dados.simulacao_salva ? 'Simulação destravada' : 'Simulação travada',
        });
      }
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar simulação',
        variant: 'destructive',
      });
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

  const simulacaoTravada = dados.simulacao_salva;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-600" />
            CMO Semanal - Custo de Mão de Obra
          </h1>
          <p className="text-muted-foreground mt-1">
            Simulador de folha + Freelas + Alimentação + Pro Labore
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/ferramentas/cmo-semanal/historico">
            <Button variant="outline">
              <History className="w-4 h-4 mr-2" />
              Ver Histórico
            </Button>
          </Link>
          {dados.simulacao_salva && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 rounded-lg border-2 border-green-500">
              <Lock className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Simulação Travada
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Seletor de Semana */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Período</CardTitle>
          <CardDescription>Escolha o ano e a semana para simular</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select
                value={anoSelecionado.toString()}
                onValueChange={(v) => setAnoSelecionado(parseInt(v))}
                disabled={simulacaoTravada}
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
                disabled={simulacaoTravada}
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

          <div className="mt-4 flex gap-2">
            <Button
              onClick={buscarDadosAutomaticos}
              disabled={buscandoAutomatico || simulacaoTravada}
            >
              {buscandoAutomatico ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Buscar Freelas + CMA
                </>
              )}
            </Button>

            {dados.id && (
              <Button
                onClick={toggleTravarSimulacao}
                variant={simulacaoTravada ? 'destructive' : 'outline'}
              >
                {simulacaoTravada ? (
                  <>
                    <Unlock className="w-4 h-4 mr-2" />
                    Destravar Simulação
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Travar Simulação
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Componentes do CMO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Freelas + CMA + Pro Labore */}
        <Card>
          <CardHeader>
            <CardTitle>Componentes Fixos</CardTitle>
            <CardDescription>Freelas, Alimentação e Pro Labore</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>1. Freelas (NIBO)</Label>
              <Input
                type="number"
                step="0.01"
                value={dados.freelas}
                onChange={(e) => setDados({ ...dados, freelas: parseFloat(e.target.value) || 0 })}
                disabled={simulacaoTravada}
              />
              <p className="text-xs text-muted-foreground">
                Soma das categorias "FREELAS" do NIBO
              </p>
            </div>

            <div className="space-y-2">
              <Label>3. CMA - Alimentação Funcionários</Label>
              <Input
                type="number"
                step="0.01"
                value={dados.cma_alimentacao}
                onChange={(e) =>
                  setDados({ ...dados, cma_alimentacao: parseFloat(e.target.value) || 0 })
                }
                disabled={simulacaoTravada}
              />
              <p className="text-xs text-muted-foreground">
                Puxado da aba CMA Semanal
              </p>
            </div>

            <div className="space-y-2">
              <Label>Meta CMO Semanal (Opcional)</Label>
              <Input
                type="number"
                step="0.01"
                value={dados.meta_cmo || ''}
                onChange={(e) =>
                  setDados({ ...dados, meta_cmo: parseFloat(e.target.value) || undefined })
                }
                disabled={simulacaoTravada}
                placeholder="Ex: 45000"
              />
              <p className="text-xs text-muted-foreground">
                Define o limite para alertas automáticos
              </p>
            </div>

            <div className="space-y-2">
              <Label>4. Pro Labore Mensal</Label>
              <Input
                type="number"
                step="0.01"
                value={dados.pro_labore_mensal}
                onChange={(e) =>
                  setDados({ ...dados, pro_labore_mensal: parseFloat(e.target.value) || 0 })
                }
                disabled={simulacaoTravada}
              />
              <p className="text-xs text-muted-foreground">
                Proporcional semanal: {formatarMoeda(dados.pro_labore_semanal)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Resultado CMO */}
        <Card>
          <CardHeader>
            <CardTitle>Resultado CMO</CardTitle>
            <CardDescription>Custo total de mão de obra da semana</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
              <div className="text-sm text-muted-foreground mb-2">CMO Total</div>
              <div className="text-4xl font-bold text-blue-600">
                {formatarMoeda(dados.cmo_total)}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">1. Freelas</span>
                <span className="font-medium">{formatarMoeda(dados.freelas)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">2. Fixos</span>
                <span className="font-medium">{formatarMoeda(dados.fixos_total)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">3. Alimentação</span>
                <span className="font-medium">{formatarMoeda(dados.cma_alimentacao)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">4. Pro Labore</span>
                <span className="font-medium">{formatarMoeda(dados.pro_labore_semanal)}</span>
              </div>
            </div>

            <Button
              onClick={salvarSimulacao}
              disabled={salvando || simulacaoTravada}
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
                  Salvar Simulação
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Simulador de Funcionários Fixos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>2. Funcionários Fixos - Simulador</CardTitle>
              <CardDescription>
                Adicione/remova funcionários e calcule o custo semanal
              </CardDescription>
            </div>
            <Button
              onClick={adicionarFuncionario}
              size="sm"
              disabled={simulacaoTravada}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Funcionário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {funcionarios.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum funcionário adicionado</p>
              <p className="text-sm">Clique em "Adicionar Funcionário" para começar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {funcionarios.map((func, index) => {
                const resultado = calcularCustoFuncionario(func);
                return (
                  <div
                    key={index}
                    className="p-4 border rounded-lg space-y-3 bg-gray-50 dark:bg-gray-900/50"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Funcionário #{index + 1}</h4>
                      <Button
                        onClick={() => removerFuncionario(index)}
                        size="sm"
                        variant="destructive"
                        disabled={simulacaoTravada}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={func.nome}
                          onChange={(e) => atualizarFuncionario(index, 'nome', e.target.value)}
                          placeholder="Nome do funcionário"
                          disabled={simulacaoTravada}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={func.tipo_contratacao}
                          onValueChange={(v) => atualizarFuncionario(index, 'tipo_contratacao', v)}
                          disabled={simulacaoTravada}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CLT">CLT</SelectItem>
                            <SelectItem value="PJ">PJ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Área</Label>
                        <Select
                          value={func.area}
                          onValueChange={(v) => atualizarFuncionario(index, 'area', v)}
                          disabled={simulacaoTravada}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Salão">Salão</SelectItem>
                            <SelectItem value="Bar">Bar</SelectItem>
                            <SelectItem value="Cozinha">Cozinha</SelectItem>
                            <SelectItem value="Estoque">Estoque</SelectItem>
                            <SelectItem value="Segurança">Segurança</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Dias Trabalhados</Label>
                        <Input
                          type="number"
                          value={func.dias_trabalhados}
                          onChange={(e) =>
                            atualizarFuncionario(index, 'dias_trabalhados', parseInt(e.target.value) || 7)
                          }
                          disabled={simulacaoTravada}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Salário Bruto</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={func.salario_bruto}
                          onChange={(e) =>
                            atualizarFuncionario(index, 'salario_bruto', parseFloat(e.target.value) || 0)
                          }
                          disabled={simulacaoTravada}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Vale Transporte</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={func.vale_transporte}
                          onChange={(e) =>
                            atualizarFuncionario(index, 'vale_transporte', parseFloat(e.target.value) || 0)
                          }
                          disabled={simulacaoTravada}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Adicional</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={func.adicional}
                          onChange={(e) =>
                            atualizarFuncionario(index, 'adicional', parseFloat(e.target.value) || 0)
                          }
                          disabled={simulacaoTravada}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Aviso Prévio</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={func.adicional_aviso_previo}
                          onChange={(e) =>
                            atualizarFuncionario(
                              index,
                              'adicional_aviso_previo',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          disabled={simulacaoTravada}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Custo Semanal:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatarMoeda(resultado.custo_semanal)}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <span className="font-medium">Total Fixos (Semanal):</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatarMoeda(dados.fixos_total)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo CMO Total */}
      <Card className={dados.acima_meta ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-6 h-6" />
                CMO Total
                {dados.acima_meta && (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
              </CardTitle>
              <CardDescription>Soma dos 4 componentes</CardDescription>
            </div>
            <Link href="/ferramentas/cmo-semanal/alertas">
              <Button variant="outline" size="sm">
                <Bell className="w-4 h-4 mr-2" />
                Ver Alertas
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Componentes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200">
                <div className="text-xs text-muted-foreground mb-1">Freelas</div>
                <div className="text-lg font-bold">{formatarMoeda(dados.freelas)}</div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                <div className="text-xs text-muted-foreground mb-1">Fixos</div>
                <div className="text-lg font-bold">{formatarMoeda(dados.fixos_total)}</div>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200">
                <div className="text-xs text-muted-foreground mb-1">Alimentação</div>
                <div className="text-lg font-bold">{formatarMoeda(dados.cma_alimentacao)}</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200">
                <div className="text-xs text-muted-foreground mb-1">Pro Labore</div>
                <div className="text-lg font-bold">{formatarMoeda(dados.pro_labore_semanal)}</div>
              </div>
            </div>

            {/* Total */}
            <div className={`p-6 rounded-lg border-2 ${
              dados.acima_meta 
                ? 'bg-red-100 dark:bg-red-950/40 border-red-400' 
                : 'bg-blue-50 dark:bg-blue-950/20 border-blue-300'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">CMO Total Semanal</div>
                  <div className={`text-4xl font-bold ${dados.acima_meta ? 'text-red-600' : 'text-blue-600'}`}>
                    {formatarMoeda(dados.cmo_total)}
                  </div>
                </div>
                {dados.meta_cmo && (
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">Meta</div>
                    <div className="text-2xl font-semibold">{formatarMoeda(dados.meta_cmo)}</div>
                    {dados.acima_meta && (
                      <div className="text-sm text-red-600 font-medium mt-1">
                        +{formatarMoeda(dados.cmo_total - dados.meta_cmo)} acima
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Alerta */}
            {dados.acima_meta && (
              <div className="p-4 bg-red-100 dark:bg-red-950/40 border border-red-400 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-red-700">CMO Acima da Meta!</div>
                    <p className="text-sm text-red-600 mt-1">
                      O CMO desta semana ultrapassou a meta em{' '}
                      {((((dados.cmo_total - (dados.meta_cmo || 0)) / (dados.meta_cmo || 1)) * 100)).toFixed(1)}%.
                      Considere revisar os custos ou ajustar a meta.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={salvarSimulacao}
                disabled={salvando || simulacaoTravada}
                className="flex-1"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Simulação
                  </>
                )}
              </Button>
              <Link href="/ferramentas/cmo-semanal/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Ver Dashboard
                </Button>
              </Link>
              <Link href="/ferramentas/cmo-semanal/comparar" className="flex-1">
                <Button variant="outline" className="w-full">
                  <History className="w-4 h-4 mr-2" />
                  Comparar
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
