'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { CheckCircle2, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

interface CAStatus {
  connected: boolean;
  has_credentials: boolean;
  needs_refresh: boolean;
  expires_at: string | null;
  stats: {
    lancamentos: number;
    categorias: number;
    centros_custo: number;
    pessoas: number;
    contas_financeiras: number;
  };
  last_sync: { data: string; status: string; registros: number } | null;
}

export interface AgendamentoStatusCAProps {
  barId: number | null;
  onSyncComplete?: () => void;
}

export function AgendamentoStatusCA({ barId, onSyncComplete }: AgendamentoStatusCAProps) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<CAStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<'pessoas' | 'categorias' | 'centros' | null>(null);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/financeiro/contaazul/status?bar_id=${barId}`);
      if (r.ok) {
        const data = await r.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Erro status CA:', e);
    } finally {
      setLoading(false);
    }
  }, [barId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const sincronizar = async (tipo: 'pessoas' | 'categorias' | 'centros') => {
    if (!barId) return;
    setSyncing(tipo);
    try {
      const path =
        tipo === 'pessoas'
          ? `/api/financeiro/contaazul/stakeholders?bar_id=${barId}&sync=true`
          : tipo === 'categorias'
            ? `/api/financeiro/contaazul/categorias?bar_id=${barId}&sync=true`
            : `/api/financeiro/contaazul/centros-custo?bar_id=${barId}&sync=true`;

      const r = await fetch(path);
      const data = await r.json();
      if (r.ok) {
        showToast({
          type: 'success',
          title: `Sync ${tipo} concluída`,
          message: `${data.total ?? '?'} registros sincronizados`,
        });
        await carregar();
        onSyncComplete?.();
      } else {
        showToast({
          type: 'error',
          title: `Erro sync ${tipo}`,
          message: data?.error || 'Falha desconhecida',
        });
      }
    } catch (e: any) {
      showToast({
        type: 'error',
        title: `Erro sync ${tipo}`,
        message: e?.message || 'Falha de rede',
      });
    } finally {
      setSyncing(null);
    }
  };

  if (!barId) return null;
  if (loading && !status) {
    return (
      <div className="mb-4 p-3 rounded-lg border border-border bg-muted/40 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Verificando Conta Azul...
      </div>
    );
  }
  if (!status) return null;

  const expirado =
    status.expires_at && new Date(status.expires_at) < new Date();
  const ok = status.connected && status.has_credentials && !expirado;
  const stats = status.stats;

  return (
    <div
      className={`mb-4 p-3 rounded-lg border ${
        ok
          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30'
          : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          {ok ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          )}
          <div className="text-sm">
            <div
              className={`font-semibold ${
                ok
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              Conta Azul: {ok ? 'conectado' : expirado ? 'token expirado' : 'desconectado'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.pessoas} fornecedores · {stats.categorias} categorias ·{' '}
              {stats.centros_custo} centros · {stats.contas_financeiras} contas
              {status.last_sync && (
                <>
                  {' '}
                  · última sync:{' '}
                  {new Date(status.last_sync.data).toLocaleString('pt-BR')}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => sincronizar('pessoas')}
            disabled={!ok || syncing !== null}
            className="h-7 text-xs"
          >
            {syncing === 'pessoas' ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Sync fornecedores
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sincronizar('categorias')}
            disabled={!ok || syncing !== null}
            className="h-7 text-xs"
          >
            {syncing === 'categorias' ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Sync categorias
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sincronizar('centros')}
            disabled={!ok || syncing !== null}
            className="h-7 text-xs"
          >
            {syncing === 'centros' ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Sync centros
          </Button>
        </div>
      </div>
    </div>
  );
}
