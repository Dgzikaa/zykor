'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/lib/api-client';
import { Boxes, Loader2, Search, CalendarDays, RefreshCw, Plus, Pencil, AlertTriangle, HelpCircle, Download, TrendingDown, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FazerContagem } from '@/components/estoque/FazerContagem';
import { PageShell } from '@/components/layout/PageShell';
import { cmpNome } from '@/components/filtros/FiltroBarra';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { CadastrarItemModal } from './GerenciarItensModal';
import { ColumnFilterHeader, useColumnFilters, type FilterCol } from '@/components/ui/column-filter-header';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const fmtQtd = (q: any, u: string | null) => `${Number(q || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}${u ? ' ' + u : ''}`;

const TIPOS = [
  { key: 'diaria', label: 'Diária', sub: 'Curva A' },
  { key: 'semanal', label: 'Semanal', sub: 'Completa' },
  { key: 'mensal', label: 'Mensal', sub: 'Inventário' },
];

// Classe = tipo de item. Grupo "cmv" (compõem o Estoque Final / CMA): Insumo · Produção ·
// Alimentação (só (F), vai pro CMA). Grupo "outros" (não entram no CMV): Limpeza (estoque ideal
// + sug. pedido) · Utensílio (modelo de quebra). Os dois grupos ficam separados por um divisor.
const CLASSES = [
  { key: 'insumo', label: 'Insumo', grupo: 'cmv' },
  { key: 'producao', label: 'Produção', grupo: 'cmv' },
  { key: 'alimentacao', label: 'Alimentação', grupo: 'cmv' },
  { key: 'limpeza', label: 'Limpeza', grupo: 'outros' },
  { key: 'utensilio', label: 'Utensílio', grupo: 'outros' },
];

// Classes cujos itens são cadastrados/editados nesta tela (botão + lápis).
// Insumo vem do VMarket; produção mora no módulo Produção-CMV → sem cadastro aqui.
const CLASSES_CADASTRO = ['limpeza', 'utensilio'];

