'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import {
  ArrowDown, ArrowRight, ArrowUp, ChevronDown, ChevronRight, History, Search, Sparkles, TrendingDown, TrendingUp,
} from 'lucide-react';
import { GraficoLinha } from '@/components/graficos/Charts';

const fmtMoeda = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const fmtData = (s: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};
const fmtDataCurta = (s: string) => {
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
};
const fmtDataHora = (s: string | null) => {
  if (!s) return '—';
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

interface Mudanca {
  produto_codigo: string;
  produto_desc: string;
  data_mudanca: string;
  data_anterior: string | null;
  custo_anterior: number | null;
  custo_novo: number | null;
  preco_anterior: number | null;
  preco_novo: number | null;
  fonte: string | null;
  editado_por_nome: string | null;
  editado_em: string | null;
}
type SeriePonto = { snapshot_date: string; custo: number | null; preco: number | null };
type Dir = 'todas' | 'subiu' | 'caiu' | 'novo';

const variacaoPct = (ant: number | null, novo: number | null): number | null => {
  if (ant == null || ant === 0 || novo == null) return null;
  return ((novo - ant) / ant) * 100;
};
const dirDe = (m: Mudanca): Dir => {
  if (m.custo_anterior == null) return 'novo';
  if ((m.custo_novo ?? 0) > (m.custo_anterior ?? 0)) return 'subiu';
  if ((m.custo_novo ?? 0) < (m.custo_anterior ?? 0)) return 'caiu';
  return 'todas';
};

function CustoCell({ m }: { m: Mudanca }) {
  const v = variacaoPct(m.custo_anterior, m.custo_novo);
  if (m.custo_anterior == null)
    return <span className="text-emerald-600 text-xs font-medium">novo · {fmtMoeda(m.custo_novo)}</span>;
  const subiu = (m.custo_novo ?? 0) > (m.custo_anterior ?? 0);
  const desceu = (m.custo_novo ?? 0) < (m.custo_anterior ?? 0);
  const cor = subiu ? 'text-red-600' : desceu ? 'text-emerald-600' : 'text-gray-500';
  const Icon = subiu ? ArrowUp : desceu ? ArrowDown : ArrowRight;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums justify-end">
      <span className="text-gray-400 line-through">{fmtMoeda(m.custo_anterior)}</span>
      <Icon className={`w-3 h-3 ${cor}`} />
      <span className={`font-semibold ${cor}`}>{fmtMoeda(m.custo_novo)}</span>
      {v != null && (
        <span className={`text-[10px] px-1 py-0.5 rounded ${subiu ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {v > 0 ? '+' : ''}{v.toFixed(0)}%
        </span>
      )}
    </span>
  );
}

function Chip({ label, value, cor, Icon }: { label: string; value: number; cor: string; Icon: any }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-gray-900">
      <Icon className={`w-4 h-4 ${cor}`} />
      <div>
        <div className={`text-lg font-bold leading-none ${cor}`}>{value}</div>
        <div className="text-[11px] text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function SerieChart({ barId, produtoCodigo }: { barId: number; produtoCodigo: string }) {
  const [serie, setSerie] = useState<SeriePonto[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    api
      .get(`/api/cardapio/custo-historico?produto_codigo=${encodeURIComponent(produtoCodigo)}&dias=180`)
      .then((r: any) => { if (vivo) setSerie(r?.serie ?? []); })
      .catch(() => { if (vivo) setSerie([]); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [barId, produtoCodigo]);

  if (loading) return <p className="text-xs text-gray-400 py-4">Carregando evolução…</p>;
  if (!serie || serie.length === 0) return <p className="text-xs text-gray-400 py-4">Sem histórico para este produto.</p>;
  if (serie.length === 1) {
    return (
      <p className="text-xs text-gray-500 py-4">
        Só há 1 registro ({fmtData(serie[0].snapshot_date)}: custo {fmtMoeda(serie[0].custo)}). A curva aparece com mais dias de histórico.
      </p>
    );
  }
  const dados = serie.map(p => ({ d: fmtDataCurta(p.snapshot_date), custo: p.custo, preco: p.preco }));
  return (
    <div className="py-3">
      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Evolução (180 dias)</p>
      <GraficoLinha
        data={dados}
        xKey="d"
        series={[
          { key: 'custo', nome: 'Custo', cor: '#6366f1' },
          { key: 'preco', nome: 'Preço', cor: '#94a3b8' },
        ]}
        height={160}
        formatV={fmtMoeda}
      />
    </div>
  );
}

export default function HistoricoPrecos({ dias }: { dias: number }) {
  const { selectedBar } = useBar();
  const [mudancas, setMudancas] = useState<Mudanca[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [dir, setDir] = useState<Dir>('todas');
  const [ordem, setOrdem] = useState<'data' | 'variacao'>('data');
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    setErro(null);
    api
      .get(`/api/cardapio/custo-historico?dias=${dias}`)
      .then((r: any) => setMudancas(r?.mudancas ?? []))
      .catch((e: any) => setErro(e?.message || 'Falha ao carregar'))
      .finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  useEffect(() => { carregar(); }, [carregar]);

  const stats = useMemo(() => {
    let subiu = 0, caiu = 0, novo = 0;
    for (const m of mudancas) {
      const d = dirDe(m);
      if (d === 'subiu') subiu++; else if (d === 'caiu') caiu++; else if (d === 'novo') novo++;
    }
    return { total: mudancas.length, subiu, caiu, novo };
  }, [mudancas]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let arr = mudancas.filter(m => (dir === 'todas' ? true : dirDe(m) === dir));
    if (q) arr = arr.filter(m => m.produto_desc?.toLowerCase().includes(q));
    arr = [...arr].sort((a, b) => {
      if (ordem === 'variacao') {
        const va = Math.abs(variacaoPct(a.custo_anterior, a.custo_novo) ?? 0);
        const vb = Math.abs(variacaoPct(b.custo_anterior, b.custo_novo) ?? 0);
        return vb - va;
      }
      return b.data_mudanca.localeCompare(a.data_mudanca);
    });
    return arr;
  }, [mudancas, busca, dir, ordem]);

  const filtros: { id: Dir; label: string }[] = [
    { id: 'todas', label: `Todas (${stats.total})` },
    { id: 'subiu', label: `Subiram (${stats.subiu})` },
    { id: 'caiu', label: `Caíram (${stats.caiu})` },
    { id: 'novo', label: `Novos (${stats.novo})` },
  ];

  return (
    <Card className="p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-1">
        <History className="w-5 h-5 text-indigo-500" />
        Histórico de preços
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Mudanças de custo e preço por produto (snapshot diário — planilha ou edição manual). Clique numa linha para ver a evolução.
      </p>

      {!loading && mudancas.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Chip label="mudanças" value={stats.total} cor="text-gray-700 dark:text-gray-200" Icon={History} />
          <Chip label="subiram" value={stats.subiu} cor="text-red-600" Icon={TrendingUp} />
          <Chip label="caíram" value={stats.caiu} cor="text-emerald-600" Icon={TrendingDown} />
          <Chip label="novos" value={stats.novo} cor="text-blue-600" Icon={Sparkles} />
        </div>
      )}

      {erro && <p className="text-xs text-red-600 mb-3">{erro}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 py-4">Carregando…</p>
      ) : mudancas.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          Nenhuma mudança registrada ainda no período. O histórico é montado diariamente —
          as variações aparecem aqui a partir do próximo snapshot.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar produto…"
                className="w-full text-sm border rounded pl-8 pr-3 py-1.5 bg-white dark:bg-gray-900"
              />
            </div>
            <div className="flex rounded-md border overflow-hidden text-xs">
              {filtros.map(f => (
                <button
                  key={f.id}
                  onClick={() => setDir(f.id)}
                  className={`px-2.5 py-1.5 transition-colors ${dir === f.id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setOrdem(o => (o === 'data' ? 'variacao' : 'data'))}
              className="text-xs border rounded px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Ordenar: {ordem === 'data' ? 'Mais recente' : 'Maior variação'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2 w-6"></th>
                  <th className="text-left py-2">Produto</th>
                  <th className="text-right py-2">Custo</th>
                  <th className="text-right py-2">Preço</th>
                  <th className="text-left py-2 pl-4">Quem editou</th>
                  <th className="text-left py-2">Quando</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((m, i) => {
                  const aberto = expandido === m.produto_codigo;
                  const vPreco = variacaoPct(m.preco_anterior, m.preco_novo);
                  return (
                    <Fragment key={`${m.produto_codigo}-${m.data_mudanca}-${i}`}>
                      <tr
                        onClick={() => setExpandido(aberto ? null : m.produto_codigo)}
                        className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer"
                      >
                        <td className="py-2 text-gray-400">
                          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-2 max-w-xs truncate" title={m.produto_desc}>{m.produto_desc}</td>
                        <td className="py-2 text-right"><CustoCell m={m} /></td>
                        <td className="py-2 text-right tabular-nums text-gray-500">
                          {m.preco_anterior == null
                            ? fmtMoeda(m.preco_novo)
                            : <span>{fmtMoeda(m.preco_novo)}{vPreco != null && vPreco !== 0 && <span className="text-[10px] text-gray-400 ml-1">({vPreco > 0 ? '+' : ''}{vPreco.toFixed(0)}%)</span>}</span>}
                        </td>
                        <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{m.editado_por_nome ?? '—'}</td>
                        <td className="py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDataHora(m.editado_em)}</td>
                      </tr>
                      {aberto && selectedBar?.id && (
                        <tr className="border-b last:border-0 bg-gray-50/50 dark:bg-gray-900/20">
                          <td></td>
                          <td colSpan={5} className="px-2">
                            <SerieChart barId={selectedBar.id} produtoCodigo={m.produto_codigo} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {lista.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">Nenhuma mudança com esse filtro.</p>
          )}
        </>
      )}
    </Card>
  );
}
