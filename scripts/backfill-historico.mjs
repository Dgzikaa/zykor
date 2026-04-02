// Backfill: recoletar todos os dados historicos do ContaHub
// Periodo: 2024-08-01 ate 2025-12-21 (dados de 2025-12-22+ ja existem)
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';
const BASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico';

async function syncDay(barId, date) {
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ bar_id: barId, data_date: date, automated: true, source: 'backfill-historico' })
    });
    return res.ok;
  } catch (e) {
    console.error(`  ERRO ${barId}/${date}:`, e.message);
    return false;
  }
}

async function run() {
  const startDate = new Date('2024-08-01');
  const endDate = new Date('2025-12-21');
  let current = new Date(startDate);
  let totalDays = 0;
  let ok = 0;
  let fail = 0;

  console.log(`Backfill: ${startDate.toISOString().split('T')[0]} -> ${endDate.toISOString().split('T')[0]}`);
  console.log('Bares: 3 (Ordinario) e 4 (Deboche)\n');

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];

    const r3 = await syncDay(3, dateStr);
    await new Promise(r => setTimeout(r, 300));
    const r4 = await syncDay(4, dateStr);

    totalDays++;
    if (r3 && r4) ok++; else fail++;

    if (totalDays % 15 === 0 || totalDays === 1) {
      console.log(`[${dateStr}] Dia ${totalDays} — OK: ${ok} Falhas: ${fail}`);
    }

    await new Promise(r => setTimeout(r, 700));
    current.setDate(current.getDate() + 1);
  }

  console.log(`\nFinalizado! ${totalDays} dias processados. OK: ${ok} Falhas: ${fail}`);
}

run();
