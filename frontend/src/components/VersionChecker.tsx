'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Detecta nova versao do app comparando o SHA embutido no bundle com o SHA
 * retornado por /api/version. Quando diferentes, exibe banner com botao
 * "Atualizar agora" que faz reload.
 *
 * Antes dependia de Service Worker (sw-zykor.js). Como matamos os SWs em
 * 79330d41, a logica foi trocada por polling do endpoint.
 *
 * Frequencia: 5min de intervalo + check ao voltar pra aba.
 */

const BUILD_VERSION =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.version === 'string' ? json.version : null;
  } catch {
    return null;
  }
}

export function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (BUILD_VERSION === 'dev') return; // local dev: nao polla

    let cancelled = false;

    const check = async () => {
      const deployed = await fetchDeployedVersion();
      if (cancelled || !deployed) return;
      if (deployed !== BUILD_VERSION) {
        setUpdateAvailable(true);
      }
    };

    check();

    const interval = setInterval(check, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-blue-600 text-white rounded-lg shadow-xl p-4 flex items-start gap-3">
        <RefreshCw className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Nova versão disponível!</p>
          <p className="text-xs text-blue-100 mt-0.5">
            Clique em atualizar para obter as últimas melhorias.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleUpdate}
              className="bg-white text-blue-600 hover:bg-blue-50 text-xs h-7 px-3"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Atualizar agora
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="text-blue-100 hover:text-white hover:bg-blue-500 text-xs h-7 px-2"
            >
              Depois
            </Button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-200 hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
