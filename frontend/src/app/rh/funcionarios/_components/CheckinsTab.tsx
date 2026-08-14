'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { getSelectedBarId } from '@/lib/selected-bar';
import { cn } from '@/lib/utils';
import { Loader2, ChevronLeft, ChevronRight, UserCheck, Clock, CalendarX, AlertTriangle } from 'lucide-react';

/**
 * Check-in do dia (ata de 13/08/2026): o líder confirma quem veio.
 *
 * A lista vem da ESCALA, não do ponto — PJ e liderança não batem ponto e sumiriam. O ponto entra
 * como sugestão: em 12/08 ele acusou 18 faltas entre 50 escalados, enquanto a semana toda teve 9.
 */

type Linha = {
  funcionario_id: number; nome: string; area_nome: string | null; tipo_contratacao: string | null;
  turno: string | null; hora_inicio: string | null; hora_fim: string | null;
  entrada: string | null; ponto_situacao: string | null; atraso_min: number | null;
  checkin_status: string | null; checkin_observacao: string | null;
  sugestao: 'ok' | 'ok_atraso' | 'falta' | null;
};
type Resposta = {
  data: string; linhas: Linha[];
  equipe_de: string | null;
  resumo: { escalados: number; marcados: number; faltas: number; pendentes: number };
};

const OPCOES = [
  { id: 'ok', label: 'OK', cls: 'bg-emerald-600 text-white border-emerald-600' },
  { id: 'ok_atraso', label: 'OK c/ atraso', cls: 'bg-amber-500 text-white border-amber-500' },
  { id: 'escala_errada', label: 'Escala errada', cls: 'bg-slate-500 text-white border-slate-500' },
  { id: 'falta', label: 'Falta', cls: 'bg-rose-600 text-white border-rose-600' },
] as const;

const hojeISO = () => new Date().toISOString().slice(0, 10);
const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
};
const fmtBR = (iso: string) => iso.split('-').reverse().join('/');
const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : null);

