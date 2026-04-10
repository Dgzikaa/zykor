// Script para recalcular métricas dos dias 08 e 09/04/2026
const fetch = require('node-fetch');

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0";
const URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/calculate-evento-metrics";

async function recalcular() {
  const dias = ['2026-04-08', '2026-04-09'];
  
  for (const dia of dias) {
    console.log(`Recalculando métricas para ${dia}...`);
    
    try {
      const response = await fetch(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({
          bar_id: 3,
          data_evento: dia
        })
      });
      
      const result = await response.json();
      console.log(`✅ ${dia}:`, JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`❌ Erro em ${dia}:`, error.message);
    }
  }
}

recalcular();
