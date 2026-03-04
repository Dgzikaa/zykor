/**
 * Teste da função calculate_daily_metrics_v2
 * Valida cálculos para diferentes dias e bares
 */

const { createClient } = require('@supabase/supabase-js');

// Pegar credenciais da connection string fornecida
const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testarDia(barId, dataEvento) {
  console.log(`\n📊 Testando Bar ${barId} - ${dataEvento}`);
  console.log('='.repeat(60));
  
  // Executar função
  const { error } = await supabase.rpc('calculate_daily_metrics_v2', {
    p_bar_id: barId,
    p_data_evento: dataEvento
  });
  
  if (error) {
    console.error(`❌ Erro: ${error.message}`);
    return false;
  }
  
  // Buscar resultado
  const { data, error: error2 } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('bar_id', barId)
    .eq('data_evento', dataEvento)
    .single();
  
  if (error2) {
    console.error(`❌ Erro ao buscar: ${error2.message}`);
    return false;
  }
  
  console.log(`✅ Faturamento: R$ ${data.real_r || 0}`);
  console.log(`✅ Clientes: ${data.cl_real || 0}`);
  console.log(`✅ Mix - Bebidas: ${parseFloat(data.percent_b || 0).toFixed(1)}%`);
  console.log(`✅ Mix - Drinks: ${parseFloat(data.percent_d || 0).toFixed(1)}%`);
  console.log(`✅ Mix - Comida: ${parseFloat(data.percent_c || 0).toFixed(1)}%`);
  console.log(`✅ Tempo Bar: ${parseFloat(data.t_bar || 0).toFixed(2)} min`);
  console.log(`✅ Tempo Cozinha: ${parseFloat(data.t_coz || 0).toFixed(2)} min`);
  console.log(`✅ Atrasinhos Bar: ${data.atrasinho_bar || 0}`);
  console.log(`✅ Atrasinhos Cozinha: ${data.atrasinho_cozinha || 0}`);
  console.log(`✅ Atrasões Bar: ${data.atrasao_bar || 0}`);
  console.log(`✅ Atrasões Cozinha: ${data.atrasao_cozinha || 0}`);
  console.log(`✅ Stockout: ${parseFloat(data.percent_stockout || 0).toFixed(2)}%`);
  
  return true;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE - calculate_daily_metrics_v2                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // Dias de teste
  const testes = [
    { barId: 3, data: '2026-02-22', desc: 'Ordinário - Domingo' },
    { barId: 3, data: '2026-02-23', desc: 'Ordinário - Segunda' },
    { barId: 4, data: '2026-02-23', desc: 'Deboche - Segunda (deve pular)' },
    { barId: 4, data: '2026-02-24', desc: 'Deboche - Terça' },
    { barId: 4, data: '2026-02-25', desc: 'Deboche - Quarta' },
  ];
  
  let sucessos = 0;
  for (const teste of testes) {
    console.log(`\n🔄 ${teste.desc}`);
    const sucesso = await testarDia(teste.barId, teste.data);
    if (sucesso) sucessos++;
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTADO: ${sucessos}/${testes.length} testes com sucesso`);
  console.log('╚════════════════════════════════════════════════════════════╝');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { testarDia, main };
