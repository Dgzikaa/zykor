'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useBar } from '@/contexts/BarContext';
import { CartaoIcon } from './CartoesBadge';

type Ocorr = {
  id: string; nome: string; vinculado: boolean; funcionario_ativo: boolean | null;
  data_inicio: string; descricao: string | null; cartao: string | null; aplicado_por: string | null;
};

const fmtData = (d: string | null) => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };

export function HistoricoOcorrencias() {
  const { selectedBar } = useBar();
  const [rows, setRows] = useState<Ocorr[]>([]);
  const [resumo, setResumo] = useState({ total: 0, vinculadas: 0, nome_so: 0 });
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const carregar = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const r = await api.get('/api/rh/ocorrencias?tipo=advertencia');
      if (r.success) { setRows(r.ocorrencias || []); setResumo(r.resumo || { total: 0, vinculadas: 0, nome_so: 0 }); }
    } finally { setLoading(false); }
  }, [selectedBar?.id]);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = q.trim()
    ? rows.filter((o) => `${o.nome} ${o.aplicado_por || ''} ${o.descricao || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    : rows;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por colaborador, líder ou motivo…" className="pl-8" />
        </div>
        <div className="text-xs text-muted-foreground">
          {resumo.total} advertências · {resumo.vinculadas} de funcionário atual · {resumo.nome_so} histórico (ex-funcionário)
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <Card className="p-0 overflow-x-auto rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40"><tr>
              <th className="text-left px-3 py-2 min-w-[220px]">Colaborador</th>
              <th className="text-center px-3 py-2">Cartão</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Data</th>
              <th className="text-left px-3 py-2">Motivo</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Líder</th>
            </tr></thead>
            <tbody>
              {filtradas.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-1.5">
                    <span className="font-medium">{o.nome}</span>
                    {!o.vinculado && <span className="ml-1.5 text-[10px] rounded px-1.5 py-0.5 bg-muted text-muted-foreground">ex-funcionário</span>}
                    {o.vinculado && o.funcionario_ativo === false && <span className="ml-1.5 text-[10px] rounded px-1.5 py-0.5 bg-muted text-muted-foreground">inativo</span>}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {o.cartao ? <CartaoIcon cor={o.cartao === 'vermelho' ? 'vermelho' : 'amarelo'} className="mx-auto" /> : <span className="text-[10px] text-muted-foreground">verbal</span>}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground tabular-nums">{fmtData(o.data_inicio)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{o.descricao || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{o.aplicado_por || '—'}</td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Nenhuma advertência.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
