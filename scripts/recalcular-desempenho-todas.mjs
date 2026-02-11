/**
 * Recalcular todas as semanas de desempenho (via Edge Function).
 * Uso: node scripts/recalcular-desempenho-todas.mjs
 * Lê frontend/.env.local para NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', 'frontend', '.env.local');

if (!existsSync(envPath)) {
  console.error('❌ frontend/.env.local não encontrado');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const eq = l.indexOf('=');
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios em frontend/.env.local');
  process.exit(1);
}

const fnUrl = `${url}/functions/v1/desempenho-semanal-auto`;
console.log('🔄 Invocando recálculo completo de desempenho...');

const res = await fetch(fnUrl, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ recalcular_todas: true, limit_semanas: 10 }),
});

const data = await res.json();

if (res.ok) {
  console.log('✅ Sucesso');
  console.log(`   Recalculadas: ${data.recalculadas ?? 0} semanas`);
  if (data.erros > 0) console.log(`   Erros: ${data.erros}`);
} else {
  console.error('❌ Erro:', data);
  process.exit(1);
}
