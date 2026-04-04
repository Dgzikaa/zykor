'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package, AlertTriangle, CheckCircle, XCircle, FileText, Calendar, Building2 } from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProdutoAuditoria {
  raw_id: number;
  prd_codigo: string;
  prd_desc: string;
  prd_venda: string;
  prd_ativo: string;
  prd_estoque: string | null;
  loc_desc: string | null;
  grp_desc: string | null;
  hora_coleta: string;
  foi_processado: boolean;
  incluido: boolean;
  motivo_exclusao: string | null;
  regra_aplicada: string | null;
  ordem_aplicacao: number | null;
  categoria_mix: string | null;
  categoria_local: string | null;
  versao_regras: string | null;
  raw_data: any;
}

interface AuditoriaData {
  audit: {
    data_consulta: string;
    hora_processamento: string;
    bar_id: number;
    total_produtos_raw: number;
    total_incluidos: number;
    total_excluidos: number;
    percentual_excluido: number;
    percentual_stockout: number;
    produtos_disponiveis: number;
    produtos_indisponiveis: number;
    exclusoes_por_motivo: Record<string, number>;
    stockout_por_categoria: Record<string, any>;
    versao_regras: string;
    tempo_processamento_ms: number;
  } | null;
  produtos: ProdutoAuditoria[];
  resumo: {
    total_raw: number;
    total_processado: number;
    incluidos: number;
    excluidos: number;
    nao_processados: number;
  };
}

const MOTIVOS_EXCLUSAO: Record<string, string> = {
  'produto_inativo': 'Produto inativo (prd_ativo != S)',
  'loc_desc_null': 'Local de produção não definido',
  'prefixo_hh': 'Happy Hour [HH] - não disponível às 19h',
  'prefixo_dd': 'Dose Dupla [DD] - variação promocional',
  'prefixo_in': 'Insumo [IN] - não é produto vendável',
  'prefixo_pp': 'Pegue e Pague [PP] - local excluído',
  'loc_pegue_pague': 'Local: Pegue e Pague',
  'loc_venda_volante': 'Local: Venda Volante',
  'loc_baldes': 'Local: Baldes',
  'grp_baldes': 'Grupo: Baldes',
  'grp_happy_hour': 'Grupo: Happy Hour',
  'grp_chegadeira': 'Grupo: Chegadeira',
  'grp_dose_dupla': 'Grupo: Dose Dupla',
  'grp_dose_dupla_sem_alcool': 'Grupo: Dose Dupla sem álcool',
  'grp_adicional': 'Grupo: Adicional',
  'grp_insumos': 'Grupo: Insumos',
  'grp_promo_chivas': 'Grupo: Promo Chivas',
  'grp_uso_interno': 'Grupo: Uso Interno',
  'grp_pegue_pague': 'Grupo: Pegue e Pague',
  'palavra_happy_hour': 'Contém "Happy Hour" no nome',
  'palavra_hh': 'Contém " HH" no nome',
  'palavra_dose_dupla': 'Contém "Dose Dupla" no nome',
  'palavra_balde': 'Contém "Balde" no nome',
  'palavra_garrafa': 'Contém "Garrafa" no nome',
  'palavra_combo': 'Combo promocional',
  'palavra_adicional': 'Contém "Adicional" no nome',
  'palavra_embalagem': 'Contém "Embalagem" no nome'
};

