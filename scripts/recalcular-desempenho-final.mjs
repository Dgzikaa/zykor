import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
const c = fs.readFileSync(envPath, 'utf8');
for (const l of c.split('\n')) {
  const m = l.trim().match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/desempenho-semanal-auto', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ recalcular_todas: true, limit_semanas: 20 })
});
const j = await res.json();
console.log('Recálculo:', j.recalculadas || 0, 'semanas | Erros:', j.erros || 0);
if (j.error) console.log('Erro:', j.error);
