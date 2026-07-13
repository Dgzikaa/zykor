import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { WikiMarkdown } from '@/components/wiki/WikiMarkdown';
import { WikiToc } from '@/components/wiki/WikiToc';
import { WikiTitle } from '@/components/wiki/WikiTitle';
import { getArticleByPath, getAllPaths, WIKI_AREA_BY_SLUG } from '@/lib/wiki';

export function generateStaticParams() {
  return getAllPaths().map((p) => ({ slug: p.split('/') }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const article = getArticleByPath(slug.join('/'));
  return { title: article ? `${article.title} · Wiki do Zykor` : 'Wiki do Zykor' };
}

/** Renderiza um artigo: breadcrumb + link pra tela real + corpo markdown + TOC. */
export default async function WikiArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.map(decodeURIComponent).join('/');
  const article = getArticleByPath(path);
  if (!article) notFound();

  const area = WIKI_AREA_BY_SLUG[article.area];

  return (
    <div className="flex gap-8">
      <article className="flex-1 min-w-0">
        <WikiTitle title={`📖 ${article.title}`} />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 flex-wrap">
          <Link href="/wiki" className="hover:text-foreground">Wiki</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>{area?.label || article.area}</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground">{article.title}</span>
        </nav>

        {article.description && (
          <p className="text-muted-foreground mb-3">{article.description}</p>
        )}

        {/* Atalho pra abrir a tela documentada */}
        {article.route && (
          <Link
            href={article.route}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))] hover:underline mb-6"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir esta tela no sistema
          </Link>
        )}

        <WikiMarkdown body={article.body} />

        {/* Rodapé: voltar ao índice */}
        <div className="mt-12 pt-5 border-t border-[hsl(var(--border))]">
          <Link href="/wiki" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar ao índice da wiki
          </Link>
        </div>
      </article>

      <WikiToc headings={article.headings} />
    </div>
  );
}
