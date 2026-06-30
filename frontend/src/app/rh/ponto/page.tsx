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
import { Clock, ChevronLeft, ChevronRight, Loader2, Trash2, Plus } from 'lucide-react';

type Reg = { id: string; funcionario_id: number; data: string; entrada: string | null; saida: string | null; intervalo_min: number; horas_previstas: number; observacao: string | null };
type Func = { id: number; nome: string; area_id: number | null };
type Opcao = { id: number; nome: string };

const DIAS_LBL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const segDaSemana = (base: Date) => { const d = new Date(base); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); d.setHours(12, 0, 0, 0); return d; };
const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const toMin = (t: string | null) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
// minutos trabalhados (trata virada de meia-noite)
const trabMin = (r: Reg) => { const e = toMin(r.entrada), s = toMin(r.saida); if (e == null || s == null) return null; let d = s - e; if (d < 0) d += 1440; return Math.max(0, d - (r.intervalo_min || 0)); };
const fmtMin = (min: number) => { const neg = min < 0; const a = Math.abs(min); const h = Math.floor(a / 60); const m = a % 60; return `${neg ? '-' : ''}${h}h${m ? String(m).padStart(2, '0') : ''}`; };

type CellEdit = { func: Func; data: string; r: Reg | null } | null;

export default function PontoPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(() => segDaSemana(new Date()));
  const [registros, setRegistros] = useState<Reg[]>([]);
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
      const r = await api.get(`/api/rh/ponto?inicio=${ymd(dias[0])}&fim=${ymd(dias[6])}`);
      setRegistros(r.registros || []); setFuncionarios(r.funcionarios || []);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar ponto', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, dias, showToast]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (!selectedBar) return; api.get('/api/rh/funcionarios/opcoes').then((r) => setAreas(r.areas || [])).catch(() => {}); }, [selectedBar]);

  const mapa = useMemo(() => { const m = new Map<string, Reg>(); for (const r of registros) m.set(`${r.funcionario_id}|${r.data}`, r); return m; }, [registros]);
  const lista = useMemo(() => funcionarios.filter((f) => !filtroArea || String(f.area_id) === filtroArea), [funcionarios, filtroArea]);

  const saldoFunc = useCallback((fid: number) => {
    let s = 0;
    for (const d of dias) { const r = mapa.get(`${fid}|${ymd(d)}`); if (!r) continue; const t = trabMin(r); if (t == null) continue; s += t - Math.round((r.horas_previstas || 0) * 60); }
    return s;
  }, [dias, mapa]);

  const salvar = async (entrada: string, saida: string, intervalo: string, previstas: string, obs: string) => {
    if (!edit) return;
    setSalvando(true);
    try {
      await api.post('/api/rh/ponto', { funcionario_id: edit.func.id, data: edit.data, entrada: entrada || null, saida: saida || null, intervalo_min: intervalo || 0, horas_previstas: previstas || 8, observacao: obs || null });
      setEdit(null); carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); }
    finally { setSalvando(false); }
  };
  const limpar = async () => {
    if (!edit?.r) { setEdit(null); return; }
    setSalvando(true);
    try { await api.delete(`/api/rh/ponto?id=${edit.r.id}`); setEdit(null); carregar(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao limpar', message: e?.message }); }
    finally { setSalvando(false); }
  };

  const hojeYmd = ymd(new Date());

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-600 to-green-600 p-5 mb-5 shadow-sm">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3 flex-wrap text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0"><Clock className="w-6 h-6" /></div>
              <div>
                <h1 className="text-xl font-bold leading-tight">Ponto & Banco de Horas</h1>
                <p className="text-sm text-white/80">Entrada/saída por dia — saldo automático na semana</p>
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
                    <th key={i} className={cn('text-center text-[11px] px-2 py-2 border-b min-w-[78px]', ymd(d) === hojeYmd && 'bg-emerald-50 dark:bg-emerald-900/20')}>
                      <div className="font-semibold text-foreground">{DIAS_LBL[i]}</div><div className="text-muted-foreground">{d.getDate()}</div>
                    </th>
                  ))}
                  <th className="text-center text-[11px] uppercase tracking-wide text-muted-foreground px-2 py-2 border-b min-w-[80px]">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => {
                  const saldo = saldoFunc(f.id);
                  return (
                    <tr key={f.id} className="hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-b">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold shrink-0">{iniciais(f.nome)}</div>
                          <span className="font-medium truncate max-w-[130px]">{f.nome}</span>
                        </div>
                      </td>
                      {dias.map((d, i) => {
                        const r = mapa.get(`${f.id}|${ymd(d)}`) || null;
                        const t = r ? trabMin(r) : null;
                        const sal = r && t != null ? t - Math.round((r.horas_previstas || 0) * 60) : null;
                        return (
                          <td key={i} className={cn('border-b px-1.5 py-1.5 text-center cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10', ymd(d) === hojeYmd && 'bg-emerald-50/40 dark:bg-emerald-900/10')}
                            onClick={() => setEdit({ func: f, data: ymd(d), r })}>
                            {t != null ? (
                              <div className="leading-tight">
                                <div className="text-[12px] font-medium">{fmtMin(t)}</div>
                                {sal != null && sal !== 0 && <div className={cn('text-[9px]', sal > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{sal > 0 ? '+' : ''}{fmtMin(sal)}</div>}
                              </div>
                            ) : r ? <span className="text-[10px] text-muted-foreground">—</span> : <Plus className="w-3.5 h-3.5 mx-auto text-muted-foreground/30" />}
                          </td>
                        );
                      })}
                      <td className="border-b px-2 py-1.5 text-center">
                        <span className={cn('text-xs font-bold', saldo > 0 ? 'text-emerald-600 dark:text-emerald-400' : saldo < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>{saldo === 0 ? '0h' : `${saldo > 0 ? '+' : ''}${fmtMin(saldo)}`}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
        <p className="text-[11px] text-muted-foreground mt-2">Saldo = horas trabalhadas − previstas no dia. Vira-noite é tratado automaticamente.</p>
      </div>

      <CellDialog edit={edit} onClose={() => setEdit(null)} onSalvar={salvar} onLimpar={limpar} salvando={salvando} />
    </ProtectedRoute>
  );
}

function CellDialog({ edit, onClose, onSalvar, onLimpar, salvando }: {
  edit: CellEdit; onClose: () => void;
  onSalvar: (entrada: string, saida: string, intervalo: string, previstas: string, obs: string) => void;
  onLimpar: () => void; salvando: boolean;
}) {
  const [entrada, setEntrada] = useState(''); const [saida, setSaida] = useState('');
  const [intervalo, setIntervalo] = useState('0'); const [previstas, setPrevistas] = useState('8'); const [obs, setObs] = useState('');

  useEffect(() => {
    if (!edit) return;
    setEntrada(edit.r?.entrada?.slice(0, 5) || ''); setSaida(edit.r?.saida?.slice(0, 5) || '');
    setIntervalo(String(edit.r?.intervalo_min ?? 0)); setPrevistas(String(edit.r?.horas_previstas ?? 8)); setObs(edit.r?.observacao || '');
  }, [edit]);

  return (
    <Dialog open={!!edit} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{edit?.func.nome}</DialogTitle>
          <DialogDescription>{edit && new Date(`${edit.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label className="text-xs">Entrada</Label><Input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Saída</Label><Input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Intervalo (min)</Label><Input type="number" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Previstas (h)</Label><Input type="number" step="0.5" value={previstas} onChange={(e) => setPrevistas(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Observação</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional" /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {edit?.r && <Button variant="outline" onClick={onLimpar} disabled={salvando} className="mr-auto text-red-600"><Trash2 className="w-4 h-4 mr-1.5" />Limpar</Button>}
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => onSalvar(entrada, saida, intervalo, previstas, obs)} disabled={salvando}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
