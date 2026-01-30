const fs = require('fs');
const path = require('path');

// Carregar .env.local
const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const lines = envFile.split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > 0) {
    const key = trimmed.substring(0, idx);
    let value = trimmed.substring(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada!');
  process.exit(1);
}

async function sync() {
  const url = 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico';
  
  console.log('🔄 Sincronizando 2026-01-28 bar_id=3 (Ordinário)...');
  console.log('');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bar_id: 3,
      data_date: '2026-01-28'
    })
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('✅ Sincronização concluída!');
    console.log('');
    console.log('📊 Resumo:');
    console.log('   - Coletados:', result.summary?.collected_count || 0, 'tipos');
    console.log('   - Registros:', result.summary?.total_records_collected || 0);
    console.log('   - Erros:', result.summary?.error_count || 0);
  } else {
    console.log('❌ Erro:', result.error);
  }
}

sync().catch(console.error);
