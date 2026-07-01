'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, Search, X, SlidersHorizontal } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface Linha {
  categoria: string;
  data: string;
  mesa: string | null;
  motivo: string | null;
  produto: string | null;
  qtd: number;
  valor_bruto: number;
  custo: number;
  tem_ficha: boolean;
}
interface Resumo {
  categoria: string;
  linhas: number;
  com_ficha: number;
  bruto: number;
  custo: number;
}

// 9 categorias padronizadas + Outros (mesma classificação da Gestão CMV)
const CATS: { key: string; label: string; cor: string }[] = [
  { key: 'funcionarios_operacao', label: 'Funcionário Operação', cor: 'bg-blue-500' },
  { key: 'funcionarios_escritorio', label: 'Funcionário Escritório', cor: 'bg-indigo-500' },
  { key: 'aniversario', label: 'Aniversário', cor: 'bg-pink-500' },
  { key: 'programa_pontos', label: 'Programa de Pontos', cor: 'bg-purple-500' },
  { key: 'beneficio_cliente', label: 'Benefício Cliente', cor: 'bg-teal-500' },
  { key: 'influencer', label: 'Influencer', cor: 'bg-fuchsia-500' },
  { key: 'artistas', label: 'Artistas', cor: 'bg-amber-500' },
  { key: 'socios', label: 'Sócios', cor: 'bg-emerald-500' },
  { key: 'relacionamento', label: 'Relacionamento', cor: 'bg-orange-500' },
  { key: 'outros', label: 'Outros', cor: 'bg-gray-500' },
];
const LABEL = Object.fromEntries(CATS.map((c) => [c.key, c.label]));
const COR = Object.fromEntries(CATS.map((c) => [c.key, c.cor]));

const DOW = [
  { i: 0, l: 'Dom', n: 'Domingo' },
  { i: 1, l: 'Seg', n: 'Segunda' },
  { i: 2, l: 'Ter', n: 'Terça' },
  { i: 3, l: 'Qua', n: 'Quarta' },
  { i: 4, l: 'Qui', n: 'Quinta' },
  { i: 5, l: 'Sex', n: 'Sexta' },
  { i: 6, l: 'Sáb', n: 'Sábado' },
];

const moeda = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const brData = (s: string) => (s ? s.split('-').reverse().join('/') : '-');
const dowDe = (s: string) => new Date(s + 'T12:00:00').getDay();

const POR_PAGINA = 100;

const PRESETS: { key: string; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: 'semana', label: 'Semana atual' },
  { key: 'mes', label: 'Mês atual' },
  { key: 'mesPassado', label: 'Mês passado' },
  { key: 'd30', label: 'Últimos 30 dias' },
];

