#!/usr/bin/env node
/**
 * R3 — Guard de schema-drift (CI).
 *
 * Roda public.lint_db_functions() (plpgsql_check em todas as funções plpgsql) e
 * FALHA (exit 1) se alguma função referencia tabela/coluna/função inexistente.
 * Pega na CI o tipo de bug que derrubou o /estrategico/desempenho por meses
 * (calculate_evento_metrics -> yuzer.valor_pago, etc.).
 *
 * Uso:
 *   DATABASE_URL=postgres://... node scripts/lint-db-functions.mjs
 *   # opcional: BASELINE=scripts/.db-lint-baseline.json para tolerar o backlog conhecido
 *   #           e falhar APENAS em regressões novas (recomendado até zerar o backlog).
 *
 * Requer: npm i pg
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Defina DATABASE_URL (connection string do Postgres).');
  process.exit(2);
}

const key = (r) => `${r.funcao} :: ${r.message}`;

let baseline = new Set();
if (process.env.BASELINE) {
  try {
    baseline = new Set(JSON.parse(readFileSync(process.env.BASELINE, 'utf8')));
  } catch {
    console.warn(`⚠️  Baseline ${process.env.BASELINE} não lido — checando tudo.`);
  }
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
const { rows } = await client.query('SELECT funcao, lineno, message FROM public.lint_db_functions() ORDER BY funcao, lineno');
await client.end();

const novos = rows.filter((r) => !baseline.has(key(r)));

if (rows.length === 0) {
  console.log('✅ Nenhuma função plpgsql quebrada.');
  process.exit(0);
}

console.log(`\n⚠️  ${rows.length} erro(s) de função no banco (${novos.length} fora do baseline):\n`);
for (const r of rows) {
  const flag = baseline.has(key(r)) ? '   ' : '🆕 ';
  console.log(`${flag}${r.funcao}  L${r.lineno ?? '?'}  →  ${r.message}`);
}

if (novos.length > 0) {
  console.error(`\n❌ ${novos.length} função(ões) quebrada(s) NOVA(S) — corrija antes do deploy.`);
  process.exit(1);
}
console.log('\n✅ Sem regressões novas (backlog conhecido tolerado pelo baseline).');
process.exit(0);
