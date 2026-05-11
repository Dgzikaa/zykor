'use client';

import { useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface SyncStats {
  lancamentos?: number;
  categorias?: number;
  centros_custo?: number;
  pessoas?: number;
  contas_financeiras?: number;
  erros?: number;
}

interface SyncResultado {
  success: boolean;
  bar_id?: number;
  sync_mode?: string;
  period?: { from?: string; to?: string };
  stats?: SyncStats;
  duration_seconds?: number;
  error?: string;
}

/**
 * Botão global para sincronizar Conta Azul sob demanda.
 * Aparece ao lado do BarSelector (presente em todas as páginas).
 * Mostra modal com resumo após a sincronização.
 */
export function ContaAzulSyncButton() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<SyncResultado | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const sync = async () => {
    if (!selectedBar?.id || loading) return;
    setLoading(true);
    setResultado(null);

    try {
      const resp = await fetch('/api/contaazul/sync-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id, sync_mode: 'daily_incremental' }),
      });
      const result: SyncResultado = await resp.json();
      setResultado(result);
      setModalOpen(true);

      if (!result.success) {
        toast({
          title: '❌ Falha no Conta Azul',
          description: result.error || 'Erro ao sincronizar',
          variant: 'destructive',
        });
      } else {
        const totalRegistros =
          (result.stats?.lancamentos ?? 0) +
          (result.stats?.categorias ?? 0) +
          (result.stats?.centros_custo ?? 0) +
          (result.stats?.pessoas ?? 0) +
          (result.stats?.contas_financeiras ?? 0);
        toast({
          title: '✅ Conta Azul sincronizado',
          description: `${totalRegistros} registros em ${result.duration_seconds ?? '?'}s`,
        });
      }
    } catch (e: any) {
      const err = e?.message || 'Erro desconhecido';
      setResultado({ success: false, error: err });
      setModalOpen(true);
      toast({ title: '❌ Erro', description: err, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={sync}
        disabled={loading || !selectedBar?.id}
        size="sm"
        variant="outline"
        className="h-9 gap-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
        title="Sincronizar lançamentos do Conta Azul para este bar"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">
          {loading ? 'Sincronizando…' : 'Conta Azul'}
        </span>
      </Button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultado?.success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Conta Azul sincronizado
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Falha na sincronização
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {resultado?.success ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bar <strong>{selectedBar?.nome}</strong> — modo{' '}
                <code className="text-xs">{resultado.sync_mode}</code>
              </p>
              {resultado.period?.from && resultado.period?.to && (
                <p className="text-xs text-gray-500">
                  Período: {resultado.period.from} a {resultado.period.to}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <StatPill label="Lançamentos" value={resultado.stats?.lancamentos ?? 0} primary />
                <StatPill label="Categorias" value={resultado.stats?.categorias ?? 0} />
                <StatPill label="Centros de custo" value={resultado.stats?.centros_custo ?? 0} />
                <StatPill label="Pessoas" value={resultado.stats?.pessoas ?? 0} />
                <StatPill label="Contas financeiras" value={resultado.stats?.contas_financeiras ?? 0} />
                <StatPill
                  label="Erros"
                  value={resultado.stats?.erros ?? 0}
                  tone={resultado.stats?.erros ? 'danger' : 'normal'}
                />
              </div>

              <p className="text-xs text-gray-500 text-right">
                Duração: {resultado.duration_seconds ?? '?'}s
              </p>
            </div>
          ) : (
            <div className="py-3 text-sm text-red-700 dark:text-red-400">
              {resultado?.error || 'Erro desconhecido'}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatPill({
  label,
  value,
  primary,
  tone = 'normal',
}: {
  label: string;
  value: number;
  primary?: boolean;
  tone?: 'normal' | 'danger';
}) {
  return (
    <div
      className={`rounded-lg p-2 border ${
        primary
          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
          : tone === 'danger' && value > 0
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`text-lg font-bold ${
          primary
            ? 'text-blue-700 dark:text-blue-300'
            : tone === 'danger' && value > 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-white'
        }`}
      >
        {value.toLocaleString('pt-BR')}
      </p>
    </div>
  );
}
