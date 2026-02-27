// Script de teste da API Gemini
// Execute: deno run --allow-net --allow-env test-gemini.ts

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || 'SUA_CHAVE_AQUI';

async function testGemini() {
  console.log('🧪 Testando API Gemini...\n');

  // Testar diferentes modelos
  const modelsToTest = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
    'gemini-pro',
  ];

  for (const model of modelsToTest) {
    try {
      console.log(`\n📡 Testando modelo: ${model}`);
      
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Responda apenas: OK' }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 50,
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
        console.log(`✅ ${model}: FUNCIONOU!`);
        console.log(`   Resposta: ${text.substring(0, 50)}`);
      } else {
        const errorText = await response.text();
        console.log(`❌ ${model}: ERRO ${response.status}`);
        console.log(`   ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`❌ ${model}: EXCEÇÃO`);
      console.log(`   ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  console.log('\n\n🏁 Teste concluído!');
}

testGemini();
