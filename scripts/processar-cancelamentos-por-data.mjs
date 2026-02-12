/**
 * Processar cancelamentos pendentes por data (bar 3)
 * Chama contahub-processor para cada data com data_types: ['cancelamentos']
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

const datas = [
  '2025-12-14','2025-12-15','2025-12-16','2025-12-17','2025-12-18','2025-12-19','2025-12-20','2025-12-21','2025-12-22','2025-12-23','2025-12-24','2025-12-25','2025-12-26','2025-12-27','2025-12-28','2025-12-29','2025-12-30','2025-12-31',
  '2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-01-09','2026-01-10','2026-01-11','2026-01-12','2026-01-13','2026-01-14','2026-01-15','2026-01-16','2026-01-17','2026-01-18','2026-01-19','2026-01-20','2026-01-21','2026-01-22','2026-01-23','2026-01-24','2026-01-25','2026-01-26','2026-01-27','2026-01-28','2026-01-29','2026-01-30','2026-01-31',
  '2026-02-01','2026-02-02','2026-02-03','2026-02-04','2026-02-05','2026-02-06','2026-02-07','2026-02-08','2026-02-09','2026-02-10','2026-02-11','2026-02-12'
];

async function processDate(d) {
  const res = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-processor', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data_date: d, bar_id: 3, data_types: ['cancelamentos'] })
  });
  return res.json();
}

let ok = 0, err = 0;
for (let i = 0; i < datas.length; i++) {
  const d = datas[i];
  const r = await processDate(d);
  if (r.success) ok++; else err++;
  if ((i + 1) % 10 === 0) console.log(`[${i + 1}/${datas.length}] Processadas...`);
  await new Promise(x => setTimeout(x, 300));
}
console.log(`\n✅ Cancelamentos processados: ${ok} ok, ${err} erros`);
