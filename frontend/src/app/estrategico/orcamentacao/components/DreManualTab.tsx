'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Save, X, RefreshCw, Filter } from 'lucide-react';

// Mesma estrutura do orcamentacao-service.ts (mantida em sync manualmente).
// Cada categoria zykor mapeia pra uma categoria_macro DRE.
const CATEGORIAS_POR_MACRO: { macro: string; categorias: string[] }[] = [
  {
    macro: 'Receita',
    categorias: ['Stone Crédito', 'Stone Débito', 'Stone Pix', 'Pix Direto na Conta', 'Dinheiro', 'Receita de Eventos', 'Outras Receitas'],
  },
  {
    macro: 'Custos Variáveis',
    categorias: ['IMPOSTO', 'PROVISÃO FISCAL', 'COMISSÃO 10%', 'TAXA MAQUININHA'],
  },
  {
    macro: 'Custo insumos (CMV)',
    categorias: ['Custo Drinks', 'Custo Bebidas', 'Custo Comida', 'Custo Outros'],
  },
  {
    macro: 'Mão-de-Obra',
    categorias: ['SALARIO FUNCIONARIOS', 'PROVISÃO TRABALHISTA', 'VALE TRANSPORTE', 'ALIMENTAÇÃO', 'ADICIONAIS', 'FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANÇA', 'FREELA BRIGADISTA', 'PRO LABORE'],
  },
  {
    macro: 'Despesas Comerciais',
    categorias: ['Marketing', 'Atrações Programação', 'Produção Eventos'],
  },
  {
    macro: 'Despesas Administrativas',
    categorias: ['Administrativo Ordinário', 'Escritório Central', 'RECURSOS HUMANOS'],
  },
  {
    macro: 'Despesas Operacionais',
    categorias: ['Materiais Operação', 'Materiais de Limpeza e Descartáveis', 'Utensílios', 'Estorno', 'Outros Operação'],
  },
  {
    macro: 'Despesas de Ocupação (Contas)',
    categorias: ['ALUGUEL/CONDOMÍNIO/IPTU', 'ÁGUA', 'Manutenção', 'TENDA', 'INTERNET', 'GÁS', 'LUZ'],
  },
  {
    macro: 'Não Operacionais',
    categorias: ['Receitas Financeiras', 'CONTRATOS'],
  },
  {
    macro: 'Sócios',
    categorias: ['Outros Sócios'],
  },
];