export function CheckinsTab() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [dia, setDia] = useState(hojeISO());
  const [q, setQ] = useState('');
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  const [verTodos, setVerTodos] = useState(false);
  const { data, isLoading, mutate } = useApiSWR<Resposta>(
    selectedBar ? `/api/rh/checkin?data=${dia}${verTodos ? '&todos=1' : ''}` : null,
  );

  const linhas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.linhas || []).filter((l) => !t || l.nome.toLowerCase().includes(t) || (l.area_nome || '').toLowerCase().includes(t));
  }, [data, q]);

  const marcar = async (l: Linha, status: string) => {
    setSalvandoId(l.funcionario_id);
    try {
      const barId = getSelectedBarId();
      const r = await fetch('/api/rh/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(barId ? { 'x-selected-bar-id': barId } : {}) },
        credentials: 'include',
        body: JSON.stringify({ funcionario_id: l.funcionario_id, data: dia, status }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Não foi possível marcar');
      if (status === 'falta') {
        showToast({ type: 'warning', title: 'Falta registrada', message: `Ocorrência criada para ${l.nome}.` });
      }
      mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao marcar', message: e?.message });
    } finally {
      setSalvandoId(null);
    }
  };

  const r = data?.resumo;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-md border border-input h-9">
          <button className="p-2 hover:bg-muted rounded-l-md" onClick={() => setDia(somaDias(dia, -1))} aria-label="Dia anterior"><ChevronLeft className="w-4 h-4" /></button>
          <span className="px-2 text-sm font-medium whitespace-nowrap">{fmtBR(dia)}</span>
          <button className="p-2 hover:bg-muted rounded-r-md" onClick={() => setDia(somaDias(dia, 1))} aria-label="Próximo dia"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={() => setDia(hojeISO())}>Hoje</Button>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou área…" className="h-9 flex-1 min-w-[180px]" />
      </div>

      {/* Cada líder marca só a sua gente; RH e admin veem o dia inteiro. O aviso existe para
          ninguém achar que a escala sumiu ao ver menos nomes do que esperava. */}
      {(data?.equipe_de || verTodos) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {data?.equipe_de
            ? <span>Mostrando só <strong>a sua equipe</strong> ({data.equipe_de}) — as cadeiras abaixo da sua no organograma.</span>
            : <span>Mostrando <strong>todos os escalados</strong> do dia.</span>}
          <Button variant="outline" size="sm" className="h-7" onClick={() => setVerTodos((v) => !v)}>
            {verTodos ? 'Ver só a minha equipe' : 'Ver todos'}
          </Button>
        </div>
      )}

      {r && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Card><CardContent className="py-2.5"><div className="text-xs text-muted-foreground">Escalados</div><div className="text-lg font-bold">{r.escalados}</div></CardContent></Card>
          <Card><CardContent className="py-2.5"><div className="text-xs text-muted-foreground">Marcados</div><div className="text-lg font-bold text-emerald-600">{r.marcados}</div></CardContent></Card>
          <Card><CardContent className="py-2.5"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-lg font-bold text-amber-600">{r.pendentes}</div></CardContent></Card>
          <Card><CardContent className="py-2.5"><div className="text-xs text-muted-foreground">Faltas</div><div className="text-lg font-bold text-rose-600">{r.faltas}</div></CardContent></Card>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
      ) : linhas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <CalendarX className="w-9 h-9 mx-auto mb-2 opacity-40" />Ninguém escalado neste dia.
        </CardContent></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40"><tr>
              <th className="text-left px-3 py-2 min-w-[190px]">Pessoa</th>
              <th className="text-left px-3 py-2">Escala</th>
              <th className="text-left px-3 py-2">Ponto</th>
              <th className="text-right px-3 py-2 min-w-[300px]">Check do líder</th>
            </tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.funcionario_id} className={cn('border-b last:border-0', !l.checkin_status && 'bg-amber-50/40 dark:bg-amber-900/10')}>
                  <td className="px-3 py-1.5">
                    <div className="font-medium truncate">{l.nome}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {l.area_nome || '—'}
                      {l.tipo_contratacao && l.tipo_contratacao !== 'CLT' && (
                        <span className="ml-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1">{l.tipo_contratacao}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    {hhmm(l.hora_inicio) && hhmm(l.hora_fim) ? `${hhmm(l.hora_inicio)}–${hhmm(l.hora_fim)}` : '—'}
                    {l.turno && <span className="block opacity-70">{l.turno}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                    {l.entrada ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />{hhmm(l.entrada)}
                        {!!l.atraso_min && l.atraso_min > 10 && <span className="text-amber-600">+{Math.round(l.atraso_min)}min</span>}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground/70">
                        <AlertTriangle className="w-3 h-3" />sem marcação
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      {salvandoId === l.funcionario_id && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      {OPCOES.map((o) => {
                        const ativo = l.checkin_status === o.id;
                        const sugerido = !l.checkin_status && l.sugestao === o.id;
                        return (
                          <button key={o.id} onClick={() => marcar(l, o.id)} disabled={salvandoId === l.funcionario_id}
                            title={sugerido ? 'Sugerido pelo ponto' : undefined}
                            className={cn(
                              'text-[11px] rounded-full border px-2 py-0.5 transition-colors disabled:opacity-50',
                              ativo ? o.cls : 'bg-background hover:bg-muted border-input text-muted-foreground',
                              sugerido && 'ring-1 ring-dashed ring-muted-foreground/50',
                            )}>
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground">
        <UserCheck className="w-3 h-3 inline mr-1" />
        A lista vem da <strong>escala</strong>, não do ponto — quem é PJ ou liderança não bate ponto e
        sumiria. O contorno pontilhado é o que o ponto sugere; a palavra final é a do líder. Marcar
        <strong> Falta</strong> cria a ocorrência da pessoa automaticamente, e corrigir a marcação depois
        desfaz a ocorrência junto.
      </p>
    </div>
  );
}
