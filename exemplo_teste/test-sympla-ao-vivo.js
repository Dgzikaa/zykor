/**
 * Teste AO VIVO da API Sympla - Verificar se mudou algo
 */

const SYMPLA_TOKEN = '2835b1e7099e748057c71a9c0c34b3a4ca1246b379687ebf8affa92cdc65a7a4';
const EVENTO_ID = 's322f32';

async function testeAoVivo() {
  console.log('🔴 TESTE AO VIVO - API SYMPLA');
  console.log('='.repeat(60));
  console.log(`📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
  console.log(`🎫 Evento: ${EVENTO_ID}`);
  console.log('='.repeat(60));
  
  // Buscar TODAS as páginas
  let todosParticipantes = [];
  let pagina = 1;
  let temProxima = true;
  
  console.log('\n📊 BUSCANDO TODAS AS PÁGINAS...\n');
  
  while (temProxima && pagina <= 40) {
    const url = `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=${pagina}&page_size=200`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        's_token': SYMPLA_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Erro na página ${pagina}: ${response.status}`);
      break;
    }
    
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      todosParticipantes = todosParticipantes.concat(data.data);
      const checkins = data.data.filter(p => p.checkin?.check_in === true).length;
      const comCampo = data.data.filter(p => p.checkin !== undefined).length;
      
      console.log(`   Página ${pagina}: ${data.data.length} participantes | ${comCampo} com campo checkin | ${checkins} checkins=true`);
      
      if (data.data.length < 200) {
        temProxima = false;
      }
      pagina++;
    } else {
      temProxima = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTADO FINAL');
  console.log('='.repeat(60));
  
  const totalCheckins = todosParticipantes.filter(p => p.checkin?.check_in === true).length;
  const comCampoCheckin = todosParticipantes.filter(p => p.checkin !== undefined).length;
  const semCampoCheckin = todosParticipantes.length - comCampoCheckin;
  
  console.log(`Total de participantes: ${todosParticipantes.length}`);
  console.log(`Com campo 'checkin': ${comCampoCheckin}`);
  console.log(`SEM campo 'checkin': ${semCampoCheckin}`);
  console.log(`Com checkin=true: ${totalCheckins}`);
  
  // Agrupar por tipo de ingresso
  const porTipo = {};
  todosParticipantes.forEach(p => {
    const tipo = p.ticket_name || 'Sem tipo';
    if (!porTipo[tipo]) {
      porTipo[tipo] = { total: 0, comCampo: 0, checkins: 0 };
    }
    porTipo[tipo].total++;
    if (p.checkin !== undefined) porTipo[tipo].comCampo++;
    if (p.checkin?.check_in === true) porTipo[tipo].checkins++;
  });
  
  console.log('\n📋 POR TIPO DE INGRESSO:');
  console.log('-'.repeat(60));
  Object.entries(porTipo)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([tipo, stats]) => {
      console.log(`\n${tipo}:`);
      console.log(`   Total: ${stats.total}`);
      console.log(`   Com campo checkin: ${stats.comCampo}`);
      console.log(`   Checkins realizados: ${stats.checkins}`);
      console.log(`   % sem campo: ${((stats.total - stats.comCampo) / stats.total * 100).toFixed(1)}%`);
    });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Teste concluído!');
  console.log('='.repeat(60));
}

testeAoVivo();
