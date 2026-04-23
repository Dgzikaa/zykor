/**
 * Recalcula a semana 14 para corrigir a meta_semanal
 */

async function recalcular() {
  console.log('🔄 Recalculando semana 14/2026...\n');

  try {
    // 1. Ver dados atuais
    const verResponse = await fetch('http://localhost:3001/api/debug/verificar-m1-faltando?semana=14&ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const dadosAtuais = await verResponse.json();

    console.log('📊 ANTES DO RECÁLCULO:');
    console.log('  Meta no banco:', dadosAtuais.semana.meta_no_banco?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('  Soma M1 dos eventos:', dadosAtuais.analise.soma_m1_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('  Diferença:', dadosAtuais.analise.diferenca_vs_banco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('');

    // 2. Buscar o ID da semana 14
    const semanasResponse = await fetch('http://localhost:3001/api/estrategico/desempenho/todas-semanas?ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const semanasData = await semanasResponse.json();
    const semana14 = semanasData.semanas.find(s => s.numero_semana === 14);

    if (!semana14) {
      console.error('❌ Semana 14 não encontrada');
      return;
    }

    console.log('🔧 Recalculando...');

    // 3. Chamar API de recálculo
    const recalcResponse = await fetch('http://localhost:3001/api/gestao/desempenho/recalcular', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-selected-bar-id': '3',
      },
      body: JSON.stringify({
        semana_id: semana14.id,
        recalcular_todas: false,
      }),
    });

    if (!recalcResponse.ok) {
      const error = await recalcResponse.json();
      console.error('❌ Erro ao recalcular:', error);
      return;
    }

    const resultado = await recalcResponse.json();

    console.log('✅ Recálculo concluído!\n');

    // 4. Verificar dados atualizados
    const verResponse2 = await fetch('http://localhost:3001/api/debug/verificar-m1-faltando?semana=14&ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const dadosNovos = await verResponse2.json();

    console.log('📊 DEPOIS DO RECÁLCULO:');
    console.log('  Meta no banco:', dadosNovos.semana.meta_no_banco?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('  Soma M1 dos eventos:', dadosNovos.analise.soma_m1_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('  Diferença:', dadosNovos.analise.diferenca_vs_banco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('');

    if (Math.abs(dadosNovos.analise.diferenca_vs_banco) < 1) {
      console.log('✅ Meta corrigida com sucesso!');
    } else {
      console.log('⚠️  Ainda há diferença. Pode ser necessário investigar mais.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

recalcular();
