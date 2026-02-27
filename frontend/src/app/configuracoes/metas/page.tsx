'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Users,
  Star,
  Coffee,
  Edit,
  Save,
  X,
  DollarSign,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3,
  Award,
  Zap,
  Share2,
  Calendar,
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';

// Tipos
interface Meta {
  id: string;
  categoria: string;
  nome: string;
  meta_ativa: boolean;
  meta_diaria: number;
  meta_semanal: number;
  meta_mensal: number;
  valor_atual: any;
  ordem_exibicao: number;
  ticket_entrada?: number;
  ticket_bar?: number;
  meta_pessoas?: number;
  custo_artistico?: number;
  custo_producao?: number;
  percent_art_fat?: number;
}

interface MetasOrganizadas {
  indicadores_estrategicos: Meta[];
  cockpit_produtos: Meta[];
  cockpit_vendas: Meta[];
  cockpit_financeiro: Meta[];
  cockpit_marketing: Meta[];
  indicadores_qualidade: Meta[];
  indicadores_mensais: Meta[];
  metas_diarias: Meta[];
}

const formatarValor = (valor: number | null, tipo: string): string => {
  if (valor === null || valor === undefined) return '-';

  switch (tipo) {
    case 'moeda':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(valor);
    case 'porcentagem':
      return `${valor}%`;
    case 'numero':
    default:
      return valor.toString();
  }
};

