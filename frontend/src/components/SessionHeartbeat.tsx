'use client';

import { useEffect, useRef } from 'react';

/**
 * Pulso de sessão (auditoria de acessos). Enquanto o usuário está logado, manda ao servidor
 * a cada ~1min se ele está ATIVO (navegando de verdade — mouse/teclado/scroll/aba visível) ou
 * só com a página aberta parada. O servidor (via cookie httpOnly zk_sid) acumula o tempo ativo
 * e o last_seen, separando "logado" de "realmente usando". Silencioso: nada aparece pro usuário.
 */
export function SessionHeartbeat() {
  const ultimaAtividade = useRef(Date.now());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const logado = () => document.cookie.includes('sgb_user=');
    const marcar = () => { ultimaAtividade.current = Date.now(); };
    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    eventos.forEach(e => window.addEventListener(e, marcar, { passive: true }));
    const onVis = () => { if (document.visibilityState === 'visible') marcar(); };
    document.addEventListener('visibilitychange', onVis);

    const bater = () => {
      if (!logado()) return; // não bate quando deslogado
      const ativo = document.visibilityState === 'visible' && (Date.now() - ultimaAtividade.current) < 90_000;
      // bar selecionado na aba (sessionStorage é a verdade da aba; ver BarContext)
      let bar: number | null = null;
      try { bar = Number(sessionStorage.getItem('sgb_selected_bar_id')) || null; } catch { /* ignore */ }
      fetch('/api/sessions/heartbeat', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // manda a tela atual (pathname) + o bar p/ acumular tempo-por-tela/bar na auditoria
        body: JSON.stringify({ active: ativo, path: window.location?.pathname || null, bar }),
        keepalive: true,
      }).catch(() => { /* silencioso */ });
    };

    bater(); // pulso inicial
    const id = setInterval(bater, 60_000);
    return () => {
      clearInterval(id);
      eventos.forEach(e => window.removeEventListener(e, marcar));
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return null;
}
