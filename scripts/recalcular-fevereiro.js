const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uqtgsvujwcbymjmvkjhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTY2MzA4MCwiZXhwIjoyMDUxMjM5MDgwfQ.VaJPxmGCkYOLpGLLfPvGHBvDVZEFVSjxQJPYhVoGEhY'
);

async function recalcular() {
  const { data: eventos, error } = await supabase
    .from('eventos_base')
    .select('id, data_evento, nome')
    .in('bar_id', [3, 4])
    .gte('data_evento', '2026-02-01')
    .lt('data_evento', '2026-03-01')
    .order('bar_id, data_evento');
  
  if (error) {
    console.error('Erro ao buscar eventos:', error);
    return;
  }
  
  console.log(`Total de eventos: ${eventos.length}`);
  
  for (const evento of eventos) {
    const { error: calcError } = await supabase.rpc('calculate_evento_metrics', { evento_id: evento.id });
    if (calcError) {
      console.error(`Erro ao calcular evento ${evento.id}:`, calcError.message);
    } else {
      console.log(`✓ ${evento.data_evento.split('T')[0]} - ${evento.nome}`);
    }
  }
  
  console.log('\n✅ Recálculo concluído!');
  
  const { data: stats } = await supabase
    .from('eventos_base')
    .select('bar_id, t_coz, t_bar, percent_d, percent_happy_hour, c_art')
    .in('bar_id', [3, 4])
    .gte('data_evento', '2026-02-01')
    .lt('data_evento', '2026-03-01');
  
  const deboche = stats.filter(e => e.bar_id === 4);
  const ordinario = stats.filter(e => e.bar_id === 3);
  
  console.log(`\nDeboche: ${deboche.filter(e => e.percent_d > 0).length}/${deboche.length} com drinks`);
  console.log(`Deboche: ${deboche.filter(e => e.percent_happy_hour > 0).length}/${deboche.length} com happy hour`);
  console.log(`Deboche: ${deboche.filter(e => e.c_art > 0).length}/${deboche.length} com custos`);
}

recalcular();
