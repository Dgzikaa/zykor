const supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';
import { readFileSync } from 'fs';

const sql = readFileSync('temp_query.sql', 'utf8');

async function executeSql() {
  try {
    console.log('🔄 Executando SQL no Supabase...\n');
    
    const url = supabaseUrl + '/rest/v1/rpc/exec_sql';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql: sql })
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ Erro na resposta HTTP:', response.status, response.statusText);
      console.error('Resposta:', responseText);
      
      if (response.status === 404) {
        console.log('\n⚠️  A função exec_sql não existe no banco.');
        console.log('📝 Para executar este SQL, você precisa:');
        console.log('   1. Acessar o Supabase Studio: https://uqtgsvujwcbymjmvkjhy.supabase.co');
        console.log('   2. Ir em "SQL Editor"');
        console.log('   3. Colar e executar o SQL manualmente');
        console.log('\n💡 Ou adicionar seu IP à lista de permissões e usar o CLI do Supabase.');
      }
      process.exit(1);
    }

    console.log('✅ SQL executado com sucesso!');
    if (responseText) {
      console.log('Resultado:', responseText);
    }
    
  } catch (err) {
    console.error('❌ Erro ao executar SQL:', err.message);
    console.log('\n📝 Instruções alternativas:');
    console.log('   1. Acesse: https://uqtgsvujwcbymjmvkjhy.supabase.co');
    console.log('   2. Vá em "SQL Editor"');
    console.log('   3. Execute o SQL manualmente');
    process.exit(1);
  }
}

executeSql();
