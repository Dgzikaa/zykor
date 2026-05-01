'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tag, RefreshCw, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface Pendencia {
  mesa: string;
  motivo: string;
  qtd_itens: number;
  total_desconto: number;
}

interface Categorizado {
  categoria: string;
  total: number;
}

interface Cobertura {
  total_categorizado: number;
  total_sem_padrao: number;
  total_geral: number;
  pct_cobertura: number;
}

interface Keyword {
  id: number;
  pattern: string;
  categoria: string;
  prioridade: number;
  bar_id: number | null;
  descricao: string | null;
  exemplo: string | null;
  ativo: boolean;
}

const CATEGORIAS = [
  { value: 'socios', label: 'Sócios', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' },
  { value: 'artistas', label: 'Artistas', color: 'bg-pink-500/10 text-pink-700 dark:text-pink-300' },
  { value: 'funcionarios_operacao', label: 'Funcionários (Operação)', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  { value: 'funcionarios_escritorio', label: 'Funcionários (Escritório)', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  { value: 'clientes', label: 'Clientes (Benefícios)', color: 'bg-green-500/10 text-green-700 dark:text-green-300' },
  { value: '_descartado', label: 'Descartar', color: 'bg-gray-500/10 text-gray-700 dark:text-gray-300' },
];

function getCategoriaInfo(cat: string) {
  return CATEGORIAS.find(c => c.value === cat) || { label: cat, color: 'bg-gray-100 text-gray-700' };
}

function getCurrentWeek(): number {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = (d.getTime() - start.getTime()) / 86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ConsumosClassificacaoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [ano, setAno] = useState(new Date().getFullYear());
  const [semana, setSemana] = useState(getCurrentWeek());
  const [loading, setLoading] = useState(false);

  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [categorizado, setCategorizado] = useState<Categorizado[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [showInactive, setShowInactive] = useState(false);

  // Modal de atribuir categoria
  const [modalOpen, setModalOpen] = useState(false);
  const [pendSelecionada, setPendSelecionada] = useState<Pendencia | null>(null);
  const [novoPattern, setNovoPattern] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('clientes');
  const [novaDescricao, setNovaDescricao] = useState('');

  useEffect(() => {
    setPageTitle('🏷️ Classificação de Consumos');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const buscarDados = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const [resPend, resKw] = await Promise.all([
        fetch(`/api/cmv-semanal/consumos-classificacao?bar_id=${selectedBar.id}&ano=${ano}&semana=${semana}`),
        fetch(`/api/cmv-semanal/consumos-classificacao/keywords?include_inactive=${showInactive}`),
      ]);

      const [dataPend, dataKw] = await Promise.all([resPend.json(), resKw.json()]);

      if (resPend.ok) {
        setCobertura(dataPend.cobertura);
        setCategorizado(dataPend.categorizado);
        setPendencias(dataPend.pendencias);
      } else {
        toast.error('Erro ao buscar pendências: ' + dataPend.error);
      }

      if (resKw.ok) {
        setKeywords(dataKw.keywords);
      } else {
        toast.error('Erro ao buscar keywords: ' + dataKw.error);
      }
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedBar, ano, semana, showInactive]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  const abrirModalAtribuir = (pend: Pendencia) => {
    setPendSelecionada(pend);
    // Sugerir pattern: motivo (sem espaços extras, em lowercase, sem pontuação)
    const sugestao = (pend.motivo !== '(sem motivo)' ? pend.motivo : pend.mesa)
      .toLowerCase()
      .replace(/[^a-záàâãéèêíïóôõöúüç0-9 ]/gi, '')
      .trim();
    setNovoPattern(sugestao);
    setNovaCategoria('clientes');
    setNovaDescricao(`Aprendido de "${pend.motivo}" / mesa "${pend.mesa}"`);
    setModalOpen(true);
  };

  const salvarKeyword = async () => {
    if (!novoPattern.trim()) {
      toast.error('Pattern é obrigatório');
      return;
    }
    try {
      const res = await fetch('/api/cmv-semanal/consumos-classificacao/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: novoPattern,
          categoria: novaCategoria,
          descricao: novaDescricao,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Keyword adicionada — recarregando...');
        setModalOpen(false);
        await buscarDados();
      } else {
        toast.error('Erro: ' + data.error);
      }
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const toggleAtivo = async (kw: Keyword) => {
    try {
      const res = await fetch(`/api/cmv-semanal/consumos-classificacao/keywords/${kw.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !kw.ativo }),
      });
      if (res.ok) {
        toast.success(`Keyword ${!kw.ativo ? 'ativada' : 'desativada'}`);
        await buscarDados();
      } else {
        const data = await res.json();
        toast.error('Erro: ' + data.error);
      }
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const corCobertura =
    !cobertura ? 'text-gray-500' :
    cobertura.pct_cobertura >= 95 ? 'text-green-600 dark:text-green-400' :
    cobertura.pct_cobertura >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
    'text-red-600 dark:text-red-400';

  const keywordsAgrupadas = CATEGORIAS.map(cat => ({
    ...cat,
    items: keywords.filter(k => k.categoria === cat.value),
  })).filter(g => g.items.length > 0);

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Input type="number" value={ano} onChange={(e) => setAno(parseInt(e.target.value) || ano)} className="w-24" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Semana</Label>
              <Input type="number" value={semana} onChange={(e) => setSemana(parseInt(e.target.value) || semana)} className="w-24" min={1} max={53} />
            </div>
            <Button onClick={buscarDados} disabled={loading} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cobertura */}
      {cobertura && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Cobertura</div>
              <div className={`text-2xl font-bold ${corCobertura}`}>
                {cobertura.pct_cobertura.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {cobertura.pct_cobertura >= 95 ? (
                  <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> Excelente</span>
                ) : cobertura.pct_cobertura >= 90 ? (
                  <span className="inline-flex items-center gap-1 text-yellow-600"><AlertTriangle className="h-3 w-3" /> Atenção</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> Crítico</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Categorizado</div>
              <div className="text-2xl font-bold">{fmtBRL(cobertura.total_categorizado)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Sem Padrão</div>
              <div className={`text-2xl font-bold ${cobertura.total_sem_padrao > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {fmtBRL(cobertura.total_sem_padrao)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Total Descontos</div>
              <div className="text-2xl font-bold">{fmtBRL(cobertura.total_geral)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pendencias" className="w-full">
        <TabsList>
          <TabsTrigger value="pendencias">
            Pendências da Semana
            {pendencias.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendencias.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="categorizado">Por Categoria</TabsTrigger>
          <TabsTrigger value="keywords">
            Keywords Cadastradas
            <Badge variant="secondary" className="ml-2">{keywords.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Pendências */}
        <TabsContent value="pendencias" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumos sem categoria — semana {semana}/{ano}</CardTitle>
            </CardHeader>
            <CardContent>
              {pendencias.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <p>Nenhum consumo sem categoria nessa semana 🎉</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Mesa</th>
                        <th className="text-left py-2 px-2">Motivo</th>
                        <th className="text-right py-2 px-2">Itens</th>
                        <th className="text-right py-2 px-2">R$</th>
                        <th className="text-right py-2 px-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendencias.map((p, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-mono text-xs">{p.mesa}</td>
                          <td className="py-2 px-2">{p.motivo}</td>
                          <td className="py-2 px-2 text-right">{p.qtd_itens}</td>
                          <td className="py-2 px-2 text-right font-mono">{fmtBRL(p.total_desconto)}</td>
                          <td className="py-2 px-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => abrirModalAtribuir(p)}>
                              <Tag className="h-3 w-3 mr-1" />
                              Atribuir
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categorizado */}
        <TabsContent value="categorizado">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por categoria — semana {semana}/{ano}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categorizado.map((c) => {
                  const info = getCategoriaInfo(c.categoria);
                  return (
                    <div key={c.categoria} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <Badge className={info.color}>{info.label}</Badge>
                      <span className="font-mono font-semibold">{fmtBRL(parseFloat(String(c.total)))}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keywords */}
        <TabsContent value="keywords">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Keywords cadastradas</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Mostrar inativas</Label>
                <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {keywordsAgrupadas.map((g) => (
                  <div key={g.value}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={g.color}>{g.label}</Badge>
                      <span className="text-xs text-muted-foreground">({g.items.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {g.items.map((kw) => (
                        <div key={kw.id} className={`p-2 rounded border text-xs ${kw.ativo ? 'bg-card' : 'bg-muted/30 opacity-60'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <code className="font-mono text-xs break-all">{kw.pattern}</code>
                              {kw.descricao && (
                                <div className="text-muted-foreground text-[10px] mt-1 truncate" title={kw.descricao}>
                                  {kw.descricao}
                                </div>
                              )}
                            </div>
                            <Switch checked={kw.ativo} onCheckedChange={() => toggleAtivo(kw)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de atribuir categoria */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir categoria</DialogTitle>
            <DialogDescription>
              {pendSelecionada && (
                <>
                  Mesa <code className="text-xs">{pendSelecionada.mesa}</code> /
                  motivo <strong>{pendSelecionada.motivo}</strong> /
                  R$ {pendSelecionada.total_desconto}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Pattern (regex POSIX, sem acento, lowercase)</Label>
              <Input value={novoPattern} onChange={(e) => setNovoPattern(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">
                Use boundaries <code>\m</code>/<code>\M</code> pra evitar falsos matches em nomes curtos
                (ex: <code>\mana\M</code> só pega &quot;ana&quot;, não &quot;banana&quot;).
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={novaCategoria} onValueChange={setNovaCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvarKeyword}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Keyword
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
