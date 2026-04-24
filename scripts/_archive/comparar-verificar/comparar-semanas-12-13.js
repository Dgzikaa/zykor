/**
 * Compara semanas 12 e 13 para ver por que 13 bate exato e 12 não
 */

async function comparar() {
  try {
    console.log('🔍 COMPARANDO SEMANAS 12 E 13\n');

    // Buscar semana 12
    const s12Resp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const s12Data = await s12Resp.json();

    // Buscar semana 13
    const s13Resp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=13&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const s13Data = await s13Resp.json();

    // Buscar dados do desempenho_semanal
    const semanaResp = await fetch('http://localhost:3001/api/estrategico/desempenho/todas-semanas?ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const semanasData = await semanaResp.json();
    const semana12 = semanasData.semanas.find(s => s.numero_semana === 12);
    const semana13 = semanasData.semanas.find(s => s.numero_semana === 13);

    console.log('📊 SEMANA 12:');
    console.log(`   Eventos: ${s12Data.eventos.length}`);
    console.log(`   Fat. Eventos (soma real_r): R$ ${s12Data.faturamento_total.toFixed(2)}`);
    console.log(`   Fat. Desempenho Semanal: R$ ${semana12?.faturamento_total?.toFixed(2)}`);
    console.log(`   Diferença: R$ ${Math.abs(s12Data.faturamento_total - (semana12?.faturamento_total || 0)).toFixed(2)}`);
    console.log(`   Mix calculado: ${s12Data.mix_calculado.perc_bebidas.toFixed(4)}%`);
    console.log(`   Mix no banco: ${semana12?.perc_bebidas?.toFixed(4)}%`);
    console.log(`   Mix planilha: 67.7000%`);
    console.log(`   Diferença vs planilha: ${Math.abs(s12Data.mix_calculado.perc_bebidas - 67.7).toFixed(4)}%\n`);

    console.log('📊 SEMANA 13:');
    console.log(`   Eventos: ${s13Data.eventos.length}`);
    console.log(`   Fat. Eventos (soma real_r): R$ ${s13Data.faturamento_total.toFixed(2)}`);
    console.log(`   Fat. Desempenho Semanal: R$ ${semana13?.faturamento_total?.toFixed(2)}`);
    console.log(`   Diferença: R$ ${Math.abs(s13Data.faturamento_total - (semana13?.faturamento_total || 0)).toFixed(2)}`);
    console.log(`   Mix calculado: ${s13Data.mix_calculado.perc_bebidas.toFixed(4)}%`);
    console.log(`   Mix no banco: ${semana13?.perc_bebidas?.toFixed(4)}%`);
    console.log(`   Mix planilha: 60.3000%`);
    console.log(`   Diferença vs planilha: ${Math.abs(s13Data.mix_calculado.perc_bebidas - 60.3).toFixed(4)}%\n`);

    // Verificar se a diferença de faturamento explica
    const difFatS12 = Math.abs(s12Data.faturamento_total - (semana12?.faturamento_total || 0));
    const difFatS13 = Math.abs(s13Data.faturamento_total - (semana13?.faturamento_total || 0));

    console.log('🔍 ANÁLISE:');
    console.log(`   S12 - Diferença de faturamento: R$ ${difFatS12.toFixed(2)} (${(difFatS12 / s12Data.faturamento_total * 100).toFixed(4)}%)`);
    console.log(`   S13 - Diferença de faturamento: R$ ${difFatS13.toFixed(2)} (${(difFatS13 / s13Data.faturamento_total * 100).toFixed(4)}%)`);

    if (difFatS12 > 100) {
      console.log('\n⚠️  SEMANA 12 TEM DIFERENÇA SIGNIFICATIVA DE FATURAMENTO!');
      console.log('   Isso pode explicar a diferença no mix.');
      console.log('   A planilha pode estar usando o faturamento do desempenho_semanal');
      console.log('   em vez da soma dos real_r dos eventos.\n');

      // Testar com faturamento do desempenho_semanal
      const contribS12 = s12Data.eventos.reduce((acc, e) => {
        return acc + (e.faturamento || 0) * (e.percent_b || 0) / 100;
      }, 0);
      const mixComFatDesempenho = (contribS12 / (semana12?.faturamento_total || 1)) * 100;
      console.log(`   Mix usando fat. desempenho_semanal: ${mixComFatDesempenho.toFixed(4)}%`);
      console.log(`   Diferença vs 67.7%: ${Math.abs(mixComFatDesempenho - 67.7).toFixed(4)}%`);
    }

    console.log('\n💡 PRÓXIMO PASSO:');
    console.log('   Verifique na planilha qual faturamento está sendo usado:');
    console.log(`   - R$ ${s12Data.faturamento_total.toFixed(2)} (soma dos eventos)?`);
    console.log(`   - R$ ${semana12?.faturamento_total?.toFixed(2)} (desempenho_semanal)?`);
    console.log(`   - Outro valor?`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

comparar();
