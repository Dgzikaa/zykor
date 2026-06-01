/**
 * Trava anti-regressão da sidebar ÚNICA (MinimalSidebar).
 *
 * Contexto: já houve bug (2026-06-01) de item adicionado na sidebar errada
 * (ModernSidebarOptimized, que nem era renderizada) — o item nunca apareceu.
 * Agora a MinimalSidebar é a única. Este teste garante que todo item visível
 * do menu aponta para uma rota que EXISTE em src/app, falhando o build se
 * alguém adicionar um link morto ou apagar a página de um item do menu.
 *
 * Lê o arquivo como texto de propósito (sem importar o componente client),
 * pra não acoplar a infra de teste a React/next/navigation.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Resolve a partir da raiz do projeto (frontend/), onde o vitest roda — robusto a ESM/CJS.
const SIDEBAR_PATH = path.join(process.cwd(), 'src', 'components', 'layouts', 'MinimalSidebar.tsx');
const APP_DIR = path.join(process.cwd(), 'src', 'app');

// Hrefs de seção (pais com subItems) — não têm página própria obrigatória.
const SECTION_PARENTS = new Set([
  '/estrategico',
  '/analitico',
  '/ferramentas',
  '/extras',
  '/configuracoes',
]);

function extractHrefs(source: string): string[] {
  const hrefs = new Set<string>();
  const re = /href:\s*'(\/[^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    hrefs.add(m[1]);
  }
  return Array.from(hrefs);
}

function routeExists(href: string): boolean {
  const clean = href.split('?')[0].split('#')[0];
  const base = path.join(APP_DIR, clean);
  return (
    fs.existsSync(path.join(base, 'page.tsx')) ||
    fs.existsSync(path.join(base, 'page.ts')) ||
    fs.existsSync(path.join(base, 'page.jsx'))
  );
}

describe('MinimalSidebar — sidebar única renderizada', () => {
  const source = fs.readFileSync(SIDEBAR_PATH, 'utf8');
  const hrefs = extractHrefs(source);
  const leafHrefs = hrefs.filter(h => !SECTION_PARENTS.has(h));

  it('extrai um número razoável de itens de menu', () => {
    expect(leafHrefs.length).toBeGreaterThan(15);
  });

  it.each(leafHrefs)('item do menu "%s" aponta para uma rota existente', (href) => {
    expect(routeExists(href)).toBe(true);
  });
});
