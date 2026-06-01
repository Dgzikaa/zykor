/**
 * Trava anti-regressão da FONTE ÚNICA do menu (lib/navigation/menu.ts).
 *
 * Garante que todo item visível do menu aponta para uma rota que EXISTE em src/app.
 * Falha o build se alguém adicionar um link morto ou apagar a página de um item.
 *
 * Contexto: já houve bug (2026-06-01) de item de menu que nunca aparecia (estava na
 * sidebar errada) e de itens apontando pra páginas inexistentes. Agora sidebar e
 * permissões saem desta fonte única.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MENU_TREE } from '../menu';

const APP_DIR = path.join(process.cwd(), 'src', 'app');

function routeExists(href: string): boolean {
  const clean = href.split('?')[0].split('#')[0];
  const base = path.join(APP_DIR, clean);
  return (
    fs.existsSync(path.join(base, 'page.tsx')) ||
    fs.existsSync(path.join(base, 'page.ts')) ||
    fs.existsSync(path.join(base, 'page.jsx'))
  );
}

const leaves = MENU_TREE.flatMap(section => section.subItems);

describe('MENU_TREE — fonte única do menu lateral', () => {
  it('tem um número razoável de itens', () => {
    expect(leaves.length).toBeGreaterThan(15);
  });

  it('não tem hrefs duplicados', () => {
    const hrefs = leaves.map(l => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each(leaves.map(l => [l.label, l.href] as const))(
    'item "%s" (%s) aponta para uma rota existente',
    (_label, href) => {
      expect(routeExists(href)).toBe(true);
    }
  );
});
