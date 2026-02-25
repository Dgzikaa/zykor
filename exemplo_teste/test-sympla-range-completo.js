/**
 * Testar buscar participantes com range de datas amplo
 */

const SYMPLA_TOKEN = '2835b1e7099e748057c71a9c0c34b3a4ca1246b379687ebf8affa92cdc65a7a4';
const EVENTO_ID = 's322f32';

async function buscarComRange() {
  console.log('🔍 BUSCANDO PARTICIPANTES COM RANGE DE DATAS\n');
  
  // Teste 1: Sem filtro de data (pega todos)
  console.log('📊 TESTE 1: SEM FILTRO DE DATA');
  console.log('='.repeat(60));
  
  let todosParticipantes = [];
  let pagina = 1;
  let temProxima = true;
  
  while (temProxima && pagina <= 40) {
    const url = `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=${pagina}&page_size=200`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        's_token': SYMPLA_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      todosParticipantes = todosParticipantes.concat(data.data);
      const checkins = data.data.filter(p => p.checkin?.check_in === true).length;
      console.log(`   Página ${pagina}: ${data.data.length} participantes, ${checkins} com checkin`);
      
      if (data.data.length < 200) {
        temProxima = false;
      }
      pagina++;
    } else {
      temProxima = false;
    }
  }
  
  const totalCheckins = todosParticipantes.filter(p => p.checkin?.check_in === true).length;
  const comCampoCheckin = todosParticipantes.filter(p => p.checkin !== undefined).length;
  
  console.log('\n📊 RESULTADO:');
  console.log(`   Total: ${todosParticipantes.length}`);
  console.log(`   Com campo checkin: ${comCampoCheckin}`);
  console.log(`   Com checkin=true: ${totalCheckins}`);
  
  // Teste 2: Com filtro de data amplo (pegar checkins de todo o período)
  console.log('\n\n📊 TESTE 2: COM FILTRO DE DATA AMPLO (01/01 a 20/02)');
  console.log('='.repeat(60));
  
  let participantesComData = [];
  pagina = 1;
  temProxima = true;
  
  while (temProxima && pagina <= 10) {
    const url = `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=${pagina}&page_size=200&from=2026-01-01&to=2026-02-20`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        's_token': SYMPLA_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      participantesComData = participantesComData.concat(data.data);
      const checkins = data.data.filter(p => p.checkin?.check_in === true).length;
      console.log(`   Página ${pagina}: ${data.data.length} participantes, ${checkins} com checkin`);
      
      if (data.data.length < 200) {
        temProxima = false;
      }
      pagina++;
    } else {
      temProxima = false;
    }
  }
  
  const totalCheckinsComData = participantesComData.filter(p => p.checkin?.check_in === true).length;
  const comCampoCheckinComData = participantesComData.filter(p => p.checkin !== undefined).length;
  
  console.log('\n📊 RESULTADO:');
  console.log(`   Total: ${participantesComData.length}`);
  console.log(`   Com campo checkin: ${comCampoCheckinComData}`);
  console.log(`   Com checkin=true: ${totalCheckinsComData}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Análise concluída!');
  console.log('='.repeat(60));
}

buscarComRange();
