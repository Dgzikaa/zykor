/**
 * Processar raw_data de cancelamentos pendentes via contahub-processor
 */
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

async function processAll() {
  const res = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-processor', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ process_all: true })
  });
  const j = await res.json();
  console.log('Processor result:', JSON.stringify(j, null, 2));
  return j;
}

// Rodar 2x para pegar os 61 (processor limita 50 por chamada)
const r1 = await processAll();
const r2 = await processAll();
console.log('\n✅ Concluído. Rodar desempenho-semanal-auto para atualizar as semanas.');
