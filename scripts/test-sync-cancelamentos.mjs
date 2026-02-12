/**
 * Teste sync retroativo cancelamentos (10 dias)
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

const res = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-retroativo', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bar_id: 3,
    start_date: '2026-02-01',
    end_date: '2026-02-10',
    data_types: ['cancelamentos'],
    delay_ms: 1000,
    process_after: true
  })
});
const text = await res.text();
console.log('Status:', res.status, '| Length:', text.length);
try {
  const j = JSON.parse(text);
  console.log('Success:', j.success);
  if (j.summary) console.log('Summary:', JSON.stringify(j.summary, null, 2));
  if (j.error) console.log('Error:', j.error);
} catch {
  console.log('Raw:', text.slice(0, 800));
}
