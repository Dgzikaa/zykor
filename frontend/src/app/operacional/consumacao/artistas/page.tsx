'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, Loader2 } from 'lucide-react';

interface Linha {
  vd: number; data: string; mesa: string | null; motivo: string | null; valor: number;
  artista_id: number | null; artista_nome: string | null; origem: string | null;
}
interface Cad { id: number; nome: string; }

const fmtBRL = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtData = (iso: string) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const isoHoje = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const isoMenos = (dias: number) => new Date(Date.now() - (3 * 3600 * 1000) - dias * 86400000).toISOString().slice(0, 10);

export default function VincularConsumoArtistaPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('🎤 Consumação — Artistas'); return () => setPageTitle(''); }, [setPageTitle]);
  const barId = selectedBar?.id;
  const [di, setDi] = useState(isoMenos(90));
  const [df, setDf] = useState(isoHoje());
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cadastro, setCadastro] = useState<Cad[]>([]);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [soPendentes, setSoPendentes] = useState(false);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/operacional/consumacao/artista?data_inicio=${di}&data_fim=${df}`, {
        headers: { 'x-selected-bar-id': String(barId) },
      });
      const j = await r.json();
      if (j.success) { setLinhas(j.linhas || []); setCadastro(j.cadastro || []); }
    } finally { setLoading(false); }
  }, [barId, di, df]);

  useEffect(() => { carregar(); }, [carregar]);

  const vincular = async (vd: number, artistaId: number | null) => {
    if (!barId) return;
    setSalvando(vd);
    try {
      await fetch('/api/operacional/consumacao/artista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({ vd, artista_id: artistaId }),
      });
      await carregar();
    } finally { setSalvando(null); }
  };

  const nomePorId = useMemo(() => new Map(cadastro.map((c) => [c.id, c.nome])), [cadastro]);
  const visiveis = useMemo(() => soPendentes ? linhas.filter((l) => !l.artista_id || l.origem === 'auto_noite') : linhas, [linhas, soPendentes]);
  const porArtista = useMemo(() => {
    const m = new Map<string, { nome: string; total: number; n: number }>();
    for (const l of linhas) {
      const nome = l.artista_id ? (nomePorId.get(l.artista_id) || l.artista_nome || '—') : '⚠ sem artista';
      const a = m.get(nome) || { nome, total: 0, n: 0 };
      a.total += l.valor; a.n += 1; m.set(nome, a);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [linhas, nomePorId]);

  if (!barId) return <div className="p-6 text-gray-500">Selecione um bar.</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-4">
          <Link href="/operacional/consumacao" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2">
            <ArrowLeft className="w-4 h-4" /> Voltar para Consumação
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" /> Consumação por Artista
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Cada consumação de artista vinculada a um artista do cadastro. Resolve sozinho pelo nome ou pelo show da noite;
            ajuste no seletor quando precisar (ex.: noite com mais de uma banda).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Input type="date" value={di} onChange={(e) => setDi(e.target.value)} className="w-40 bg-white dark:bg-gray-800" />
          <span className="text-gray-400">até</span>
          <Input type="date" value={df} onChange={(e) => setDf(e.target.value)} className="w-40 bg-white dark:bg-gray-800" />
          <Button variant={soPendentes ? 'default' : 'outline'} size="sm" onClick={() => setSoPendentes((v) => !v)}>
            Só revisar (auto por noite / sem artista)
          </Button>
        </div>

        {/* resumo por artista */}
        {!loading && porArtista.length > 0 && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-4">
            <CardContent className="p-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {porArtista.map((a) => (
                <span key={a.nome} className={a.nome.startsWith('⚠') ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}>
                  {a.nome}: <b>{fmtBRL(a.total)}</b> <span className="text-xs text-gray-400">({a.n})</span>
                </span>
              ))}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-left px-3 py-2">Mesa</th>
                    <th className="text-left px-3 py-2">Motivo</th>
                    <th className="text-right px-3 py-2">Valor</th>
                    <th className="text-left px-3 py-2">Artista</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {visiveis.map((l) => (
                    <tr key={l.vd} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(l.data)}</td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300 max-w-[10rem] truncate" title={l.mesa || ''}>{l.mesa || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-500 max-w-[12rem] truncate" title={l.motivo || ''}>{l.motivo || '—'}</td>
                      <td className="px-3 py-1.5 text-right">{fmtBRL(l.valor)}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            className="rounded border border-gray-200 dark:border-gray-600 bg-transparent px-1.5 py-1 text-xs max-w-[11rem]"
                            value={l.artista_id ?? ''}
                            onChange={(e) => vincular(l.vd, e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">— sem artista —</option>
                            {cadastro.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                          {salvando === l.vd
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                            : l.origem && <span className={`text-[10px] ${l.origem === 'manual' ? 'text-emerald-600' : 'text-gray-400'}`}>{l.origem === 'manual' ? 'manual' : l.origem === 'auto_nome' ? 'auto (nome)' : 'auto (noite)'}</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visiveis.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400">Nenhuma consumação de artista no período.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
