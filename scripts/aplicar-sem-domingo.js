const fs = require('fs');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function aplicarETestar() {
  try {
    await client.connect();
    console.log('✓ Conectado ao banco de dados');
    
    const sql = fs.readFileSync('c:/Projects/zykor/temp_function_sem_domingo.sql', 'utf8');
    
    console.log('\nAplicando função SEM verificação de domingo...');
    await client.query(sql);
    console.log('✓ Função aplicada');
    
    console.log('\nRecalculando evento 723...');
    await client.query('SELECT calculate_evento_metrics(723)');
    console.log('✓ Recálculo executado');
    
    // Buscar resultado
    const result = await client.query(`
      SELECT percent_b, percent_c, percent_d, real_r, cl_real
      FROM eventos_base
      WHERE id = 723
    `);
    
    const updated = result.rows[0];
    console.log('\n=== RESULTADO ===');
    console.log('Evento: 723 - Pagode Lucas Alves + Final Super Copa');
    console.log('Data: 01/02/2026 (Deboche - bar_id=4)');
    console.log('\nPercentuais:');
    console.log('  %Bebidas (Salao):', parseFloat(updated.percent_b || 0).toFixed(2) + '%');
    console.log('  %Drinks (Bar):', parseFloat(updated.percent_d || 0).toFixed(2) + '%');
    console.log('  %Comida (Cozinha):', parseFloat(updated.percent_c || 0).toFixed(2) + '%');
    const total = parseFloat(updated.percent_b || 0) + parseFloat(updated.percent_c || 0) + parseFloat(updated.percent_d || 0);
    console.log('  Total:', total.toFixed(2) + '%');
    console.log('\nReceita Real: R$', parseFloat(updated.real_r || 0).toFixed(2));
    console.log('Clientes Real:', updated.cl_real);
    
    // Restaurar função original
    console.log('\n\nRestaurando função original COM verificação de domingo...');
    const sqlOriginal = fs.readFileSync('c:/Projects/zykor/temp_function_dynamic_arrays_nobom.sql', 'utf8');
    await client.query(sqlOriginal);
    console.log('✓ Função original restaurada');
    
    await client.end();
    
  } catch (err) {
    console.error('\nERRO:', err.message);
    await client.end();
    process.exit(1);
  }
}

aplicarETestar();