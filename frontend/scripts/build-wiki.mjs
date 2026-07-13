#!/usr/bin/env node
/**
 * Compila os artigos da Wiki (content/wiki/**\/*.md) num módulo TS estático
 * (src/lib/wiki/generated.ts). Motivo: o build usa Turbopack e roda na Vercel —
 * ler arquivo do disco em runtime é frágil (file tracing). Um import estático é
 * 100% confiável e ainda deixa a busca client-side trivial (os dados já vêm no JS).
 *
 * Fonte da verdade = os .md (versionados, fáceis de escrever/revisar).
 * generated.ts é DERIVADO — não edite à mão. Rode `npm run wiki:build` e COMMITE
 * o generated.ts junto. NÃO roda no build da Vercel de propósito: o .vercelignore
 * remove scripts/ e **/*.md do deploy, então o runtime usa o generated.ts commitado.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'content', 'wiki');
const OUT_FILE = join(ROOT, 'src', 'lib', 'wiki', 'generated.ts');

/** Varre recursivamente e devolve os caminhos .md. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Parser de frontmatter mínimo (key: value por linha). Arquivos controlados; sem YAML lib. */
function parseFrontmatter(raw) {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw);
  if (!m) return { meta: {}, body: raw.trim() };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-zA-Z_][\w-]*):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[kv[1]] = val;
  }
  return { meta, body: m[2].trim() };
}

/** Extrai headings (## e ###) do corpo p/ TOC e busca. Ignora blocos de código. */
function extractHeadings(body) {
  const heads = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^```/.test(line.trim())) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) heads.push({ level: h[1].length, text: h[2].replace(/[*_`]/g, '').trim() });
  }
  return heads;
}

/** Texto plano (sem markdown) p/ indexar na busca — enxuto. */
function plainExcerpt(body, max = 400) {
  const txt = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return txt.slice(0, max);
}

const files = walk(CONTENT_DIR);
const articles = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const relPath = relative(CONTENT_DIR, file).split(sep);
  const fileSlug = relPath[relPath.length - 1].replace(/\.md$/, '');
  const area = meta.area || relPath[0] || 'geral';
  const slug = meta.slug || fileSlug;
  const path = `${area}/${slug}`;
  articles.push({
    path,
    slug,
    area,
    title: meta.title || slug,
    description: meta.description || '',
    route: meta.route || '',
    order: Number(meta.order || 999),
    icon: meta.icon || '',
    headings: extractHeadings(body),
    excerpt: plainExcerpt(body),
    body,
  });
}

// Proteção: nunca sobrescreve o índice com vazio (ex.: se rodar onde os .md foram
// removidos). Sem .md achado, mantém o generated.ts commitado.
if (articles.length === 0) {
  console.warn('[wiki] nenhum .md encontrado em content/wiki — generated.ts NÃO foi alterado.');
  process.exit(0);
}

articles.sort((a, b) => (a.area).localeCompare(b.area) || a.order - b.order || a.title.localeCompare(b.title));

const header = `/* eslint-disable */
// ⚠️ ARQUIVO GERADO por scripts/build-wiki.mjs — NÃO EDITE À MÃO.
// Fonte: content/wiki/**/*.md. Rode \`npm run wiki:build\` pra regenerar.

export interface WikiHeading { level: number; text: string; }
export interface WikiArticle {
  path: string;
  slug: string;
  area: string;
  title: string;
  description: string;
  route: string;
  order: number;
  icon: string;
  headings: WikiHeading[];
  excerpt: string;
  body: string;
}

export const WIKI_ARTICLES: WikiArticle[] = `;

if (!existsSync(dirname(OUT_FILE))) mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, header + JSON.stringify(articles, null, 2) + ';\n', 'utf8');

console.log(`[wiki] ${articles.length} artigo(s) → ${relative(ROOT, OUT_FILE)}`);
