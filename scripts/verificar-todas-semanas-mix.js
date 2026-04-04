/**
 * Verifica o mix de todas as semanas para encontrar o padrão
 */

async function verificar() {
  try {
    console.log('🔍 VERIFICANDO MIX DE TODAS AS SEMANAS\n');

    const semanas = [10, 11, 12, 13];
    const mixPlanilha = {
      10: null, // Você não informou
      11: null, // Você não informou
      12: 67.7,
      13: 60.3,
    };

    for (const numSemana of semanas) {
      const resp = await fetch(`http://localhost:3001/api/debug/mix-vendas-semana?semana=${numSemana}&ano=2026&recalcular=false`, {
        headers: { 'x-selected-bar-id': '3' },
      });
      const data = await resp.json();

      const mixEventos = data.mix_calculado_manual?.perc_bebidas || 0;
      const mixRPC = data.mix_rpc?.perc_bebidas || 0;
      const mixBanco = data.mix_atual_banco?.perc_bebidas || 0;
      const mixPlan = mixPlanilha[numSemana];

      console.log(`📊 SEMANA ${numSemana}:`);
      console.log(`   eventos_base: ${mixEventos.toFixed(4)}%`);
      console.log(`   vendas_item (RPC): ${mixRPC.toFixed(4)}%`);
      console.log(`   banco (atual): ${mixBanco.toFixed(4)}%`);
      
      if (mixPlan !== null) {
        console.log(`   planilha: ${mixPlan.toFixed(4)}%`);
        
        const diffEventos = Math.abs(mixEventos - mixPlan);
        const diffRPC = Math.abs(mixRPC - mixPlan);
        const diffBanco = Math.abs(mixBanco - mixPlan);

        console.log(`   Diff eventos_base: ${diffEventos.toFixed(4)}%`);
        console.log(`   Diff vendas_item: ${diffRPC.toFixed(4)}%`);
        console.log(`   Diff banco: ${diffBanco.toFixed(4)}%`);

        // Qual fonte bate melhor?
        const fontes = [
          { nome: 'eventos_base', diff: diffEventos },
          { nome: 'vendas_item', diff: diffRPC },
          { nome: 'banco', diff: diffBanco },
        ];
        const melhor = fontes.sort((a, b) => a.diff - b.diff)[0];
        
        if (melhor.diff < 0.01) {
          console.log(`   ✅ Planilha usa: ${melhor.nome} (diff: ${melhor.diff.toFixed(4)}%)`);
        } else {
          console.log(`   ⚠️  Melhor fonte: ${melhor.nome} (diff: ${melhor.diff.toFixed(4)}%)`);
        }
      }
      
      console.log('');
    }

    console.log('💡 PRÓXIMO PASSO:');
    console.log('   Informe os valores da planilha para S10 e S11');
    console.log('   para confirmar qual fonte a planilha está usando.');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificar();
