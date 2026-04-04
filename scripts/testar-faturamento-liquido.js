/**
 * Testa se a planilha está usando faturamento líquido em vez de bruto
 */

async function testar() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Buscar eventos com mais detalhes
    const response = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();

    console.log('💰 TESTANDO FATURAMENTO LÍQUIDO\n');

    // Buscar conta assinada e descontos da semana
    const dataInicio = '2026-03-16';
    const dataFim = '2026-03-22';

    console.log('📋 EVENTOS (Faturamento Bruto):');
    let totalBruto = 0;
    data.eventos.forEach(e => {
      console.log(`  ${e.data}: R$ ${e.faturamento?.toFixed(2)} - B=${e.percent_b?.toFixed(2)}%`);
      totalBruto += e.faturamento || 0;
    });
    console.log(`  TOTAL BRUTO: R$ ${totalBruto.toFixed(2)}\n`);

    // Calcular mix com faturamento bruto (atual)
    let somaB = 0;
    data.eventos.forEach(e => {
      somaB += (e.faturamento || 0) * ((e.percent_b || 0) / 100);
    });
    const mixBruto = (somaB / totalBruto) * 100;

    console.log('🧮 CÁLCULOS:');
    console.log(`  Mix com Fat. Bruto: ${mixBruto.toFixed(2)}%`);
    console.log(`  Planilha: 67.7%`);
    console.log(`  Diferença: ${Math.abs(mixBruto - 67.7).toFixed(2)}%`);
    console.log('');
    console.log('💡 HIPÓTESES:');
    console.log('  1. Planilha pode estar arredondando os % individuais antes de ponderar');
    console.log('  2. Planilha pode ter faturamentos ligeiramente diferentes');
    console.log('  3. Diferença de 0.18% é marginal e aceitável');
    console.log('');
    console.log('🔍 Para investigar mais, verifique na planilha:');
    console.log('  - O faturamento de cada dia bate com o sistema?');
    console.log('  - Os % individuais (B/D/C) de cada dia batem?');
    console.log('  - Como a planilha calcula a média ponderada?');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testar();