const MESES_NOMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface DreEntry {
  id: number;
  bar_id: number;
  data_competencia: string;
  descricao: string;
  valor: number | string;
  categoria: string;
  categoria_macro: string;
  observacoes: string | null;
  usuario_criacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface FormEntry {
  data_competencia: string;
  descricao: string;
  valor: string;
  categoria: string;
  categoria_macro: string;
  observacoes: string;
}

const emptyForm = (): FormEntry => ({
  data_competencia: new Date().toISOString().slice(0, 10),
  descricao: '',
  valor: '',
  categoria: '',
  categoria_macro: '',
  observacoes: '',
});

export function DreManualTab({ barId }: { barId: number }) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Filtros
  const [anoFiltro, setAnoFiltro] = useState<number>(new Date().getFullYear());
  const [mesFiltro, setMesFiltro] = useState<number | 'todos'>('todos');

  // Form de criação/edição
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormEntry>(emptyForm());
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const sp = new URLSearchParams({
        bar_id: String(barId),
        ano: String(anoFiltro),
      });
      if (mesFiltro !== 'todos') sp.set('mes', String(mesFiltro));
      const r = await fetch(`/api/estrategico/orcamentacao/dre-manual?${sp.toString()}`);
      const d = await r.json();
      if (d.success) setEntries(d.data || []);
      else setErro(d.error || 'Erro ao carregar');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setLoading(false);
    }
  }, [barId, anoFiltro, mesFiltro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Categorias disponiveis pra macro selecionado no form
  const categoriasDoMacroForm = form.categoria_macro
    ? CATEGORIAS_POR_MACRO.find(g => g.macro === form.categoria_macro)?.categorias || []
    : [];

  const handleSalvar = async () => {
    if (!form.data_competencia || !form.descricao || !form.categoria || !form.categoria_macro) {
      toast({ title: 'Faltam campos', description: 'Preencha data, descrição, categoria e macro', variant: 'destructive' });
      return;
    }
    const valorNum = parseFloat(form.valor.replace(',', '.').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(valorNum)) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }

    setSalvando(true);
    try {
      const body: Record<string, unknown> = {
        data_competencia: form.data_competencia,
        descricao: form.descricao,
        valor: valorNum,
        categoria: form.categoria,
        categoria_macro: form.categoria_macro,
        observacoes: form.observacoes || null,
      };
      let resp: Response;
      if (editandoId !== null) {
        resp = await fetch('/api/estrategico/orcamentacao/dre-manual', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editandoId, ...body }),
        });
      } else {
        resp = await fetch('/api/estrategico/orcamentacao/dre-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bar_id: barId, ...body }),
        });
      }
      const j = await resp.json();
      if (!resp.ok || !j.success) throw new Error(j.error || 'Erro');
      toast({ title: editandoId !== null ? 'Atualizado!' : 'Criado!' });
      setCriando(false);
      setEditandoId(null);
      setForm(emptyForm());
      await carregar();
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: e instanceof Error ? e.message : 'erro', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async (id: number) => {
    if (!window.confirm('Remover este lançamento?')) return;
    try {
      const resp = await fetch(`/api/estrategico/orcamentacao/dre-manual?id=${id}`, {
        method: 'DELETE',
      });
      const j = await resp.json();
      if (!resp.ok || !j.success) throw new Error(j.error || 'Erro');
      toast({ title: 'Removido' });
      await carregar();
    } catch (e) {
      toast({ title: 'Erro ao remover', description: e instanceof Error ? e.message : 'erro', variant: 'destructive' });
    }
  };

  const iniciarEdicao = (entry: DreEntry) => {
    setEditandoId(entry.id);
    setForm({
      data_competencia: entry.data_competencia,
      descricao: entry.descricao,
      valor: String(entry.valor),
      categoria: entry.categoria,
      categoria_macro: entry.categoria_macro,
      observacoes: entry.observacoes || '',
    });
    setCriando(true);
  };

  const cancelarForm = () => {
    setCriando(false);
    setEditandoId(null);
    setForm(emptyForm());
  };

  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">DRE Manual</h2>
          <Badge variant="outline">{entries.length} lançamentos</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={String(anoFiltro)} onValueChange={(v) => setAnoFiltro(Number(v))}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(mesFiltro)} onValueChange={(v) => setMesFiltro(v === 'todos' ? 'todos' : Number(v))}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos meses</SelectItem>
              {MESES_NOMES.slice(1).map((nome, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={carregar} className="gap-1">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
          {!criando && (
            <Button size="sm" onClick={() => { setForm(emptyForm()); setCriando(true); setEditandoId(null); }} className="gap-1">
              <Plus className="w-4 h-4" /> Novo
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ajustes manuais que entram no DRE da página de orçamentação. São somados ao valor automático do ContaAzul (gold) por categoria/mês.
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Form de criação/edição */}
          {criando && (
            <div className="p-4 border-b bg-muted/30 space-y-3">
              <div className="text-sm font-medium">
                {editandoId !== null ? `Editando lançamento #${editandoId}` : 'Novo lançamento'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <div className="lg:col-span-1">
                  <label className="text-xs text-muted-foreground">Data competência</label>
                  <Input
                    type="date"
                    value={form.data_competencia}
                    onChange={e => setForm({ ...form, data_competencia: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs text-muted-foreground">Descrição</label>
                  <Input
                    placeholder="Ex: Ambev Bonificação Janeiro"
                    value={form.descricao}
                    onChange={e => setForm({ ...form, descricao: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor (positivo=receita, neg=despesa)</label>
                  <Input
                    type="text"
                    placeholder="-1234,56 ou 1234.56"
                    value={form.valor}
                    onChange={e => setForm({ ...form, valor: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Macro</label>
                  <Select
                    value={form.categoria_macro}
                    onValueChange={(v) => setForm({ ...form, categoria_macro: v, categoria: '' })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_POR_MACRO.map(g => (
                        <SelectItem key={g.macro} value={g.macro}>{g.macro}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Categoria</label>
                  <Select
                    value={form.categoria}
                    onValueChange={(v) => setForm({ ...form, categoria: v })}
                    disabled={!form.categoria_macro}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasDoMacroForm.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Observações (opcional)</label>
                <Input
                  value={form.observacoes}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSalvar} disabled={salvando} className="gap-1">
                  <Save className="w-4 h-4" /> {editandoId !== null ? 'Atualizar' : 'Criar'}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelarForm}>
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Lista de entries */}
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : erro ? (
            <div className="p-4 text-red-500 text-sm">{erro}</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum lançamento no período. Clique em <strong>Novo</strong> pra adicionar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Data</th>
                    <th className="text-left py-2 px-3">Descrição</th>
                    <th className="text-right py-2 px-3">Valor</th>
                    <th className="text-left py-2 px-3">Categoria</th>
                    <th className="text-left py-2 px-3">Macro</th>
                    <th className="text-left py-2 px-3">Quem</th>
                    <th className="text-center py-2 px-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const valorNum = Number(entry.valor) || 0;
                    return (
                      <tr key={entry.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-3 text-xs font-mono">
                          {new Date(entry.data_competencia + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2 px-3 text-xs">{entry.descricao}</td>
                        <td className={`py-2 px-3 text-right text-xs font-mono font-semibold ${valorNum < 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {fmtMoeda(valorNum)}
                        </td>
                        <td className="py-2 px-3 text-xs">{entry.categoria}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{entry.categoria_macro}</td>
                        <td className="py-2 px-3 text-xs">
                          <Badge variant="secondary" className="text-[10px]">
                            {entry.usuario_criacao || 'sistema'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => iniciarEdicao(entry)}>
                              <Pencil className="w-3.5 h-3.5 text-blue-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeletar(entry.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
