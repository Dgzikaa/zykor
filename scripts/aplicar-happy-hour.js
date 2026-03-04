const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTY2MzA4MCwiZXhwIjoyMDUxMjM5MDgwfQ.VaJPxmGCkYOLpGLLfPvGHBvDVZEFVSjxQJPYhVoGEhY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function aplicar() {
  console.log('Lendo função SQL...');
  const sqlPath = path.join(__dirname, '..', 'temp_function.sql');
  const funcaoSQL = fs.readFileSync(sqlPath, 'utf8');
  
  console.log(`SQL tem ${funcaoSQL.length} caracteres`);
  console.log('Aplicando função...');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql: funcaoSQL });
  
  if (error) {
    console.error('Erro ao aplicar função:', error);
    return;
  }
  
  console.log('✅ Função aplicada com sucesso!');
  
  console.log('\nRecalculando eventos de fevereiro/2026 do Deboche...');
  const { data: eventos } = await supabase
    .from('eventos_base')
    .select('id, data_evento, nome')
    .eq('bar_id', 4)
    .gte('data_evento', '2026-02-01')
    .lt('data_evento', '2026-03-01')
    .order('data_evento');
  
  console.log(`Total de eventos: ${eventos.length}`);
  
  for (const evento of eventos) {
    await supabase.rpc('calculate_evento_metrics', { evento_id: evento.id });
    console.log(`✓ ${evento.data_evento.split('T')[0]} - ${evento.nome}`);
  }
  
  console.log('\n=== VERIFICANDO RESULTADOS ===');
  const { data: resultados } = await supabase
    .from('eventos_base')
    .select('data_evento, nome, percent_happy_hour, percent_d, t_coz, t_bar, c_art')
    .eq('bar_id', 4)
    .gte('data_evento', '2026-02-01')
    .lt('data_evento', '2026-03-01')
    .order('data_evento')
    .limit(10);
  
  console.table(resultados);
  
  const { data: stats } = await supabase
    .from('eventos_base')
    .select('percent_happy_hour, percent_d')
    .eq('bar_id', 4)
    .gte('data_evento', '2026-02-01')
    .lt('data_evento', '2026-03-01');
  
  const comHappyHour = stats.filter(e => parseFloat(e.percent_happy_hour) > 0).length;
  const comDrinks = stats.filter(e => parseFloat(e.percent_d) > 0).length;
  
  console.log(`\n✅ Eventos com Happy Hour > 0: ${comHappyHour}/${stats.length}`);
  console.log(`✅ Eventos com %Drinks > 0: ${comDrinks}/${stats.length}`);
}

aplicar().catch(console.error);
