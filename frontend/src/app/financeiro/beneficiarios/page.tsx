'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Users, Loader2, Search, Layers } from 'lucide-react';

type Benef = {
  canonical_key: string; nome: string; documento: string | null;
  qtd_cadastros_ca: number; qtd_pagamentos: number; total_pago: number;
  primeiro_pgto: string | null; ultimo_pgto: string | null;
};

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function BeneficiariosPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [linhas, setLinhas] = useState<Benef[]>([]);
  const [resumo, setResumo] = useState<{ pessoas: number; total_pago: number; com_duplicados: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [soDup, setSoDup] = useState(false);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/financeiro/beneficiarios/historico?q=${encodeURIComponent(q)}&so_duplicados=${soDup ? '1' : '0'}`);
      setLinhas(res.beneficiarios || []);
      setResumo(res.resumo || null);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message });
    } finally { setLoading(false); }
  }, [selectedBar, q, soDup, showToast]);

  useEffect(() => { const t = setTimeout(carregar, 300); return () => clearTimeout(t); }, [carregar]);

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-5 max-w-5xl">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5" />
          <h1 className="text-xl font-bold">Beneficiários</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Controle por pessoa — cadastros do Conta Azul unificados num só, com histórico de pagamentos.</p>

        {resumo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Pessoas</div><div className="text-lg font-bold">{resumo.pessoas}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Total pago</div><div className="text-lg font-bold">{fmtBRL(resumo.total_pago)}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Com cadastros duplicados no CA</div><div className="text-lg font-bold text-amber-600">{resumo.com_duplicados}</div></CardContent></Card>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome…" className="pl-8" />
          </div>
          <Button variant={soDup ? 'default' : 'outline'} size="sm" onClick={() => setSoDup(s => !s)}>
            <Layers className="w-4 h-4 mr-1.5" />{soDup ? 'Mostrando duplicados' : 'Só duplicados'}
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : linhas.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Users className="w-9 h-9 mx-auto mb-2 opacity-40" />Nenhum beneficiário.</CardContent></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-card min-w-[200px]">Pessoa</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Documento</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Pagamentos</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Total pago</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Último</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((b) => (
                  <tr key={b.canonical_key} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-1.5 sticky left-0 bg-card">
                      <div className="font-medium truncate max-w-[240px]">{b.nome}</div>
                      {Number(b.qtd_cadastros_ca) > 1 && (
                        <span className="text-[10px] text-amber-600">⚠ {b.qtd_cadastros_ca} cadastros no CA unificados</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{b.documento || '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{b.qtd_pagamentos}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fmtBRL(Number(b.total_pago))}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted-foreground">{b.ultimo_pgto || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
