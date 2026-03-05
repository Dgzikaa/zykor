'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  Clock,
  DollarSign,
  Scale,
  TrendingUp,
  Database,
  ChefHat
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface ReceitaInfo {
  receita_id: number;
  receita_nome: string;
  custo_total: string;
  peso_total: number;
  rendimento_esperado: number;
  custo_por_grama: string;
  insumos_count: number;
}

interface Receita {
  id: number;
  receita_nome: string;
  receita_codigo: string;
  receita_categoria: string | null;
}

export default function FichasTecnicasPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [processando, setProcessando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [resultadoAtualizacao, setResultadoAtualizacao] = useState<{
    total_receitas: number;
    sucessos: number;
    erros: number;
    detalhes: ReceitaInfo[];
  } | null>(null);

  const [filtro, setFiltro] = useState<'todas' | 'especifica' | 'por_insumo'>('todas');
  const [receitaId, setReceitaId] = useState('');
  const [insumoId, setInsumoId] = useState('');
  
  // Estados para busca de receitas
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loadingReceitas, setLoadingReceitas] = useState(false);

  useEffect(() => {
    setPageTitle('📋 Gestão de Fichas Técnicas');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Buscar receitas quando o filtro for "especifica"
  useEffect(() => {
    if (filtro === 'especifica') {
      buscarReceitas();
    }
  }, [filtro]);

  const buscarReceitas = async () => {
    try {
      setLoadingReceitas(true);
      const response = await fetch('/api/receitas');
      const data = await response.json();
      
      if (data.receitas) {
        setReceitas(data.receitas);
      }
    } catch (error) {
      console.error('Erro ao buscar receitas:', error);
      toast.error('Erro ao carregar receitas');
    } finally {
      setLoadingReceitas(false);
    }
  };

  const atualizarFichasTecnicas = async () => {
    try {
      setProcessando(true);
      toast.info('Iniciando atualização de fichas técnicas...');

      const body: any = {};

      if (filtro === 'especifica' && receitaId) {
        body.receita_id = parseInt(receitaId);
      } else if (filtro === 'por_insumo' && insumoId) {
        body.insumo_id = parseInt(insumoId);
      }

      const response = await fetch('/api/fichas-tecnicas/atualizar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setResultadoAtualizacao(result);
        setUltimaAtualizacao(new Date());
        toast.success(
          `✅ ${result.sucessos} fichas técnicas atualizadas com sucesso!`
        );
      } else {
        toast.error(result.error || 'Erro ao atualizar fichas técnicas');
      }
    } catch (error) {
      console.error('Erro ao atualizar fichas:', error);
      toast.error('Erro ao processar atualização');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            Gestão de Fichas Técnicas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm ml-11">
            Atualize automaticamente gramatura e custos das fichas técnicas
          </p>
        </div>

        {/* Card de Controle */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Atualizar Fichas Técnicas
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Recalcule automaticamente pesos, gramaturas e custos das receitas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Tipo de Atualização</Label>
              <Select value={filtro} onValueChange={(v: any) => setFiltro(v)}>
                <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800">
                  <SelectItem value="todas">📋 Atualizar TODAS as receitas</SelectItem>
                  <SelectItem value="especifica">🎯 Atualizar receita específica</SelectItem>
                  <SelectItem value="por_insumo">🧪 Atualizar por insumo alterado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtro === 'especifica' && (
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Selecionar Receita</Label>
                <Select 
                  value={receitaId} 
                  onValueChange={setReceitaId}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                    <SelectValue placeholder="Selecione uma receita..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 max-h-[300px]">
                    {loadingReceitas ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                        Carregando receitas...
                      </div>
                    ) : receitas.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        Nenhuma receita encontrada
                      </div>
                    ) : (
                      receitas.map((receita) => (
                        <SelectItem 
                          key={receita.id} 
                          value={receita.id.toString()}
                          className="text-gray-900 dark:text-gray-100"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{receita.receita_nome}</span>
                            <Badge variant="outline" className="text-xs">
                              {receita.receita_codigo}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

              </div>
            )}

            {filtro === 'por_insumo' && (
              <div>
                <Label className="text-gray-700 dark:text-gray-300">ID do Insumo</Label>
                <Input
                  type="number"
                  placeholder="Ex: 456"
                  value={insumoId}
                  onChange={(e) => setInsumoId(e.target.value)}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            )}

            <Button
              onClick={atualizarFichasTecnicas}
              disabled={processando || (filtro === 'especifica' && !receitaId) || (filtro === 'por_insumo' && !insumoId)}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
            >
              {processando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar Fichas
                </>
              )}
            </Button>

            {ultimaAtualizacao && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 pt-2">
                <Clock className="w-4 h-4" />
                Última atualização: {ultimaAtualizacao.toLocaleString('pt-BR')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resultados */}
        {resultadoAtualizacao && (
          <div className="space-y-4">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Processadas</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {resultadoAtualizacao.total_receitas}
                      </p>
                    </div>
                    <Database className="w-10 h-10 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Sucessos</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {resultadoAtualizacao.sucessos}
                      </p>
                    </div>
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Erros</p>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {resultadoAtualizacao.erros}
                      </p>
                    </div>
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detalhes das Receitas */}
            {resultadoAtualizacao.detalhes && resultadoAtualizacao.detalhes.length > 0 && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <ChefHat className="w-5 h-5" />
                    Detalhes das Receitas Atualizadas
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Mostrando até 10 receitas atualizadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {resultadoAtualizacao.detalhes.map((receita, index) => (
                      <div
                        key={index}
                        className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {receita.receita_nome}
                            </h4>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                ID: {receita.receita_id}
                              </Badge>
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                {receita.insumos_count} insumos
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Custo Total
                              </p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                R$ {receita.custo_total}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Scale className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Peso Total
                              </p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {receita.peso_total}g
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-600" />
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Rendimento
                              </p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {receita.rendimento_esperado}g
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-orange-600" />
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Custo/g
                              </p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                R$ {receita.custo_por_grama}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Informações */}
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 mt-6">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100 text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Informações Importantes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <p>• <strong>Atualização Completa:</strong> Recalcula custos e gramaturas de todas as receitas ativas</p>
            <p>• <strong>Atualização Específica:</strong> Atualiza apenas uma receita pelo ID</p>
            <p>• <strong>Por Insumo:</strong> Atualiza todas as receitas que contém um insumo específico</p>
            <p>• <strong>Histórico:</strong> Todas as alterações são registradas automaticamente</p>
            <p>• <strong>Automação:</strong> No futuro, essa atualização será automática ao alterar insumos/receitas</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

