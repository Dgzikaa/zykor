/**
 * Script para comparar vendas_item entre semanas 10, 11, 12, 13
 */

async function compararSemanas() {
  console.log('🔍 Comparando vendas_item entre semanas...\n');

  const semanas = [
    { num: 10, inicio: '2026-03-02', fim: '2026-03-08' },
    { num: 11, inicio: '2026-03-09', fim: '2026-03-15' },
    { num: 12, inicio: '2026-03-16', fim: '2026-03-22' },
    { num: 13, inicio: '2026-03-23', fim: '2026-03-29' },
  ];

  for (const semana of semanas) {
    try {
      const response = await fetch(`http://localhost:3001/api/debug/investigar-mix-semana-12?semana=${semana.num}`, {
        headers: { 'x-selected-bar-id': '3' },
      });

      // Criar endpoint genérico
      const url = `http://localhost:3001/api/debug/mix-vendas-semana?semana=${semana.num}&ano=2026&recalcular=false`;
      const resp = await fetch(url, {
        headers: { 'x-selected-bar-id': '3' },
      });

      const data = await resp.json();

      console.log(`📅 SEMANA ${semana.num} (${semana.inicio} até ${semana.fim})`);
      console.log(`  Faturamento eventos: R$ ${data.faturamento_total?.toFixed(2)}`);
      console.log(`  Mix banco: B=${data.mix_atual_banco.perc_bebidas?.toFixed(2)}%`);
      console.log(`  Mix manual: B=${data.mix_calculado_manual.perc_bebidas?.toFixed(2)}%`);
      console.log(`  Mix RPC: B=${data.mix_rpc?.perc_bebidas?.toFixed(2)}%`);
      console.log(`  Diferença: ${Math.abs((data.mix_atual_banco.perc_bebidas || 0) - data.mix_calculado_manual.perc_bebidas).toFixed(2)}%`);
      console.log('');

    } catch (error) {
      console.error(`❌ Erro na semana ${semana.num}:`, error.message);
    }
  }
}

compararSemanas();
