'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Loader2, ChevronLeft, ChevronRight, Clock, AlertTriangle, MapPin, Camera, CalendarX } from 'lucide-react';

type Linha = {
  data: string; entrada: string | null; saida: string | null; intervalo_min: number | null;
  prev_inicio: string | null; prev_fim: string | null; turno: string | null;
  origem: string | null; status: string | null; foto_in_url: string | null; geo_ok: boolean | null;
  horas_trab: number | null; horas_prev: number | null; horas_extra: number | null; atraso_min: number | null;
  situacao: string; observacao: string | null;
};
type Resumo = { horas_trab: number; horas_extra: number; faltas: number; justificadas: number; folgas: number; atrasos: number; dias_trabalhados: number };

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—');
const fmtDia = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}`; };
const fmtHoras = (h: number | null) => { if (!h) return '0h'; const H = Math.floor(h); const M = Math.round((h - H) * 60); return M ? `${H}h${String(M).padStart(2, '0')}` : `${H}h`; };
const labelMes = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); };
const addMes = (ym: string, delta: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const hojeMes = () => new Date().toISOString().slice(0, 7);

const SIT: Record<string, { dot: string; txt: string; label: string }> = {
  trabalhou: { dot: 'bg-emerald-500', txt: 'text-emerald-600 dark:text-emerald-400', label: 'trabalhou' },
  ok: { dot: 'bg-emerald-500', txt: 'text-emerald-600 dark:text-emerald-400', label: 'trabalhou' },
  atraso: { dot: 'bg-amber-500', txt: 'text-amber-600 dark:text-amber-400', label: 'atraso' },
  falta: { dot: 'bg-red-500', txt: 'text-red-600 dark:text-red-400', label: 'falta' },
  ausencia_justificada: { dot: 'bg-violet-500', txt: 'text-violet-600 dark:text-violet-400', label: 'justificada' },
  folga: { dot: 'bg-sky-400', txt: 'text-sky-600 dark:text-sky-400', label: 'folga' },
  feriado: { dot: 'bg-indigo-400', txt: 'text-indigo-600 dark:text-indigo-400', label: 'feriado' },
  agendada: { dot: 'bg-sky-400', txt: 'text-sky-600 dark:text-sky-400', label: 'agendada' },
  sem_escala: { dot: 'bg-muted-foreground/40', txt: 'text-muted-foreground', label: '—' },
  sem_marcacao: { dot: 'bg-muted-foreground/40', txt: 'text-muted-foreground', label: 'folga' },
};

export function EspelhoPontoTab({ funcionarioId }: { funcionarioId: number }) {
  const [mes, setMes] = useState(hojeMes());
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/rh/ponto/espelho?funcionario_id=${funcionarioId}&mes=${mes}`);
      setResumo(r.resumo); setLinhas(r.linhas || []);
    } catch { setResumo(null); setLinhas([]); }
    finally { setLoading(false); }
  }, [funcionarioId, mes]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="px-6 py-4 space-y-4">
      {/* seletor de mês (pill) */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center rounded-lg border bg-background shadow-sm">
          <button onClick={() => setMes((m) => addMes(m, -1))} title="Mês anterior" className="px-2.5 py-2 rounded-l-lg hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="px-3 py-2 text-sm font-semibold capitalize border-x min-w-[150px] text-center">{labelMes(mes)}</span>
          <button onClick={() => setMes((m) => addMes(m, +1))} disabled={mes >= hojeMes()} title="Mês seguinte" className="px-2.5 py-2 rounded-r-lg hover:bg-muted disabled:opacity-25 disabled:hover:bg-transparent transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? <div className="py-12 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
      : !resumo ? <div className="py-12 text-center text-sm text-muted-foreground">Sem dados de ponto neste mês.</div>
      : (
        <>
          {/* resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Kpi icon={Clock} label="Trabalhadas" value={fmtHoras(resumo.horas_trab)} />
            <Kpi icon={Clock} label="Hora extra" value={fmtHoras(resumo.horas_extra)} accent="text-indigo-600 dark:text-indigo-400" />
            <Kpi icon={CalendarX} label="Faltas" value={String(resumo.faltas)} accent={resumo.faltas ? 'text-red-600 dark:text-red-400' : ''} />
            <Kpi icon={CalendarX} label="Justificadas" value={String(resumo.justificadas)} accent={resumo.justificadas ? 'text-violet-600 dark:text-violet-400' : ''} />
            <Kpi icon={Clock} label="Folgas" value={String(resumo.folgas)} accent="text-sky-600 dark:text-sky-400" />
            <Kpi icon={AlertTriangle} label="Atrasos" value={String(resumo.atrasos)} accent={resumo.atrasos ? 'text-amber-600 dark:text-amber-400' : ''} />
          </div>

          {/* espelho */}
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30"><tr>
                <th className="text-left px-3 py-2">Dia</th><th className="text-left px-3 py-2">Escala</th>
                <th className="text-center px-3 py-2">Entrada</th><th className="text-center px-3 py-2">Saída</th>
                <th className="text-right px-3 py-2">Trab.</th><th className="text-right px-3 py-2">Extra</th>
                <th className="text-center px-3 py-2">Status</th><th className="text-center px-3 py-2 w-10"></th>
              </tr></thead>
              <tbody>
                {linhas.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sem marcações.</td></tr>
                : linhas.map((l, i) => {
                  const sit = SIT[l.situacao] || SIT.sem_escala;
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-medium whitespace-nowrap">{fmtDia(l.data)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{l.prev_inicio ? `${hhmm(l.prev_inicio)}–${hhmm(l.prev_fim)}` : '—'}</td>
                      <td className="px-3 py-1.5 text-center whitespace-nowrap">{hhmm(l.entrada)}{l.atraso_min && l.atraso_min > 10 ? <span className="text-amber-600 ml-1" title={`atraso ${Math.round(l.atraso_min)}min`}>⚠</span> : null}</td>
                      <td className="px-3 py-1.5 text-center whitespace-nowrap">{hhmm(l.saida)}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtHoras(l.horas_trab)}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap text-indigo-600 dark:text-indigo-400">{l.horas_extra ? '+' + fmtHoras(l.horas_extra) : '—'}</td>
                      <td className={`px-3 py-1.5 text-center text-xs ${sit.txt}`}><span className={`inline-block w-2 h-2 rounded-full mr-1 align-middle ${sit.dot}`} />{sit.label}</td>
                      <td className="px-3 py-1.5 text-center text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {l.foto_in_url && <Camera className="w-3.5 h-3.5" />}
                          {l.geo_ok === true && <MapPin className="w-3.5 h-3.5 text-emerald-600" />}
                          {l.geo_ok === false && <MapPin className="w-3.5 h-3.5 text-red-600" />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="inline-flex items-center mr-2"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />trabalhou</span>
            <span className="inline-flex items-center mr-2"><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />falta</span>
            <span className="inline-flex items-center mr-2"><span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-1" />ausência justificada (atestado/férias)</span>
            <span className="inline-flex items-center mr-2"><span className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-1" />folga (escala)</span>
            <br />📷 foto da marcação · <MapPin className="inline w-3 h-3 text-emerald-600" /> bateu no bar · <MapPin className="inline w-3 h-3 text-red-600" /> fora do local. Situação espelha o Tangerino; a folga vem da escala e a justificativa do atestado/férias lançado no dossiê.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" />{label}</div>
      <div className={`text-base font-bold ${accent || ''}`}>{value}</div>
    </div>
  );
}
