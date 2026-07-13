'use client';

import { useEffect, useState } from 'react';
import { slugifyHeading } from './WikiMarkdown';
import type { WikiHeading } from '@/lib/wiki/generated';

/** Índice "nesta página" (headings ## e ###) com destaque do trecho visível. */
export function WikiToc({ headings }: { headings: WikiHeading[] }) {
  const itens = headings.filter((h) => h.level === 2 || h.level === 3);
  const [ativo, setAtivo] = useState<string>('');

  useEffect(() => {
    if (!itens.length) return;
    const ids = itens.map((h) => slugifyHeading(h.text));
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visivel = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visivel[0]?.target?.id) setAtivo(visivel[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [itens]);

  if (itens.length < 2) return null;

  return (
    <aside className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-2">Nesta página</div>
        <ul className="space-y-0.5 border-l border-[hsl(var(--border))]">
          {itens.map((h) => {
            const id = slugifyHeading(h.text);
            const on = ativo === id;
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={`block py-1 text-sm transition -ml-px border-l-2 ${
                    h.level === 3 ? 'pl-5' : 'pl-3'
                  } ${
                    on
                      ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {h.text}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