export default function ControleConsumacaoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const hoje = new Date();
  const primeiroDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [di, setDi] = useState(iso(primeiroDoMes));
  const [df, setDf] = useState(iso(hoje));
  const [presetAtivo, setPresetAtivo] = useState<string>('mes');
  const [loading, setLoading] = useState(false);
  const [fator, setFator] = useState(0.35);
  const [resumo, setResumo] = useState<Resumo[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalCusto, setTotalCusto] = useState(0);

  // filtros client-side
  const [catFiltro, setCatFiltro] = useState<Set<string>>(new Set());
  const [diaSemana, setDiaSemana] = useState<Set<number>>(new Set());
  const [motivoSel, setMotivoSel] = useState('');
  const [produtoSel, setProdutoSel] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => setPageTitle('Controle de Consumação'), [setPageTitle]);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/operacional/consumacao?data_inicio=${di}&data_fim=${df}`, {
        headers: { 'x-selected-bar-id': String(selectedBar.id) },
      });
      const j = await r.json();
      if (!j.success) {
        toast.error(j.error || 'Erro ao carregar');
        return;
      }
      setFator(j.fator ?? 0.35);
      setResumo(j.resumo || []);
      setLinhas(j.linhas || []);
      setTotalBruto(j.total_bruto || 0);
      setTotalCusto(j.total_custo || 0);
    } catch {
      toast.error('Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [selectedBar, di, df]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // qualquer mudança de filtro volta pra página 1
  useEffect(() => {
    setPagina(1);
  }, [catFiltro, diaSemana, motivoSel, produtoSel, busca, di, df]);

  const preset = (tipo: string) => {
    const h = new Date();
    const set = (a: Date, b: Date) => {
      setDi(iso(a));
      setDf(iso(b));
    };
    if (tipo === 'hoje') set(h, h);
    else if (tipo === 'ontem') {
      const o = new Date(h);
      o.setDate(h.getDate() - 1);
      set(o, o);
    } else if (tipo === 'semana') {
      const seg = new Date(h);
      seg.setDate(h.getDate() - ((h.getDay() + 6) % 7));
      set(seg, h);
    } else if (tipo === 'mes') set(new Date(h.getFullYear(), h.getMonth(), 1), h);
    else if (tipo === 'mesPassado') set(new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 0));
    else {
      const d = new Date(h);
      d.setDate(h.getDate() - 29);
      set(d, h);
    }
    setPresetAtivo(tipo);
  };

  const toggleCat = (key: string) =>
    setCatFiltro((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const toggleDow = (i: number) =>
    setDiaSemana((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  // opções de motivo/produto derivadas das linhas carregadas
  const motivos = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.motivo).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [linhas],
  );
  const produtos = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.produto).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [linhas],
  );

  const temFiltro = catFiltro.size > 0 || diaSemana.size > 0 || !!motivoSel || !!produtoSel || !!busca;

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const mv = motivoSel.trim().toLowerCase();
    const pr = produtoSel.trim().toLowerCase();
    return linhas.filter((l) => {
      if (catFiltro.size > 0 && !catFiltro.has(l.categoria)) return false;
      if (diaSemana.size > 0 && !diaSemana.has(dowDe(l.data))) return false;
      if (mv && !(l.motivo || '').toLowerCase().includes(mv)) return false;
      if (pr && !(l.produto || '').toLowerCase().includes(pr)) return false;
      if (q) {
        const alvo = `${l.motivo || ''} ${l.produto || ''} ${l.mesa || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [linhas, catFiltro, diaSemana, motivoSel, produtoSel, busca]);

  const totFiltrado = useMemo(
    () => ({
      bruto: linhasFiltradas.reduce((s, l) => s + l.valor_bruto, 0),
      custo: linhasFiltradas.reduce((s, l) => s + l.custo, 0),
    }),
    [linhasFiltradas],
  );

  const totalPaginas = Math.max(1, Math.ceil(linhasFiltradas.length / POR_PAGINA));
  const pagina1 = Math.min(pagina, totalPaginas);
  const pageSlice = linhasFiltradas.slice((pagina1 - 1) * POR_PAGINA, pagina1 * POR_PAGINA);

  const limparTudo = () => {
    setCatFiltro(new Set());
    setDiaSemana(new Set());
    setMotivoSel('');
    setProdutoSel('');
    setBusca('');
  };

  const exportarCsv = () => {
    const head = ['Data', 'Categoria', 'Mesa', 'Motivo', 'Produto', 'Qtd', 'Valor Bruto', 'Custo', 'Tem ficha'];
    const linhasCsv = linhasFiltradas.map((l) =>
      [
        l.data,
        LABEL[l.categoria] || l.categoria,
        l.mesa || '',
        (l.motivo || '').replace(/;/g, ','),
        (l.produto || '').replace(/;/g, ','),
        String(l.qtd).replace('.', ','),
        String(l.valor_bruto).replace('.', ','),
        String(l.custo).replace('.', ','),
        l.tem_ficha ? 'sim' : 'nao',
      ].join(';'),
    );
    const csv = [head.join(';'), ...linhasCsv].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumacao_${di}_a_${df}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resumoMap = new Map(resumo.map((r) => [r.categoria, r]));

  // chips de filtros ativos
  const chips: { label: string; onClear: () => void }[] = [
    ...Array.from(catFiltro).map((k) => ({ label: `Categoria: ${LABEL[k] || k}`, onClear: () => toggleCat(k) })),
    ...Array.from(diaSemana).map((i) => ({ label: DOW[i].n, onClear: () => toggleDow(i) })),
    ...(motivoSel ? [{ label: `Motivo: ${motivoSel}`, onClear: () => setMotivoSel('') }] : []),
    ...(produtoSel ? [{ label: `Produto: ${produtoSel}`, onClear: () => setProdutoSel('') }] : []),
    ...(busca ? [{ label: `Busca: ${busca}`, onClear: () => setBusca('') }] : []),
  ];

  const campoLabel = 'block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1';

  return (
    <div className="space-y-4 p-1">
      {/* ===== Painel de filtros ===== */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Período: presets + datas */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className={campoLabel}>Período</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => preset(p.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      presetAtivo === p.key
                        ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <span className={campoLabel}>De</span>
                <Input
                  type="date"
                  value={di}
                  onChange={(e) => {
                    setDi(e.target.value);
                    setPresetAtivo('');
                  }}
                  className="input-dark w-[9.5rem]"
                />
              </div>
              <div>
                <span className={campoLabel}>Até</span>
                <Input
                  type="date"
                  value={df}
                  onChange={(e) => {
                    setDf(e.target.value);
                    setPresetAtivo('');
                  }}
                  className="input-dark w-[9.5rem]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={carregar} disabled={loading} title="Atualizar">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Dia da semana */}
          <div>
            <span className={campoLabel}>Dia da semana</span>
            <div className="flex flex-wrap gap-1.5">
              {DOW.map((d) => (
                <button
                  key={d.i}
                  onClick={() => toggleDow(d.i)}
                  title={d.n}
                  className={`w-11 rounded-md py-1 text-xs font-medium transition-colors ${
                    diaSemana.has(d.i)
                      ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {d.l}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo / Produto / Busca */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <span className={campoLabel}>Motivo (artista / sócio / etc.)</span>
              <Input
                list="motivos-list"
                placeholder="Selecione ou digite…"
                value={motivoSel}
                onChange={(e) => setMotivoSel(e.target.value)}
                className="input-dark"
              />
              <datalist id="motivos-list">
                {motivos.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div>
              <span className={campoLabel}>Produto</span>
              <Input
                list="produtos-list"
                placeholder="Selecione ou digite…"
                value={produtoSel}
                onChange={(e) => setProdutoSel(e.target.value)}
                className="input-dark"
              />
              <datalist id="produtos-list">
                {produtos.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <span className={campoLabel}>Busca livre (motivo, produto, mesa)</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="input-dark pl-8"
                />
              </div>
            </div>
          </div>

          {/* Chips de filtros ativos */}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 dark:border-gray-800 pt-3">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              {chips.map((c, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs"
                >
                  {c.label}
                  <button onClick={c.onClear} className="hover:text-blue-900 dark:hover:text-blue-100">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button onClick={limparTudo} className="ml-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline">
                Limpar tudo
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Resumo por categoria (clicável) ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {CATS.map((c) => {
          const r = resumoMap.get(c.key);
          const ativo = catFiltro.has(c.key);
          const pct = totalBruto > 0 ? ((r?.bruto || 0) / totalBruto) * 100 : 0;
          return (
            <button
              key={c.key}
              onClick={() => toggleCat(c.key)}
              className={`text-left rounded-lg border p-2.5 transition-colors ${
                ativo
                  ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${c.cor}`} />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{c.label}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{moeda(r?.bruto || 0)}</p>
              <p className="text-[11px] text-gray-400">
                {(r?.linhas || 0).toLocaleString('pt-BR')} lanç. · {pct.toFixed(0)}%
              </p>
            </button>
          );
        })}
      </div>

      {/* ===== Totais ===== */}
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="p-3">
            <p className="text-xs text-gray-400">Total bruto {temFiltro ? '(filtro)' : ''}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{moeda(temFiltro ? totFiltrado.bruto : totalBruto)}</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="p-3">
            <p className="text-xs text-gray-400">Custo real (ficha + ×{fator})</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{moeda(temFiltro ? totFiltrado.custo : totalCusto)}</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="p-3">
            <p className="text-xs text-gray-400">Lançamentos</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{linhasFiltradas.length.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Barra da tabela: contagem + CSV ===== */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {linhasFiltradas.length.toLocaleString('pt-BR')} lançamento(s)
          {totalPaginas > 1 && <span className="text-gray-400"> · página {pagina1} de {totalPaginas}</span>}
        </p>
        <Button variant="outline" size="sm" onClick={exportarCsv} disabled={linhasFiltradas.length === 0}>
          <Download className="w-4 h-4 mr-1" />
          CSV
        </Button>
      </div>

      {/* ===== Tabela ===== */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-3 py-2">Data</th>
                <th className="text-left font-medium px-3 py-2">Categoria</th>
                <th className="text-left font-medium px-3 py-2">Mesa</th>
                <th className="text-left font-medium px-3 py-2">Motivo</th>
                <th className="text-left font-medium px-3 py-2">Produto</th>
                <th className="text-right font-medium px-3 py-2">Qtd</th>
                <th className="text-right font-medium px-3 py-2">Bruto</th>
                <th className="text-right font-medium px-3 py-2">Custo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    Carregando...
                  </td>
                </tr>
              ) : pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    Nenhum lançamento no período/filtro.
                  </td>
                </tr>
              ) : (
                pageSlice.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{brData(l.data)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${COR[l.categoria] || 'bg-gray-400'}`} />
                        <span className="text-gray-700 dark:text-gray-200">{LABEL[l.categoria] || l.categoria}</span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">{l.mesa || '-'}</td>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[240px] truncate" title={l.motivo || ''}>
                      {l.motivo || '-'}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500 max-w-[240px] truncate" title={l.produto || ''}>
                      {l.produto || '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{l.qtd.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">{moeda(l.valor_bruto)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <span
                        className={`mr-1 inline-block rounded px-1 text-[9px] font-bold align-middle ${
                          l.tem_ficha
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                        title={l.tem_ficha ? 'Custo da ficha técnica' : `Sem ficha — estimado (×${fator})`}
                      >
                        {l.tem_ficha ? 'FT' : `×${fator}`}
                      </span>
                      <span className="text-gray-700 dark:text-gray-200">{moeda(l.custo)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ===== Paginação ===== */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina1 <= 1}>
            Anterior
          </Button>
          <span className="text-gray-500">
            Página {pagina1} de {totalPaginas}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina1 >= totalPaginas}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