export default function StockoutAuditoriaPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar: contextBar, isLoading: barLoading, bars } = useBar();

  const [selectedBarId, setSelectedBarId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });

  const [prdCodigo, setPrdCodigo] = useState('');
  const [auditoriaData, setAuditoriaData] = useState<AuditoriaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'incluidos' | 'excluidos'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');

  useEffect(() => {
    if (contextBar?.id) {
      setSelectedBarId(contextBar.id);
    }
  }, [contextBar]);

  useEffect(() => {
    setPageTitle('🔍 Auditoria de Stockout');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const buscarAuditoria = async () => {
    if (!selectedBarId) {
      toast.error('Selecione um bar primeiro');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/contahub/stockout/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_consulta: selectedDate,
          bar_id: selectedBarId,
          prd_codigo: prdCodigo || undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        setAuditoriaData(result.data);
        toast.success(`Auditoria carregada: ${result.data.produtos.length} produtos`);
      } else {
        toast.error(result.error || 'Erro ao buscar auditoria');
        setAuditoriaData(null);
      }
    } catch (error) {
      console.error('Erro ao buscar auditoria:', error);
      toast.error('Erro ao buscar auditoria');
      setAuditoriaData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!barLoading && selectedBarId) {
      buscarAuditoria();
    }
  }, [selectedBarId, barLoading]);

  const produtosFiltrados = auditoriaData?.produtos.filter(p => {
    if (filtroStatus === 'incluidos' && !p.incluido) return false;
    if (filtroStatus === 'excluidos' && p.incluido) return false;
    if (filtroCategoria !== 'todas' && p.categoria_local !== filtroCategoria) return false;
    return true;
  }) || [];

  const categorias = ['Bar', 'Drinks', 'Comidas', 'Outro'];
  const getCountPorCategoria = (cat: string) => {
    return auditoriaData?.produtos.filter(p => p.categoria_local === cat).length || 0;
  };

  const formatarData = (data: string) => {
    try {
      return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return data;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Auditoria de Stockout v2.0</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Sistema de rastreamento RAW → PROCESSADO → AUDIT
          </p>
        </div>
      </div>

      {/* Controles de Busca */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Bar:
                </label>
                <Select
                  value={selectedBarId?.toString() || ''}
                  onValueChange={(value) => setSelectedBarId(parseInt(value))}
                >
                  <SelectTrigger className="w-[180px] bg-[hsl(var(--background))] border-[hsl(var(--border))]">
                    <SelectValue placeholder="Selecione o bar" />
                  </SelectTrigger>
                  <SelectContent>
                    {(bars || []).map((bar) => (
                      <SelectItem key={bar.id} value={bar.id.toString()}>
                        {bar.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">
                  Data:
                </label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="input-dark w-[180px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">
                  Código Produto:
                </label>
                <Input
                  type="text"
                  value={prdCodigo}
                  onChange={(e) => setPrdCodigo(e.target.value)}
                  placeholder="Ex: 872"
                  className="input-dark w-[120px]"
                />
              </div>

              <Button
                onClick={buscarAuditoria}
                disabled={loading}
                loading={loading}
                className="btn-primary-dark"
                leftIcon={!loading ? <Search className="w-4 h-4" /> : undefined}
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {auditoriaData && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
              <CardHeader className="pb-1.5 p-3">
                <CardTitle className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Total RAW
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold">
                  {auditoriaData.resumo.total_raw}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Coletados do sistema
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
              <CardHeader className="pb-1.5 p-3">
                <CardTitle className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Processados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {auditoriaData.resumo.total_processado}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Analisados
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
              <CardHeader className="pb-1.5 p-3">
                <CardTitle className="text-xs font-medium text-green-600 dark:text-green-400">
                  Incluídos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  {auditoriaData.resumo.incluidos}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Válidos para análise
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
              <CardHeader className="pb-1.5 p-3">
                <CardTitle className="text-xs font-medium text-red-600 dark:text-red-400">
                  Excluídos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" />
                  {auditoriaData.resumo.excluidos}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Filtrados por regras
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
              <CardHeader className="pb-1.5 p-3">
                <CardTitle className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                  Não Processados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  {auditoriaData.resumo.nao_processados}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Aguardando
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Informações do Audit */}
          {auditoriaData.audit && (
            <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Resumo do Processamento
                </CardTitle>
                <CardDescription className="text-xs">
                  Processado em {formatarData(auditoriaData.audit.hora_processamento)}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Versão das Regras</p>
                    <p className="text-sm font-semibold">{auditoriaData.audit.versao_regras}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Tempo de Processamento</p>
                    <p className="text-sm font-semibold">{auditoriaData.audit.tempo_processamento_ms}ms</p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">% Stockout</p>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {auditoriaData.audit.percentual_stockout.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">% Excluído</p>
                    <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                      {auditoriaData.audit.percentual_excluido.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Stockout por Categoria */}
                {auditoriaData.audit.stockout_por_categoria && Object.keys(auditoriaData.audit.stockout_por_categoria).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Stockout por Categoria</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Object.entries(auditoriaData.audit.stockout_por_categoria).map(([categoria, stats]: [string, any]) => (
                        <div key={categoria} className="p-3 bg-[hsl(var(--muted))] rounded-lg border border-[hsl(var(--border))]">
                          <h5 className="font-semibold text-sm mb-2">{categoria}</h5>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-[hsl(var(--muted-foreground))]">Total:</span>
                              <span className="font-medium">{stats.total}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-green-600 dark:text-green-400">Disponíveis:</span>
                              <span className="font-medium text-green-600 dark:text-green-400">{stats.disponiveis}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-red-600 dark:text-red-400">Stockout:</span>
                              <span className="font-medium text-red-600 dark:text-red-400">{stats.stockout}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-[hsl(var(--border))]">
                              <span className="text-[hsl(var(--muted-foreground))]">% Stockout:</span>
                              <Badge className={
                                parseFloat(stats.percentual) <= 10 ? 'badge-success' :
                                parseFloat(stats.percentual) <= 25 ? 'badge-warning' :
                                'badge-error'
                              }>
                                {stats.percentual}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exclusões por Motivo */}
                {auditoriaData.audit.exclusoes_por_motivo && Object.keys(auditoriaData.audit.exclusoes_por_motivo).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Exclusões por Motivo</h4>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      {Object.entries(auditoriaData.audit.exclusoes_por_motivo)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([motivo, qtd]) => (
                          <div key={motivo} className="flex items-center justify-between p-2 bg-[hsl(var(--muted))] rounded">
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                              {MOTIVOS_EXCLUSAO[motivo] || motivo}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {qtd as number}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Filtros de Status e Categoria */}
          <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <CardContent className="p-3">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Button
                    size="sm"
                    variant={filtroStatus === 'todos' ? 'default' : 'outline'}
                    onClick={() => setFiltroStatus('todos')}
                    className={filtroStatus === 'todos' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  >
                    Todos ({auditoriaData.produtos.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={filtroStatus === 'incluidos' ? 'default' : 'outline'}
                    onClick={() => setFiltroStatus('incluidos')}
                    className={filtroStatus === 'incluidos' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                  >
                    Incluídos ({auditoriaData.resumo.incluidos})
                  </Button>
                  <Button
                    size="sm"
                    variant={filtroStatus === 'excluidos' ? 'default' : 'outline'}
                    onClick={() => setFiltroStatus('excluidos')}
                    className={filtroStatus === 'excluidos' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                  >
                    Excluídos ({auditoriaData.resumo.excluidos})
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Categoria:</span>
                  <Button
                    size="sm"
                    variant={filtroCategoria === 'todas' ? 'default' : 'outline'}
                    onClick={() => setFiltroCategoria('todas')}
                    className={filtroCategoria === 'todas' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  >
                    Todas
                  </Button>
                  {categorias.map(cat => (
                    <Button
                      key={cat}
                      size="sm"
                      variant={filtroCategoria === cat ? 'default' : 'outline'}
                      onClick={() => setFiltroCategoria(cat)}
                      className={filtroCategoria === cat ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                    >
                      {cat} ({getCountPorCategoria(cat)})
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Produtos */}
          <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produtos ({produtosFiltrados.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Detalhes do processamento de cada produto
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {produtosFiltrados.map((produto, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      produto.incluido
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {produto.incluido ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )}
                          <h3 className="font-semibold text-base">
                            {produto.prd_desc}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            #{produto.prd_codigo}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[hsl(var(--muted-foreground))]">Local:</span>
                            <p className="font-medium">{produto.loc_desc || 'Não definido'}</p>
                          </div>
                          <div>
                            <span className="text-[hsl(var(--muted-foreground))]">Grupo:</span>
                            <p className="font-medium">{produto.grp_desc || 'Não definido'}</p>
                          </div>
                          <div>
                            <span className="text-[hsl(var(--muted-foreground))]">Status Venda:</span>
                            <Badge className={produto.prd_venda === 'S' ? 'badge-success' : 'badge-error'}>
                              {produto.prd_venda === 'S' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-[hsl(var(--muted-foreground))]">Estoque:</span>
                            <p className="font-medium">{produto.prd_estoque || '0'}</p>
                          </div>
                        </div>

                        {!produto.incluido && produto.motivo_exclusao && (
                          <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded border border-red-300 dark:border-red-700">
                            <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                              Motivo da Exclusão:
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                              {MOTIVOS_EXCLUSAO[produto.motivo_exclusao] || produto.motivo_exclusao}
                            </p>
                            {produto.regra_aplicada && (
                              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                                Regra: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">{produto.regra_aplicada}</code>
                              </p>
                            )}
                          </div>
                        )}

                        {produto.incluido && (
                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-[hsl(var(--muted-foreground))]">Categoria Mix:</span>
                              <Badge className="ml-2 badge-primary">{produto.categoria_mix}</Badge>
                            </div>
                            <div>
                              <span className="text-[hsl(var(--muted-foreground))]">Categoria Local:</span>
                              <Badge className="ml-2 badge-secondary">{produto.categoria_local}</Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {produtosFiltrados.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>Nenhum produto encontrado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {loading && (
        <LoadingState
          title="Carregando auditoria..."
          subtitle="Buscando dados de processamento"
          icon={<Search className="w-4 h-4" />}
        />
      )}
    </div>
  );
}
