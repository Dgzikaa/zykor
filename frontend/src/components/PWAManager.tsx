'use client'

import { useEffect } from 'react'

// Antes este componente registrava SWs (sw-zykor.js) com estrategia cache-first
// que segurava dados antigos por dias. Projeto nao usa PWA real, entao agora
// ele apenas garante que qualquer SW antigo seja desregistrado e os caches
// limpos pro-ativamente. Defesa em profundidade junto com sw-zykor.js
// (self-destruct) — se browser servir SW antigo do disco antes de re-checar,
// este codigo client-side limpa mesmo assim.
export function PWAManager() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {})
    }

    if ('caches' in window) {
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {})
    }
  }, [])

  return null
}
