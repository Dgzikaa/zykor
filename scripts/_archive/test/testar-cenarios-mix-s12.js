/**
 * Testa diferentes cenários para encontrar 67.7% exato
 */

async function testar() {
  try {
    const eventosResp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const eventosData = await eventosResp.json();

    const semanaResp = await fetch('http://localhost:3001/api/estrategico/desempenho/todas-semanas?ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const semanasData = await semanaResp.json();
    const semana12 = semanasData.semanas.find(s => s.numero_semana === 12);

    console.log('🧪 TESTANDO CENÁRIOS PARA 67.7% EXATO\n');

    // Dados base
    const eventos = eventosData.eventos;
    const fatEventos = eventosData.faturamento_total;
    const contaAssinada = semana12?.conta_assinada_valor || 0;
    const descontos = semana12?.descontos_valor || 0;

    // Contribuição de bebidas (em reais)
    const contribBebidas = eventos.reduce((acc, e) => {
      return acc + (e.faturamento || 0) * (e.percent_b || 0) / 100;
    }, 0);

    console.log(`💰 Valores base:`);
    console.log(`   Contribuição Bebidas: R$ ${contribBebidas.toFixed(2)}`);
    console.log(`   Fat. Eventos: R$ ${fatEventos.toFixed(2)}`);
    console.log(`   Conta Assinada: R$ ${contaAssinada.toFixed(2)}`);
    console.log(`   Descontos: R$ ${descontos.toFixed(2)}\n`);

    // Cenário 1: Só eventos
    const mix1 = (contribBebidas / fatEventos) * 100;
    console.log(`1️⃣ Só eventos: ${mix1.toFixed(4)}% (diff: ${Math.abs(mix1 - 67.7).toFixed(4)}%)`);

    // Cenário 2: Eventos + Conta Assinada
    const fat2 = fatEventos + contaAssinada;
    const mix2 = (contribBebidas / fat2) * 100;
    console.log(`2️⃣ Eventos + Conta Assinada: ${mix2.toFixed(4)}% (diff: ${Math.abs(mix2 - 67.7).toFixed(4)}%)`);

    // Cenário 3: Eventos - Descontos
    const fat3 = fatEventos - descontos;
    const mix3 = (contribBebidas / fat3) * 100;
    console.log(`3️⃣ Eventos - Descontos: ${mix3.toFixed(4)}% (diff: ${Math.abs(mix3 - 67.7).toFixed(4)}%)`);

    // Cenário 4: Faturamento do desempenho_semanal
    const fatDesempenho = semana12?.faturamento_total || 0;
    const mix4 = (contribBebidas / fatDesempenho) * 100;
    console.log(`4️⃣ Fat. Desempenho Semanal: ${mix4.toFixed(4)}% (diff: ${Math.abs(mix4 - 67.7).toFixed(4)}%)`);

    // Cenário 5: Qual faturamento daria 67.7% exato?
    const fatExato = contribBebidas / 0.677;
    console.log(`\n🎯 FATURAMENTO PARA 67.7% EXATO: R$ ${fatExato.toFixed(2)}`);
    console.log(`   Diferença vs Fat. Eventos: R$ ${(fatExato - fatEventos).toFixed(2)}`);
    console.log(`   Diferença vs Fat. + Conta Assinada: R$ ${(fatExato - fat2).toFixed(2)}`);

    // Testar se arredondando os % individuais bate
    console.log(`\n5️⃣ TESTANDO ARREDONDAMENTOS:\n`);

    // Arredondar para 2 casas
    let soma2casas = 0;
    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const perc = Math.round((e.percent_b || 0) * 100) / 100;
      soma2casas += fat * perc / 100;
    });
    const mix2casas = (soma2casas / fatEventos) * 100;
    console.log(`   % arredondado 2 casas: ${mix2casas.toFixed(4)}% (diff: ${Math.abs(mix2casas - 67.7).toFixed(4)}%)`);

    // Arredondar para 1 casa
    let soma1casa = 0;
    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const perc = Math.round((e.percent_b || 0) * 10) / 10;
      soma1casa += fat * perc / 100;
    });
    const mix1casa = (soma1casa / fatEventos) * 100;
    console.log(`   % arredondado 1 casa: ${mix1casa.toFixed(4)}% (diff: ${Math.abs(mix1casa - 67.7).toFixed(4)}%)`);

    console.log('\n📊 DETALHAMENTO DOS EVENTOS (para comparar com planilha):\n');
    eventos.forEach((e, idx) => {
      console.log(`${idx + 1}. ${e.data} - R$ ${(e.faturamento || 0).toFixed(2)} - ${(e.percent_b || 0).toFixed(2)}% bebidas`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testar();
