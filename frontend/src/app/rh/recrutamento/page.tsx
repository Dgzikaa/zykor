'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Briefcase, Loader2, Plus, Trash2, UserPlus, X, ChevronRight } from 'lucide-react';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';

type Vaga = { id: string; titulo: string; area_id: number | null; tipo_contratacao: string | null; status: string; candidatos: number };
type Cand = { id: string; nome: string; telefone: string | null; email: string | null; etapa: string; funcionario_id: number | null };
type Opcao = { id: number; nome: string };

const ETAPAS = [
  { v: 'inscrito', l: 'Inscritos', cls: 'border-t-slate-400' },
  { v: 'triagem', l: 'Triagem', cls: 'border-t-sky-400' },
  { v: 'entrevista', l: 'Entrevista', cls: 'border-t-amber-400' },
  { v: 'aprovado', l: 'Aprovados', cls: 'border-t-emerald-400' },
  { v: 'contratado', l: 'Contratados', cls: 'border-t-violet-400' },
];
const TODAS_ETAPAS = [...ETAPAS.map((e) => e.v), 'reprovado'];
const ETAPA_LBL: Record<string, string> = { inscrito: 'Inscrito', triagem: 'Triagem', entrevista: 'Entrevista', aprovado: 'Aprovado', contratado: 'Contratado', reprovado: 'Reprovado' };
const sel = 'h-8 rounded-md border border-input bg-background px-1.5 text-xs';
const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function RecrutamentoPage() {
  const { selectedBar } = useBar();
  const { soLeitura } = useModuloPermissao('/rh/recrutamento');
  const { showToast } = useToast();
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('💼 Recrutamento');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [areas, setAreas] = useState<Opcao[]>([]);
  const [sel0, setSel0] = useState<string | null>(null);
  const [cands, setCands] = useState<Cand[]>([]);
  const [loading, setLoading] = useState(false);
  const [novaVaga, setNovaVaga] = useState({ titulo: '', tipo_contratacao: 'CLT', area_id: '' });
  const [formVaga, setFormVaga] = useState(false);
  const [novoCand, setNovoCand] = useState({ nome: '', telefone: '' });
  const [busy, setBusy] = useState<string | null>(null);

  const carregarVagas = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try { const r = await api.get('/api/rh/vagas'); setVagas(r.vagas || []); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar vagas', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, showToast]);
  useEffect(() => { carregarVagas(); }, [carregarVagas]);
  useEffect(() => { if (!selectedBar) return; api.get('/api/rh/funcionarios/opcoes').then((r) => setAreas(r.areas || [])).catch(() => {}); }, [selectedBar]);

  const carregarCands = useCallback(async (vagaId: string) => {
    try { const r = await api.get(`/api/rh/vagas/${vagaId}/candidatos`); setCands(r.candidatos || []); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar candidatos', message: e?.message }); }
  }, [showToast]);
  useEffect(() => { if (sel0) carregarCands(sel0); else setCands([]); }, [sel0, carregarCands]);

  const criarVaga = async () => {
    if (!novaVaga.titulo.trim()) { showToast({ type: 'error', title: 'Informe o título' }); return; }
    try { await api.post('/api/rh/vagas', novaVaga); setNovaVaga({ titulo: '', tipo_contratacao: 'CLT', area_id: '' }); setFormVaga(false); carregarVagas(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
  };
  const mudarStatus = async (v: Vaga, status: string) => { try { await api.post('/api/rh/vagas', { id: v.id, status }); carregarVagas(); } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); } };
  const addCand = async () => {
    if (!sel0 || !novoCand.nome.trim()) return;
    try { await api.post(`/api/rh/vagas/${sel0}/candidatos`, novoCand); setNovoCand({ nome: '', telefone: '' }); carregarCands(sel0); carregarVagas(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
  };
  const mudarEtapa = async (c: Cand, etapa: string) => {
    setCands((p) => p.map((x) => x.id === c.id ? { ...x, etapa } : x));
    try { await api.post(`/api/rh/vagas/${sel0}/candidatos`, { id: c.id, etapa }); } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); if (sel0) carregarCands(sel0); }
  };
  const admitir = async (c: Cand) => {
    if (!sel0) return;
    setBusy(c.id);
    try {
      const r = await api.post(`/api/rh/vagas/${sel0}/candidatos`, { id: c.id, admitir: true });
      if (r.success) { showToast({ type: 'success', title: `${c.nome} admitido(a)!`, message: 'Funcionário criado na Central.' }); carregarCands(sel0); carregarVagas(); }
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao admitir', message: e?.message }); }
    finally { setBusy(null); }
  };
  const removerCand = async (c: Cand) => {
    if (!sel0) return;
    try { await api.delete(`/api/rh/vagas/${sel0}/candidatos?candidato_id=${c.id}`); carregarCands(sel0); carregarVagas(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
  };

  const vagaSel = useMemo(() => vagas.find((v) => v.id === sel0), [vagas, sel0]);
  const reprovados = cands.filter((c) => c.etapa === 'reprovado').length;

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-600 p-5 mb-5 shadow-sm">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3 flex-wrap text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0"><Briefcase className="w-6 h-6" /></div>
              <div>
                <h1 className="flex items-center gap-2 text-xl font-bold leading-tight">Recrutamento{soLeitura && <BadgeSomenteLeitura />}</h1>
                <p className="text-sm text-white/80">Vagas, candidatos por etapa e admissão</p>
              </div>
            </div>
            <Button onClick={() => setFormVaga((v) => !v)} className="bg-white text-purple-700 hover:bg-white/90 shadow-sm"><Plus className="w-4 h-4 mr-1.5" />Nova vaga</Button>
          </div>
        </div>

        {formVaga && (
          <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm mb-4">
            <CardContent className="py-3 flex items-end gap-2 flex-wrap">
              <label className="flex flex-col gap-1 flex-1 min-w-[180px]"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Título da vaga</span><Input value={novaVaga.titulo} onChange={(e) => setNovaVaga({ ...novaVaga, titulo: e.target.value })} placeholder="ex: Bartender" className="h-9 text-sm" /></label>
              <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo</span><select value={novaVaga.tipo_contratacao} onChange={(e) => setNovaVaga({ ...novaVaga, tipo_contratacao: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option>CLT</option><option>PJ</option><option>Freela</option></select></label>
              <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Área</span><select value={novaVaga.area_id} onChange={(e) => setNovaVaga({ ...novaVaga, area_id: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
              <Button size="sm" className="h-9" onClick={criarVaga}>Criar</Button>
            </CardContent>
          </Card>
        )}

        {loading ? <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div> : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Lista de vagas */}
            <div className="lg:col-span-1 space-y-2">
              {vagas.length === 0 ? <div className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded-lg">Nenhuma vaga. Crie a primeira.</div> :
                vagas.map((v) => (
                  <button key={v.id} onClick={() => setSel0(v.id)} className={cn('w-full text-left rounded-xl border px-3 py-2.5 transition-colors', sel0 === v.id ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700' : 'bg-background hover:bg-muted/40')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{v.titulo}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={cn('text-[10px] rounded-full px-1.5 py-0.5', v.status === 'aberta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : v.status === 'pausada' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800')}>{v.status}</span>
                      {v.tipo_contratacao && <span className="text-[10px] text-muted-foreground">{v.tipo_contratacao}</span>}
                      <span className="text-[10px] text-muted-foreground ml-auto">{v.candidatos} cand.</span>
                    </div>
                  </button>
                ))}
            </div>

            {/* Pipeline da vaga selecionada */}
            <div className="lg:col-span-3">
              {!vagaSel ? <div className="text-sm text-muted-foreground text-center py-16 border border-dashed rounded-2xl">Selecione uma vaga pra ver os candidatos.</div> : (
                <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <div className="font-semibold">{vagaSel.titulo}</div>
                      <div className="flex items-center gap-2">
                        <select value={vagaSel.status} onChange={(e) => mudarStatus(vagaSel, e.target.value)} className={sel}><option value="aberta">Aberta</option><option value="pausada">Pausada</option><option value="fechada">Fechada</option></select>
                        {reprovados > 0 && <span className="text-[11px] text-muted-foreground">{reprovados} reprovado(s)</span>}
                      </div>
                    </div>

                    <div className="flex items-end gap-2 mb-4">
                      <Input value={novoCand.nome} onChange={(e) => setNovoCand({ ...novoCand, nome: e.target.value })} placeholder="Nome do candidato" className="h-9 text-sm flex-1" />
                      <Input value={novoCand.telefone} onChange={(e) => setNovoCand({ ...novoCand, telefone: e.target.value })} placeholder="Telefone" className="h-9 text-sm w-36" />
                      <Button size="sm" className="h-9" onClick={addCand}><Plus className="w-4 h-4 mr-1" />Candidato</Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
                      {ETAPAS.map((col) => {
                        const itens = cands.filter((c) => c.etapa === col.v);
                        return (
                          <div key={col.v} className={cn('rounded-xl bg-muted/30 border-t-2 p-2 min-h-[80px]', col.cls)}>
                            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">{col.l}<span className="rounded-full bg-background px-1.5">{itens.length}</span></div>
                            <div className="space-y-1.5">
                              {itens.map((c) => (
                                <div key={c.id} className="rounded-lg bg-background border px-2 py-1.5 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 flex items-center justify-center text-[9px] font-bold shrink-0">{iniciais(c.nome)}</div>
                                    <span className="font-medium truncate flex-1">{c.nome}</span>
                                    <button onClick={() => removerCand(c)} className="text-muted-foreground/40 hover:text-red-500 shrink-0"><X className="w-3 h-3" /></button>
                                  </div>
                                  {c.telefone && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.telefone}</div>}
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <select value={c.etapa} onChange={(e) => mudarEtapa(c, e.target.value)} className="h-6 rounded border border-input bg-background px-1 text-[10px] flex-1">
                                      {TODAS_ETAPAS.map((e) => <option key={e} value={e}>{ETAPA_LBL[e]}</option>)}
                                    </select>
                                    {col.v === 'aprovado' && (
                                      <button onClick={() => admitir(c)} disabled={busy === c.id} title="Admitir (cria funcionário)" className="h-6 px-1.5 rounded bg-emerald-600 text-white text-[10px] inline-flex items-center gap-0.5 shrink-0 hover:bg-emerald-700">
                                        {busy === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserPlus className="w-3 h-3" />Admitir</>}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
