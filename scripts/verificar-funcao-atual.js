const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function verificarFuncao() {
  try {
    await client.connect();
    
    console.log('Verificando definição da função calculate_evento_metrics...\n');
    
    const result = await client.query(`
      SELECT pg_get_functiondef('calculate_evento_metrics'::regproc)
    `);
    
    const funcDef = result.rows[0].pg_get_functiondef;
    
    // Verificar se tem os arrays dinâmicos
    if (funcDef.includes('locais_bebidas TEXT[]')) {
      console.log('✓ Função TEM declaração de arrays dinâmicos');
    } else {
      console.log('✗ Função NÃO TEM declaração de arrays dinâmicos');
    }
    
    if (funcDef.includes('IF evento_record.bar_id = 3 THEN')) {
      console.log('✓ Função TEM lógica condicional por bar_id');
    } else {
      console.log('✗ Função NÃO TEM lógica condicional por bar_id');
    }
    
    if (funcDef.includes('loc_desc = ANY(locais_bebidas)')) {
      console.log('✓ Função USA arrays dinâmicos na query');
    } else {
      console.log('✗ Função NÃO USA arrays dinâmicos na query');
    }
    
    // Salvar definição completa
    const fs = require('fs');
    fs.writeFileSync('c:/Projects/zykor/funcao_atual_definicao.sql', funcDef, 'utf8');
    console.log('\n✓ Definição completa salva em funcao_atual_definicao.sql');
    
    await client.end();
    
  } catch (err) {
    console.error('ERRO:', err.message);
    await client.end();
    process.exit(1);
  }
}

verificarFuncao();