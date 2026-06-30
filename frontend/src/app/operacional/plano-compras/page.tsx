'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/PageShell';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { ShoppingCart, Search, Loader2, CalendarDays, RefreshCw, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

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

export default function PlanoComprasPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [res, setRes] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [soCurvaA, setSoCurvaA] = useState(false);
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
      && (filtro === 'todos' || (filtro === 'comprar' ? !i.nao_comprar : i.nao_comprar))
      && (!secao || i.secao_vmarket === secao)
      && (!s || (i.nome || '').toLowerCase().includes(s) || (i.codigo || '').toLowerCase().includes(s)));
  }, [res, busca, soCurvaA, filtro, secao]);

  const totComprar = useMemo(() => linhas.filter((i) => !i.nao_comprar).length, [linhas]);
  const custoEstimado = useMemo(() => linhas.reduce((s, i) => s + (i.nao_comprar ? 0 : i.sugestao_qtd * i.custo), 0), [linhas]);
  const semProducao = (res?.producao_encerrada || []).length === 0;

  return (
    <PageShell width="wide">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl"><ShoppingCart className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planejamento de Compras</h1>
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
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="Ponto de Ressuprimento = média + desvio × fator de serviço (em nº de embalagens)">PR</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="Estoque atual (em nº de embalagens)">Estoque</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="Necessidade da produção planejada, plano encerrado da semana (em nº de embalagens)">p/ Produção</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[72px]">Sugestão</th>
              <th className="text-right font-medium px-1.5 py-2 whitespace-nowrap min-w-[64px]" title="O que apareceu de compra no Vmarket nesta semana">Comprado</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={9} className="px-3 py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : linhas.length === 0 ? <tr><td colSpan={9} className="px-3 py-12 text-center text-gray-400">Sem insumos no filtro.</td></tr>
              : linhas.map((it) => {
                const expandido = aberto === it.codigo;
                return (
                <Fragment key={it.codigo}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100 leading-tight w-full">
                    <span className="whitespace-nowrap font-medium">{it.nome}</span>{it.curva_a && <Badge variant="outline" className="ml-1.5 text-[10px] text-indigo-600 border-indigo-300">A</Badge>}
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
                  <td className="px-1.5 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200 font-medium whitespace-nowrap">{fmtEmb(it.pr, it.embalagem)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-gray-500 whitespace-nowrap">{fmtEmb(it.estoque, it.embalagem)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap">{it.ab > 0 ? <span className="text-indigo-600 dark:text-indigo-400">{fmtEmb(it.ab, it.embalagem)}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                  <td className="px-1.5 py-2 text-right whitespace-nowrap">
                    {it.nao_comprar
                      ? <span className="text-gray-400 text-xs">Não comprar</span>
                      : <span className="inline-flex flex-col items-end"><span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{fmtI(it.sugestao_qtd)} emb.</span><span className="text-[10px] text-gray-400">≈ {fmtMedida(it.sugestao_base, it.base)}</span></span>}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap">{it.comprado > 0 ? <span className="text-gray-700 dark:text-gray-200">{fmtI(it.comprado)} emb.</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                </tr>
                {expandido && <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                  <td colSpan={9} className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-600 dark:text-gray-300">Uso direto por semana:</span>
                      {(it.semanas || []).map((wk: string, i: number) => {
                        const v = it.saidas?.[i] ?? 0;
                        return <span key={wk} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${v > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 line-through'}`}>{fmtDM(wk)}: <b>{fmtEmb(v, it.embalagem)} emb</b> <span className="opacity-60">×{i + 1}</span></span>;
                      })}
                      <span className="text-gray-600 dark:text-gray-300">= média <b>{fmtEmb(it.media6, it.embalagem)} emb</b></span>
                    </div>
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
