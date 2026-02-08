// Script temporário para ler a planilha
const http = require('http');

http.get('http://localhost:3000/api/debug/ler-planilha', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('=== PLANILHA ===');
    console.log('ID:', json.spreadsheet_id);
    console.log('Abas:', json.abas);
    console.log('\n');
    
    for (const aba of json.abas) {
      const dados = json.dados[aba];
      console.log(`\n=== ABA: ${aba} ===`);
      console.log(`Total de linhas: ${dados.length}`);
      if (dados.length > 0) {
        console.log('Cabeçalho:', dados[0]);
        console.log('Primeiras 5 linhas de dados:');
        dados.slice(1, 6).forEach((row, i) => {
          console.log(`  Linha ${i+1}:`, row);
        });
      }
    }
  });
}).on('error', err => console.error('Erro:', err));
