'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import './wiki.css';

/** Gera um id-âncora estável a partir do texto do heading (pra TOC e deep-link). */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function headingText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(headingText).join('');
  if (children && typeof children === 'object' && 'props' in (children as any)) {
    return headingText((children as any).props?.children);
  }
  return '';
}

/**
 * Renderiza o corpo markdown de um artigo da wiki. GFM (tabelas!) ligado.
 * Headings ganham id-âncora; links internos (/wiki/...) usam next/link.
 */
export function WikiMarkdown({ body }: { body: string }) {
  return (
    <div className="wiki-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <h2 id={slugifyHeading(headingText(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={slugifyHeading(headingText(children))}>{children}</h3>,
          a: ({ href, children }) => {
            const url = href || '';
            if (url.startsWith('/')) return <Link href={url}>{children}</Link>;
            return <a href={url} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          table: ({ children }) => (
            <div className="wiki-table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
