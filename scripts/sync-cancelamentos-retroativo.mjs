/**
 * Sync retroativo de cancelamentos + tempo, depois recalcular desempenho
 * node scripts/sync-cancelamentos-retroativo.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.trim().match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();

const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada em frontend/.env.local');
  process.exit(1);
}

async function invoke(name, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, data: json };
}

async function main() {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 45); // 45 dias
  const startDate = inicio.toISOString().slice(0, 10);

  console.log('📥 1. Sync retroativo (cancelamentos + tempo)...');
  console.log(`   Período: ${startDate} até ${hoje}`);
  const r1 = await invoke('contahub-sync-retroativo', {
    bar_id: 3,
    start_date: startDate,
    end_date: hoje,
    data_types: ['cancelamentos', 'tempo'],
    delay_ms: 1500,
    process_after: true
  });
  console.log(r1.ok ? '   ✅ Sync concluído' : `   ❌ Erro: ${JSON.stringify(r1.data).slice(0, 200)}`);

  console.log('\n🔄 2. Recalculando desempenho semanal...');
  const r2 = await invoke('desempenho-semanal-auto', {
    recalcular_todas: true,
    limit_semanas: 16
  });
  console.log(r2.ok ? `   ✅ ${r2.data.recalculadas ?? 0} semanas recalculadas` : `   ❌ Erro: ${JSON.stringify(r2.data).slice(0, 200)}`);

  console.log('\n✅ Concluído.');
}

main().catch(console.error);
