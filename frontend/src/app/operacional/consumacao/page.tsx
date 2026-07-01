'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, Search } from 'lucide-react';
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
  valor_cmv: number;
}
interface Resumo {
  categoria: string;
  linhas: number;
  bruto: number;
  cmv: number;
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

const moeda = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const brData = (s: string) => (s ? s.split('-').reverse().join('/') : '-');

const POR_PAGINA = 100;

export default function ControleConsumacaoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const hoje = new Date();
  const primeiroDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [di, setDi] = useState(iso(primeiroDoMes));
  const [df, setDf] = useState(iso(hoje));
  const [loading, setLoading] = useState(false);
  const [fator, setFator] = useState(0.35);
  const [resumo, setResumo] = useState<Resumo[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalCmv, setTotalCmv] = useState(0);
  const [catFiltro, setCatFiltro] = useState<Set<string>>(new Set());
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
      setTotalCmv(j.total_cmv || 0);
      setPagina(1);
    } catch {
      toast.error('Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [selectedBar, di, df]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const preset = (tipo: 'mes' | 'mesPassado' | 'semana' | 'd30') => {
    const h = new Date();
    if (tipo === 'mes') {
      setDi(iso(new Date(h.getFullYear(), h.getMonth(), 1)));
      setDf(iso(h));
    } else if (tipo === 'mesPassado') {
      setDi(iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)));
      setDf(iso(new Date(h.getFullYear(), h.getMonth(), 0)));
    } else if (tipo === 'semana') {
      const seg = new Date(h);
      seg.setDate(h.getDate() - ((h.getDay() + 6) % 7)); // segunda desta semana
      setDi(iso(seg));
      setDf(iso(h));
    } else {
      const d = new Date(h);
      d.setDate(h.getDate() - 29);
      setDi(iso(d));
      setDf(iso(h));
    }
  };

  const toggleCat = (key: string) => {
    setCatFiltro((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
    setPagina(1);
  };

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (catFiltro.size > 0 && !catFiltro.has(l.categoria)) return false;
      if (q) {
        const alvo = `${l.motivo || ''} ${l.produto || ''} ${l.mesa || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [linhas, catFiltro, busca]);

  const totFiltrado = useMemo(
    () => ({
      bruto: linhasFiltradas.reduce((s, l) => s + l.valor_bruto, 0),
      cmv: linhasFiltradas.reduce((s, l) => s + l.valor_cmv, 0),
    }),
    [linhasFiltradas],
  );

  const totalPaginas = Math.max(1, Math.ceil(linhasFiltradas.length / POR_PAGINA));
  const pagina1 = Math.min(pagina, totalPaginas);
  const pageSlice = linhasFiltradas.slice((pagina1 - 1) * POR_PAGINA, pagina1 * POR_PAGINA);

  const exportarCsv = () => {
    const head = ['Data', 'Categoria', 'Mesa', 'Motivo', 'Produto', 'Qtd', 'Valor Bruto', `Valor x${fator}`];
    const linhasCsv = linhasFiltradas.map((l) =>
      [
        l.data,
        LABEL[l.categoria] || l.categoria,
        l.mesa || '',
        (l.motivo || '').replace(/;/g, ','),
        (l.produto || '').replace(/;/g, ','),
        String(l.qtd).replace('.', ','),
        String(l.valor_bruto).replace('.', ','),
        String(l.valor_cmv).replace('.', ','),
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

  return (
    <div className="space-y-4 p-1">
      {/* Cabeçalho + período */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Controle de Consumação</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cada lançamento de consumação, linha a linha, por categoria. Custo efetivo = bruto × {fator}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-0.5">Início</label>
            <Input type="date" value={di} onChange={(e) => setDi(e.target.value)} className="input-dark w-40" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-0.5">Fim</label>
            <Input type="date" value={df} onChange={(e) => setDf(e.target.value)} className="input-dark w-40" />
          </div>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => preset('semana')}>Semana atual</Button>
        <Button variant="ghost" size="sm" onClick={() => preset('mes')}>Mês atual</Button>
        <Button variant="ghost" size="sm" onClick={() => preset('mesPassado')}>Mês passado</Button>
        <Button variant="ghost" size="sm" onClick={() => preset('d30')}>Últimos 30 dias</Button>
      </div>

      {/* Resumo por categoria (clicável) */}
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

      {/* Totais */}
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="p-3">
            <p className="text-xs text-gray-400">Total bruto {catFiltro.size > 0 ? '(filtro)' : ''}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {moeda(catFiltro.size > 0 || busca ? totFiltrado.bruto : totalBruto)}
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="p-3">
            <p className="text-xs text-gray-400">Custo efetivo (×{fator})</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {moeda(catFiltro.size > 0 || busca ? totFiltrado.cmv : totalCmv)}
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="p-3">
            <p className="text-xs text-gray-400">Lançamentos</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {linhasFiltradas.length.toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Busca + export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por motivo, produto ou mesa..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            className="input-dark pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          {catFiltro.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCatFiltro(new Set())}>
              Limpar filtro
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={linhasFiltradas.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Tabela */}
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
                <th className="text-right font-medium px-3 py-2">×{fator}</th>
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
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[240px] truncate" title={l.motivo || ''}>{l.motivo || '-'}</td>
                    <td className="px-3 py-1.5 text-gray-500 max-w-[240px] truncate" title={l.produto || ''}>{l.produto || '-'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{l.qtd.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">{moeda(l.valor_bruto)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 whitespace-nowrap">{moeda(l.valor_cmv)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Paginação */}
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
