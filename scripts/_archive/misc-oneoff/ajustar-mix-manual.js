/**
 * Ajusta manualmente o mix para bater exatamente com a planilha
 */

async function ajustar() {
  console.log('🔧 Ajustando mix manualmente para bater com planilha...\n');

  try {
    const supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
    
    // Valores da planilha
    const mixPlanilha = {
      perc_bebidas: 67.7,
      perc_drinks: 16.9, // ajuste se necessário
      perc_comida: 15.4, // ajuste se necessário
    };

    console.log('📊 Valores da planilha a serem aplicados:');
    console.log(`  Bebidas: ${mixPlanilha.perc_bebidas}%`);
    console.log(`  Drinks: ${mixPlanilha.perc_drinks}%`);
    console.log(`  Comida: ${mixPlanilha.perc_comida}%`);
    console.log(`  Total: ${(mixPlanilha.perc_bebidas + mixPlanilha.perc_drinks + mixPlanilha.perc_comida).toFixed(1)}%`);
    console.log('');

    // Chamar API para atualizar
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/desempenho_semanal?bar_id=eq.3&ano=eq.2026&numero_semana=eq.12`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        perc_bebidas: mixPlanilha.perc_bebidas,
        perc_drinks: mixPlanilha.perc_drinks,
        perc_comida: mixPlanilha.perc_comida,
        atualizado_em: new Date().toISOString(),
      }),
    });

    if (!updateResponse.ok) {
      console.error('❌ Erro ao atualizar:', await updateResponse.text());
      return;
    }

    console.log('✅ Mix atualizado com sucesso!');
    console.log('');
    console.log('⚠️  ATENÇÃO: Este é um ajuste manual.');
    console.log('   Se houver recálculo automático, os valores podem voltar.');
    console.log('   Considere investigar a diferença na planilha.');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Descomentar para executar
// ajustar();

console.log('⚠️  Script preparado mas não executado.');
console.log('   Para executar, descomente a última linha do script.');
console.log('');
console.log('   Antes de executar, confirme os valores da planilha:');
console.log('   - Bebidas: 67.7%');
console.log('   - Drinks: ?');
console.log('   - Comida: ?');
