/**
 * Verifica se há valores adicionais no faturamento da semana 12
 */

async function verificar() {
  try {
    const supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const dataInicio = '2026-03-16';
    const dataFim = '2026-03-22';
    const barId = 3;

    console.log('💰 VERIFICANDO FATURAMENTO COMPLETO - SEMANA 12\n');
    console.log(`Período: ${dataInicio} até ${dataFim}\n`);

    // 1. Faturamento dos eventos
    const eventosResp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const eventosData = await eventosResp.json();
    const fatEventos = eventosData.faturamento_total;

    console.log('📊 FATURAMENTO POR FONTE:\n');
    console.log(`1. Eventos (real_r): R$ ${fatEventos.toFixed(2)}`);

    // 2. Buscar dados do desempenho_semanal
    const semanaResp = await fetch('http://localhost:3001/api/estrategico/desempenho/todas-semanas?ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const semanasData = await semanaResp.json();
    const semana12 = semanasData.semanas.find(s => s.numero_semana === 12);

    if (semana12) {
      console.log(`2. Desempenho Semanal: R$ ${semana12.faturamento_total?.toFixed(2)}`);
      console.log(`3. Conta Assinada: R$ ${semana12.conta_assinada_valor?.toFixed(2) || 0}`);
      console.log(`4. Descontos: R$ ${semana12.descontos_valor?.toFixed(2) || 0}`);
      
      const fatComAjustes = semana12.faturamento_total + (semana12.conta_assinada_valor || 0);
      console.log(`\n💡 Fat. Total + Conta Assinada: R$ ${fatComAjustes.toFixed(2)}`);
      
      // Testar se incluindo conta assinada bate
      const contribAtual = eventosData.eventos.reduce((acc, e) => acc + (e.faturamento || 0) * (e.percent_b || 0) / 100, 0);
      const mixComContaAssinada = (contribAtual / fatComAjustes) * 100;
      
      console.log(`   Mix com ajuste: ${mixComContaAssinada.toFixed(4)}%`);
      console.log(`   Diferença vs 67.7%: ${Math.abs(mixComContaAssinada - 67.7).toFixed(4)}%`);
    }

    // 3. Verificar se há diferença entre real_r somado vs faturamento_total
    const somaRealR = eventosData.eventos.reduce((acc, e) => acc + (e.faturamento || 0), 0);
    console.log(`\n5. Soma real_r dos eventos: R$ ${somaRealR.toFixed(2)}`);
    console.log(`   Diferença vs eventos: R$ ${Math.abs(somaRealR - fatEventos).toFixed(2)}`);

    // 4. Calcular qual seria o faturamento para dar 67.7% exato
    const contribBebidas = eventosData.eventos.reduce((acc, e) => acc + (e.faturamento || 0) * (e.percent_b || 0) / 100, 0);
    const fatNecessario = contribBebidas / 0.677;
    
    console.log(`\n🎯 PARA DAR 67.7% EXATO:`);
    console.log(`   Faturamento necessário: R$ ${fatNecessario.toFixed(2)}`);
    console.log(`   Faturamento atual: R$ ${fatEventos.toFixed(2)}`);
    console.log(`   Diferença: R$ ${(fatNecessario - fatEventos).toFixed(2)}`);
    console.log(`   % de diferença: ${((fatNecessario - fatEventos) / fatEventos * 100).toFixed(4)}%`);

    console.log('\n💡 POSSIBILIDADES:');
    console.log('   1. Planilha tem faturamento R$ 1.071 maior (0.26% a mais)');
    console.log('   2. Planilha arredonda de forma diferente');
    console.log('   3. Diferença de 0.18% é aceitável (< 0.2%)');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificar();
