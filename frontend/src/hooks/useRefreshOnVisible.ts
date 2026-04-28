'use client';

import { useEffect, useRef } from 'react';

type Options = {
  /**
   * Intervalo minimo entre refreshes (ms). Evita spam quando usuario fica
   * trocando de aba toda hora. Default: 30s.
   */
  minIntervalMs?: number;
  /**
   * Se false, o hook fica inerte. Util pra desabilitar via feature flag
   * ou quando o componente nao quer refresh automatico em alguns estados.
   */
  enabled?: boolean;
};

/**
 * Roda `callback` quando a aba volta a ficar visivel (visibilitychange =>
 * 'visible'), respeitando um intervalo minimo desde o ultimo refresh.
 *
 * Caso de uso: paginas de dashboard que devem trazer dado fresh quando o
 * usuario volta da reuniao / volta de outra aba. Sem precisar F5.
 *
 * @example
 *   useRefreshOnVisible(() => fetchDados());
 *   useRefreshOnVisible(fetchDados, { minIntervalMs: 60_000 });
 */
export function useRefreshOnVisible(
  callback: () => void | Promise<void>,
  options: Options = {}
) {
  const { minIntervalMs = 30_000, enabled = true } = options;

  // Mantem ref atualizada pra callback nao virar dep do useEffect
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const lastRunRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    const handler = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) return;
      lastRunRef.current = now;
      try {
        const ret = callbackRef.current();
        if (ret && typeof (ret as Promise<unknown>).catch === 'function') {
          (ret as Promise<unknown>).catch(() => {});
        }
      } catch {
        /* swallow */
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
    };
  }, [minIntervalMs, enabled]);
}
