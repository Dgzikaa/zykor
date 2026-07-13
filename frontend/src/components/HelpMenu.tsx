'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { HelpCircle, LifeBuoy, BookOpen } from 'lucide-react';

/**
 * Menu de ajuda no header (ícone "?"). Abre um dropdown com duas opções:
 *  - Abrir chamado → /chamados (Central de Chamados)
 *  - Wiki          → /wiki (documentação do sistema)
 * O badge (novidade nos chamados do usuário) fica no gatilho, como antes.
 */
export function HelpMenu() {
  const router = useRouter();
  const [naoLidos, setNaoLidos] = useState(0);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/api/chamados?resumo=1');
      if (r?.success) setNaoLidos(Number(r.data?.nao_lidos) || 0);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60_000);
    const onFocus = () => carregar();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [carregar]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const ir = (href: string) => { setAberto(false); router.push(href); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="relative rounded-[4px] hover:text-gray-500 text-gray-500 h-8 p-2 flex items-center justify-center"
        aria-label="Ajuda"
        aria-haspopup="menu"
        aria-expanded={aberto}
        title="Ajuda"
      >
        <HelpCircle className="h-4 w-4" />
        {naoLidos > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-900 tabular-nums"
            aria-label={`${naoLidos} chamados com novidade`}
          >
            {naoLidos > 99 ? '99+' : naoLidos}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-lg py-1 z-50"
        >
          <button
            role="menuitem"
            onClick={() => ir('/chamados')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
          >
            <LifeBuoy className="w-4 h-4 shrink-0" />
            <span className="flex-1">Abrir chamado</span>
            {naoLidos > 0 && (
              <span className="text-[11px] font-bold text-red-500 tabular-nums">{naoLidos > 99 ? '99+' : naoLidos}</span>
            )}
          </button>
          <button
            role="menuitem"
            onClick={() => ir('/wiki')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="flex-1">Wiki</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default HelpMenu;
