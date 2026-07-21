'use client';

import { Fragment, useMemo, useState } from 'react';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import { Loader2, Plus, Trash2 } from 'lucide-react';

/**
 * DRE Eventos — o COMPLEMENTO da aba "DRE Bar": mostra só a economia do show.
 *   Receita        = couvert + ingresso (Yuzer) + Sympla
 *   Custo Variável = imposto (2% da entrada) + taxa maquininha (proporcional) — mesma conta da DRE Bar
 *   Despesas Artístico = as 4 categorias que a DRE Bar remove (drilláveis no CA)
 *   = Resultado de Eventos
 * Mensal (12 meses + YTD). Dados: /api/estrategico/orcamentacao/dre-excel?modo=eventos.
 */
type EvRow = {
  mes: string; grupo: string; ordem_grupo: number; ordem_sub: number;
  categoria: string; valor: number; drill_macro?: string | null;
};

type DrillArg = { categoria_macro: string; canon: string; mes: number; ano: number; label: string };
type OutraReceita = { id: string; competencia: string; descricao: string | null; valor: number; imposto: number };

// Parse pt-BR/en: "36.000,00" | "36000,00" | "36000" | "36000.00"
const parseNum = (s: string) => {
  const t = String(s).replace(/[R$\s]/g, '').trim();
  if (!t) return NaN;
  return t.includes(',') ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t);
};

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const GRUPOS = [
  { ordem: 1, nome: 'Receita', cor: 'text-emerald-700 dark:text-emerald-400' },
  { ordem: 2, nome: 'Custo Variável', cor: 'text-amber-700 dark:text-amber-400' },
  { ordem: 3, nome: 'Despesas Artístico', cor: 'text-rose-700 dark:text-rose-400' },
];

