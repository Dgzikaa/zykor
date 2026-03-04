// Node 18+ tem fetch nativo

const supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI2MzY3NTMsImV4cCI6MjA0ODIxMjc1M30.j7k5Nt1rEMVXfZqwdNPvPqEPmAhB_VDTdNLuTWwVLWU';

async function chamarFuncao() {
  console.log('🚀 Chamando recalcular-desempenho-auto com token do cron...\n');

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/recalcular-desempenho-auto`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const resultado = await response.json();
    console.log('✅ Resposta completa:', JSON.stringify(resultado, null, 2));
    console.log('\n📊 Detalhes:');
    
    if (resultado.detalhes) {
      const bar3 = resultado.detalhes.filter(d => d.bar_id === 3);
      const bar4 = resultado.detalhes.filter(d => d.bar_id === 4);
      
      console.log(`\n🍺 Ordinário (bar_id=3): ${bar3.length} semanas processadas`);
      bar3.forEach(d => {
        console.log(`  - Semana ${d.semana}: R$ ${d.faturamento?.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | ${d.clientes} clientes`);
      });
      
      console.log(`\n🎭 Deboche (bar_id=4): ${bar4.length} semanas processadas`);
      bar4.forEach(d => {
        console.log(`  - Semana ${d.semana}: R$ ${d.faturamento?.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | ${d.clientes} clientes`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

chamarFuncao();
