const fs = require('fs');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function aplicarETestarComDebug() {
  try {
    await client.connect();
    console.log('✓ Conectado ao banco de dados');
    
    const sql = fs.readFileSync('c:/Projects/zykor/temp_function_debug.sql', 'utf8');
    
    console.log('\nAplicando função COM debug...');
    await client.query(sql);
    console.log('✓ Função aplicada');
    
    // Habilitar notices
    await client.query('SET client_min_messages TO NOTICE');
    
    // Capturar notices
    const notices = [];
    client.on('notice', (msg) => {
      notices.push(msg.message);
      console.log('NOTICE:', msg.message);
    });
    
    console.log('\nRecalculando evento 723...');
    await client.query('SELECT calculate_evento_metrics(723)');
    console.log('✓ Recálculo executado');
    
    // Buscar resultado
    const result = await client.query(`
      SELECT percent_b, percent_c, percent_d
      FROM eventos_base
      WHERE id = 723
    `);
    
    const updated = result.rows[0];
    console.log('\n=== RESULTADO ===');
    console.log('  %Bebidas:', parseFloat(updated.percent_b || 0).toFixed(2) + '%');
    console.log('  %Drinks:', parseFloat(updated.percent_d || 0).toFixed(2) + '%');
    console.log('  %Comida:', parseFloat(updated.percent_c || 0).toFixed(2) + '%');
    
    await client.end();
    
  } catch (err) {
    console.error('\nERRO:', err.message);
    console.error('Stack:', err.stack);
    await client.end();
    process.exit(1);
  }
}

aplicarETestarComDebug();