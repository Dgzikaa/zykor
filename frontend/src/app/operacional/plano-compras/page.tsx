'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/PageShell';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { ShoppingCart, Search, Loader2, CalendarDays, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Eye, EyeOff, RotateCcw } from 'lucide-react';

const fmtN = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtI = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
// número na unidade-base com conversão p/ leitura (g≥1000→kg, ml≥1000→L) — evita "627.000,00 ml"
const fmtMedida = (v: any, base?: string) => {
  if (v == null) return '—';
  const n = Number(v);
  if (base === 'g') return n >= 1000 ? `${fmtN(n / 1000)} kg` : `${fmtN(n)} g`;
  if (base === 'ml') return n >= 1000 ? `${fmtN(n / 1000)} L` : `${fmtN(n)} ml`;
  return `${fmtN(n)} un`;
};
// valor da unidade-base convertido p/ nº de EMBALAGENS (unidade de compra), ex.: 627000 ml ÷ 269 = 2331 latas
const fmtEmb = (vBase: any, emb: any) => vBase == null ? '—' : fmtN(Number(vBase) / (Number(emb) || 1));
const fmtDM = (s: string) => s ? s.split('-').reverse().slice(0, 2).join('/') : '';

// Nível de Serviço → Fator de Serviço (z), igual ao Planejamento da Produção. Entra no PR.
const NIVEIS = [50, 60, 70, 80, 85, 90, 95, 96, 97, 98, 99, 99.9];
const NIVEL_Z: Record<number, number> = { 50: 0, 60: 0.254, 70: 0.525, 80: 0.842, 85: 1.037, 90: 1.282, 95: 1.645, 96: 1.751, 97: 1.88, 98: 2.055, 99: 2.325, 99.9: 3.1 };
const zDe = (n: number) => NIVEL_Z[n] ?? 1.645;
const r2 = (v: number) => Number(v.toFixed(2));
// Média ponderada por recência (peso = posição+1) e desvio padrão — espelham o route, p/ recompute
// ao vivo quando o usuário edita/ignora uma semana. `ign[i]` = semana ignorada (fora da média).
const mediaPond = (s: number[], ign: boolean[]) => { let n = 0, d = 0; s.forEach((v, i) => { if (ign[i]) return; if (v > 0) { n += v * (i + 1); d += (i + 1); } }); return d > 0 ? n / d : 0; };
const desvPad = (s: number[]) => { const k = s.length; if (k < 2) return 0; const m = s.reduce((a, v) => a + v, 0) / k; return Math.sqrt(s.reduce((a, v) => a + (v - m) ** 2, 0) / (k - 1)); };
const ehProteina = (secao?: string | null) => /prote/i.test(secao || '');

