'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type Linha = { mes: string; grupo_dfc: string; categoria: string; categoria_macro?: string; ordem_macro?: number; ordem_sub?: number; entradas: number; saidas: number; net: number };

type ForaItem = { categoria: string; qtd: number; total: number | string; grupo_dfc: string | null; na_dre: boolean; na_orcamentacao: boolean; primeiro: string; ultimo: string };

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const GRUPOS = ['OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO'] as const;
const GRUPO_LABEL: Record<string, string> = {
  OPERACIONAL: 'Fluxo Operacional', INVESTIMENTO: 'Fluxo de Investimento', FINANCIAMENTO: 'Fluxo de Financiamento',
};
const n = (x: unknown) => Number(x) || 0;
const fmt = (v: number) => v === 0 ? '–' : `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DfcPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('📊 Demonstrativo de Fluxo de Caixa (DFC)');
    return () => setPageTitle('');
  }, [setPageTitle]);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [soConciliado, setSoConciliado] = useState(true); // padrão: só conciliado (decisão do sócio)
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [foraDepara, setForaDepara] = useState<ForaItem[]>([]);
  const [soPendentes, setSoPendentes] = useState(false);

  const carregarDfc = useCallback(() => {
    if (!selectedBar) return;
    setLoading(true);
    fetch(`/api/financeiro/dfc?bar_id=${selectedBar.id}&ano=${ano}&conciliado=${soConciliado ? '1' : '0'}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setLinhas(Array.isArray(d.linhas) ? d.linhas : []))
      .catch(() => setLinhas([]))
      .finally(() => setLoading(false));
  }, [selectedBar, ano, soConciliado]);
  useEffect(() => { carregarDfc(); }, [carregarDfc]);

  // Categorias fora do de-para do DFC (aba classificador self-service).
  const carregarFora = useCallback(() => {
    if (!selectedBar) return;
    fetch(`/api/financeiro/dfc/fora-depara?bar_id=${selectedBar.id}&ano=${ano}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setForaDepara(Array.isArray(d.categorias) ? d.categorias : []))
      .catch(() => setForaDepara([]));
  }, [selectedBar, ano]);
  useEffect(() => { carregarFora(); }, [carregarFora]);

  // Classifica a categoria num grupo do DFC (exceção do bar) e recarrega.
  const [salvandoCat, setSalvandoCat] = useState<string | null>(null);
  const classificar = async (categoria: string, grupo: string) => {
    if (!selectedBar || !grupo) return;
    setSalvandoCat(categoria);
    try {
      const r = await fetch('/api/financeiro/dfc/fora-depara', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id, categoria, grupo_dfc: grupo }),
      });
      if (r.ok) { carregarFora(); carregarDfc(); }
    } finally { setSalvandoCat(null); }
  };

  // Hierarquia: grupo -> macro-categoria (igual DRE) -> categoria, cada um com [12] meses
  type MacroNode = { mes: number[]; ordem: number; cats: Record<string, { mes: number[]; ordem: number }> };
  const dados = useMemo(() => {
    const grupoMes: Record<string, number[]> = {};
    const macro: Record<string, Record<string, MacroNode>> = {}; // grupo -> macro -> node
    for (const g of GRUPOS) { grupoMes[g] = Array(12).fill(0); macro[g] = {}; }
    for (const l of linhas) {
      const m = new Date(l.mes + 'T00:00:00').getMonth(); // 0-11
      const g = l.grupo_dfc;
      if (!grupoMes[g]) continue;
      grupoMes[g][m] += n(l.net);
      const mc = (l.categoria_macro && l.categoria_macro.trim()) || 'Outros';
      const M = (macro[g][mc] ||= { mes: Array(12).fill(0), ordem: l.ordem_macro ?? 999, cats: {} });
      M.mes[m] += n(l.net);
      M.ordem = Math.min(M.ordem, l.ordem_macro ?? 999);
      const C = (M.cats[l.categoria] ||= { mes: Array(12).fill(0), ordem: l.ordem_sub ?? 999 });
      C.mes[m] += n(l.net);
      C.ordem = Math.min(C.ordem, l.ordem_sub ?? 999);
    }
    const variacao = Array(12).fill(0).map((_, m) => GRUPOS.reduce((s, g) => s + grupoMes[g][m], 0));
    return { grupoMes, macro, variacao };
  }, [linhas]);

  const cor = (v: number) => v > 0 ? 'text-emerald-600 dark:text-emerald-400' : v < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Por caixa (data de pagamento) · {selectedBar?.nome || 'Bar'} · derivado do Conta Azul (exclui ajustes não-caixa).
            {soConciliado ? ' Mostrando só o que foi conciliado no banco.' : ' "Baixado no CA" (não reflete conciliação bancária).'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none" title="Conta só o que foi conciliado no extrato do banco (exclui pago-mas-não-conciliado, ex.: dinheiro e ajustes).">
            <input type="checkbox" checked={soConciliado} onChange={e => setSoConciliado(e.target.checked)} className="accent-emerald-600" />
            Só conciliado
          </label>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="h-8 text-sm border rounded px-2 bg-white dark:bg-gray-800">
            {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {selectedBar && (
            <a
              href={`/api/financeiro/dfc/export?bar_id=${selectedBar.id}&ano=${ano}&conciliado=${soConciliado ? '1' : '0'}`}
              className="h-8 inline-flex items-center gap-1.5 text-xs font-medium rounded px-2.5 border bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              title="Baixar CSV (categoria × mês) pra conferir com o Conta Azul"
            >
              ⬇ Exportar CSV
            </a>
          )}
        </div>
      </div>

      <Tabs defaultValue="fluxo">
        <TabsList className="mb-3">
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="fora">Categorias{foraDepara.filter(c => !c.grupo_dfc).length > 0 && <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title="não classificadas">{foraDepara.filter(c => !c.grupo_dfc).length}</span>}</TabsTrigger>
        </TabsList>
        <TabsContent value="fluxo">
      {loading ? <Skeleton className="h-[500px]" /> : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800/60">
                <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-gray-50 dark:bg-gray-800/60 z-10 min-w-[220px]">Grupo / Categoria</th>
                {MES_ABBR.map((m, i) => <th key={i} className="text-right font-semibold px-3 py-2 whitespace-nowrap min-w-[120px]">{m}</th>)}
              </tr>
            </thead>
              {GRUPOS.map(g => {
                const aberto = !!abertos[g];
                const macros = Object.entries(dados.macro[g]).sort((a, b) => a[1].ordem - b[1].ordem || a[0].localeCompare(b[0]));
                return (
                  <tbody key={g}>
                    {/* Nível 1: GRUPO */}
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-100/80 dark:bg-gray-800/60 font-bold cursor-pointer" onClick={() => setAbertos(p => ({ ...p, [g]: !p[g] }))}>
                      <td className="px-3 py-1.5 sticky left-0 bg-gray-100/80 dark:bg-gray-800/60 flex items-center gap-1 whitespace-nowrap">
                        {aberto ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                        {GRUPO_LABEL[g]}
                      </td>
                      {dados.grupoMes[g].map((v, m) => <td key={m} className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap ${cor(v)}`}>{fmt(v)}</td>)}
                    </tr>
                    {aberto && macros.map(([mc, M]) => {
                      const mkey = g + '|' + mc;
                      const mAberto = !!abertos[mkey];
                      const cats = Object.entries(M.cats).sort((a, b) => a[1].ordem - b[1].ordem || a[0].localeCompare(b[0]));
                      return (
                        <Fragment key={mkey}>
                          {/* Nível 2: MACRO-CATEGORIA (igual DRE) */}
                          <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 font-semibold cursor-pointer" onClick={() => setAbertos(p => ({ ...p, [mkey]: !p[mkey] }))}>
                            <td className="px-3 py-1 pl-7 sticky left-0 bg-gray-50/60 dark:bg-gray-800/30 flex items-center gap-1 whitespace-nowrap">
                              {mAberto ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                              {mc}
                            </td>
                            {M.mes.map((v, m) => <td key={m} className={`px-3 py-1 text-right tabular-nums whitespace-nowrap ${cor(v)}`}>{fmt(v)}</td>)}
                          </tr>
                          {/* Nível 3: CATEGORIA */}
                          {mAberto && cats.map(([cat, C]) => (
                            <tr key={cat} className="border-b border-gray-50 dark:border-gray-800/50">
                              <td className="px-3 py-1 pl-14 sticky left-0 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 whitespace-nowrap">{cat}</td>
                              {C.mes.map((v, m) => <td key={m} className={`px-3 py-1 text-right tabular-nums whitespace-nowrap ${cor(v)}`}>{fmt(v)}</td>)}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                );
              })}
              <tbody>
                <tr className="border-t-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 font-bold">
                  <td className="px-3 py-2 sticky left-0 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 whitespace-nowrap">Variação de Caixa</td>
                  {dados.variacao.map((v, m) => <td key={m} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${cor(v)}`}>{fmt(v)}</td>)}
                </tr>
              </tbody>
          </table>
        </Card>
      )}
        </TabsContent>
        <TabsContent value="fora">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-2xl">
                Todas as categorias do Conta Azul com movimento em {ano} no <b>{selectedBar?.nome || 'bar'}</b>.
                <b> Classifique no dropdown</b> — a regra é salva como exceção deste bar e entra no DFC na hora, sem dev.
                As <span className="text-amber-600 font-medium">não classificadas</span> ficam de fora do fluxo de caixa.
                A coluna DRE/Orç avisa se também falta nesses relatórios.
              </p>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none whitespace-nowrap text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={soPendentes} onChange={e => setSoPendentes(e.target.checked)} className="accent-amber-600" />
                Só não classificadas
              </label>
            </div>
            {foraDepara.length === 0 ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-8">
                <CheckCircle2 className="w-5 h-5" />Nenhuma categoria com movimento em {ano}.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="border-b text-left text-gray-500 dark:text-gray-400">
                  <th className="px-2 py-2">Categoria</th>
                  <th className="px-2 py-2 text-right">Lançamentos</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2 whitespace-nowrap">Período</th>
                  <th className="px-2 py-2 text-center" title="Se também falta no de-para da DRE / Orçamentação">DRE/Orç</th>
                  <th className="px-2 py-2 text-center">Classificar no DFC</th>
                </tr></thead>
                <tbody>
                  {(soPendentes ? foraDepara.filter(c => !c.grupo_dfc) : foraDepara).map(c => (
                    <tr key={c.categoria} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-2 py-1.5 font-medium"><span className="flex items-center gap-1.5">{!c.grupo_dfc && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}{c.categoria}</span></td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{c.qtd}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmt(n(c.total))}</td>
                      <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{c.primeiro?.slice(5)} → {c.ultimo?.slice(5)}</td>
                      <td className="px-2 py-1.5 text-center text-[10px] whitespace-nowrap">
                        <span className={c.na_dre ? 'text-emerald-600' : 'text-red-500'} title={c.na_dre ? 'na DRE' : 'falta na DRE'}>DRE</span>
                        {' · '}
                        <span className={c.na_orcamentacao ? 'text-emerald-600' : 'text-red-500'} title={c.na_orcamentacao ? 'na Orçamentação' : 'falta na Orçamentação'}>Orç</span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <select
                          className={`h-7 text-xs border rounded px-1 bg-white dark:bg-gray-800 disabled:opacity-50 ${!c.grupo_dfc ? 'border-amber-400 text-amber-700 dark:text-amber-300' : ''}`}
                          value={c.grupo_dfc || ''}
                          disabled={salvandoCat === c.categoria}
                          onChange={e => classificar(c.categoria, e.target.value)}
                        >
                          <option value="" disabled>{salvandoCat === c.categoria ? 'salvando…' : '— classificar —'}</option>
                          <option value="OPERACIONAL">Operacional</option>
                          <option value="INVESTIMENTO">Investimento</option>
                          <option value="FINANCIAMENTO">Financiamento</option>
                          <option value="AJUSTE">Ajuste (fora do caixa)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
