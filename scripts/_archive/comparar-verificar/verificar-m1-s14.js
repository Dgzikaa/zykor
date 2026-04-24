async function verificar() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/verificar-m1-faltando?semana=14&ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();

    console.log('📅 SEMANA 14 - Análise de Metas\n');
    console.log('Período:', data.semana.periodo);
    console.log('Meta no banco:', data.semana.meta_no_banco?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('');
    console.log('📊 ANÁLISE:');
    console.log('  Total de eventos:', data.analise.total_eventos);
    console.log('  Com M1:', data.analise.eventos_com_m1);
    console.log('  Sem M1:', data.analise.eventos_sem_m1);
    console.log('  Soma M1 atual:', data.analise.soma_m1_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('  Soma M1 sugerida:', data.analise.soma_m1_sugerida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('  Meta total calculada:', data.analise.meta_total_calculada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('');
    
    if (data.eventos_sem_m1.length > 0) {
      console.log('❌ EVENTOS SEM M1:');
      data.eventos_sem_m1.forEach(e => {
        console.log(`  ${e.data} (${e.dia_semana}) - ${e.nome}`);
        console.log(`    M1 atual: R$ ${e.m1_atual}`);
        console.log(`    M1 sugerido: R$ ${e.m1_sugerido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      });
    }

    console.log('\n💡 RECOMENDAÇÃO:', data.recomendacao);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificar();
