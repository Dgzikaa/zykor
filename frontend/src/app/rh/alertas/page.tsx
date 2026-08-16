'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { cn } from '@/lib/utils';
import { ShieldAlert, Loader2, Search, CheckCircle2, ExternalLink } from 'lucide-react';
import { VinculoTangerino } from './_components/VinculoTangerino';

/**
 * Alerta de RH (Fase 8 da ata de 13/08/2026).
 *
 * A mesma função de alertas do dossiê, aplicada à base inteira. No dossiê o aviso só aparece
 * quando alguém abre aquela pessoa — e ninguém abre 68 fichas pra descobrir quem está sem
 * contrato. Aqui o RH vê tudo de uma vez e ataca por tipo de pendência.
 */

type Alerta = { tipo: string; label: string; nivel: 'alerta' | 'aviso' };
type Linha = { funcionario_id: number; nome: string; cargo_nome: string | null; alertas: Alerta[]; n_alerta: number; n_aviso: number };

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function AlertasRhPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');

  useEffect(() => {
    setPageTitle('🚨 Alerta de RH');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const { data, isLoading } = useApiSWR<any>(selectedBar ? '/api/rh/alertas' : null);
  const linhas: Linha[] = useMemo(() => data?.linhas || [], [data]);
  const porTipo = data?.por_tipo || [];
  const r = data?.resumo;

  const visiveis = useMemo(() => {
    const q = semAcento(busca.trim());
    return linhas.filter((l) =>
      (!q || semAcento(l.nome).includes(q) || semAcento(l.cargo_nome || '').includes(q)) &&
      (!tipo || l.alertas.some((a) => a.tipo === tipo)));
  }, [linhas, busca, tipo]);

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-red-600 to-orange-600 p-5 mb-5 shadow-sm">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-3 text-white">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0"><ShieldAlert className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Alerta de RH</h1>
              <p className="text-sm text-white/80">Todo mundo que tem pendência aberta, num lugar só</p>
            </div>
          </div>
        </div>

        {/* Fica ACIMA dos alertas por pessoa e fora do isLoading: vínculo quebrado não é pendência
            de uma ficha, é a integração parada — e some sozinho quando não há nada a resolver. */}
        <VinculoTangerino />

        {isLoading ? <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div> : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Ativos</div><div className="text-xl font-bold">{r?.ativos ?? 0}</div></CardContent></Card>
              <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Com pendência</div><div className="text-xl font-bold text-red-600 dark:text-red-400">{r?.com_pendencia ?? 0}</div></CardContent></Card>
              <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Sem nada em aberto</div><div className="text-xl font-bold text-emerald-600">{r?.limpos ?? 0}</div></CardContent></Card>
            </div>

            {/* Por tipo: é assim que o RH resolve em lote, não pessoa a pessoa */}
            {porTipo.length > 0 && (
              <Card className="mb-3"><CardContent className="py-3">
                <div className="text-xs font-semibold mb-2">Pendências por tipo — clique pra filtrar</div>
                <div className="flex flex-wrap gap-1.5">
                  {porTipo.map((t: any) => (
                    <button key={t.tipo} onClick={() => setTipo(tipo === t.tipo ? '' : t.tipo)}
                      className={cn('text-xs rounded-full border px-2.5 py-1 transition-colors',
                        tipo === t.tipo ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
                        t.nivel === 'aviso' && tipo !== t.tipo && 'text-amber-700 dark:text-amber-400')}>
                      {t.label} <strong className="tabular-nums">{t.pessoas}</strong>
                    </button>
                  ))}
                </div>
              </CardContent></Card>
            )}

            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo" className="h-9 pl-8" />
            </div>

            <div className="space-y-1.5">
              {visiveis.map((l) => (
                <Card key={l.funcionario_id} className={cn(l.n_alerta > 0 && 'ring-1 ring-red-200 dark:ring-red-900/50')}>
                  <CardContent className="py-2.5 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{l.nome}</span>
                        {l.cargo_nome && <span className="text-[11px] text-muted-foreground">{l.cargo_nome}</span>}
                        <a href={`/rh/funcionarios?funcionario=${l.funcionario_id}`}
                          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
                          abrir dossiê <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      {l.alertas.length === 0 ? (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />Nada em aberto
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {l.alertas.map((a, i) => (
                            <span key={i} className={cn('text-[10px] rounded px-1.5 py-0.5',
                              a.nivel === 'alerta'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300')}>
                              {a.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {visiveis.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-14 border border-dashed rounded-xl">
                  Nenhum funcionário com esse filtro.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