const fmtBRL = (n: number) => {
  const v = Math.abs(n);
  const str = v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-R$ ${str}` : `R$ ${str}`;
};
const mesIdx = (mes: string) => Number(String(mes).slice(5, 7)) - 1; // 'YYYY-MM-01' → 0..11

export function DreEventosTab({ barId, anoInicial, onDrill }: {
  barId: number; anoInicial?: number; onDrill?: (p: DrillArg) => void;
}) {
  const anoSistema = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoInicial ?? anoSistema);

  const { data, isLoading, mutate } = useApiSWR<{ linhas?: EvRow[] }>(
    barId ? `/api/estrategico/orcamentacao/dre-excel?bar_id=${barId}&ano=${ano}&modo=eventos` : null,
  );

  // Outras receitas sem CMV (patrocínio/festival) lançadas à mão — gerenciadas no painel.
  const { data: outrasData, mutate: mutateOutras } = useApiSWR<{ outras_receitas?: OutraReceita[] }>(
    barId ? `/api/financeiro/dre/eventos-outras-receitas?bar_id=${barId}&ano=${ano}` : null,
  );
  const outras = outrasData?.outras_receitas || [];

  const [showPanel, setShowPanel] = useState(false);
  const [fMes, setFMes] = useState<number>(new Date().getMonth() + 1);
  const [fDesc, setFDesc] = useState('');
  const [fValor, setFValor] = useState('');
  const [fImposto, setFImposto] = useState('');
  const [saving, setSaving] = useState(false);
  const valorOk = Number.isFinite(parseNum(fValor)) && parseNum(fValor) > 0;

  const adicionar = async () => {
    if (!valorOk || saving) return;
    const imposto = fImposto.trim() ? parseNum(fImposto) : 0;
    setSaving(true);
    try {
      await api.post('/api/financeiro/dre/eventos-outras-receitas', {
        bar_id: barId, ano, mes: fMes, descricao: fDesc.trim(),
        valor: parseNum(fValor), imposto: Number.isFinite(imposto) ? imposto : 0,
      });
      setFDesc(''); setFValor(''); setFImposto('');
      await Promise.all([mutate(), mutateOutras()]);
    } catch (e: any) {
      alert(e?.message || 'Erro ao lançar');
    } finally {
      setSaving(false);
    }
  };
  const excluir = async (id: string) => {
    if (!window.confirm('Excluir esta receita da DRE Eventos?')) return;
    try {
      await api.delete(`/api/financeiro/dre/eventos-outras-receitas?id=${id}&bar_id=${barId}`);
      await Promise.all([mutate(), mutateOutras()]);
    } catch (e: any) {
      alert(e?.message || 'Erro ao excluir');
    }
  };

  // Pivota: por grupo → categoria → valores[12]. Guarda drill_macro pra linha artística.
  const modelo = useMemo(() => {
    const linhas = data?.linhas || [];
    // categoria única por grupo, preservando ordem_sub e drill
    type Cat = { categoria: string; ordem_sub: number; drill_macro?: string | null; valores: number[] };
    const porGrupo = new Map<number, Map<string, Cat>>();
    for (const l of linhas) {
      if (!porGrupo.has(l.ordem_grupo)) porGrupo.set(l.ordem_grupo, new Map());
      const g = porGrupo.get(l.ordem_grupo)!;
      if (!g.has(l.categoria)) g.set(l.categoria, { categoria: l.categoria, ordem_sub: l.ordem_sub, drill_macro: l.drill_macro, valores: Array(12).fill(0) });
      const c = g.get(l.categoria)!;
      const i = mesIdx(l.mes);
      if (i >= 0 && i < 12) c.valores[i] += Number(l.valor) || 0;
    }
    const grupos = GRUPOS.map((g) => {
      const cats = Array.from(porGrupo.get(g.ordem)?.values() || []).sort((a, b) => a.ordem_sub - b.ordem_sub);
      const subtotal = Array(12).fill(0);
      for (const c of cats) for (let i = 0; i < 12; i++) subtotal[i] += c.valores[i];
      return { ...g, cats, subtotal };
    });
    // Resultado de Eventos = soma de todos os grupos (custo/artístico já são negativos)
    const resultado = Array(12).fill(0);
    for (const g of grupos) for (let i = 0; i < 12; i++) resultado[i] += g.subtotal[i];
    return { grupos, resultado };
  }, [data]);

  const ytd = (v: number[]) => v.reduce((s, x) => s + x, 0);
  const temDado = modelo.grupos.some((g) => g.cats.length > 0);

  const cell = (v: number, k: string | number, bold = false) => (
    <td key={k} className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${bold ? 'font-semibold' : ''} ${v < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
      {v === 0 ? '—' : fmtBRL(v)}
    </td>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Economia do show: entrada (couvert + ingresso + Sympla) − imposto/taxa − artístico. Complemento da DRE Bar.
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPanel((s) => !s)}
            className={`h-8 rounded-md border px-2.5 text-sm inline-flex items-center gap-1.5 ${showPanel ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-[hsl(var(--border))]'}`}>
            <Plus className="w-3.5 h-3.5" /> Outras receitas (sem CMV)
          </button>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
            className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm">
            {[anoSistema, anoSistema - 1, anoSistema - 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Painel: lançar receita esporádica de evento (patrocínio/festival) sem custo de produto. */}
      {showPanel && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
          <div className="text-xs text-muted-foreground">
            Receita de evento <b>sem custo de produto</b> (patrocínio, festival, etc.). O <b>imposto</b> é o que você pagou sobre a nota — entra como custo variável. Some na coluna do mês da DRE Eventos.
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="block text-muted-foreground mb-0.5">Mês</span>
              <select value={fMes} onChange={(e) => setFMes(Number(e.target.value))}
                className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm">
                {MES_LABEL.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label className="text-xs flex-1 min-w-[160px]">
              <span className="block text-muted-foreground mb-0.5">Descrição</span>
              <input value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Ex.: Patrocínio Curicaca"
                className="h-8 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm" />
            </label>
            <label className="text-xs">
              <span className="block text-muted-foreground mb-0.5">Valor (R$)</span>
              <input value={fValor} onChange={(e) => setFValor(e.target.value)} inputMode="decimal" placeholder="36.000,00"
                className="h-8 w-32 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm text-right tabular-nums" />
            </label>
            <label className="text-xs">
              <span className="block text-muted-foreground mb-0.5">Imposto (R$)</span>
              <input value={fImposto} onChange={(e) => setFImposto(e.target.value)} inputMode="decimal" placeholder="0,00"
                className="h-8 w-28 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm text-right tabular-nums" />
            </label>
            <button onClick={adicionar} disabled={!valorOk || saving}
              className="h-8 rounded-md bg-emerald-600 text-white px-3 text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Adicionar
            </button>
          </div>

          {outras.length > 0 && (
            <div className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
              {outras.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                  <span className="w-10 text-xs text-muted-foreground shrink-0">{MES_LABEL[mesIdx(r.competencia)] || '—'}</span>
                  <span className="flex-1 min-w-0 truncate">{r.descricao || <span className="text-muted-foreground">sem descrição</span>}</span>
                  <span className="tabular-nums text-right w-28 text-emerald-700 dark:text-emerald-400">{fmtBRL(Number(r.valor))}</span>
                  <span className="tabular-nums text-right w-24 text-rose-600 dark:text-rose-400" title="Imposto informado">
                    {Number(r.imposto) ? fmtBRL(-Number(r.imposto)) : '—'}
                  </span>
                  <button onClick={() => excluir(r.id)} className="text-muted-foreground hover:text-rose-600 shrink-0 p-1" title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : !temDado ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Sem dados de eventos para {ano}.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/60 text-xs">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium sticky left-0 bg-[hsl(var(--muted))]/60 min-w-[180px]">DRE Eventos · {ano}</th>
                {MES_LABEL.map((m) => <th key={m} className="px-2 py-1.5 text-right font-medium">{m}</th>)}
                <th className="px-2 py-1.5 text-right font-semibold">Ano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {modelo.grupos.map((g) => (
                <Fragment key={`g-${g.ordem}`}>
                  {/* header do grupo com subtotal */}
                  <tr className="bg-[hsl(var(--muted))]/30 font-semibold">
                    <td className={`px-2 py-1 text-left sticky left-0 bg-[hsl(var(--muted))]/30 ${g.cor}`}>{g.nome}</td>
                    {g.subtotal.map((v, i) => cell(v, `st-${i}`, true))}
                    {cell(ytd(g.subtotal), 'st-ytd', true)}
                  </tr>
                  {/* linhas do grupo */}
                  {g.cats.map((c) => {
                    const drillavel = !!c.drill_macro && !!onDrill;
                    return (
                      <tr key={c.categoria} className="hover:bg-[hsl(var(--muted))]/20">
                        <td className="px-2 py-1 text-left pl-5 sticky left-0 bg-[hsl(var(--background))] text-muted-foreground">{c.categoria}</td>
                        {c.valores.map((v, i) => (
                          drillavel && v !== 0 ? (
                            <td key={i} className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                              <button
                                onClick={() => onDrill!({ categoria_macro: c.drill_macro!, canon: c.categoria, mes: i + 1, ano, label: `${c.categoria} · ${MES_LABEL[i]}/${ano}` })}
                                className="hover:underline text-rose-600 dark:text-rose-400">
                                {fmtBRL(v)}
                              </button>
                            </td>
                          ) : cell(v, i)
                        ))}
                        {cell(ytd(c.valores), 'ytd')}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
              {/* Resultado de Eventos */}
              <tr className="border-t-2 border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 font-bold">
                <td className="px-2 py-1.5 text-left sticky left-0 bg-[hsl(var(--muted))]/50">Resultado de Eventos</td>
                {modelo.resultado.map((v, i) => cell(v, `res-${i}`, true))}
                {cell(ytd(modelo.resultado), 'res-ytd', true)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
