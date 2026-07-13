/**
 * Helpers de dados da Wiki. Consome o módulo gerado (generated.ts) — dados puros,
 * seguros no cliente e no servidor. Sem acesso a disco em runtime.
 */
import { WIKI_ARTICLES, type WikiArticle } from './generated';
import { WIKI_AREAS, WIKI_AREA_BY_SLUG, type WikiArea } from './areas';

export type { WikiArticle, WikiArea };
export { WIKI_AREAS, WIKI_AREA_BY_SLUG };

export function getArticles(): WikiArticle[] {
  return WIKI_ARTICLES;
}

export function getArticleByPath(path: string): WikiArticle | undefined {
  const norm = path.replace(/^\/+|\/+$/g, '');
  return WIKI_ARTICLES.find((a) => a.path === norm);
}

/** Artigos agrupados por área, na ordem de WIKI_AREAS. Só áreas que têm artigo. */
export function getArticlesByArea(): Array<{ area: WikiArea; artigos: WikiArticle[] }> {
  return WIKI_AREAS.map((area) => ({
    area,
    artigos: WIKI_ARTICLES.filter((a) => a.area === area.slug),
  })).filter((g) => g.artigos.length > 0);
}

/** Todos os `path` (pra generateStaticParams do catch-all). */
export function getAllPaths(): string[] {
  return WIKI_ARTICLES.map((a) => a.path);
}

export interface WikiSearchHit {
  article: WikiArticle;
  score: number;
  /** Trecho com a ocorrência, pra exibir no resultado. */
  snippet: string;
}

/**
 * Busca simples e determinística (sem dep). Pontua por casamento em título (peso alto),
 * área/descrição, headings e corpo. Suporta múltiplos termos (AND flexível).
 */
export function searchWiki(query: string, limit = 20): WikiSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const termos = q.split(/\s+/).filter(Boolean);
  const hits: WikiSearchHit[] = [];

  for (const article of WIKI_ARTICLES) {
    const areaLabel = (WIKI_AREA_BY_SLUG[article.area]?.label || '').toLowerCase();
    const title = article.title.toLowerCase();
    const desc = article.description.toLowerCase();
    const headings = article.headings.map((h) => h.text.toLowerCase()).join(' · ');
    const excerpt = article.excerpt.toLowerCase();
    const route = article.route.toLowerCase();

    let score = 0;
    let matchedAll = true;
    for (const t of termos) {
      let termScore = 0;
      if (title.includes(t)) termScore += 10;
      if (title.startsWith(t)) termScore += 5;
      if (areaLabel.includes(t)) termScore += 3;
      if (desc.includes(t)) termScore += 3;
      if (headings.includes(t)) termScore += 4;
      if (route.includes(t)) termScore += 2;
      if (excerpt.includes(t)) termScore += 1;
      if (termScore === 0) matchedAll = false;
      score += termScore;
    }
    if (score === 0 || !matchedAll) continue;

    // Snippet: primeiro heading/descrição que casa, senão a descrição.
    let snippet = article.description;
    const hitHeading = article.headings.find((h) => termos.some((t) => h.text.toLowerCase().includes(t)));
    if (hitHeading) snippet = hitHeading.text;
    hits.push({ article, score, snippet });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
