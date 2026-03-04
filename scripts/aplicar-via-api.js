const fs = require('fs');
const https = require('https');

const accessToken = 'sbp_8d7c35d99215a642b6f560af5df7063cdef62b7f';
const projectId = 'uqtgsvujwcbymjmvkjhy';

async function aplicarFuncao() {
  try {
    const sql = fs.readFileSync('c:/Projects/zykor/temp_function_dynamic_arrays.sql', 'utf8');
    
    console.log('Aplicando função calculate_evento_metrics com arrays dinâmicos...');
    console.log('Tamanho do SQL:', sql.length, 'caracteres');
    
    // Usar API REST do Supabase
    const postData = JSON.stringify({ query: sql });
    
    const options = {
      hostname: `${projectId}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3MTk1NTgsImV4cCI6MjA1MDI5NTU1OH0.Ib-1ZjYDvRXEpGJhKJJXvRYLgNGxvGqVxwHQbFNXZI4',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDcxOTU1OCwiZXhwIjoyMDUwMjk1NTU4fQ.sSzxYqZjFdUxDqOmzBZxEhAjZXGxJpHQgWpwjJGWqRU'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
          console.log('✓ Função aplicada com sucesso!');
          console.log('Resposta:', data);
        } else {
          console.error('ERRO:', res.statusCode, data);
          process.exit(1);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('ERRO:', error);
      process.exit(1);
    });
    
    req.write(postData);
    req.end();
    
  } catch (err) {
    console.error('ERRO:', err);
    process.exit(1);
  }
}

aplicarFuncao();