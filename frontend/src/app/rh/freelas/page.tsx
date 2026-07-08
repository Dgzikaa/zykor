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
import { HandCoins, Loader2, Plus, Trash2, Copy, Users } from 'lucide-react';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';

type Conv = { id: string; funcionario_id: number; data: string; status: string; valor_diaria: number | null; funcao: string | null };
type Pool = { id: number; nome: string; area_id: number | null; valor_diaria: number | null; chave_pix: string | null; tipo_chave_pix: string | null };

const STATUS_OPC = [
  { v: 'convocado', l: 'Convocado' }, { v: 'confirmado', l: 'Confirmado' },
  { v: 'compareceu', l: 'Compareceu' }, { v: 'faltou', l: 'Faltou' }, { v: 'recusado', l: 'Recusou' },
];
const STATUS_CLS: Record<string, string> = {
  convocado: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  confirmado: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  compareceu: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  faltou: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  recusado: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};
const sel = 'h-8 rounded-md border border-input bg-background px-2 text-xs';
const fmtBRL = (v: number | null | undefined) => v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function FreelasPage() {
  const { selectedBar } = useBar();
  const { soLeitura } = useModuloPermissao('/rh/freelas');
  const { showToast } = useToast();
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('🤝 Freelas');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const [data, setData] = useState(() => ymd(new Date()));
  const [convocacoes, setConvocacoes] = useState<Conv[]>([]);
  const [pool, setPool] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try { const r = await api.get(`/api/rh/freelas?data=${data}`); setConvocacoes(r.convocacoes || []); setPool(r.pool || []); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar freelas', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, data, showToast]);
  useEffect(() => { carregar(); }, [carregar]);

  const poolMap = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const convocadoIds = useMemo(() => new Set(convocacoes.map((c) => c.funcionario_id)), [convocacoes]);
  const disponiveis = useMemo(() => pool.filter((p) => !convocadoIds.has(p.id)), [pool, convocadoIds]);

  const convocar = async (id: number) => {
    setBusy(`conv-${id}`);
    try { await api.post('/api/rh/freelas', { data, funcionario_id: id }); carregar(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao convocar', message: e?.message }); }
    finally { setBusy(null); }
  };
  const atualizar = async (c: Conv, patch: Partial<Conv>) => {
    setConvocacoes((prev) => prev.map((x) => x.id === c.id ? { ...x, ...patch } : x));
    try { await api.post('/api/rh/freelas', { id: c.id, ...patch }); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); carregar(); }
  };
  const remover = async (id: string) => {
    setBusy(`del-${id}`);
    try { await api.delete(`/api/rh/freelas?id=${id}`); carregar(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao remover', message: e?.message }); }
    finally { setBusy(null); }
  };

  // Resumo: a pagar = quem confirmou/compareceu
  const aPagar = convocacoes.filter((c) => c.status === 'confirmado' || c.status === 'compareceu');
  const totalPagar = aPagar.reduce((s, c) => s + (Number(c.valor_diaria) || 0), 0);

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5 mb-5 shadow-sm">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3 flex-wrap text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0"><HandCoins className="w-6 h-6" /></div>
              <div>
                <h1 className="flex items-center gap-2 text-xl font-bold leading-tight">Freelas{soLeitura && <BadgeSomenteLeitura />}</h1>
                <p className="text-sm text-white/80">Convocação por dia, confirmação e pagamento</p>
              </div>
            </div>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 rounded-md bg-white/15 backdrop-blur border-0 text-white px-2 text-sm [color-scheme:dark]" />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pool disponível */}
            <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm lg:col-span-1">
              <CardContent className="py-4">
                <div className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Users className="w-4 h-4" />Disponíveis ({disponiveis.length})</div>
                {disponiveis.length === 0 ? <div className="text-xs text-muted-foreground py-6 text-center">Todos os freelas já foram convocados (ou não há freelas cadastrados).</div> : (
                  <div className="space-y-1.5">
                    {disponiveis.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center justify-center text-[9px] font-bold shrink-0">{iniciais(p.nome)}</div>
                          <span className="text-sm truncate">{p.nome}</span>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 shrink-0" disabled={busy === `conv-${p.id}`} onClick={() => convocar(p.id)}>
                          {busy === `conv-${p.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1" />Convocar</>}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Convocados */}
            <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm lg:col-span-2">
              <CardContent className="py-4">
                <div className="text-sm font-semibold mb-3 flex items-center gap-1.5"><HandCoins className="w-4 h-4" />Convocados ({convocacoes.length})</div>
                {convocacoes.length === 0 ? <div className="text-xs text-muted-foreground py-8 text-center">Ninguém convocado pra esse dia ainda.</div> : (
                  <div className="space-y-2">
                    {convocacoes.map((c) => {
                      const f = poolMap.get(c.funcionario_id);
                      return (
                        <div key={c.id} className="rounded-lg border px-3 py-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center justify-center text-[10px] font-bold shrink-0">{iniciais(f?.nome || '?')}</div>
                              <span className="font-medium text-sm truncate">{f?.nome || `#${c.funcionario_id}`}</span>
                              <span className={cn('text-[10px] rounded-full px-1.5 py-0.5', STATUS_CLS[c.status])}>{STATUS_OPC.find((s) => s.v === c.status)?.l}</span>
                            </div>
                            <button className="text-muted-foreground hover:text-red-600" disabled={busy === `del-${c.id}`} onClick={() => remover(c.id)}><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <select className={sel} value={c.status} onChange={(e) => atualizar(c, { status: e.target.value })}>
                              {STATUS_OPC.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                            </select>
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-muted-foreground">R$</span>
                              <Input type="number" step="0.01" value={c.valor_diaria ?? ''} onChange={(e) => atualizar(c, { valor_diaria: e.target.value === '' ? null : Number(e.target.value) })} className="h-8 w-24 text-xs" placeholder="diária" />
                            </div>
                            {f?.chave_pix && (
                              <button className="text-[11px] inline-flex items-center gap-1 rounded border px-2 h-8 hover:bg-muted" title="Copiar chave PIX"
                                onClick={() => { navigator.clipboard?.writeText(f.chave_pix || ''); showToast({ type: 'success', title: 'Chave PIX copiada' }); }}>
                                <Copy className="w-3 h-3" />{f.tipo_chave_pix || 'pix'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Resumo de pagamento */}
        {!loading && convocacoes.length > 0 && (
          <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm mt-4">
            <CardContent className="py-4 flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="font-semibold">A pagar:</span> {aPagar.length} freela(s) que confirmaram/compareceram
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(totalPagar)}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
