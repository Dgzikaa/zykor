/**
 * Testar API Sympla com diferentes parâmetros
 */

const SYMPLA_TOKEN = '2835b1e7099e748057c71a9c0c34b3a4ca1246b379687ebf8affa92cdc65a7a4';
const EVENTO_ID = 's322f32';

async function testarComParametros() {
  console.log('🧪 TESTANDO API SYMPLA COM DIFERENTES PARÂMETROS\n');
  
  const testes = [
    {
      nome: 'Padrão (sem parâmetros)',
      url: `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=1`
    },
    {
      nome: 'Com cancelled_filter=include',
      url: `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=1&cancelled_filter=include`
    },
    {
      nome: 'Com page_size=200 (máximo)',
      url: `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=1&page_size=200`
    },
    {
      nome: 'Com from/to (data do evento)',
      url: `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=1&from=2026-02-13&to=2026-02-14`
    },
    {
      nome: 'Página 34 (onde tem checkins)',
      url: `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=34`
    }
  ];
  
  for (const teste of testes) {
    console.log('='.repeat(60));
    console.log(`🔍 Teste: ${teste.nome}`);
    console.log(`📡 URL: ${teste.url}`);
    console.log('-'.repeat(60));
    
    try {
      const response = await fetch(teste.url, {
        method: 'GET',
        headers: {
          's_token': SYMPLA_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log(`❌ Erro: ${response.status} ${response.statusText}\n`);
        continue;
      }
      
      const data = await response.json();
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Total de participantes nesta página: ${data.data?.length || 0}`);
      console.log(`📄 Paginação:`, JSON.stringify(data.pagination, null, 2));
      
      // Contar checkins
      const comCheckin = data.data?.filter(p => p.checkin?.check_in === true).length || 0;
      const semCheckin = (data.data?.length || 0) - comCheckin;
      
      console.log(`✅ Com checkin: ${comCheckin}`);
      console.log(`❌ Sem checkin: ${semCheckin}`);
      
      // Verificar se há campo checkin nos registros
      const temCampoCheckin = data.data?.filter(p => p.checkin !== undefined).length || 0;
      console.log(`🔍 Registros com campo 'checkin': ${temCampoCheckin}`);
      
      // Mostrar exemplo de participante
      if (data.data && data.data.length > 0) {
        const primeiro = data.data[0];
        console.log(`\n📝 Exemplo (primeiro participante):`);
        console.log(`   Nome: ${primeiro.first_name} ${primeiro.last_name}`);
        console.log(`   Tipo: ${primeiro.ticket_name}`);
        console.log(`   Status: ${primeiro.order_status}`);
        console.log(`   Tem campo checkin? ${primeiro.checkin !== undefined ? 'SIM' : 'NÃO'}`);
        if (primeiro.checkin) {
          console.log(`   Checkin:`, JSON.stringify(primeiro.checkin, null, 2));
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`❌ Erro: ${error.message}\n`);
    }
  }
  
  console.log('='.repeat(60));
  console.log('✅ Testes concluídos!');
  console.log('='.repeat(60));
}

testarComParametros();
