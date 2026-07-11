'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Trash2, Loader2, Package, Clock, TrendingDown, TrendingUp, DollarSign, X, AlertTriangle,
  CalendarCheck, CalendarDays, CheckCircle2, ListChecks, Pencil,
} from 'lucide-react';
import {
  addDiasIso, fmtDM, isoLocal, desvioRendReais, fmtBRL, fmtNum, fmtPeso, rendAmigavel,
  fmtPct, fmtTempo, fmtData, secaoDeCodigo, type Secao,
} from './_shared';
import { EditarExecucaoModal } from './EditarExecucaoModal';

export function AbaHistorico({ fichas, responsaveis, secaoAtiva, podeEditar, podeExcluir }: { fichas: any[]; responsaveis: any[]; secaoAtiva: Secao; podeEditar: boolean; podeExcluir: boolean }) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;
  const [excluindo, setExcluindo] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);

  const [execs, setExecs] = useState<any[]>([]);
  const [baselines, setBaselines] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [fProd, setFProd] = useState<number | null>(null);
  const [fResp, setFResp] = useState<number | null>(null);
  const [buscaProd, setBuscaProd] = useState(''); // busca por texto no histórico (ex.: "pastel")
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [detInsumos, setDetInsumos] = useState<any[]>([]);
  // filtro de semana — mesmo time-frame do Planejamento da Produção (null = todas)
  const [semanaSel, setSemanaSel] = useState<string | null>(null);
  const [diaSel, setDiaSel] = useState<string>(''); // filtro por 1 dia (YYYY-MM-DD); '' = todos
  const [soFora, setSoFora] = useState(false); // mostrar só execuções fora do plano
  const [soAcimaPlano, setSoAcimaPlano] = useState(false); // mostrar só produções que passaram da QTD planejada
  const [rendFiltro, setRendFiltro] = useState<'todos' | 'abaixo' | 'dentro' | 'acima'>('todos'); // filtro por rendimento real vs esperado (±5%)
  const [planSemana, setPlanSemana] = useState<any | null>(null);

  // ao trocar de seção (Cozinha/Bar), zera o filtro de produção — ele aponta pra ficha da outra seção
  useEffect(() => { setFProd(null); }, [secaoAtiva]);

  // lista de semanas + itens planejados (planos encerrados) da semana selecionada
  useEffect(() => {
    if (!barId) return;
    const qs = semanaSel ? `?calendario=1&semana=${encodeURIComponent(semanaSel)}` : '?calendario=1';
    api.get(`/api/operacional/plano-producao${qs}`).then(r => { if (r?.success) setPlanSemana(r); }).catch(() => {});
  }, [barId, semanaSel]);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ bar_id: String(barId) });
      if (fProd) qs.set('producao_id', String(fProd));
      if (fResp) qs.set('responsavel_id', String(fResp));
      if (semanaSel) { qs.set('de', semanaSel); qs.set('ate', `${addDiasIso(semanaSel, 6)}T23:59:59.999`); }
      const r = await api.get(`/api/operacional/producoes/execucao?${qs.toString()}`);
      if (r.success) { setExecs(r.execucoes || []); setBaselines(r.baselines || {}); }
    } finally { setLoading(false); }
  }, [barId, fProd, fResp, semanaSel]);
  useEffect(() => { carregar(); }, [carregar]);

  // execuções da seção ativa (Cozinha/Bar) — base de tudo no histórico
  const execsSecao = useMemo(() =>
    execs.filter((e: any) => secaoDeCodigo(e.producao_codigo) === secaoAtiva),
    [execs, secaoAtiva]);

  // Produções que ESTAVAM no planejamento encerrado da semana carregada (só da seção ativa).
  // É contra este conjunto que marcamos "fora do plano".
  const planProdIds = useMemo(() => {
    const s = new Set<number>();
    (planSemana?.itens || []).forEach((it: any) => {
      if (!(Number(it.decidido_receitas) > 0)) return;
      const f = fichas.find(x => x.id === it.producao_id);
      if (f && secaoDeCodigo(f.codigo) === secaoAtiva) s.add(Number(it.producao_id));
    });
    return s;
  }, [planSemana, fichas, secaoAtiva]);

  // Janela [ini, fim] da semana que o plano carregado cobre. Só marcamos "fora do plano" execuções
  // DENTRO desta janela — assim nunca marcamos errado uma execução de outra semana (o plano é 1 semana).
  const planWeek = useMemo(() => {
    const ini = planSemana?.semana?.ini;
    return ini ? { ini, fim: addDiasIso(ini, 6) } : null;
  }, [planSemana]);

  // Uma execução é "fora do plano" quando cai na semana do plano carregado e a produção não estava planejada.
  const foraDoPlano = useCallback((e: any) => {
    if (!planWeek || !e?.criado_em) return false;
    const d = isoLocal(e.criado_em);
    return d >= planWeek.ini && d <= planWeek.fim && !planProdIds.has(Number(e.producao_id));
  }, [planWeek, planProdIds]);

  // ── "Acima do plano": produziu MAIS que a quantidade planejada na semana ──
  // GOTCHA de unidade: pra kg/L o rendimento_real é gravado em g/ml (×1000), enquanto o
  // plano (decidido_qtd) está em kg/L. un/porção/g/ml batem direto. Converte o produzido
  // pra unidade do plano antes de comparar. Tolerância de 5% (evita ruído de arredondamento).
  const TOL_ACIMA_PLANO = 1.05;
  const fatorParaUnidadePlano = (unidade?: string) =>
    /^(kg|l)$/i.test(String(unidade || '').trim()) ? 0.001 : 1; // g→kg, ml→L

  // Total planejado (decidido_qtd somado na semana) + unidade, por produção da seção ativa.
  const planoQtdPorProd = useMemo(() => {
    const m = new Map<number, { qtd: number; unidade?: string }>();
    (planSemana?.itens || []).forEach((it: any) => {
      const f = fichas.find(x => x.id === it.producao_id);
      if (!(f && secaoDeCodigo(f.codigo) === secaoAtiva)) return;
      const cur = m.get(Number(it.producao_id)) || { qtd: 0, unidade: it.unidade };
      cur.qtd += Number(it.decidido_qtd) || 0;
      if (!cur.unidade && it.unidade) cur.unidade = it.unidade;
      m.set(Number(it.producao_id), cur);
    });
    return m;
  }, [planSemana, fichas, secaoAtiva]);

  // Por produção da semana: planejado (decidido_qtd) vs produzido (convertido p/ unidade do plano)
  // + se passou (>5%). Usado no selo/alerta pra mostrar os números (planejado→produzido).
  const planoResumoPorProd = useMemo(() => {
    const m = new Map<number, { planejado: number; produzido: number; unidade?: string; acima: boolean }>();
    if (!planWeek) return m;
    planoQtdPorProd.forEach((v, prodId) => m.set(prodId, { planejado: v.qtd, produzido: 0, unidade: v.unidade, acima: false }));
    execsSecao.forEach((e: any) => {
      if (e.rendimento_real == null) return;
      const d = isoLocal(e.criado_em);
      if (d < planWeek.ini || d > planWeek.fim) return;
      const r = m.get(Number(e.producao_id));
      if (!r) return;
      r.produzido += Number(e.rendimento_real) * fatorParaUnidadePlano(r.unidade);
    });
    m.forEach((r) => { r.acima = r.planejado > 0 && r.produzido > r.planejado * TOL_ACIMA_PLANO; });
    return m;
  }, [planWeek, execsSecao, planoQtdPorProd]);

  const acimaDoPlano = useCallback((e: any) => {
    if (!planWeek || !e?.criado_em) return false;
    const d = isoLocal(e.criado_em);
    return d >= planWeek.ini && d <= planWeek.fim && !!planoResumoPorProd.get(Number(e.producao_id))?.acima;
  }, [planWeek, planoResumoPorProd]);

  // Resumo da Semana: cruza o plano encerrado da semana com as execuções da semana (só da seção ativa)
  const resumo = useMemo(() => {
    if (!semanaSel) return null;
    const execProdIds = new Set(execsSecao.map((e: any) => Number(e.producao_id)));
    const planejadasExecutadas = [...planProdIds].filter(id => execProdIds.has(id)).length;
    const comRend = execsSecao.filter((e: any) => e.rendimento_real != null && e.rendimento_esperado != null && e.rendimento_esperado > 0);
    const dentro = comRend.filter((e: any) => Math.abs(e.rendimento_real / e.rendimento_esperado - 1) <= 0.05).length;
    const aders = execsSecao.filter((e: any) => e.aderencia_pct != null).map((e: any) => Number(e.aderencia_pct));
    const aderMedia = aders.length ? aders.reduce((s: number, v: number) => s + v, 0) / aders.length : null;
    const tempoTotal = execsSecao.reduce((s: number, e: any) => s + (Number(e.duracao_seg) || 0), 0);
    const custoPlan = execsSecao.reduce((s: number, e: any) => s + (Number(e.custo_planejado) || 0), 0);
    const custoReal = execsSecao.reduce((s: number, e: any) => s + (Number(e.custo_real) || 0), 0);
    const desvioRendTotal = execsSecao.reduce((s: number, e: any) => s + (desvioRendReais(e) ?? 0), 0);
    // execuções fora do plano (produção não planejada) nesta semana
    const foraPlanoN = execsSecao.filter((e: any) => foraDoPlano(e)).length;
    return {
      planejadas: planProdIds.size,
      planejadasExecutadas,
      executadas: execsSecao.length,
      aderMedia,
      rendDentro: dentro,
      rendTotal: comRend.length,
      tempoTotal,
      custoPlan, custoReal, desvioRendTotal,
      foraPlano: foraPlanoN,
      acimaPlano: [...planoResumoPorProd.values()].filter(r => r.acima).length,
    };
  }, [semanaSel, execsSecao, planProdIds, foraDoPlano, planoResumoPorProd]);

  // busca por texto no histórico (nome/código) + filtro por 1 dia (data local = coluna "Data")
  const execsView = useMemo(() => {
    let base = execsSecao;
    if (diaSel) base = base.filter((e: any) => isoLocal(e.criado_em) === diaSel);
    if (soFora) base = base.filter((e: any) => foraDoPlano(e));
    if (soAcimaPlano) base = base.filter((e: any) => acimaDoPlano(e));
    if (rendFiltro !== 'todos') base = base.filter((e: any) => {
      const esp = Number(e.rendimento_esperado), real = Number(e.rendimento_real);
      if (!(e.rendimento_esperado != null && e.rendimento_real != null && esp > 0)) return false; // sem rendimento registrado
      const r = real / esp; // dentro = ±5%
      return rendFiltro === 'abaixo' ? r < 0.95 : rendFiltro === 'acima' ? r > 1.05 : (r >= 0.95 && r <= 1.05);
    });
    const s = buscaProd.trim().toLowerCase();
    if (!s) return base;
    return base.filter((e: any) => (e.producao_nome || '').toLowerCase().includes(s) || (e.producao_codigo || '').toLowerCase().includes(s));
  }, [execsSecao, buscaProd, diaSel, soFora, soAcimaPlano, rendFiltro, foraDoPlano, acimaDoPlano]);

  const abrirDetalhe = async (e: any) => {
    setDetalhe(e); setDetInsumos([]);
    try {
      const r = await api.get(`/api/operacional/producoes/execucao?bar_id=${barId}&execucao_id=${e.id}`);
      if (r.success) setDetInsumos(r.insumos || []);
    } catch (err: any) { toast({ title: 'Erro', description: err?.message, variant: 'destructive' }); }
  };

  // Excluir execução (admin only) — corrige lançamento errado/duplicado. Confirma antes.
  const excluir = async (e: any) => {
    if (!barId || excluindo) return;
    if (!window.confirm(`Excluir esta execução de "${e.producao_nome || `#${e.producao_id}`}" (${fmtData(e.criado_em)})?\n\nIsso remove do histórico e das médias. Não dá pra desfazer.`)) return;
    setExcluindo(true);
    try {
      const r = await api.delete(`/api/operacional/producoes/execucao?id=${e.id}&bar_id=${barId}`);
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Execução excluída', description: e.producao_nome || `#${e.producao_id}` });
      setDetalhe(null);
      await carregar();
    } catch (err: any) { toast({ title: 'Erro ao excluir', description: err?.message, variant: 'destructive' }); }
    finally { setExcluindo(false); }
  };

  // flags de controle por execução
  const flags = (e: any) => {
    const out: { icon: any; label: string; cls: string }[] = [];
    const base = baselines[e.producao_id];
    const limite = e.tempo_meta_seg || (base?.tempo_medio_seg ? base.tempo_medio_seg * 1.3 : null);
    if (e.duracao_seg != null && limite && e.duracao_seg > limite)
      out.push({ icon: Clock, label: 'demorou', cls: 'text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-900/20' });
    if (e.custo_real != null && e.custo_planejado != null && e.custo_planejado > 0 && e.custo_real > e.custo_planejado * 1.1)
      out.push({ icon: DollarSign, label: 'gasto alto', cls: 'text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20' });
    if (e.aderencia_pct != null && e.aderencia_pct < 85)
      out.push({ icon: Package, label: 'insumo fora', cls: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20' });
    if (e.rendimento_real != null && e.rendimento_esperado != null && e.rendimento_esperado > 0 && e.rendimento_real < e.rendimento_esperado * 0.95)
      out.push({ icon: TrendingDown, label: 'baixo rend.', cls: 'text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-900/20' });
    // retroativo: produção feita num dia anterior ao lançamento (inicio < criação) → tempo não vale
    if (e.inicio && e.criado_em && new Date(e.inicio).toISOString().slice(0, 10) < new Date(e.criado_em).toISOString().slice(0, 10))
      out.push({ icon: CalendarCheck, label: 'retroativo', cls: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20' });
    // fora do plano: produziram algo que não estava no planejamento da semana
    if (foraDoPlano(e))
      out.push({ icon: AlertTriangle, label: 'fora do plano', cls: 'text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-900/20' });
    // acima do plano: produziram MAIS que a quantidade planejada na semana (>5%)
    if (acimaDoPlano(e))
      out.push({ icon: TrendingUp, label: 'acima do plano', cls: 'text-sky-600 border-sky-300 bg-sky-50 dark:bg-sky-900/20' });
    return out;
  };

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex items-center gap-1.5 text-sm">
          <CalendarDays className="w-4 h-4 text-violet-500" />
          <select value={semanaSel ?? ''} onChange={e => setSemanaSel(e.target.value || null)}
            className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
            <option value="">Todas as semanas</option>
            {(planSemana?.semanas_disponiveis || []).filter((s: any) => s.tem_contagem).map((s: any) =>
              <option key={s.ini} value={s.ini}>{fmtDM(s.ini)} – {fmtDM(s.fim)}</option>)}
          </select>
        </div>
        <div className="inline-flex items-center gap-1.5 text-sm">
          <CalendarCheck className="w-4 h-4 text-blue-500" />
          <Input type="date" value={diaSel} max={new Date().toISOString().slice(0, 10)}
            onChange={e => setDiaSel(e.target.value)} title="Filtrar por um dia específico" className="h-9 w-40" />
          {diaSel && <button onClick={() => setDiaSel('')} className="text-gray-400 hover:text-gray-600" title="Limpar dia"><X className="w-4 h-4" /></button>}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={buscaProd} onChange={e => setBuscaProd(e.target.value)} placeholder="Buscar produção (ex.: pastel)…" className="h-9 pl-8 w-52" />
        </div>
        <select value={fProd ?? ''} onChange={e => setFProd(e.target.value ? Number(e.target.value) : null)}
          className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
          <option value="">Todas as produções</option>
          {fichas.filter(f => secaoDeCodigo(f.codigo) === secaoAtiva).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <select value={fResp ?? ''} onChange={e => setFResp(e.target.value ? Number(e.target.value) : null)}
          className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
          <option value="">Todos os responsáveis</option>
          {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <button onClick={() => setSoFora(v => !v)} title="Mostrar só as produções feitas fora do planejamento"
          className={`inline-flex items-center gap-1 h-9 rounded-md border px-2.5 text-sm transition ${soFora ? 'border-rose-400 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
          <AlertTriangle className="w-3.5 h-3.5" />Só fora do plano
        </button>
        <button onClick={() => setSoAcimaPlano(v => !v)} title="Mostrar só as produções que produziram MAIS que a quantidade planejada na semana (só com semana selecionada)"
          className={`inline-flex items-center gap-1 h-9 rounded-md border px-2.5 text-sm transition ${soAcimaPlano ? 'border-sky-400 bg-sky-50 text-sky-600 dark:border-sky-800 dark:bg-sky-900/25 dark:text-sky-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
          <TrendingUp className="w-3.5 h-3.5" />Só acima do plano
        </button>
        <select value={rendFiltro} onChange={e => setRendFiltro(e.target.value as 'todos' | 'abaixo' | 'dentro' | 'acima')} title="Filtrar pelo rendimento real vs. esperado (tolerância ±5%)"
          className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
          <option value="todos">Rendimento: todos</option>
          <option value="abaixo">🔻 Abaixo do rendimento</option>
          <option value="dentro">✅ Dentro (±5%)</option>
          <option value="acima">🔺 Acima do rendimento</option>
        </select>
        {(fProd || fResp || semanaSel || buscaProd || diaSel || soFora || soAcimaPlano || rendFiltro !== 'todos') && <button onClick={() => { setFProd(null); setFResp(null); setSemanaSel(null); setBuscaProd(''); setDiaSel(''); setSoFora(false); setSoAcimaPlano(false); setRendFiltro('todos'); }} className="text-xs text-gray-400 underline">limpar</button>}
        <span className="text-xs text-gray-400 ml-auto">{execsView.length} execuç{execsView.length === 1 ? 'ão' : 'ões'}</span>
      </div>

      {/* Resumo da Semana — cruza o que foi planejado (plano encerrado) com o que foi executado */}
      {resumo && (
        <Card className="card-dark border-violet-200 dark:border-violet-900/40">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
              <CalendarCheck className="w-4 h-4" />Resumo da semana {fmtDM(semanaSel)} – {fmtDM(addDiasIso(semanaSel!, 6))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><ListChecks className="w-3.5 h-3.5" />Planejado × executado</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{resumo.planejadasExecutadas}<span className="text-gray-400 text-sm font-normal">/{resumo.planejadas}</span></div>
                <div className="text-[11px] text-gray-400">{resumo.executadas} execuç{resumo.executadas === 1 ? 'ão' : 'ões'} no total</div>
              </div>
              <div className={`rounded-lg border p-2 ${resumo.foraPlano > 0 ? 'border-rose-300 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-900/15' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center gap-1 text-xs text-gray-500"><AlertTriangle className="w-3.5 h-3.5" />Fora do plano</div>
                <div className={`text-lg font-bold tabular-nums ${resumo.foraPlano > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{resumo.foraPlano}</div>
                <div className="text-[11px] text-gray-400">produção não planejada</div>
              </div>
              <div className={`rounded-lg border p-2 ${resumo.acimaPlano > 0 ? 'border-sky-300 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-900/15' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center gap-1 text-xs text-gray-500"><TrendingUp className="w-3.5 h-3.5" />Acima do plano</div>
                <div className={`text-lg font-bold tabular-nums ${resumo.acimaPlano > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{resumo.acimaPlano}</div>
                <div className="text-[11px] text-gray-400">produziu + que o planejado</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><Package className="w-3.5 h-3.5" />Aderência média</div>
                <div className={`text-lg font-bold tabular-nums ${resumo.aderMedia == null ? 'text-gray-400' : resumo.aderMedia >= 90 ? 'text-emerald-600' : resumo.aderMedia >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{fmtPct(resumo.aderMedia)}</div>
                <div className="text-[11px] text-gray-400">insumos calc. × usado</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><CheckCircle2 className="w-3.5 h-3.5" />Rend. no esperado</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{resumo.rendDentro}<span className="text-gray-400 text-sm font-normal">/{resumo.rendTotal}</span></div>
                <div className="text-[11px] text-gray-400">dentro de ±5%</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><Package className="w-3.5 h-3.5" />Desvio insumos</div>
                {(() => { const di = resumo.custoReal - resumo.custoPlan; return <div className={`text-base font-bold tabular-nums ${di > 0.005 ? 'text-red-600' : di < -0.005 ? 'text-emerald-600' : 'text-gray-900 dark:text-gray-100'}`}>{di >= 0 ? '+' : ''}{fmtBRL(di)}</div>; })()}
                <div className="text-[11px] text-gray-400">real − planejado</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><DollarSign className="w-3.5 h-3.5" />Desvio rendimento</div>
                <div className={`text-base font-bold tabular-nums ${resumo.desvioRendTotal > 0.005 ? 'text-emerald-600' : resumo.desvioRendTotal < -0.005 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>{resumo.desvioRendTotal >= 0 ? '+' : ''}{fmtBRL(resumo.desvioRendTotal)}</div>
                <div className="text-[11px] text-gray-400">vs esperado</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3.5 h-3.5" />Tempo total</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{fmtTempo(resumo.tempoTotal)}</div>
                <div className="text-[11px] text-gray-400">soma das execuções</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Baseline da ficha filtrada */}
      {fProd && baselines[fProd] && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline" className="text-blue-600 border-blue-300"><Clock className="w-3 h-3 mr-1" />tempo médio {baselines[fProd].tempo_medio_seg != null ? fmtTempo(baselines[fProd].tempo_medio_seg) : '—'}</Badge>
          <Badge variant="outline" className="text-emerald-600 border-emerald-300"><DollarSign className="w-3 h-3 mr-1" />custo médio {fmtBRL(baselines[fProd].custo_medio)}</Badge>
          <Badge variant="outline" className="text-amber-600 border-amber-300"><Package className="w-3 h-3 mr-1" />aderência média {fmtPct(baselines[fProd].aderencia_media)}</Badge>
        </div>
      )}

      <Card className="card-dark">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
              <th className="text-left font-medium px-3 py-2">Data</th>
              <th className="text-left font-medium px-3 py-2">Produção</th>
              <th className="text-left font-medium px-3 py-2">Responsável</th>
              <th className="text-right font-medium px-3 py-2">Tempo</th>
              <th className="text-right font-medium px-3 py-2">Custo plan./real</th>
              <th className="text-right font-medium px-3 py-2" title="Desvio de insumos = custo real − custo planejado (usaram mais/menos ingrediente do que a ficha pedia)">Desvio Insumos</th>
              <th className="text-right font-medium px-3 py-2">Aderência</th>
              <th className="text-right font-medium px-3 py-2">Rend. real/meta</th>
              <th className="text-right font-medium px-3 py-2" title="Rendimento real ÷ rendimento esperado">% Rend.</th>
              <th className="text-right font-medium px-3 py-2" title="Fator de correção: realizado (líquido ÷ bruto pesado) / esperado (da ficha). Só nas produções que pesam o bruto (FC).">FC real/esp</th>
              <th className="text-right font-medium px-3 py-2" title="Desvio de rendimento em R$ = (rend. real − rend. esperado) × custo por kg da produção">Desvio Rend.</th>
              <th className="text-left font-medium px-3 py-2">Alertas</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : execsView.length === 0 ? <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-400">{soAcimaPlano ? (semanaSel ? 'Nenhuma produção acima da quantidade planejada 👍 (tudo dentro do plano).' : 'Selecione uma semana pra comparar com o planejado.') : soFora ? 'Nenhuma produção fora do plano 🎉 (tudo dentro do planejamento).' : diaSel ? `Nenhuma execução em ${fmtDM(diaSel)}.` : buscaProd ? 'Nenhuma execução com essa busca.' : 'Nenhuma execução registrada ainda.'}</td></tr>
              : execsView.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer" onClick={() => abrirDetalhe(e)}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{fmtData(e.criado_em)}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{e.producao_nome || `#${e.producao_id}`}<span className="block text-xs text-gray-400">{e.producao_codigo || ''}</span>
                    {(() => {
                      const r = acimaDoPlano(e) ? planoResumoPorProd.get(Number(e.producao_id)) : null;
                      if (!r) return null;
                      const un = r.unidade ? ` ${r.unidade}` : '';
                      return <span className="block text-[11px] text-sky-600 dark:text-sky-400 font-medium mt-0.5 whitespace-nowrap"><TrendingUp className="inline w-3 h-3 mr-0.5 -mt-0.5" />plano {fmtNum(r.planejado, 1)} → feito {fmtNum(r.produzido, 1)}{un}</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.responsavel_nome || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.duracao_seg != null ? fmtTempo(e.duracao_seg) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(e.custo_planejado)} <span className="text-gray-400">/</span> <span className="font-medium">{fmtBRL(e.custo_real)}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {(e.custo_real == null || e.custo_planejado == null) ? <span className="text-gray-400">—</span>
                      : (() => { const d = Number(e.custo_real) - Number(e.custo_planejado); return <span className={d > 0.005 ? 'text-red-600 font-medium' : d < -0.005 ? 'text-emerald-600 font-medium' : 'text-gray-400'}>{d >= 0 ? '+' : ''}{fmtBRL(d)}</span>; })()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={e.aderencia_pct == null ? 'text-gray-400' : e.aderencia_pct >= 90 ? 'text-emerald-600' : e.aderencia_pct >= 80 ? 'text-amber-600' : 'text-red-600'}>{fmtPct(e.aderencia_pct)}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{(() => { const r = rendAmigavel(e); return <>{r.real != null ? fmtNum(r.real, 2) : '—'} <span className="text-gray-400">/</span> {r.esp != null ? fmtNum(r.esp, 2) : '—'}{r.un ? ` ${r.un}` : ''}</>; })()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(e.rendimento_real == null || e.rendimento_esperado == null || !(e.rendimento_esperado > 0)) ? <span className="text-gray-400">—</span>
                      : (() => { const p = (e.rendimento_real / e.rendimento_esperado) * 100; return <span className={p >= 95 && p <= 105 ? 'text-emerald-600' : p >= 90 ? 'text-amber-600' : 'text-red-600'}>{fmtPct(p)}</span>; })()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {(!(Number(e.peso_bruto) > 0) || !(Number(e.peso_mestre_real) > 0)) ? <span className="text-gray-400">—</span>
                      : (() => { const fcReal = Number(e.peso_mestre_real) / Number(e.peso_bruto); const fcEsp = Number(e.fc_esperado) || 0; const cls = fcEsp > 0 && fcReal < fcEsp - 0.02 ? 'text-red-600 font-medium' : fcEsp > 0 && fcReal > fcEsp + 0.02 ? 'text-emerald-600 font-medium' : 'text-gray-600 dark:text-gray-300'; return <span className={cls}>{fmtNum(fcReal, 2)}{fcEsp > 0 ? <span className="text-gray-400"> / {fmtNum(fcEsp, 2)}</span> : ''}</span>; })()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {(() => { const d = desvioRendReais(e); return d == null ? <span className="text-gray-400">—</span>
                      : <span className={d > 0.005 ? 'text-emerald-600 font-medium' : d < -0.005 ? 'text-red-600 font-medium' : 'text-gray-400'}>{d >= 0 ? '+' : ''}{fmtBRL(d)}</span>; })()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {flags(e).map((f, i) => {
                        const Icon = f.icon;
                        return <span key={i} className={`inline-flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5 border ${f.cls}`}><Icon className="w-3 h-3" />{f.label}</span>;
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal detalhe */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetalhe(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">{detalhe.producao_nome}</h4>
                <p className="text-xs text-gray-500">{fmtData(detalhe.criado_em)} · {detalhe.responsavel_nome || '—'} · {detalhe.duracao_seg != null ? fmtTempo(detalhe.duracao_seg) : '—'}</p>
                {/* Rendimento real × planejado (da ficha) */}
                {detalhe.rendimento_real != null && (
                  <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">
                    Rendimento: <b>{fmtNum(rendAmigavel(detalhe).real, 2)} {rendAmigavel(detalhe).un}</b>
                    <span className="text-gray-400"> / meta </span>
                    {detalhe.rendimento_esperado != null ? `${fmtNum(rendAmigavel(detalhe).esp, 2)} ${rendAmigavel(detalhe).un}` : '—'}
                    {detalhe.rendimento_esperado != null && detalhe.rendimento_esperado > 0 && (() => {
                      const p = (Number(detalhe.rendimento_real) / Number(detalhe.rendimento_esperado)) * 100;
                      return <span className={`ml-1 font-medium ${p >= 95 && p <= 105 ? 'text-emerald-600' : p >= 90 ? 'text-amber-600' : 'text-red-600'}`}>({fmtPct(p)})</span>;
                    })()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {podeEditar && (
                  <button onClick={() => { setEditando(detalhe); setDetalhe(null); }}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 border border-indigo-200 dark:border-indigo-800 rounded-md px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    title="Editar esta execução">
                    <Pencil className="w-3.5 h-3.5" />Editar
                  </button>
                )}
                {podeExcluir && (
                  <button onClick={() => excluir(detalhe)} disabled={excluindo}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 border border-red-200 dark:border-red-800 rounded-md px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    title="Excluir esta execução do histórico">
                    {excluindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}Excluir
                  </button>
                )}
                <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {flags(detalhe).map((f, i) => { const Icon = f.icon; return <span key={i} className={`inline-flex items-center gap-0.5 text-[11px] rounded px-1.5 py-0.5 border ${f.cls}`}><Icon className="w-3 h-3" />{f.label}</span>; })}
              {/* FC resultante (líquido/bruto) vs esperado da ficha — só quando pesou o bruto (mestre com FC) */}
              {Number(detalhe.peso_bruto) > 0 && Number(detalhe.peso_mestre_real) > 0 && (() => {
                const fcReal = Number(detalhe.peso_mestre_real) / Number(detalhe.peso_bruto);
                const fcEsp = Number(detalhe.fc_esperado) || 0;
                const cls = fcEsp > 0 && fcReal < fcEsp - 0.02 ? 'text-red-600 border-red-300 dark:text-red-400 dark:border-red-800' : fcEsp > 0 && fcReal > fcEsp + 0.02 ? 'text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800' : 'text-gray-600 border-gray-300 dark:text-gray-300 dark:border-gray-700';
                return <span className={`inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 border ${cls}`} title="Fator de correção resultante (líquido ÷ bruto) vs o esperado da ficha">FC real {fmtNum(fcReal, 2)}{fcEsp > 0 ? ` · esperado ${fmtNum(fcEsp, 2)}` : ''}</span>;
              })()}
              {detalhe.observacao && <span className="text-xs text-gray-500 italic">“{detalhe.observacao}”</span>}
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                <th className="text-left font-medium px-2 py-1.5">Insumo</th>
                <th className="text-right font-medium px-2 py-1.5" title="Peso pesado antes de limpar (mestre com fator de correção)">Bruto</th>
                <th className="text-right font-medium px-2 py-1.5">Calculado</th>
                <th className="text-right font-medium px-2 py-1.5" title="Líquido que foi pra receita">Usado</th>
                <th className="text-right font-medium px-2 py-1.5">Desvio</th>
                <th className="text-right font-medium px-2 py-1.5">Custo real</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {detInsumos.length === 0 ? <tr><td colSpan={6} className="px-2 py-4 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></td></tr>
                : detInsumos.map(i => (
                  <tr key={i.id} className={i.is_mestre ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                    <td className="px-2 py-1.5">{i.is_mestre && <span className="text-amber-500 mr-1">★</span>}{i.nome || i.insumo_codigo || '—'}</td>
                    {/* Bruto: só o mestre com peso bruto lançado (FC). É o que de fato saiu do estoque antes da limpeza. */}
                    <td className="px-2 py-1.5 text-right tabular-nums">{i.is_mestre && detalhe.peso_bruto != null && Number(detalhe.peso_bruto) > 0
                      ? <span className="font-medium text-gray-700 dark:text-gray-200">{fmtPeso(detalhe.peso_bruto, i.unidade)}</span>
                      : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtPeso(i.qtd_calculada, i.unidade)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtPeso(i.qtd_real, i.unidade)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {i.desvio_pct == null ? '—' : <span className={Math.abs(i.desvio_pct) < 0.05 ? 'text-emerald-600' : Math.abs(i.desvio_pct) < 0.15 ? 'text-amber-600' : 'text-red-600'}>{i.desvio_pct > 0 ? '+' : ''}{fmtPct(i.desvio_pct * 100)}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(i.custo_real)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de edição rápida (admin) — corrige lançamento errado sem perder o registro */}
      {editando && podeEditar && barId && (
        <EditarExecucaoModal
          exec={editando} fichas={fichas} responsaveis={responsaveis} barId={barId}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}
