'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { iconFor } from '@/lib/navigation/menu-icons';
import { WikiSearch } from './WikiSearch';
import type { WikiArea, WikiArticle } from '@/lib/wiki';

interface Grupo { area: WikiArea; artigos: Pick<WikiArticle, 'path' | 'title'>[] }

/**
 * Barra lateral da wiki: busca no topo + índice por área. Marca o artigo atual.
 * No mobile vira um botão que abre/fecha o índice.
 */
export function WikiSidebar({ grupos }: { grupos: Grupo[] }) {
  const pathname = usePathname();
  const [abertoMobile, setAbertoMobile] = useState(false);
  const atual = decodeURIComponent(pathname.replace(/^\/wiki\/?/, ''));

  const nav = (
    <nav className="space-y-5">
      {grupos.map(({ area, artigos }) => {
        const Icon = iconFor(area.icon);
        return (
          <div key={area.slug}>
            <div className="flex items-center gap-2 px-2 mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Icon className="w-3.5 h-3.5" />
              {area.label}
            </div>
            <ul className="space-y-0.5">
              {artigos.map((a) => {
                const ativo = atual === a.path;
                return (
                  <li key={a.path}>
                    <Link
                      href={`/wiki/${a.path}`}
                      onClick={() => setAbertoMobile(false)}
                      className={`block rounded-md px-2 py-1.5 text-sm transition ${
                        ativo
                          ? 'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))] font-medium'
                          : 'text-foreground/80 hover:bg-[hsl(var(--muted))] hover:text-foreground'
                      }`}
                    >
                      {a.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile: botão de índice */}
      <div className="lg:hidden mb-3">
        <button
          onClick={() => setAbertoMobile((v) => !v)}
          className="flex items-center gap-2 h-9 px-3 rounded-md border border-[hsl(var(--border))] text-sm"
        >
          {abertoMobile ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          Índice da wiki
        </button>
        {abertoMobile && (
          <div className="mt-3 space-y-3">
            <WikiSearch />
            {nav}
          </div>
        )}
      </div>

      {/* Desktop: sidebar fixa */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-4 space-y-4">
          <WikiSearch />
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 pb-6">{nav}</div>
        </div>
      </aside>
    </>
  );
}
