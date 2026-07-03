'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, Trash2, Plus } from 'lucide-react';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';

type Escala = {
  id: string; funcionario_id: number; data: string; turno: string;
  status: string; hora_inicio: string | null; hora_fim: string | null; observacao: string | null;
};
type Func = { id: number; nome: string; area_id: number | null; tipo_contratacao: string | null };
type Opcao = { id: number; nome: string };

const DIAS_LBL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const TURNOS = ['Manhã', 'Tarde', 'Noite', 'Integral'];
const TURNO_CLS: Record<string, string> = {
  'Manhã': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Tarde': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'Noite': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Integral': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};
const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const segDaSemana = (base: Date) => { const d = new Date(base); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); d.setHours(12, 0, 0, 0); return d; };
const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

type CellEdit = { func: Func; data: string; e: Escala | null } | null;

export default function EscalaPage() {
  const { selectedBar } = useBar();
  const { soLeitura } = useModuloPermissao('/rh/escala');
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(() => segDaSemana(new Date()));
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [funcionarios, setFuncionarios] = useState<Func[]>([]);
  const [areas, setAreas] = useState<Opcao[]>([]);
  const [filtroArea, setFiltroArea] = useState('');
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<CellEdit>(null);
  const [salvando, setSalvando] = useState(false);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const inicio = ymd(dias[0]); const fim = ymd(dias[6]);
      const r = await api.get(`/api/rh/escala?inicio=${inicio}&fim=${fim}`);
      setEscalas(r.escalas || []); setFuncionarios(r.funcionarios || []);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar escala', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, dias, showToast]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (!selectedBar) return; api.get('/api/rh/funcionarios/opcoes').then((r) => setAreas(r.areas || [])).catch(() => {}); }, [selectedBar]);

  const mapa = useMemo(() => {
    const m = new Map<string, Escala>();
    for (const e of escalas) m.set(`${e.funcionario_id}|${e.data}`, e);
    return m;
  }, [escalas]);

  const lista = useMemo(() => funcionarios.filter((f) => !filtroArea || String(f.area_id) === filtroArea), [funcionarios, filtroArea]);

  const salvar = async (turno: string, status: string, hi: string, hf: string, obs: string) => {
    if (!edit) return;
    setSalvando(true);
    try {
      await api.post('/api/rh/escala', {
        funcionario_id: edit.func.id, data: edit.data, turno, status,
        hora_inicio: hi || null, hora_fim: hf || null, observacao: obs || null,
        area_id: edit.func.area_id,
      });
      setEdit(null); carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); }
    finally { setSalvando(false); }
  };
  const limpar = async () => {
    if (!edit?.e) { setEdit(null); return; }
    setSalvando(true);
    try { await api.delete(`/api/rh/escala?id=${edit.e.id}`); setEdit(null); carregar(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao limpar', message: e?.message }); }
    finally { setSalvando(false); }
  };

  const hojeYmd = ymd(new Date());

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-5 mb-5 shadow-sm">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3 flex-wrap text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0"><CalendarRange className="w-6 h-6" /></div>
              <div>
                <h1 className="flex items-center gap-2 text-xl font-bold leading-tight">Escala{soLeitura && <BadgeSomenteLeitura />}</h1>
                <p className="text-sm text-white/80">Turnos da equipe por semana — clique numa célula pra escalar</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0" onClick={() => setWeekStart(segDaSemana(new Date()))}>Hoje</Button>
              <div className="flex items-center rounded-md bg-white/15 backdrop-blur">
                <button className="p-2 hover:bg-white/10 rounded-l-md" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-2 text-xs font-medium whitespace-nowrap">{dias[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – {dias[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                <button className="p-2 hover:bg-white/10 rounded-r-md" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todas as áreas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{lista.length} funcionário(s)</span>
        </div>

        <Card className="p-0 overflow-x-auto rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          {loading ? (
            <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
          ) : lista.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Nenhum funcionário ativo.</div>
          ) : (
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="bg-muted/40">
                  <th className="sticky left-0 z-10 bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground px-3 py-2 min-w-[180px] border-b">Funcionário</th>
                  {dias.map((d, i) => (
                    <th key={i} className={cn('text-center text-[11px] px-2 py-2 border-b min-w-[92px]', ymd(d) === hojeYmd && 'bg-blue-50 dark:bg-blue-900/20')}>
                      <div className="font-semibold text-foreground">{DIAS_LBL[i]}</div>
                      <div className="text-muted-foreground">{d.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-b">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold shrink-0">{iniciais(f.nome)}</div>
                        <span className="font-medium truncate max-w-[130px]">{f.nome}</span>
                      </div>
                    </td>
                    {dias.map((d, i) => {
                      const k = `${f.id}|${ymd(d)}`; const e = mapa.get(k) || null;
                      return (
                        <td key={i} className={cn('border-b px-1.5 py-1.5 text-center cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-900/10', ymd(d) === hojeYmd && 'bg-blue-50/40 dark:bg-blue-900/10')}
                          onClick={() => setEdit({ func: f, data: ymd(d), e })}>
                          {e ? (
                            e.status === 'folga' ? <span className="text-[11px] rounded px-1.5 py-0.5 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Folga</span>
                              : e.status === 'falta' ? <span className="text-[11px] rounded px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Falta</span>
                                : (
                                  <span className={cn('text-[11px] rounded px-1.5 py-0.5 inline-flex flex-col leading-tight', TURNO_CLS[e.turno] || 'bg-muted')}>
                                    {e.turno}{e.hora_inicio && <span className="text-[9px] opacity-80">{e.hora_inicio.slice(0, 5)}{e.hora_fim ? `–${e.hora_fim.slice(0, 5)}` : ''}</span>}
                                  </span>
                                )
                          ) : <Plus className="w-3.5 h-3.5 mx-auto text-muted-foreground/30" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <CellDialog edit={edit} onClose={() => setEdit(null)} onSalvar={salvar} onLimpar={limpar} salvando={salvando} />
    </ProtectedRoute>
  );
}

function CellDialog({ edit, onClose, onSalvar, onLimpar, salvando }: {
  edit: CellEdit; onClose: () => void;
  onSalvar: (turno: string, status: string, hi: string, hf: string, obs: string) => void;
  onLimpar: () => void; salvando: boolean;
}) {
  const [turno, setTurno] = useState('Integral');
  const [status, setStatus] = useState('planejado');
  const [hi, setHi] = useState(''); const [hf, setHf] = useState(''); const [obs, setObs] = useState('');

  useEffect(() => {
    if (!edit) return;
    setTurno(edit.e?.turno || 'Integral'); setStatus(edit.e?.status || 'planejado');
    setHi(edit.e?.hora_inicio?.slice(0, 5) || ''); setHf(edit.e?.hora_fim?.slice(0, 5) || ''); setObs(edit.e?.observacao || '');
  }, [edit]);

  return (
    <Dialog open={!!edit} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{edit?.func.nome}</DialogTitle>
          <DialogDescription>{edit && new Date(`${edit.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Turno</Label>
            <select className={sel} value={turno} onChange={(e) => setTurno(e.target.value)}>
              {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="planejado">Planejado</option>
              <option value="confirmado">Confirmado</option>
              <option value="folga">Folga</option>
              <option value="falta">Falta</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label className="text-xs">Início</Label><Input type="time" value={hi} onChange={(e) => setHi(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Fim</Label><Input type="time" value={hf} onChange={(e) => setHf(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Observação</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional" /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {edit?.e && <Button variant="outline" onClick={onLimpar} disabled={salvando} className="mr-auto text-red-600"><Trash2 className="w-4 h-4 mr-1.5" />Limpar</Button>}
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => onSalvar(turno, status, hi, hf, obs)} disabled={salvando}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
