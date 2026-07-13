import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { iconFor } from '@/lib/navigation/menu-icons';
import { WikiSearch } from '@/components/wiki/WikiSearch';
import { getArticlesByArea, getArticles } from '@/lib/wiki';

export const metadata = { title: 'Wiki do Zykor' };

/** Índice geral da wiki: hero com busca + cards por área com seus artigos. */
export default function WikiIndexPage() {
  const grupos = getArticlesByArea();
  const total = getArticles().length;

  return (
    <div className="max-w-5xl">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <BookOpen className="w-4 h-4" />
          Central de conhecimento
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Wiki do Zykor</h1>
        <p className="text-muted-foreground max-w-2xl">
          Documentação completa do sistema, tela por tela: o que cada página faz, como cada
          número é calculado e o passo a passo de cada tarefa. {total} artigo(s) publicado(s).
        </p>
        <div className="mt-4 max-w-xl">
          <WikiSearch focarAoMontar />
        </div>
      </div>

      {/* Áreas */}
      <div className="grid gap-5 sm:grid-cols-2">
        {grupos.map(({ area, artigos }) => {
          const Icon = iconFor(area.icon);
          return (
            <div key={area.slug} className="rounded-xl border border-[hsl(var(--border))] bg-card p-5">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]">
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <h2 className="text-lg font-bold">{area.label}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{area.descricao}</p>
              <ul className="space-y-1">
                {artigos.slice(0, 8).map((a) => (
                  <li key={a.path}>
                    <Link
                      href={`/wiki/${a.path}`}
                      className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
                    >
                      <span className="truncate">{a.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
                    </Link>
                  </li>
                ))}
                {artigos.length > 8 && (
                  <li className="px-2 pt-1 text-xs text-muted-foreground">+ {artigos.length - 8} artigo(s)</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {grupos.length === 0 && (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-10 text-center text-muted-foreground">
          Nenhum artigo publicado ainda.
        </div>
      )}
    </div>
  );
}
