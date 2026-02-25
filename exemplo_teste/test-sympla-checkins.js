/**
 * Script para testar API do Sympla e verificar checkins
 * 
 * Como usar:
 * 1. node exemplo_teste/test-sympla-checkins.js
 */

const SYMPLA_TOKEN = '2835b1e7099e748057c71a9c0c34b3a4ca1246b379687ebf8affa92cdc65a7a4';
const EVENTO_ID = 's322f32'; // Evento 13/02 - Abre Alas

async function buscarParticipantes(eventoId, token) {
  let todosParticipantes = [];
  let pagina = 1;
  let temProximaPagina = true;

  console.log(`\n🔍 Buscando participantes do evento ${eventoId}...\n`);

  while (temProximaPagina) {
    const url = `https://api.sympla.com.br/public/v1.5.1/events/${eventoId}/participants?page=${pagina}`;
    
    console.log(`📄 Página ${pagina}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        's_token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      todosParticipantes = todosParticipantes.concat(data.data);
      
      // Contar checkins nesta página
      const checkinsNestaPagina = data.data.filter(p => p.checkin?.check_in === true).length;
      console.log(`   ✅ ${data.data.length} participantes, ${checkinsNestaPagina} com checkin`);
      
      pagina++;
      
      // API Sympla retorna 100 por página
      if (data.data.length < 100) {
        temProximaPagina = false;
      }
    } else {
      temProximaPagina = false;
    }
  }

  return todosParticipantes;
}

async function analisarCheckins() {
  try {
    console.log('🎪 TESTE DE CHECKINS SYMPLA');
    console.log('='.repeat(60));
    
    const participantes = await buscarParticipantes(EVENTO_ID, SYMPLA_TOKEN);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO FINAL:');
    console.log('='.repeat(60));
    
    const totalParticipantes = participantes.length;
    const participantesComCheckin = participantes.filter(p => p.checkin?.check_in === true);
    const totalCheckins = participantesComCheckin.length;
    
    console.log(`\n👥 Total de participantes: ${totalParticipantes}`);
    console.log(`✅ Total com checkin: ${totalCheckins}`);
    console.log(`❌ Total sem checkin: ${totalParticipantes - totalCheckins}`);
    console.log(`📊 Percentual de checkin: ${((totalCheckins / totalParticipantes) * 100).toFixed(2)}%`);
    
    // Análise por tipo de ingresso
    console.log('\n📋 CHECKINS POR TIPO DE INGRESSO:');
    console.log('-'.repeat(60));
    
    const porTipo = {};
    participantes.forEach(p => {
      const tipo = p.ticket_name || 'Sem tipo';
      if (!porTipo[tipo]) {
        porTipo[tipo] = { total: 0, checkins: 0 };
      }
      porTipo[tipo].total++;
      if (p.checkin?.check_in === true) {
        porTipo[tipo].checkins++;
      }
    });
    
    Object.entries(porTipo).forEach(([tipo, stats]) => {
      const percentual = ((stats.checkins / stats.total) * 100).toFixed(1);
      console.log(`\n${tipo}:`);
      console.log(`  Total: ${stats.total}`);
      console.log(`  Checkins: ${stats.checkins} (${percentual}%)`);
    });
    
    // Mostrar alguns exemplos de participantes COM checkin
    console.log('\n📝 EXEMPLOS DE PARTICIPANTES COM CHECKIN (COM DADOS RAW):');
    console.log('-'.repeat(60));
    participantesComCheckin.slice(0, 3).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   Ingresso: ${p.ticket_name}`);
      console.log(`   Checkin em: ${p.checkin.check_in_date}`);
      console.log(`   Status pedido: ${p.order_status}`);
      console.log(`   Checkin RAW:`, JSON.stringify(p.checkin, null, 2));
    });
    
    // Mostrar alguns exemplos SEM checkin das cortesias
    console.log('\n📝 EXEMPLOS DE CORTESIAS SEM CHECKIN:');
    console.log('-'.repeat(60));
    const cortesiasSemCheckin = participantes.filter(p => 
      p.ticket_name?.includes('Cortesias') && !p.checkin?.check_in
    ).slice(0, 3);
    
    cortesiasSemCheckin.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   Ingresso: ${p.ticket_name}`);
      console.log(`   Status pedido: ${p.order_status}`);
      console.log(`   Checkin RAW:`, JSON.stringify(p.checkin, null, 2));
    });
    
    // Verificar se há algum padrão nos checkins
    console.log('\n🔍 ANÁLISE DE DATAS DE CHECKIN:');
    console.log('-'.repeat(60));
    
    const checkinsPorData = {};
    participantesComCheckin.forEach(p => {
      if (p.checkin?.check_in_date) {
        const data = p.checkin.check_in_date.split('T')[0];
        checkinsPorData[data] = (checkinsPorData[data] || 0) + 1;
      }
    });
    
    Object.entries(checkinsPorData).sort().forEach(([data, count]) => {
      console.log(`${data}: ${count} checkins`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Análise concluída!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('\nStack:', error.stack);
  }
}

// Executar
analisarCheckins();