export default function PlanoComprasPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('🛒 Planejamento de Compras'); return () => setPageTitle(''); }, [setPageTitle]);
  const barId = selectedBar?.id;
  const [res, setRes] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [soCurvaA, setSoCurvaA] = useState(false);
  const [soProteina, setSoProteina] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | 'comprar' | 'nao'>('todos');
  const [secao, setSecao] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [semanaSel, setSemanaSel] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!barId) return; setLoading(true);
    try {
      const qs = semanaSel ? `?semana=${encodeURIComponent(semanaSel)}` : '';
      const r = await api.get(`/api/operacional/plano-compras${qs}`);
      if (r.success) setRes(r);
    } finally { setLoading(false); }
  }, [barId, semanaSel]);
  useEffect(() => { carregar(); }, [carregar]);

  const semanaAtual = semanaSel ?? res?.semana_sel ?? null;
  const secoes = useMemo(() => Array.from(new Set(((res?.itens || []) as any[]).map((i) => i.secao_vmarket).filter(Boolean))).sort(), [res]);

  const linhas = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return ((res?.itens || []) as any[]).filter((i) =>
      (!soCurvaA || i.curva_a)
      && (!soProteina || ehProteina(i.secao_vmarket))
      && (filtro === 'todos' || (filtro === 'comprar' ? !i.nao_comprar : i.nao_comprar))
      && (!secao || i.secao_vmarket === secao)
      && (!s || (i.nome || '').toLowerCase().includes(s) || (i.codigo || '').toLowerCase().includes(s)))
      // insumo marcado como "acabou" sobe pro topo (o resto mantém a ordem de sugestão do servidor)
      .sort((a, b) => (b.falta ? 1 : 0) - (a.falta ? 1 : 0));
  }, [res, busca, soCurvaA, soProteina, filtro, secao]);

  // muda o nível de serviço do insumo: recalcula PR/sugestão ao vivo (PR = Média6s + DesvPad × z)
  // e persiste. Tudo em unidade-base (mesma dos campos da linha).
  const salvarConfig = async (it: any, ns: number) => {
    setRes((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: (prev.itens as any[]).map((x) => {
          if (x.codigo !== it.codigo) return x;
          const pr = x.media6 + x.desvpad * zDe(ns);
          const sugestaoBase = pr - x.estoque + x.ab;
          const naoComprar = sugestaoBase <= 0;
          const sugestaoQtd = !naoComprar ? Math.ceil(sugestaoBase / (x.embalagem || 1)) : 0;
          return { ...x, nivel_servico: ns, pr: r2(pr), sugestao_base: r2(sugestaoBase), sugestao_qtd: sugestaoQtd, nao_comprar: naoComprar };
        }),
      };
    });
    try { await api.post('/api/operacional/plano-compras', { bar_id: barId, action: 'config', insumo_codigo: it.codigo, nivel_servico: ns }); }
    catch { /* fica salvo local; próximo refresh corrige */ }
  };

  // Ajusta a saída de UMA semana: valor na mão (patch.valorBase, unidade-base; null = volta ao
  // automático) e/ou ignorar (patch.ignorar). Recalcula Média6/DesvPad/PR/Sugestão ao vivo (só as
  // semanas não-ignoradas entram) e persiste. Fica registrado quem alterou (usuario) no banco.
  const salvarSaida = async (it: any, i: number, patch: { valorBase?: number | null; ignorar?: boolean }) => {
    const semana = it.semanas?.[i];
    if (!semana) return;
    const saidas = [...(it.saidas || [])];
    const ignorados = [...(it.ignorados || [])];
    const manuais = [...(it.manuais || [])];
    const orig = (it.saidas_orig || [])[i] ?? 0;
    if ('valorBase' in patch) {
      if (patch.valorBase == null) { saidas[i] = orig; manuais[i] = false; }
      else { saidas[i] = patch.valorBase; manuais[i] = true; }
    }
    if ('ignorar' in patch) ignorados[i] = !!patch.ignorar;
    const valor_manual = manuais[i] ? saidas[i] : null;
    const ignorar = !!ignorados[i];
    const media6 = mediaPond(saidas, ignorados);
    const desvpad = desvPad(saidas.filter((_, k) => !ignorados[k]));
    const pr = media6 + desvpad * zDe(it.nivel_servico);
    const sugestaoBase = pr - it.estoque + it.ab;
    const naoComprar = sugestaoBase <= 0;
    const sugestaoQtd = !naoComprar ? Math.ceil(sugestaoBase / (it.embalagem || 1)) : 0;
    const ultima = saidas.length ? saidas[saidas.length - 1] : null;
    setRes((prev: any) => prev ? { ...prev, itens: (prev.itens as any[]).map((x) => x.codigo === it.codigo
      ? { ...x, saidas, ignorados, manuais, ultima, media6: r2(media6), desvpad: r2(desvpad), pr: r2(pr), sugestao_base: r2(sugestaoBase), sugestao_qtd: sugestaoQtd, nao_comprar: naoComprar }
      : x) } : prev);
    try { await api.post('/api/operacional/plano-compras', { bar_id: barId, action: 'saida_ajuste', insumo_codigo: it.codigo, semana_ini: semana, valor_manual, ignorar }); }
    catch { /* fica local; próximo refresh corrige */ }
  };

  // Marca/resolve "insumo acabou" (sinal manual que vira badge, mesmo com a contagem mostrando estoque).
  // Otimista no local; persiste no servidor. resolver=true limpa a falta (comprou / recontou / voltou).
  const marcarFalta = async (it: any, resolver: boolean) => {
    setRes((prev: any) => prev ? { ...prev, itens: (prev.itens as any[]).map((x) => x.codigo === it.codigo
      ? { ...x, falta: resolver ? null : { origem: 'compras', por: null, em: new Date().toISOString() } } : x) } : prev);
    try {
      await api.post('/api/operacional/insumo-falta', { bar_id: barId, insumo_codigo: it.codigo, nome: it.nome, origem: 'compras', acao: resolver ? 'resolver' : 'marcar' });
    } catch { /* fica local; próximo refresh corrige */ }
  };

  const totComprar = useMemo(() => linhas.filter((i) => !i.nao_comprar).length, [linhas]);
  const custoEstimado = useMemo(() => linhas.reduce((s, i) => s + (i.nao_comprar ? 0 : i.sugestao_qtd * i.custo), 0), [linhas]);
  const semProducao = (res?.producao_encerrada || []).length === 0;

  return (
    <PageShell width="wide">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl"><ShoppingCart className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
          <div className="flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">Sugestão de compra = Ponto de Ressuprimento − Estoque + necessidade da produção · {selectedBar?.nome || ''}</p>
          </div>
          <button onClick={carregar} title="Atualizar" className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
        </div>

        {/* Semana + status */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {res?.semanas_disponiveis && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-1"><CalendarDays className="w-4 h-4" />Semana:
            <select value={semanaAtual ?? ''} onChange={e => { setSemanaSel(e.target.value); setAberto(null); }} className="bg-transparent font-semibold outline-none cursor-pointer">
              {res.semanas_disponiveis.map((s: any) => <option key={s.ini} value={s.ini} disabled={!s.tem_contagem} className="text-gray-900">{fmtDM(s.ini)} – {fmtDM(s.fim)}{s.tem_contagem ? '' : ' (aguardando contagem)'}</option>)}
            </select>
          </span>}
          {semProducao && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-1"><AlertTriangle className="w-4 h-4" />Produção não encerrada nesta semana — a coluna &ldquo;p/ Produção&rdquo; fica zerada até finalizar o Planejamento da Produção.</span>}
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Insumos a comprar</div><div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totComprar}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Custo estimado</div><div className="text-2xl font-bold">{custoEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Insumos na lista</div><div className="text-2xl font-bold">{linhas.length}</div></CardContent></Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar insumo…" className="pl-9" /></div>
          <select value={secao} onChange={e => setSecao(e.target.value)} className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 cursor-pointer max-w-[220px]">
            <option value="" className="text-gray-900">Todas as seções (VMarket)</option>
            {secoes.map((s) => <option key={s as string} value={s as string} className="text-gray-900">{s as string}</option>)}
          </select>
          <button onClick={() => setSoCurvaA(v => !v)}><Badge variant="outline" className={`cursor-pointer text-indigo-600 border-indigo-300 ${soCurvaA ? 'ring-1 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>Só Curva A</Badge></button>
          <button onClick={() => setSoProteina(v => !v)}><Badge variant="outline" className={`cursor-pointer text-rose-600 border-rose-300 ${soProteina ? 'ring-1 ring-rose-400 bg-rose-50 dark:bg-rose-900/20' : ''}`}>Só Proteínas (P)</Badge></button>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
            {([['todos', 'Todos'], ['comprar', 'Comprar'], ['nao', 'Não comprar']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setFiltro(v)} className={`px-3 py-1.5 ${filtro === v ? 'bg-emerald-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{label}</button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2 w-full">Insumo</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="Uso direto da última semana (em nº de embalagens)">Uso Direto</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="Média ponderada do uso direto das 6 semanas (em nº de embalagens)">Média 6s</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="Desvio padrão (em nº de embalagens)">Desv. Pad.</th>
              <th className="text-center font-medium px-1.5 py-2 whitespace-nowrap min-w-[72px]" title="Define o fator de segurança do Ponto de Ressuprimento (z). Entra no PR.">Nível de Serviço</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="Ponto de Ressuprimento = média + desvio × fator de serviço (em nº de embalagens)">PR</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="Estoque atual (em nº de embalagens)">Estoque</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="Necessidade da produção planejada, plano encerrado da semana (em nº de embalagens)">p/ Produção</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[72px]">Sugestão</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="O que apareceu de compra no Vmarket nesta semana">Comprado</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={10} className="px-3 py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : linhas.length === 0 ? <tr><td colSpan={10} className="px-3 py-12 text-center text-gray-400">Sem insumos no filtro.</td></tr>
              : linhas.map((it) => {
                const expandido = aberto === it.codigo;
                return (
                <Fragment key={it.codigo}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100 leading-tight w-full">
                    <span className="whitespace-nowrap font-medium">{it.nome}</span>{it.curva_a && <Badge variant="outline" className="ml-1.5 text-[10px] text-indigo-600 border-indigo-300">A</Badge>}
                    {it.falta
                      ? <button onClick={() => marcarFalta(it, true)} title={`Marcado como ACABOU${it.falta.por ? ' por ' + it.falta.por : ''}${it.falta.em ? ' em ' + fmtDM(String(it.falta.em).slice(0, 10)) : ''}. Clique para resolver (comprou / recontou / voltou).`}
                          className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[10px] rounded px-1.5 py-0.5 border border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">⚠ acabou</button>
                      : <button onClick={() => marcarFalta(it, false)} title="Marcar que este insumo acabou (vira badge e sobe pro topo)"
                          className="ml-1.5 align-middle text-[10px] text-gray-300 hover:text-rose-500 dark:text-gray-600 dark:hover:text-rose-400">acabou?</button>}
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400 font-mono">{it.codigo}</span>
                    <span className="block text-[11px] text-gray-400 whitespace-nowrap">{it.secao_vmarket || 'sem seção'} · emb. {fmtMedida(it.embalagem, it.base)}</span>
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap">{fmtEmb(it.ultima, it.embalagem)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap">
                    <button onClick={() => setAberto(expandido ? null : it.codigo)} className="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400" title="Ver as 6 semanas que formam a média">
                      {expandido ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}{fmtEmb(it.media6, it.embalagem)}
                    </button>
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-gray-500 whitespace-nowrap">{fmtEmb(it.desvpad, it.embalagem)}</td>
                  <td className="px-1.5 py-2 text-center whitespace-nowrap">
                    <select value={it.nivel_servico} onChange={e => salvarConfig(it, Number(e.target.value))} title="Nível de serviço (z do PR)"
                      className="bg-transparent text-xs outline-none cursor-pointer rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 px-1">
                      {NIVEIS.map(n => <option key={n} value={n} className="text-gray-900">{n}%</option>)}
                    </select>
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200 font-medium whitespace-nowrap">{fmtEmb(it.pr, it.embalagem)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-gray-500 whitespace-nowrap"
                    title={it.consumo_pos > 0 ? `Estoque real = contagem ${fmtMedida(it.estoque_contagem, it.base)} − ${fmtMedida(it.consumo_pos, it.base)} produzido desde a contagem` : undefined}>
                    {fmtEmb(it.estoque, it.embalagem)}{it.consumo_pos > 0 && <span className="ml-0.5 text-amber-500">•</span>}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap">{it.ab > 0 ? <span className="text-indigo-600 dark:text-indigo-400">{fmtEmb(it.ab, it.embalagem)}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                  <td className="px-1.5 py-2 text-right whitespace-nowrap">
                    {it.nao_comprar
                      ? <span className="text-gray-400 text-xs">Não comprar</span>
                      : <span className="inline-flex flex-col items-end"><span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{fmtI(it.sugestao_qtd)} emb.</span><span className="text-[10px] text-gray-400">≈ {fmtMedida(it.sugestao_base, it.base)}</span></span>}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap">{it.comprado > 0 ? <span className="text-gray-700 dark:text-gray-200">{fmtI(it.comprado)} emb.</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                </tr>
                {expandido && <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                  <td colSpan={10} className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-600 dark:text-gray-300 mr-1">Uso direto por semana:</span>
                      {(it.semanas || []).map((wk: string, i: number) => {
                        const vBase = it.saidas?.[i] ?? 0;
                        const ign = it.ignorados?.[i];
                        const man = it.manuais?.[i];
                        const vEmb = r2(vBase / (it.embalagem || 1));
                        return (
                          <span key={wk} className={`inline-flex items-center gap-1 rounded px-2 py-1 border ${ign ? 'border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/60 text-gray-400' : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'}`}>
                            <span className="font-medium">{fmtDM(wk)}</span>
                            <input key={`${wk}-${man}-${ign}-${vEmb}`} type="number" step="any" defaultValue={vEmb} disabled={ign}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              onBlur={e => { const raw = e.target.value.trim().replace(',', '.'); const emb = raw === '' ? null : Number(raw); if (emb != null && (!isFinite(emb) || emb < 0)) return; salvarSaida(it, i, { valorBase: emb == null ? null : emb * (it.embalagem || 1) }); }}
                              title={man ? 'Editado na mão — clique p/ mudar' : 'Editar valor (em embalagens)'}
                              className={`w-12 bg-transparent text-right tabular-nums outline-none border-b ${man ? 'border-amber-400 text-amber-600 dark:text-amber-300 font-semibold' : 'border-transparent'} ${ign ? 'line-through' : ''}`} />
                            <span className="opacity-60">emb ×{i + 1}</span>
                            <button onClick={() => salvarSaida(it, i, { ignorar: !ign })} title={ign ? 'Voltar a considerar na média' : 'Ignorar esta semana na média'} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">{ign ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
                            {(man || ign) && <button onClick={() => salvarSaida(it, i, { valorBase: null, ignorar: false })} title="Resetar (voltar ao automático)" className="text-gray-400 hover:text-red-600"><RotateCcw className="w-3 h-3" /></button>}
                          </span>
                        );
                      })}
                      <span className="text-gray-600 dark:text-gray-300 ml-1">= média <b>{fmtEmb(it.media6, it.embalagem)} emb</b></span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-gray-400">Editar troca o valor da semana no cálculo (fica <b>registrado que foi manual</b> — borda amarela). O olho <b>ignora</b> a semana (sai da média e do desvio). ↺ volta ao automático.</p>
                  </td>
                </tr>}
                </Fragment>
              );})}
            </tbody>
          </table>
        </div></CardContent></Card>
        <p className="text-[11px] text-gray-400">Todos os números estão em <b>nº de embalagens</b> (unidade de compra; ex.: latas/garrafas/pacotes) — o tamanho de cada embalagem aparece abaixo do nome do insumo. Saída = uso <b>direto</b> do insumo em produtos (vendas × ficha). A necessidade dos insumos que vão em preparos vem da coluna <b>p/ Produção</b> (puxa o que foi decidido no Planejamento da Produção da mesma semana). <b>Comprado</b> = o que entrou de compra no Vmarket — é a &ldquo;finalização&rdquo; do planejamento.</p>
    </PageShell>
  );
}
