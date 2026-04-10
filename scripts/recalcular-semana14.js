// Script para recalcular desempenho da semana 14
const fetch = require('node-fetch');

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0";
const URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/recalcular-desempenho-v2";

async function recalcular() {
  console.log('🔄 Recalculando desempenho da semana 14/2026...\n');
  
  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        bar_id: 3,
        ano: 2026,
        numero_semana: 14,
        mode: 'write'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Recálculo concluído!\n');
      console.log(JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.error('❌ Erro:', error);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

recalcular();