const MetaCard = ({
  meta,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving,
}: {
  meta: Meta;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (valores: Record<string, number | null>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) => {
  const [valores, setValores] = useState({
    meta_diaria: meta.meta_diaria || '',
    meta_semanal: meta.meta_semanal || '',
    meta_mensal: meta.meta_mensal || '',
  });

  const handleSave = () => {
    const valoresParaSalvar = {
      meta_diaria: valores.meta_diaria
        ? parseFloat(valores.meta_diaria.toString())
        : 0,
      meta_semanal: valores.meta_semanal
        ? parseFloat(valores.meta_semanal.toString())
        : 0,
      meta_mensal: valores.meta_mensal
        ? parseFloat(valores.meta_mensal.toString())
        : 0,
    };
    onSave(valoresParaSalvar);
  };

  const getCategoryIcon = (categoria: string) => {
    switch (categoria.toLowerCase()) {
      case 'financeiro':
        return <DollarSign className="w-5 h-5" />;
      case 'avaliacoes':
        return <Star className="w-5 h-5" />;
      case 'cockpit_produtos':
        return <Coffee className="w-5 h-5" />;
      case 'marketing':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Target className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (categoria: string) => {
    switch (categoria.toLowerCase()) {
      case 'financeiro':
        return 'from-green-500 to-green-600';
      case 'avaliacoes':
        return 'from-yellow-500 to-yellow-600';
      case 'cockpit_produtos':
        return 'from-purple-500 to-purple-600';
      case 'marketing':
        return 'from-blue-500 to-blue-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <Card className="card-dark border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg bg-gradient-to-r ${getCategoryColor(meta.categoria)} text-white`}
            >
              {getCategoryIcon(meta.categoria)}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                {meta.nome}
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {meta.categoria}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={meta.meta_ativa ? 'default' : 'secondary'}
              className={
                meta.meta_ativa
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                  : ''
              }
            >
              {meta.meta_ativa ? 'Ativa' : 'Inativa'}
            </Badge>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Editar
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  disabled={isSaving}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div
          className={`grid gap-4 ${
            meta.categoria === 'metas_diarias' ||
            meta.categoria === 'indicadores_mensais'
              ? 'grid-cols-1 md:grid-cols-1'
              : 'grid-cols-1 md:grid-cols-3'
          }`}
        >
          {(() => {
            // Para metas diárias, mostrar apenas meta diária
            if (meta.categoria === 'metas_diarias') {
              return [
                {
                  key: 'diario',
                  label: 'Meta Diária',
                  valor: meta.meta_diaria,
                },
              ].map(periodo => {
                const chaveValor =
                  `meta_${periodo.key}` as keyof typeof valores;

                return (
                  <div
                    key={periodo.key}
                    className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl"
                  >
                    <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      {periodo.label}
                    </Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={valores[chaveValor]}
                        onChange={e =>
                          setValores(prev => ({
                            ...prev,
                            [chaveValor]: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        className="mt-2 bg-white dark:bg-gray-800"
                      />
                    ) : (
                      <div className="mt-2">
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {periodo.valor || 0}
                        </span>
                      </div>
                    )}
                  </div>
                );
              });
            }

            // Para indicadores mensais, mostrar apenas meta mensal
            if (meta.categoria === 'indicadores_mensais') {
              return [
                {
                  key: 'mensal',
                  label: 'Meta Mensal',
                  valor: meta.meta_mensal,
                },
              ].map(periodo => {
                const chaveValor =
                  `meta_${periodo.key}` as keyof typeof valores;

                return (
                  <div
                    key={periodo.key}
                    className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl"
                  >
                    <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      {periodo.label}
                    </Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={valores[chaveValor]}
                        onChange={e =>
                          setValores(prev => ({
                            ...prev,
                            [chaveValor]: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        className="mt-2 bg-white dark:bg-gray-800"
                      />
                    ) : (
                      <div className="mt-2">
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {periodo.valor || 0}
                        </span>
                      </div>
                    )}
                  </div>
                );
              });
            }

            // Para outras categorias, mostrar os três períodos
            return [
              { key: 'diario', label: 'Diário', valor: meta.meta_diaria },
              { key: 'semanal', label: 'Semanal', valor: meta.meta_semanal },
              { key: 'mensal', label: 'Mensal', valor: meta.meta_mensal },
            ].map(periodo => {
              const chaveValor = `meta_${periodo.key}` as keyof typeof valores;

              return (
                <div
                  key={periodo.key}
                  className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl"
                >
                  <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {periodo.label}
                  </Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={valores[chaveValor]}
                      onChange={e =>
                        setValores(prev => ({
                          ...prev,
                          [chaveValor]: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                      className="mt-2 bg-white dark:bg-gray-800"
                    />
                  ) : (
                    <div className="mt-2">
                      <span className="text-xl font-bold text-gray-900 dark:text-white">
                        {periodo.valor || 0}
                      </span>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {meta.categoria === 'metas_diarias' ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  <strong>Ticket Entrada:</strong> R${' '}
                  {meta.ticket_entrada?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  <strong>Ticket Bar:</strong> R${' '}
                  {meta.ticket_bar?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  <strong>Meta Pessoas:</strong> {meta.meta_pessoas || 0}{' '}
                  pessoas
                </p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <strong>% Art/Fat:</strong> {meta.percent_art_fat || 0}%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <p className="text-sm text-indigo-700 dark:text-indigo-300">
                  <strong>Custo Artístico:</strong> R${' '}
                  {meta.custo_artistico?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-3 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
                <p className="text-sm text-teal-700 dark:text-teal-300">
                  <strong>Custo Produção:</strong> R${' '}
                  {meta.custo_producao?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Valor Atual:</strong> {meta.valor_atual || 'N/A'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function MetasPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metas, setMetas] = useState<MetasOrganizadas>({
    indicadores_estrategicos: [],
    cockpit_produtos: [],
    cockpit_vendas: [],
    cockpit_financeiro: [],
    cockpit_marketing: [],
    indicadores_qualidade: [],
    indicadores_mensais: [],
    metas_diarias: [],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const carregarMetas = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/configuracoes/metas');
      const data = await response.json();

      if (data.success) {
        setMetas(data.data);
      } else {
        console.error('Erro ao carregar metas:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    } finally {
      setLoading(false);
    }
  }, []); // Removida dependência do toast

  useEffect(() => {
    carregarMetas();
  }, [carregarMetas]);

  // Otimizar cálculo de estatísticas com useMemo
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; ativas: number }> = {};

    Object.entries(metas).forEach(([categoria, metasCategoria]) => {
      const total = metasCategoria.length;
      const ativas = metasCategoria.filter(m => m.meta_ativa).length;
      stats[categoria] = { total, ativas };
    });

    return stats;
  }, [metas]);

  // Otimizar cálculo do total de metas
  const totalMetas = useMemo(() => {
    return Object.values(metas).reduce((acc, curr) => acc + curr.length, 0);
  }, [metas]);

  const getCategoryStats = useCallback(
    (categoria: keyof MetasOrganizadas) => {
      return categoryStats[categoria] || { total: 0, ativas: 0 };
    },
    [categoryStats]
  );

  const salvarMeta = async (
    metaId: string,
    valores: Record<string, number | null>
  ) => {
    try {
      setSavingId(metaId);

      const response = await fetch('/api/configuracoes/metas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ id: metaId }, valores)),
      });

      const data = await response.json();

      if (data.success) {
        await carregarMetas();
        setEditingId(null);
        toast({
          title: '✅ Sucesso',
          description: 'Meta atualizada com sucesso!',
        });
      } else {
        toast({
          title: '❌ Erro',
          description: data.error || 'Erro ao atualizar meta',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      toast({
        title: '❌ Erro',
        description: 'Erro ao salvar meta',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const getTabIcon = (categoria: string) => {
    switch (categoria.toLowerCase()) {
      case 'indicadores_estrategicos':
        return <Target className="w-4 h-4" />;
      case 'cockpit_produtos':
        return <Coffee className="w-4 h-4" />;
      case 'cockpit_vendas':
        return <TrendingUp className="w-4 h-4" />;
      case 'cockpit_financeiro':
        return <DollarSign className="w-4 h-4" />;
      case 'cockpit_marketing':
        return <Share2 className="w-4 h-4" />;
      case 'indicadores_qualidade':
        return <Star className="w-4 h-4" />;
      case 'indicadores_mensais':
        return <Calendar className="w-4 h-4" />;
      case 'metas_diarias':
        return <Activity className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingState
          title="Carregando metas..."
          subtitle="Preparando objetivos e indicadores"
          icon={<Target className="w-4 h-4" />}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header Moderno */}
        <div className="relative">
          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Button
                  variant="ghost"
                  onClick={() => router.push('/configuracoes')}
                  className="text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>

                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <Target className="w-8 h-8" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">
                      Configuração de Metas
                    </h1>
                    <p className="text-orange-100 mt-1">
                      Defina e acompanhe os KPIs do seu negócio
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-orange-200">Total de Metas</div>
                  <div className="text-2xl font-bold">{totalMetas}</div>
                </div>
                <div className="p-3 bg-white/10 rounded-xl">
                  <Award className="w-8 h-8" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
          {metas && typeof metas === 'object'
            ? (Object.entries(metas) as [keyof MetasOrganizadas, Meta[]][]).map(
                ([categoria, metasCategoria]) => {
                  const stats = getCategoryStats(categoria);
                  return (
                    <Card
                      key={categoria}
                      className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 capitalize">
                              {categoria.replace('_', ' ')}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                              {stats.ativas}/{stats.total}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Metas ativas
                            </p>
                          </div>
                          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl">
                            {getTabIcon(categoria)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
              )
            : null}
        </div>

        {/* Tabs de Categorias */}
          <Card className="card-dark border-0 shadow-lg">
          <Tabs defaultValue="indicadores_estrategicos" className="w-full">
            <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-white">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Gerenciar Metas por Categoria
                </CardTitle>
              </div>

              <TabsList className="grid w-full grid-cols-8 bg-gray-100 dark:bg-gray-700">
                {metas && typeof metas === 'object'
                  ? (
                      Object.entries(metas) as [
                        keyof MetasOrganizadas,
                        Meta[],
                      ][]
                    ).map(([categoria, metasCategoria]) => (
                      <TabsTrigger
                        key={categoria}
                        value={categoria}
                        className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600"
                      >
                        {getTabIcon(categoria)}
                        <span className="capitalize">
                          {categoria === 'indicadores_estrategicos'
                            ? 'Estratégicos'
                            : categoria === 'cockpit_produtos'
                              ? 'Produtos'
                              : categoria === 'cockpit_vendas'
                                ? 'Vendas'
                                : categoria === 'cockpit_financeiro'
                                  ? 'Financeiro'
                                  : categoria === 'cockpit_marketing'
                                    ? 'Marketing'
                                    : categoria === 'indicadores_qualidade'
                                      ? 'Qualidade'
                                      : categoria === 'indicadores_mensais'
                                        ? 'Mensais'
                                        : categoria === 'metas_diarias'
                                          ? 'Diárias'
                                          : String(categoria).replace('_', ' ')}
                        </span>
                        <Badge
                          variant="outline"
                          className="ml-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                        >
                          {metasCategoria.length}
                        </Badge>
                      </TabsTrigger>
                    ))
                  : null}
              </TabsList>
            </CardHeader>

            <CardContent className="p-6">
              {metas && typeof metas === 'object'
                ? (
                    Object.entries(metas) as [keyof MetasOrganizadas, Meta[]][]
                  ).map(([categoria, metasCategoria]) => (
                    <TabsContent
                      key={categoria}
                      value={categoria}
                      className="space-y-6 mt-0"
                    >
                      {metasCategoria.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                            {getTabIcon(categoria)}
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Nenhuma meta encontrada
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            Não há metas configuradas para a categoria{' '}
                            {categoria.replace('_', ' ')}.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {metasCategoria.map((meta: Meta) => (
                            <MetaCard
                              key={meta.id}
                              meta={meta}
                              isEditing={editingId === meta.id}
                              onEdit={() => setEditingId(meta.id)}
                              onSave={valores => salvarMeta(meta.id, valores)}
                              onCancel={() => setEditingId(null)}
                              isSaving={savingId === meta.id}
                            />
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  ))
                : null}
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
