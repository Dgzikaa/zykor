/**
 * Script para testar webhook do Falaê
 */

const WEBHOOK_URL = 'https://zykor.com.br/api/falae/webhook';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb21wYW55X2lkIjoiZDE2Njk1MmQtOTdmOS00ODgyLWE3MjQtZmNlYmNjN2VmZmY4IiwiaWF0IjoxNzcwNzI3NDM1LCJzdWIiOiIxNGExYTE1Ny0yMWIxLTQ2MGEtYmE1Ni0xZDFhMzI0ODA5NTUifQ.PXwQR9WHqn_E2AGRd9gHHCGQ-pVoihL4ZkkUfbUMh5I';

// Payload simulando uma resposta real do Falaê
const testPayload = {
  data: {
    answer: {
      id: 'test-webhook-' + Date.now(),
      nps: 10,
      created_at: new Date().toISOString(),
      discursive_question: 'Teste de webhook - favor ignorar',
      search_id: '5ea57678-1748-4bb8-8558-782b2c47a6e8',
      search: {
        id: '5ea57678-1748-4bb8-8558-782b2c47a6e8',
        name: 'NPS Digital'
      },
      client: {
        id: null,
        name: 'Teste Webhook',
        email: 'teste@webhook.com',
        phone: null
      },
      consumption: {
        id: null,
        order_id: null
      },
      company: {
        id: 'd166952d-97f9-4882-a724-fcebcc7efff8',
        name: 'Ordinário Bar & Música'
      },
      criteria: [
        {
          name: '5',
          nick: 'Atendimento',
          type: 'Rating',
          suggestion: ''
        },
        {
          name: new Date().toISOString().split('T')[0],
          nick: 'Data do pedido',
          type: 'Data',
          suggestion: ''
        }
      ]
    }
  }
};

async function testWebhook() {
  console.log('🧪 Testando webhook do Falaê...\n');
  console.log(`📍 URL: ${WEBHOOK_URL}`);
  console.log(`🔑 Token: ${TOKEN.substring(0, 20)}...`);
  console.log(`📦 Payload ID: ${testPayload.data.answer.id}\n`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify(testPayload)
    });

    const data = await response.json();

    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);

    if (response.ok) {
      console.log('✅ WEBHOOK FUNCIONANDO!\n');
      console.log('📋 Resposta:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n✅ O webhook está configurado corretamente!');
      console.log('✅ As próximas respostas do Falaê serão sincronizadas automaticamente.');
      return true;
    } else {
      console.log('❌ WEBHOOK COM ERRO!\n');
      console.log('📋 Resposta de erro:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n⚠️  O webhook não está funcionando corretamente.');
      return false;
    }
  } catch (error) {
    console.error('❌ ERRO AO TESTAR WEBHOOK:', error);
    return false;
  }
}

testWebhook().then(success => {
  process.exit(success ? 0 : 1);
});
