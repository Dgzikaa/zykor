'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, CornerDownLeft, Loader2 } from 'lucide-react';
// IMPORTANTE: importar de '@/lib/wiki/areas', NÃO de '@/lib/wiki'. O index re-exporta o
// `generated.ts` (1,2 MB com o texto de todos os artigos) e qualquer import dele aqui, num
// client component, joga o corpus inteiro no bundle do navegador.
import { WIKI_AREA_BY_SLUG } from '@/lib/wiki/areas';

type Hit = { path: string; title: string; area: string; snippet: string };

/**
 * Busca da wiki: digita → chama /api/wiki/busca (a busca roda no servidor) → Enter ou clique
 * abre o artigo. Setas ↑↓ navegam os resultados.
 *
 * A busca era client-side e por isso arrastava todo o conteúdo da wiki pro bundle. Agora só
 * os resultados trafegam. O debounce evita uma requisição por tecla.
 */
export function WikiSearch({ focarAoMontar = false }: { focarAoMontar?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setAtivo(0); }, [q]);

  // Busca no servidor, com debounce. O AbortController descarta resposta de uma digitação
  // antiga que chegue depois da nova (senão a lista "pisca" com resultado velho).
  useEffect(() => {
    const termo = q.trim();
    if (!termo) { setHits([]); setBuscando(false); return; }

    const ctrl = new AbortController();
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/wiki/busca?q=${encodeURIComponent(termo)}&limit=12`, {
          signal: ctrl.signal,
          credentials: 'include',
        });
        const j = await r.json();
        setHits(r.ok && j?.success ? (j.hits ?? []) : []);
      } catch {
        // abort é o caso normal aqui (usuário continuou digitando); erro real também
        // não deve quebrar a barra de busca — só fica sem resultado.
      } finally {
        setBuscando(false);
      }
    }, 180);

    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  // Foco programático (evita o atributo autoFocus, barrado pelo lint do build).
  useEffect(() => { if (focarAoMontar) inputRef.current?.focus(); }, [focarAoMontar]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const ir = (path: string) => {
    router.push(`/wiki/${path}`);
    setAberto(false);
    setQ('');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!hits.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); ir(hits[ativo].path); }
    else if (e.key === 'Escape') { setAberto(false); }
  };

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onKeyDown={onKey}
          placeholder="Buscar na wiki..."
          className="w-full h-9 pl-8 pr-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
          aria-label="Buscar na wiki"
        />
        {q && (
          <button
            onClick={() => { setQ(''); setAberto(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {aberto && q.trim() && (
        <div className="absolute z-50 mt-1.5 w-full max-h-[60vh] overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg py-1">
          {buscando && hits.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…
            </div>
          ) : hits.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Nada encontrado para “{q}”.
            </div>
          ) : (
            hits.map((h, i) => (
              <button
                key={h.path}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => ir(h.path)}
                className={`w-full flex items-start gap-2 px-3 py-2 text-left ${i === ativo ? 'bg-[hsl(var(--muted))]' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{h.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] text-muted-foreground shrink-0">
                      {WIKI_AREA_BY_SLUG[h.area]?.label || h.area}
                    </span>
                  </div>
                  {h.snippet && <div className="text-xs text-muted-foreground truncate mt-0.5">{h.snippet}</div>}
                </div>
                {i === ativo && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
