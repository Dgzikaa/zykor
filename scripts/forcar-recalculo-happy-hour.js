require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function recalcularSemana(semana, ano, barId) {
  console.log(`\n⚙️ Recalculando semana ${semana}/${ano} - Bar ${barId}`);
  
  // Buscar dados da semana
  const { data: semanaData, error: semanaError } = await supabase
    .from('desempenho_semanal')
    .select('*')
    .eq('bar_id', barId)
    .eq('ano', ano)
    .eq('numero_semana', semana)
    .single();
  
  if (semanaError) {
    console.error(`❌ Erro ao buscar semana:`, semanaError);
    return;
  }
  
  const startDate = semanaData.data_inicio;
  const endDate = semanaData.data_fim;
  
  console.log(`📅 Período: ${startDate} a ${endDate}`);
  
  // Buscar eventos com percentuais
  const { data: eventosComPercentuais, error: eventosError } = await supabase
    .from('eventos_base')
    .select('data_evento, real_r, percent_b, percent_d, percent_c, percent_happy_hour')
    .eq('bar_id', barId)
    .gte('data_evento', startDate)
    .lte('data_evento', endDate)
    .eq('ativo', true)
    .not('real_r', 'is', null)
    .gt('real_r', 0);
  
  if (eventosError) {
    console.error(`❌ Erro ao buscar eventos:`, eventosError);
    return;
  }
  
  console.log(`📊 Eventos encontrados: ${eventosComPercentuais?.length || 0}`);
  
  if (!eventosComPercentuais || eventosComPercentuais.length === 0) {
    console.log(`⚠️ Nenhum evento com faturamento encontrado`);
    return;
  }
  
  // Mostrar dados de cada evento
  eventosComPercentuais.forEach(e => {
    console.log(`  - ${e.data_evento}: Fat R$ ${parseFloat(e.real_r).toFixed(2)}, HH ${parseFloat(e.percent_happy_hour || 0).toFixed(2)}%`);
  });
  
  // Calcular média ponderada
  const faturamentoTotal = eventosComPercentuais.reduce((sum, e) => sum + parseFloat(e.real_r), 0);
  
  let percBebidasPonderado = 0;
  let percDrinksPonderado = 0;
  let percComidaPonderado = 0;
  let percHappyHourPonderado = 0;
  
  if (faturamentoTotal > 0) {
    const somaBebidasPonderada = eventosComPercentuais.reduce((sum, e) => 
      sum + (parseFloat(e.real_r) * (parseFloat(e.percent_b) || 0) / 100), 0);
    const somaDrinksPonderada = eventosComPercentuais.reduce((sum, e) => 
      sum + (parseFloat(e.real_r) * (parseFloat(e.percent_d) || 0) / 100), 0);
    const somaComidaPonderada = eventosComPercentuais.reduce((sum, e) => 
      sum + (parseFloat(e.real_r) * (parseFloat(e.percent_c) || 0) / 100), 0);
    const somaHappyHourPonderada = eventosComPercentuais.reduce((sum, e) => 
      sum + (parseFloat(e.real_r) * (parseFloat(e.percent_happy_hour) || 0) / 100), 0);
    
    percBebidasPonderado = (somaBebidasPonderada / faturamentoTotal) * 100;
    percDrinksPonderado = (somaDrinksPonderada / faturamentoTotal) * 100;
    percComidaPonderado = (somaComidaPonderada / faturamentoTotal) * 100;
    percHappyHourPonderado = (somaHappyHourPonderada / faturamentoTotal) * 100;
  }
  
  console.log(`\n📊 Mix Calculado:`);
  console.log(`  Bebidas: ${percBebidasPonderado.toFixed(2)}%`);
  console.log(`  Drinks: ${percDrinksPonderado.toFixed(2)}%`);
  console.log(`  Comida: ${percComidaPonderado.toFixed(2)}%`);
  console.log(`  Happy Hour: ${percHappyHourPonderado.toFixed(2)}%`);
  
  // Atualizar no banco
  const { error: updateError } = await supabase
    .from('desempenho_semanal')
    .update({
      perc_bebidas: percBebidasPonderado,
      perc_drinks: percDrinksPonderado,
      perc_comida: percComidaPonderado,
      perc_happy_hour: percHappyHourPonderado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', semanaData.id)
    .eq('bar_id', barId);
  
  if (updateError) {
    console.error(`❌ Erro ao atualizar:`, updateError);
    return;
  }
  
  console.log(`✅ Semana ${semana} atualizada com sucesso!`);
}

async function main() {
  console.log('🔄 Forçando recálculo de % Happy Hour para semanas 6, 7, 8, 9 de 2026\n');
  
  const semanas = [6, 7, 8, 9];
  const ano = 2026;
  const bares = [3, 4]; // Ordinário e Deboche
  
  for (const semana of semanas) {
    for (const barId of bares) {
      await recalcularSemana(semana, ano, barId);
    }
  }
  
  console.log('\n✅ Recálculo concluído!');
}

main().catch(console.error);
