'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { cn } from '@/lib/utils';
import { Loader2, Search, Clock, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * Banco de horas (ata de 13/08/2026): "a soma dos extras, não só daquele mês, mas é um somatório
 * geral". Serve à operação na hora de escalar — dá para preferir quem tem crédito.
 *
 * O saldo parte da abertura que o RH já media e acumula (trabalhado − previsto) a partir dali.
 */

type Linha = {
  funcionario_id: number; nome: string; area_nome: string | null;
  saldo_inicial_min: number; data_base: string | null;
  movimento_ponto_min: number; movimento_manual_min: number;
  saldo_min: number; dias_considerados: number;
};
type Resposta = {
  banco: Linha[];
  resumo: { pessoas: number; devendo: number; credito: number; saldo_total_min: number; sem_abertura: number };
};

/** -3696 -> "-61:36". O sinal é o que interessa aqui, então vai sempre explícito. */
export function fmtHoras(min: number): string {
  const s = min < 0 ? '-' : '+';
  const a = Math.abs(Math.round(min));
  return `${s}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

const fmtData = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

export function BancoHorasTab() {
  const { selectedBar } = useBar();
  const { data, isLoading } = useApiSWR<Resposta>(selectedBar ? '/api/rh/banco-horas' : null);
  const [q, setQ] = useState('');
  const [ordem, setOrdem] = useState<'saldo' | 'nome'>('saldo');

  const linhas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.banco || [])
      .filter((l) => !t || l.nome.toLowerCase().includes(t) || (l.area_nome || '').toLowerCase().includes(t))
      .sort((a, b) => (ordem === 'nome'
        ? a.nome.localeCompare(b.nome, 'pt-BR')
        : a.saldo_min - b.saldo_min));
  }, [data, q, ordem]);

  const r = data?.resumo;

  if (isLoading) return <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Saldo do time</div>
          <div className={cn('text-xl font-bold tabular-nums', (r?.saldo_total_min || 0) < 0 ? 'text-rose-600' : 'text-emerald-600')}>
            {fmtHoras(r?.saldo_total_min || 0)}
          </div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3" />Devendo horas</div>
          <div className="text-xl font-bold">{r?.devendo ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />Com crédito</div>
          <div className="text-xl font-bold">{r?.credito ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Sem saldo de abertura</div>
          <div className="text-xl font-bold">{r?.sem_abertura ?? 0}</div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou área…" className="pl-8" />
        </div>
        <div className="flex items-center rounded-md border border-input overflow-hidden h-9 text-xs">
          <button onClick={() => setOrdem('saldo')} className={cn('px-2 h-full', ordem === 'saldo' ? 'bg-emerald-600 text-white' : 'hover:bg-muted')}>Maior dívida</button>
          <button onClick={() => setOrdem('nome')} className={cn('px-2 h-full', ordem === 'nome' ? 'bg-emerald-600 text-white' : 'hover:bg-muted')}>Nome A–Z</button>
        </div>
      </div>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40"><tr>
            <th className="text-left px-3 py-2 min-w-[200px]">Pessoa</th>
            <th className="text-left px-3 py-2">Área</th>
            <th className="text-right px-3 py-2" title="Saldo que o RH já media, na data de referência">Abertura</th>
            <th className="text-right px-3 py-2" title="Trabalhado menos previsto depois da data de referência">Desde então</th>
            <th className="text-right px-3 py-2" title="Folgas compensadas, pagamentos e ajustes">Manual</th>
            <th className="text-right px-3 py-2">Saldo</th>
          </tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.funcionario_id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-1.5">
                  <div className="font-medium truncate">{l.nome}</div>
                  {!l.data_base && (
                    <span className="text-[10px] text-amber-600 inline-flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />sem abertura — conta o histórico inteiro
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{l.area_nome || '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {l.data_base ? fmtHoras(l.saldo_inicial_min) : '—'}
                  {l.data_base && <span className="block text-[10px] opacity-70">em {fmtData(l.data_base)}</span>}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {fmtHoras(l.movimento_ponto_min)}
                  <span className="block text-[10px] opacity-70">{l.dias_considerados} dia(s)</span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {l.movimento_manual_min ? fmtHoras(l.movimento_manual_min) : '—'}
                </td>
                <td className={cn('px-3 py-1.5 text-right tabular-nums font-semibold whitespace-nowrap',
                  l.saldo_min < 0 ? 'text-rose-600 dark:text-rose-400' : l.saldo_min > 0 ? 'text-emerald-600 dark:text-emerald-400' : '')}>
                  {fmtHoras(l.saldo_min)}
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />Ninguém encontrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Só entra no cálculo o dia que tem marcação de ponto <strong>e</strong> escala prevista — por isso a
        coluna mostra quantos dias contaram. Falta não vira hora negativa aqui: ela é ocorrência, e
        descontar do banco puniria a mesma coisa duas vezes.
      </p>
    </div>
  );
}
