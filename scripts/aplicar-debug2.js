const fs = require('fs');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function aplicarDebug2() {
  try {
    await client.connect();
    
    const sql = fs.readFileSync('c:/Projects/zykor/temp_function_debug2.sql', 'utf8');
    
    console.log('Aplicando função debug2...');
    await client.query(sql);
    console.log('✓ Função aplicada\n');
    
    await client.query('SET client_min_messages TO NOTICE');
    
    client.on('notice', (msg) => {
      console.log('NOTICE:', msg.message);
    });
    
    console.log('Recalculando evento 723...\n');
    await client.query('SELECT calculate_evento_metrics(723)');
    
    const result = await client.query('SELECT percent_b, percent_c, percent_d FROM eventos_base WHERE id = 723');
    const updated = result.rows[0];
    
    console.log('\n=== RESULTADO ===');
    console.log('  %Bebidas:', parseFloat(updated.percent_b || 0).toFixed(2) + '%');
    console.log('  %Drinks:', parseFloat(updated.percent_d || 0).toFixed(2) + '%');
    console.log('  %Comida:', parseFloat(updated.percent_c || 0).toFixed(2) + '%');
    
    await client.end();
    
  } catch (err) {
    console.error('ERRO:', err.message);
    await client.end();
    process.exit(1);
  }
}

aplicarDebug2();