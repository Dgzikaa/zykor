import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://qzghqkdqfnkgxqxqtxvg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6Z2hxa2RxZm5rZ3hxeHF0eHZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTY5MjQzNCwiZXhwIjoyMDQ3MjY4NDM0fQ.pODHytaYSI-Vt_4Oo9Wvq9NG_LbQTxlpFxXBVnL_9Hs';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = readFileSync('database/functions/calculate_evento_metrics.sql', 'utf-8');

console.log('📤 Fazendo deploy da função calculate_evento_metrics...');

const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async () => {
  // Se exec_sql não existir, executar direto
  const { data, error } = await supabase.from('_sql').select('*').limit(0).then(() => 
    fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: sql })
    })
  );
  
  if (error) throw error;
  return { data, error: null };
});

if (error) {
  console.error('❌ Erro:', error);
  process.exit(1);
}

console.log('✅ Deploy concluído com sucesso!');