export default function EstoqueHistoricoPage() {
  const { selectedBar } = useBar();
  const { soLeitura, podeInserir, podeEditar } = useModuloPermissao('/operacional/estoque-historico');
  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('📦 Estoque — Histórico de Contagens'); return () => setPageTitle(''); }, [setPageTitle]);
  const barId = selectedBar?.id;
  const [classe, setClasse] = useState('insumo');
  const [cadOpen, setCadOpen] = useState(false);
  const [cadEditCodigo, setCadEditCodigo] = useState<string | null>(null);
  const [tipo, setTipo] = useState('semanal');
  const abrirCadastro = (codigo: string | null) => { setCadEditCodigo(codigo); setCadOpen(true); };
  const [sincronizando, setSincronizando] = useState(false);
  const [data, setData] = useState<string | null>(null);
  const [datas, setDatas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [totaisArea, setTotaisArea] = useState<any[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);
  // Composição da contagem do dia (Insumo / Produção / Alimentação) — alimenta o "como chega
  // nesse número", que reconcilia esta tela com o Estoque Final da Gestão CMV.
  const [ponte, setPonte] = useState<{ insumo: number; producao: number; alimentacao: number; estoque_do_cmv: number; total_contado: number } | null>(null);
  const [verConta, setVerConta] = useState(false);
  const [anomalosN, setAnomalosN] = useState(0);
  const [soAnomalos, setSoAnomalos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  // Ordenação (padrão: maior valor primeiro). Filtros de coluna estilo Excel via useColumnFilters.
  // `codigo` e `nome` entraram a pedido do time: a conferência contra a planilha é feita na ordem
  // do código, e a leitura de item é A–Z. Antes só Qtd e Valor tinham cabeçalho clicável — o sort
  // por nome já existia na lógica e não tinha como ser acionado.
  type Ordem = 'valor' | 'qtd' | 'nome' | 'codigo';
  const [sortBy, setSortBy] = useState<Ordem>('valor');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // texto (código/nome) começa em A–Z; número começa do maior — é o que se espera de cada um
  const toggleSort = (col: Ordem) =>
    sortBy === col
      ? setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
      : (setSortBy(col), setSortDir(col === 'nome' || col === 'codigo' ? 'asc' : 'desc'));
  const setaDe = (col: Ordem) => (sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '');

  const [comparar, setComparar] = useState(false);
  const [dataB, setDataB] = useState<string | null>(null);
  const [comp, setComp] = useState<any | null>(null);
  const [loadingComp, setLoadingComp] = useState(false);
  /**
   * Ordem e filtro da COMPARAÇÃO, separados dos da lista.
   * `delta` (o padrão) é a maior variação em MÓDULO, que é como a comparação já chegava da API —
   * mudar isso silenciosamente trocaria o que o time vê ao abrir a tela.
   */
  const [sortComp, setSortComp] = useState<'delta' | 'codigo' | 'nome' | 'qtd' | 'valor'>('delta');
  const [sortCompDir, setSortCompDir] = useState<'asc' | 'desc'>('desc');
  const toggleSortComp = (col: typeof sortComp) =>
    sortComp === col
      ? setSortCompDir(d => (d === 'asc' ? 'desc' : 'asc'))
      : (setSortComp(col), setSortCompDir(col === 'nome' || col === 'codigo' ? 'asc' : 'desc'));
  const setaComp = (col: typeof sortComp) => (sortComp === col ? (sortCompDir === 'asc' ? '▲' : '▼') : '');
  /** Só quedas / só aumentos — pelo Δ VALOR, que é o número que vai pra reunião. */
  const [sinal, setSinal] = useState<'todos' | 'neg' | 'pos'>('todos');

  // compara duas contagens DO MESMO TIPO (data + tipo) — busca os dois lados já filtrados pelo tipo
  const carregarComp = useCallback(async (t: string, a: string | null, b: string | null) => {
    if (!a || !b || a === b) { setComp(null); return; }
    setLoadingComp(true);
    try {
      const [ra, rb] = await Promise.all([
        api.get(`/api/operacional/estoque-historico?tipo=${t}&classe=${classe}&data=${a}`),
        api.get(`/api/operacional/estoque-historico?tipo=${t}&classe=${classe}&data=${b}`),
      ]);
      const chave = (i: any) => i.insumo_codigo || i.insumo_nome;
      const mapA = new Map<string, any>((ra.itens || []).map((i: any) => [chave(i), i]));
      const mapB = new Map<string, any>((rb.itens || []).map((i: any) => [chave(i), i]));
      const keys = Array.from(new Set([...mapA.keys(), ...mapB.keys()])) as string[];
      let va = 0, vb = 0;
      const itens = keys.map((k) => {
        const A = mapA.get(k), B = mapB.get(k);
        const qa = Number(A?.estoque_final || 0), qb = Number(B?.estoque_final || 0);
        const vAi = Number(A?.valor || 0), vBi = Number(B?.valor || 0);
        va += vAi; vb += vBi;
        return { insumo_codigo: A?.insumo_codigo || B?.insumo_codigo, nome: A?.insumo_nome || B?.insumo_nome, unidade: A?.unidade_medida || B?.unidade_medida, qtd_a: qa, qtd_b: qb, delta_qtd: qb - qa, valor_a: vAi, valor_b: vBi, delta_valor: vBi - vAi };
      }).sort((x, y) => Math.abs(y.delta_valor) - Math.abs(x.delta_valor));
      setComp({ data_a: a, data_b: b, itens, resumo: { valor_a: va, valor_b: vb, delta_valor: vb - va } });
    } finally { setLoadingComp(false); }
  }, [classe]);
  const toggleComparar = () => {
    if (comparar) { setComparar(false); return; }
    const segunda = (datas.find((d: any) => d.data !== data)?.data) || null;
    setDataB(segunda); setComparar(true); carregarComp(tipo, data, segunda);
  };
  const trocarDataB = (b: string) => { setDataB(b); carregarComp(tipo, data, b); };

  const carregar = useCallback(async (t: string, d?: string | null) => {
    if (!barId) return;
    setLoading(true);
    try {
      const fetchOne = (dd?: string | null) =>
        api.get(`/api/operacional/estoque-historico?tipo=${t}&classe=${classe}${dd ? `&data=${dd}` : ''}`);
      let r = await fetchOne(d);
      // Preserva a data ao trocar de aba: se a data pedida não existir nessa classe,
      // cai pra contagem mais recente (refaz sem data).
      if (r.success && d && (r.datas || []).length && !(r.datas || []).some((x: any) => x.data === d)) {
        r = await fetchOne(null);
      }
      if (r.success) {
        setDatas(r.datas || []);
        setData(r.data || null);
        setItens(r.itens || []);
        setTotaisArea(r.totais_area || []);
        setTotalGeral(r.total_geral || 0);
        setPonte(r.ponte_cmv || null);
        setAnomalosN(r.anomalos_n || 0);
      }
    } finally { setLoading(false); }
  }, [barId, classe]);

  // Data selecionada num ref pra preservá-la ao trocar de aba (classe) sem re-disparar
  // o efeito toda vez que a data muda.
  const dataRef = useRef<string | null>(null);
  useEffect(() => { dataRef.current = data; }, [data]);
  const prevTipoRef = useRef(tipo);

  // Ao trocar de TIPO o universo de datas muda (segundas × dia 1 × cada dia) → recarrega da
  // mais recente. Ao trocar só de ABA/classe (mesmo tipo), preserva a data selecionada.
  useEffect(() => {
    const tipoMudou = prevTipoRef.current !== tipo;
    prevTipoRef.current = tipo;
    carregar(tipo, tipoMudou ? null : dataRef.current);
  }, [tipo, classe, carregar]);

  // roda o sync da planilha de contagem (aba INSUMOS) pro bar atual e recarrega
  const sincronizar = async () => {
    if (!barId) return;
    setSincronizando(true);
    try {
      const r = await api.post('/api/operacional/estoque-historico', { action: 'sync' });
      if (!r.success) throw new Error(r.error);
      const sem = (r.sem_cadastro || []).length;
      toast({ title: 'Estoque sincronizado', description: `${r.upserted ?? 0} linhas atualizadas${sem ? ` · ${sem} sem cadastro` : ''}` });
      await carregar(tipo, null);
    } catch (e: any) { toast({ title: 'Erro ao sincronizar', description: e?.message, variant: 'destructive' }); }
    finally { setSincronizando(false); }
  };

  const trocarData = (d: string) => { setData(d); carregar(tipo, d); if (comparar) carregarComp(tipo, d, dataB); };

  // Unidade a exibir na coluna Qtd: insumo/produção usam a unidade de CONTAGEM do cadastro
  // (quando houver — senão só o número); limpeza mantém a unidade-base própria.
  const unidadeCol = (it: any): string | null =>
    (classe === 'insumo' || classe === 'producao' || classe === 'alimentacao') ? (it.unidade_contagem || null) : (it.unidade_medida || null);

  // #3 — filtros de coluna estilo Excel (multi-seleção) em Área e Categoria.
  const filterCols = useMemo<FilterCol<any>[]>(() => [
    { id: 'area', get: (r) => r.area || '—' },
    { id: 'categoria', get: (r) => r.categoria || '—' },
  ], []);
  // Base = busca + "só fora do padrão"; os filtros de coluna operam por cima dela.
  const baseItens = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return itens.filter(i =>
      (!s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s)) &&
      (!soAnomalos || i.anomalo)
    );
  }, [itens, busca, soAnomalos]);
  const { setCol, colFilter, optionsByCol, view: colFiltrados, anyCol, clearAll } = useColumnFilters(baseItens, filterCols);

  const itensView = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...colFiltrados].sort((a, b) => {
      if (sortBy === 'nome') return dir * cmpNome(a.insumo_nome, b.insumo_nome); // A–Z pt-BR (mesmo comparador da aba CMV)
      if (sortBy === 'codigo') return dir * cmpNome(a.insumo_codigo || '', b.insumo_codigo || '');
      if (sortBy === 'qtd') return dir * (Number(a.estoque_final || 0) - Number(b.estoque_final || 0));
      return dir * (Number(a.valor || 0) - Number(b.valor || 0));
    });
  }, [colFiltrados, sortBy, sortDir]);

  const compView = useMemo(() => {
    if (!comp) return [];
    const s = busca.trim().toLowerCase();
    const filtrados = (comp.itens || []).filter((i: any) => {
      if (s && !(i.nome || '').toLowerCase().includes(s) && !(i.insumo_codigo || '').toLowerCase().includes(s)) return false;
      if (sinal === 'neg') return Number(i.delta_valor || 0) < 0;
      if (sinal === 'pos') return Number(i.delta_valor || 0) > 0;
      return true;
    });
    if (sortComp === 'delta') return filtrados; // já vem por maior variação em módulo
    const dir = sortCompDir === 'asc' ? 1 : -1;
    return [...filtrados].sort((a: any, b: any) => {
      if (sortComp === 'nome') return dir * cmpNome(a.nome || '', b.nome || '');
      if (sortComp === 'codigo') return dir * cmpNome(a.insumo_codigo || '', b.insumo_codigo || '');
      if (sortComp === 'qtd') return dir * (Number(a.delta_qtd || 0) - Number(b.delta_qtd || 0));
      return dir * (Number(a.delta_valor || 0) - Number(b.delta_valor || 0));
    });
  }, [comp, busca, sinal, sortComp, sortCompDir]);

  /** Totais do que está na tela — o CSV fecha com eles, igual ao export dos desvios. */
  const totalCompView = useMemo(
    () => compView.reduce((s: number, i: any) => s + Number(i.delta_valor || 0), 0),
    [compView],
  );

  /**
   * Exporta o que está NA TELA — aba, busca, filtros de coluna, "fora do costume", sinal e
   * ordem vão junto. Se o usuário filtrou, é o filtrado que ele quer levar pra reunião.
   *
   * Formato Excel pt-BR (mesma convenção do export de desvios): vírgula decimal sem separador
   * de milhar e SEM aspas nos números, campo separado por `;` e BOM no início. Sem isso o
   * Excel pt-BR abre número como texto e quebra acento.
   */
  const exportarCSV = useCallback(() => {
    const num = (v: unknown, dec = 2) =>
      v == null || v === '' ? '' : Number(v).toFixed(dec).replace('.', ',');
    const txt = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    let head: string[];
    let linhas: string[][];
    let rodape: string[][] = [];

    if (comparar) {
      const dA = fmtData(comp?.data_a), dB = fmtData(comp?.data_b);
      head = ['Código', 'Insumo', `Qtd ${dA}`, `Qtd ${dB}`, 'Δ Qtd', `Valor ${dA}`, `Valor ${dB}`, 'Δ Valor'];
      linhas = compView.map((it: any) => [
        txt(it.insumo_codigo), txt(it.nome),
        num(it.qtd_a, 3), num(it.qtd_b, 3), num(it.delta_qtd, 3),
        num(it.valor_a), num(it.valor_b), num(it.delta_valor),
      ]);
      rodape = [
        [txt(''), txt(`TOTAL (${compView.length} itens)`), '', '', '', '', '', num(totalCompView)],
      ];
    } else {
      const ehLimpeza = classe === 'limpeza';
      head = [
        'Código', ehLimpeza ? 'Item' : classe === 'producao' ? 'Produção' : 'Insumo',
        ...(ehLimpeza ? [] : ['Área']), 'Categoria',
        ...(ehLimpeza ? ['Estoque ideal'] : []),
        'Qtd contada', 'Unidade',
        ...(ehLimpeza ? ['Sugestão de pedido'] : []),
        'Preço unitário', 'Valor',
      ];
      linhas = itensView.map((it: any) => [
        txt(it.insumo_codigo), txt(it.insumo_nome),
        ...(ehLimpeza ? [] : [txt(it.area || '')]), txt(it.categoria || ''),
        ...(ehLimpeza ? [num(it.estoque_ideal, 3)] : []),
        num(it.estoque_final, 3), txt(unidadeCol(it) || ''),
        ...(ehLimpeza ? [num(it.sug_pedido, 3)] : []),
        num(it.custo_unitario), num(it.valor),
      ]);
      const total = itensView.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);
      rodape = [[txt(''), txt(`TOTAL (${itensView.length} itens)`), ...head.slice(2, -1).map(() => ''), num(total)]];
    }

    const csv = [head.map(txt), ...linhas, ...rodape].map(r => r.join(';')).join('\n');
    const nome = comparar
      ? `estoque_${classe}_comparacao_${comp?.data_a || ''}_${comp?.data_b || ''}${sinal !== 'todos' ? `_${sinal === 'neg' ? 'quedas' : 'aumentos'}` : ''}.csv`
      : `estoque_${classe}_${tipo}_${data || ''}.csv`;

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome; a.click();
    URL.revokeObjectURL(url);
  }, [comparar, comp, compView, totalCompView, itensView, classe, tipo, data, sinal, unidadeCol]);

  return (
    <PageShell width="wide">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><Boxes className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">{soLeitura && <BadgeSomenteLeitura />}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Valor em estoque por área e por contagem · {selectedBar?.nome || `Bar ${barId ?? ''}`}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {podeInserir && CLASSES_CADASTRO.includes(classe) && (
              <Button onClick={() => abrirCadastro(null)} variant="outline" title="Adicionar item desta classe">
                <Plus className="w-4 h-4 mr-1.5" />Adicionar item
              </Button>
            )}
            {podeInserir && <FazerContagem onSaved={() => carregar(tipo, null)} />}
            <Button onClick={exportarCSV} variant="outline"
              disabled={comparar ? compView.length === 0 : itensView.length === 0}
              title="Baixa exatamente o que está na tela — aba, busca, filtros e ordem — em CSV para Excel">
              <Download className="w-4 h-4 mr-1.5" />Exportar CSV
            </Button>
            <Button onClick={sincronizar} disabled={sincronizando} variant="outline" title="Buscar o estoque dos últimos 14 dias da planilha de contagem (aba INSUMOS)">
              <RefreshCw className={`w-4 h-4 mr-1.5 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'Sincronizando…' : 'Sincronizar planilha'}
            </Button>
          </div>
        </div>

        {(classe === 'limpeza' || classe === 'utensilio') && (
          <CadastrarItemModal classe={classe} open={cadOpen} editCodigo={cadEditCodigo}
            onClose={() => setCadOpen(false)} onSaved={() => carregar(tipo, null)} />
        )}

        {/* Classe: [Insumo · Produção · Alimentação] | [Limpeza · Utensílio] (grupos separados) */}
        <div className="inline-flex items-stretch rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 gap-1">
          {CLASSES.map((c, i) => (
            <Fragment key={c.key}>
              {i > 0 && CLASSES[i - 1].grupo !== c.grupo && (
                <span aria-hidden className="mx-1 w-px self-stretch bg-gray-200 dark:bg-gray-700" />
              )}
              <button onClick={() => { setClasse(c.key); if (c.key === 'limpeza' || c.key === 'utensilio') setTipo('semanal'); setComparar(false); setComp(null); }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${classe === c.key ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                {c.label}
              </button>
            </Fragment>
          ))}
        </div>

        {/* Tipo de contagem */}
        <div className="flex flex-wrap gap-2">
          {TIPOS.map(t => (
            <button key={t.key} onClick={() => { setTipo(t.key); setComparar(false); setComp(null); }}
              className={`rounded-lg px-4 py-2 text-sm transition border ${tipo === t.key ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              <span className="font-semibold">{t.label}</span> <span className="text-xs opacity-80">· {t.sub}</span>
            </button>
          ))}
        </div>

        {/* Cards de total */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              {classe === 'utensilio' ? 'Valor de quebra (semana)' : 'Total em estoque'}
              {ponte && classe !== 'utensilio' && (
                <button onClick={() => setVerConta(v => !v)} title="Entender como chega nesse total (e por que difere da Gestão CMV)"
                  className="inline-flex items-center gap-0.5 normal-case text-[11px] text-amber-700 dark:text-amber-400 hover:underline">
                  <HelpCircle className="w-3.5 h-3.5" />como chega nesse número
                </button>
              )}
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtBRL(totalGeral)}</div>
          </CardContent></Card>
          {totaisArea.map((a: any) => (
            <Card key={a.area} className="card-dark"><CardContent className="py-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wide capitalize">{a.area} <span className="normal-case">({a.itens} itens)</span></div>
              <div className="text-2xl font-bold">{fmtBRL(a.valor)}</div>
            </CardContent></Card>
          ))}
        </div>

        {/* COMO CHEGA NESSE NÚMERO — pedido do Isaías (04/08): "o Total em estoque não deveria
            bater com o estoque inicial da semana na Gestão CMV?". Não bate por dois motivos que
            ninguém adivinha olhando a tela: (1) aqui é UMA aba por vez, o CMV soma Insumo +
            Produção; (2) a Alimentação (F) fica fora do CMV (vira CMA). Aqui a conta fecha. */}
        {verConta && ponte && classe !== 'utensilio' && (
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Contagem de {fmtData(data || '')} — o que foi contado
            </div>
            <table className="w-full text-[11px] max-w-2xl">
              <tbody className="text-gray-600 dark:text-gray-300">
                <tr className={classe === 'insumo' ? 'font-semibold text-gray-900 dark:text-gray-100' : ''}>
                  <td className="py-0.5 w-4 text-gray-400"></td>
                  <td className="py-0.5">Insumos{classe === 'insumo' && ' ← aba aberta'}</td>
                  <td className="py-0.5 text-right tabular-nums whitespace-nowrap">{fmtBRL(ponte.insumo)}</td>
                  <td className="py-0.5 pl-2 text-gray-400">o que está no estoque pra usar</td>
                </tr>
                <tr className={classe === 'producao' ? 'font-semibold text-gray-900 dark:text-gray-100' : ''}>
                  <td className="py-0.5 text-gray-400">+</td>
                  <td className="py-0.5">Produções{classe === 'producao' && ' ← aba aberta'}</td>
                  <td className="py-0.5 text-right tabular-nums whitespace-nowrap">{fmtBRL(ponte.producao)}</td>
                  <td className="py-0.5 pl-2 text-gray-400">preparos prontos (molho, massa…)</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td className="py-1 text-gray-400">=</td>
                  <td className="py-1 font-semibold text-gray-800 dark:text-gray-100">Estoque que o CMV usa</td>
                  <td className="py-1 text-right tabular-nums font-semibold whitespace-nowrap">{fmtBRL(ponte.estoque_do_cmv)}</td>
                  <td className="py-1 pl-2 text-emerald-700 dark:text-emerald-300">
                    é este que aparece na Gestão CMV como Estoque Final da semana que fecha nesta contagem (e inicial da seguinte)
                  </td>
                </tr>
                <tr className={classe === 'alimentacao' ? 'font-semibold text-gray-900 dark:text-gray-100' : ''}>
                  <td className="py-0.5 text-gray-400">+</td>
                  <td className="py-0.5">Alimentação (F){classe === 'alimentacao' && ' ← aba aberta'}</td>
                  <td className="py-0.5 text-right tabular-nums whitespace-nowrap">{fmtBRL(ponte.alimentacao)}</td>
                  <td className="py-0.5 pl-2 text-gray-400">comida da equipe — <b>fora do CMV</b>, entra no CMA</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td className="py-0.5 text-gray-400">=</td>
                  <td className="py-0.5">Tudo que foi contado no dia</td>
                  <td className="py-0.5 text-right tabular-nums whitespace-nowrap">{fmtBRL(ponte.total_contado)}</td>
                  <td className="py-0.5 pl-2 text-gray-400">soma das 3 abas</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-gray-400 max-w-2xl">
              O card &ldquo;Total em estoque&rdquo; mostra <b>só a aba aberta</b>. Comparando com a Gestão CMV, confira duas coisas:
              a <b>data</b> (esta tela abre na contagem mais recente; o CMV usa a que fecha a semana) e o <b>escopo</b>
              (Insumos + Produções, sem a Alimentação).
            </p>
          </CardContent></Card>
        )}

        {/* Seletor de data + comparar + busca */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
            <select value={data || ''} onChange={e => trocarData(e.target.value)}
              className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm sm:min-w-[220px]">
              {datas.length === 0 && <option value="">Sem contagens</option>}
              {datas.map((d: any) => <option key={d.data} value={d.data}>{fmtData(d.data)} · {d.itens} itens</option>)}
            </select>
            <button onClick={toggleComparar}
              className={`h-10 rounded-md px-3 text-sm border ${comparar ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
              {comparar ? 'Comparando' : 'Comparar'}
            </button>
            {comparar && (
              <>
                <span className="text-gray-400 text-sm">com</span>
                <select value={dataB || ''} onChange={e => trocarDataB(e.target.value)}
                  className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm sm:min-w-[220px]">
                  {datas.filter((d: any) => d.data !== data).map((d: any) => <option key={d.data} value={d.data}>{fmtData(d.data)} · {d.itens} itens</option>)}
                </select>
              </>
            )}
          </div>
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar insumo…" className="pl-9" />
          </div>
        </div>

        {/* Filtros de coluna estilo Excel ficam nos cabeçalhos Área/Categoria da tabela. */}
        {!comparar && anyCol && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Filtros de coluna ativos</span>
            <button onClick={clearAll} className="text-xs text-indigo-600 hover:underline">Limpar filtros</button>
          </div>
        )}

        {/* #6 — insight de contagens fora do costume (clica pra filtrar) */}
        {!comparar && anomalosN > 0 && (
          <button onClick={() => setSoAnomalos(v => !v)}
            className={`flex items-center gap-2 text-left text-sm rounded-lg px-3 py-2 border w-full sm:w-auto ${soAnomalos ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 text-amber-800 dark:text-amber-200' : 'bg-amber-50 dark:bg-amber-900/15 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-900/25'}`}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><b>{anomalosN}</b> contagem(ns) fora do costume — possível preenchimento ou preço errado. {soAnomalos ? 'Mostrando só elas — clique p/ ver todas.' : 'Clique pra revisar.'}</span>
          </button>
        )}

        {/* Só quedas / só aumentos — o caminho de 1 clique, mesmo padrão do "Só perdas/sobras"
            dos desvios. O sinal é o do Δ VALOR, que é o número que vai pra reunião. */}
        {comparar && (
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <button onClick={() => setSinal(s => (s === 'neg' ? 'todos' : 'neg'))}
              className={`h-9 rounded-md px-3 border inline-flex items-center gap-1.5 ${sinal === 'neg' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
              title="Só os itens que caíram de valor entre as duas contagens">
              <TrendingDown className="w-4 h-4" />Só quedas
            </button>
            <button onClick={() => setSinal(s => (s === 'pos' ? 'todos' : 'pos'))}
              className={`h-9 rounded-md px-3 border inline-flex items-center gap-1.5 ${sinal === 'pos' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
              title="Só os itens que subiram de valor entre as duas contagens">
              <TrendingUp className="w-4 h-4" />Só aumentos
            </button>
            {sinal !== 'todos' && (
              <span className="text-xs text-gray-500">
                {compView.length} item(ns) · {fmtBRL(totalCompView)}
              </span>
            )}
          </div>
        )}

        {comparar && comp?.resumo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">{fmtData(comp.data_a)}</div><div className="text-xl font-bold">{fmtBRL(comp.resumo.valor_a)}</div></CardContent></Card>
            <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">{fmtData(comp.data_b)}</div><div className="text-xl font-bold">{fmtBRL(comp.resumo.valor_b)}</div></CardContent></Card>
            <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Diferença</div><div className={`text-xl font-bold ${comp.resumo.delta_valor < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtBRL(comp.resumo.delta_valor)}</div></CardContent></Card>
          </div>
        )}

        {/* Tabela */}
        {classe === 'utensilio' ? (
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">Cód.</th>
              <th className="text-left font-medium px-3 py-2">Item</th>
              <th className="text-left font-medium px-3 py-2">Seção</th>
              <th className="text-right font-medium px-3 py-2">Mín/Máx</th>
              <th className="text-right font-medium px-3 py-2">Estoque</th>
              <th className="text-right font-medium px-3 py-2">Compra</th>
              <th className="text-right font-medium px-3 py-2">Quebra</th>
              <th className="text-right font-medium px-3 py-2">Valor de Quebra</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itensView.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Nenhuma contagem nessa data.</td></tr>
              : itensView.map((it: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">{it.insumo_codigo || '—'}
                      {podeEditar && CLASSES_CADASTRO.includes(classe) && it.insumo_codigo && <button onClick={() => abrirCadastro(it.insumo_codigo)} className="text-gray-400 hover:text-indigo-600" title="Editar item"><Pencil className="w-3 h-3" /></button>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    <span className="inline-flex items-center gap-1.5" title={it.anomalo ? (it.anomalia_motivo || 'Fora do padrão') : undefined}>
                      {it.anomalo && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {it.insumo_nome}
                    </span>
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{it.area || '—'}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-400 text-xs">{it.estoque_min == null && it.estoque_max == null ? '—' : `${it.estoque_min ?? '—'} / ${it.estoque_max ?? '—'}`}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(it.estoque_final || 0).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{it.compra == null ? '—' : Number(it.compra).toLocaleString('pt-BR')}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${it.quebra == null ? 'text-gray-400' : Number(it.quebra) > 0 ? 'text-red-500' : Number(it.quebra) < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{it.quebra == null ? '—' : Number(it.quebra).toLocaleString('pt-BR')}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${it.valor_quebra == null ? 'text-gray-400' : Number(it.valor_quebra) > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{it.valor_quebra == null ? '—' : fmtBRL(it.valor_quebra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
        ) : !comparar ? (
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">
                <button onClick={() => toggleSort('codigo')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200" title="Ordenar por código">
                  Cód. {setaDe('codigo')}
                </button>
              </th>
              <th className="text-left font-medium px-3 py-2">
                <button onClick={() => toggleSort('nome')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200" title="Ordenar de A a Z">
                  {classe === 'limpeza' ? 'Item' : classe === 'producao' ? 'Produção' : 'Insumo'} {setaDe('nome')}
                </button>
              </th>
              {classe === 'limpeza'
                ? <ColumnFilterHeader label="Categoria" className="py-2" options={optionsByCol.categoria || []} selected={colFilter.categoria || new Set()} onChange={(n) => setCol('categoria', n)} />
                : <>
                    <ColumnFilterHeader label="Área" className="py-2" options={optionsByCol.area || []} selected={colFilter.area || new Set()} onChange={(n) => setCol('area', n)} />
                    <ColumnFilterHeader label="Categoria" className="py-2" options={optionsByCol.categoria || []} selected={colFilter.categoria || new Set()} onChange={(n) => setCol('categoria', n)} />
                  </>}
              {classe === 'limpeza' && <th className="text-right font-medium px-3 py-2">Estoque Ideal</th>}
              <th className="text-right font-medium px-3 py-2">
                <button onClick={() => toggleSort('qtd')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                  Qtd. contada {setaDe('qtd')}
                </button>
              </th>
              {classe === 'limpeza' && <th className="text-right font-medium px-3 py-2">Sug. Pedido</th>}
              <th className="text-right font-medium px-3 py-2">{classe === 'limpeza' ? 'Preço' : classe === 'producao' ? 'Custo (ficha)' : 'Preço VMarket (na data)'}</th>
              <th className="text-right font-medium px-3 py-2">
                <button onClick={() => toggleSort('valor')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                  Valor {setaDe('valor')}
                </button>
              </th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={classe === 'limpeza' ? 8 : 7} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itensView.length === 0 ? <tr><td colSpan={classe === 'limpeza' ? 8 : 7} className="px-3 py-10 text-center text-gray-400">Nenhuma contagem nessa data.</td></tr>
              : itensView.map((it: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">{it.insumo_codigo || '—'}
                      {podeEditar && CLASSES_CADASTRO.includes(classe) && it.insumo_codigo && <button onClick={() => abrirCadastro(it.insumo_codigo)} className="text-gray-400 hover:text-indigo-600" title="Editar item"><Pencil className="w-3 h-3" /></button>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    <span className="inline-flex items-center gap-1.5" title={it.anomalo ? (it.anomalia_motivo || 'Fora do padrão') : undefined}>
                      {it.anomalo && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {it.insumo_nome}
                    </span>
                  </td>
                  {classe === 'limpeza'
                    ? <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{it.categoria || '—'}</td>
                    : <><td className="px-3 py-2"><Badge variant="outline">{it.area || '—'}</Badge></td><td className="px-3 py-2 text-gray-500 dark:text-gray-400">{it.categoria || '—'}</td></>}
                  {classe === 'limpeza' && <td className="px-3 py-2 text-right tabular-nums text-gray-500">{it.estoque_ideal == null ? '—' : fmtQtd(it.estoque_ideal, it.unidade_medida)}</td>}
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.estoque_final, unidadeCol(it))}</td>
                  {classe === 'limpeza' && <td className={`px-3 py-2 text-right tabular-nums ${Number(it.sug_pedido) > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-400'}`}>{it.sug_pedido == null ? '—' : fmtQtd(it.sug_pedido, it.unidade_medida)}</td>}
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{it.custo_unitario ? fmtBRL(it.custo_unitario) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{it.valor ? fmtBRL(it.valor) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
        ) : (
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">
                <button onClick={() => toggleSortComp('codigo')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200" title="Ordenar por código">
                  Cód. {setaComp('codigo')}
                </button>
              </th>
              <th className="text-left font-medium px-3 py-2">
                <button onClick={() => toggleSortComp('nome')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200" title="Ordenar de A a Z">
                  Insumo {setaComp('nome')}
                </button>
              </th>
              <th className="text-right font-medium px-3 py-2">Qtd {fmtData(comp?.data_a)}</th>
              <th className="text-right font-medium px-3 py-2">Qtd {fmtData(comp?.data_b)}</th>
              <th className="text-right font-medium px-3 py-2">
                <button onClick={() => toggleSortComp('qtd')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200" title="Ordenar pela variação de quantidade">
                  Δ Qtd {setaComp('qtd')}
                </button>
              </th>
              <th className="text-right font-medium px-3 py-2">Valor {fmtData(comp?.data_a)}</th>
              <th className="text-right font-medium px-3 py-2">Valor {fmtData(comp?.data_b)}</th>
              <th className="text-right font-medium px-3 py-2">
                {/* "maior variação" é a ordem que a tela sempre teve (Δ em módulo) — continua sendo
                    o padrão; clicar aqui passa a ordenar por Δ com sinal, do maior pro menor. */}
                <button onClick={() => toggleSortComp('valor')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200" title="Ordenar pela variação de valor (clique de novo para inverter)">
                  Δ Valor {sortComp === 'delta' ? '≠' : setaComp('valor')}
                </button>
              </th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loadingComp ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : compView.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Escolha duas datas pra comparar.</td></tr>
              : compView.map((it: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">{it.insumo_codigo || '—'}
                      {podeEditar && CLASSES_CADASTRO.includes(classe) && it.insumo_codigo && <button onClick={() => abrirCadastro(it.insumo_codigo)} className="text-gray-400 hover:text-indigo-600" title="Editar item"><Pencil className="w-3 h-3" /></button>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{it.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.qtd_a, it.unidade)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.qtd_b, it.unidade)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${Number(it.delta_qtd) < 0 ? 'text-red-500' : Number(it.delta_qtd) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{Number(it.delta_qtd) > 0 ? '+' : ''}{Number(it.delta_qtd || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(it.valor_a)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(it.valor_b)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${Number(it.delta_valor) < 0 ? 'text-red-500' : Number(it.delta_valor) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{fmtBRL(it.delta_valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
        )}
    </PageShell>
  );
}
