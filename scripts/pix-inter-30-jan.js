// Script para enviar PIX direto pelo Inter (sem NIBO)
// Data: 30/01/2026

const BASE_URL = process.env.LOCAL ? 'http://localhost:3001' : 'https://zykor.com.br';

// Pagamentos do Ordinário (bar_id: 3)
const PAGAMENTOS_ORDINARIO = [
  { nome: 'ALEXANDRE JOSE DA SILVA BRITO', chave: 'BRITTOALEXANDRE1@GMAIL.COM', valor: 'R$ 424,20', descricao: 'VALE TRANSPORTE' },
  { nome: 'ANA CLARA NUNES', chave: '059.049.731-60', valor: 'R$ 363,30', descricao: 'VALE TRANSPORTE' },
  { nome: 'ANA JULIA RIBEIRO DOS SANTOS', chave: '075.572.151-92', valor: 'R$ 327,60', descricao: 'VALE TRANSPORTE' },
  { nome: 'ANA LUÍZA ARAÚJO DE SOUZA', chave: '091.992.491-38', valor: 'R$ 428,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'BEATRIZ DOS ANJOS SOUZA REIS', chave: '4519ab5f-6bf0-48a2-ba66-911645251792', valor: 'R$ 363,30', descricao: 'VALE TRANSPORTE' },
  { nome: 'BRUNO DA SILVA DE OLIVEIRA', chave: '(61) 9 9642-2475', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'DAKOTA OASIS LEVY DE OLIVEIRA GODOY', chave: '(61) 9 96925505', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'DIEGO GALDINO RIBEIRO', chave: '(61) 9 93365088', valor: 'R$ 264,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'EDNA JULIA GOMES DE OLIVEIRA CRUZ', chave: 'ednajulia892@gmail.com', valor: 'R$ 209,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'ELIAS COSTA LIMA SILVA', chave: '61995020995', valor: 'R$ 276,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'EDUARDO DA SILVA LIMA', chave: '(61) 9 92251525', valor: 'R$ 449,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'ELSON DE SOUSA BARBOSA', chave: 'elsonsousab@gmail.com', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'FRANCINETE GONÇAVES DE OLIVEIRA', chave: '(61) 9 95429732', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'GELCI DE SOUSA', chave: '076.663.661-59', valor: 'R$ 220,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'GABRIEL DA SILVA OLIVEIRA', chave: 'gs5052648@gmail.com', valor: 'R$ 449,40', descricao: 'VALE TRANSPORTE' },
  { nome: 'GUSTAVO DE SOUSA RODRIGUES', chave: '065.424.961-06', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'GEOVANE BARBOSA DA SILVA', chave: '4817147156', valor: 'R$ 462,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'HADASSA LEITE', chave: '890.181.762-49', valor: 'R$ 327,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'HÉLIO DE ALMEIDA', chave: '051.035.691-59', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'ISAAC DE ARAÚJO CARVALHO', chave: '070.560.621-05', valor: 'R$ 363,30', descricao: 'VALE TRANSPORTE' },
  { nome: 'JEDYEL RUBENS RODRIGUES DA SILVA COSTA', chave: '068.504.971-03', valor: 'R$ 363,30', descricao: 'VALE TRANSPORTE' },
  { nome: 'JHEYDI NATHALY GONTIJO DE MENDEIROS', chave: '041.287.651-55', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'JHULY NAYLI PAIXÃO REIS', chave: '616.860.623-89', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'JOÃO VITOR PINHEIRO DUARTE', chave: '6745957183', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'JABER PAZ DE BARROS CLEMENTINO', chave: '102.506.691-02', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'JOYCE DE SOUZA BRITO', chave: '013.114.121-07', valor: 'R$ 424,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'KATHLEN LORRANE DE SOUZA FERNANDES', chave: '61 996794187', valor: 'R$ 462,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'KAUAN OTAVIANO DE OLIVEIRA', chave: '055.262.401-26', valor: 'R$ 484,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'LAUANE MOREIRA DOS SANTOS', chave: '(61) 9 9444-6735', valor: 'R$ 338,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'LUAN SALLES RODRIGUES DE MENDONCA', chave: '044.071.011-13', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'LUCIA ELENA DA SILVA', chave: '(61) 9 85333769', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'MARCELO DO NASCIMENTO', chave: '027.491.761-07', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'MATHEUS LIMA DE JESUS', chave: '088.580.111-39', valor: 'R$ 374,30', descricao: 'VALE TRANSPORTE' },
  { nome: 'MATHEUS MONTENEGRO', chave: '(61) 9 9286-9259', valor: 'R$ 468,30', descricao: 'VALE TRANSPORTE' },
  { nome: 'MATHEUS OLIVEIRA QUEIROZ', chave: '050.471.241-18', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'MIRELLY FERREIRA DA SILVA', chave: '(61) 9 94500236', valor: 'R$ 220,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'NAYARA GONÇALVES DA CONCEICAO', chave: '182.312.286-83', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'PAULA SILVA RODRIGUES', chave: '041.570.211-93', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'PAULO EMANUEL SANCHO ALVES RODRIGUES', chave: '10283427132', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'PHELIPE FERREIRA DA SILVA', chave: '017.880.441-00', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'RENAN VICTOR SANTANA DA SILVA', chave: 'renaannvicsan@gmail.com', valor: 'R$ 327,60', descricao: 'VALE TRANSPORTE' },
  { nome: 'RENATO AUGUSTO BATISTA', chave: '(61) 9 83334523', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'RICARDO SOARES DOS SANTOS', chave: 'wolly2508@gmail.com', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'RITA DE CÁSSIA SILVA DOS SANTOS', chave: 'silvaritadecassia092@gmail.com', valor: 'R$ 327,60', descricao: 'VALE TRANSPORTE' },
  { nome: 'TALITA TEIXEIRA', chave: 'tallysantos2004@gmail.com', valor: 'R$ 327,60', descricao: 'VALE TRANSPORTE' },
  { nome: 'THAYLSON LIMA DE OLIVEIRA', chave: 'THAYLSON.LIMA@HOTMAIL.COM', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'WENDEL CABRAL', chave: '042.930.661-01', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'VIVIAN PEREIRA DOS SANTOS', chave: '089.618.651-29', valor: 'R$ 468,30', descricao: 'VALE TRANSPORTE' },
  { nome: 'MARIA FERNANDA OLIVEIRA BASTOS', chave: '056.417.079-88', valor: 'R$ 371,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'ANDREIA PEREIRA DA SILVA', chave: '070.396.301-50', valor: 'R$ 231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'ANA PAULA RODRIGUES MARTINS', chave: '010.309.081-92', valor: 'R$ 170,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'DANIEL BARCELOS', chave: '987.552.851-04', valor: 'R$ 242,00', descricao: 'VALE TRANSPORTE' },
];

// Pagamentos do Deboche (bar_id: 4)
const PAGAMENTOS_DEBOCHE = [
  { nome: 'ALAN PEREIRA LISBOA', chave: '(61) 9 9256-3198', valor: 'R$286,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'ALANE DE JESUS SANTOS', chave: '053.315.551-79', valor: 'R$380,60', descricao: 'VALE TRANSPORTE' },
  { nome: 'RAISSA AYANNA HADASSAH GADHRIRRAH MACHADO GOMES', chave: '(61) 9 9859-4048', valor: 'R$176,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'BEATRIZ SANTOS DA SILVA', chave: '056.517.371-54', valor: 'R$253,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'CAMYLLA DOS SANTOS ALVES', chave: '031.874.471-63', valor: 'R$253,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'CAUÃ MATEUS DOS SANTOS', chave: '089.698.631-41', valor: 'R$380,60', descricao: 'VALE TRANSPORTE' },
  { nome: 'DEIVID HENRIQUE COSTA MORAES', chave: 'henricostamoraes@gmail.com', valor: 'R$242,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'ESTER VITORIA RAMOS DE JESUS', chave: '(61) 97402-4180', valor: 'R$176,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'ISAIAS CARNEIRO GOMES SANTOS', chave: '(61) 9 94387667', valor: 'R$242,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'LAUANE MOREIRA DOS SANTOS', chave: '(61) 9 9444-6735', valor: 'R$413,60', descricao: 'VALE TRANSPORTE' },
  { nome: 'MANOELA GOMES DO NASCIMENTO', chave: '(61) 9 8458-6958', valor: 'R$242,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'MICHELE SILVA DA COSTA', chave: '015.608.931-92', valor: 'R$242,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'RAQUEL RODRIGUES DE ARAUJO', chave: '006.694.101-60', valor: 'R$470,80', descricao: 'VALE TRANSPORTE' },
  { nome: 'THAIS HIGINO DOS SANTOS', chave: '071.459.801-18', valor: 'R$231,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'THIAGO BORGES MORAIS', chave: '017.776.051-64', valor: 'R$242,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'YAGO LOPO ALECRIM', chave: '(61) 9 9888-8055', valor: 'R$242,00', descricao: 'VALE TRANSPORTE' },
  { nome: 'ARTUR AMARAL PELINSKY', chave: '043.386.461-36', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'ANA ELIZA MACHADO MARTINS CHAVES', chave: '020.414.241-50', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'DÉBORA TEREZA EVANGELISTA ROBERTO', chave: '(61) 9 83138169', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'DANIELI SANTOS DIEB DA GUARDA', chave: '(61) 9 8374-9088', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'DAVID MARQUES LUCAS BELMIRO', chave: '61 991919149', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'THAÍS DIAS PEREIRA GOUVEIA', chave: 'thatadpg@gmail.com', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'PAULO ANDRÉ DE LAVOR MIRANDA', chave: '022.275.861-92', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'CAIRO MATHEUS GARCIA FRANCO', chave: '(61) 9 8259-7198', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'CAIO TRAVASSOS CAVALCANTI', chave: '094.406.331-40', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'KATRINNY SENA CALDEIRA', chave: 'katrinnysenacaldeira@gmail.com', valor: 'R$170,00', descricao: 'AJUDA DE CUSTO' },
  { nome: 'LUCAS MARQUES DIAS ARAUJO LOUZEIRO', chave: '(61) 9 82690702', valor: 'R$297,00', descricao: 'VALE TRANSPORTE' },
];

// Função para processar pagamentos
async function processarPagamentos(pagamentos, barId, contaNome) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processando ${pagamentos.length} pagamentos - ${contaNome} (bar_id: ${barId})`);
  console.log(`${'='.repeat(60)}\n`);
  
  let sucessos = 0;
  let erros = 0;
  const errosDetalhados = [];
  
  for (let i = 0; i < pagamentos.length; i++) {
    const pag = pagamentos[i];
    console.log(`[${i + 1}/${pagamentos.length}] ${pag.nome} - ${pag.valor}`);
    
    try {
      const payload = {
        destinatario: pag.nome,
        chave: pag.chave,
        valor: pag.valor,
        descricao: `${pag.descricao} - ${pag.nome}`,
        bar_id: barId
      };
      
      const response = await fetch(`${BASE_URL}/api/financeiro/inter/pix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`   ✅ Sucesso - Código: ${result.data?.codigoSolicitacao || 'N/A'}`);
        sucessos++;
      } else {
        console.log(`   ❌ Erro: ${result.error}`);
        erros++;
        errosDetalhados.push({ nome: pag.nome, erro: result.error });
      }
    } catch (error) {
      console.log(`   ❌ Erro de conexão: ${error.message}`);
      erros++;
      errosDetalhados.push({ nome: pag.nome, erro: error.message });
    }
    
    // Delay de 500ms entre requisições para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Resumo ${contaNome}:`);
  console.log(`  ✅ Sucessos: ${sucessos}`);
  console.log(`  ❌ Erros: ${erros}`);
  console.log(`${'='.repeat(60)}`);
  
  if (errosDetalhados.length > 0) {
    console.log('\nDetalhes dos erros:');
    errosDetalhados.forEach(e => console.log(`  - ${e.nome}: ${e.erro}`));
  }
  
  return { sucessos, erros, errosDetalhados };
}

// Executar
async function main() {
  console.log('🚀 Iniciando envio de PIX pelo Banco Inter...');
  console.log(`📍 URL Base: ${BASE_URL}`);
  console.log(`📅 Data: ${new Date().toLocaleDateString('pt-BR')}\n`);
  
  // Processar Ordinário
  const resultOrdinario = await processarPagamentos(PAGAMENTOS_ORDINARIO, 3, 'Ordinário');
  
  // Processar Deboche
  const resultDeboche = await processarPagamentos(PAGAMENTOS_DEBOCHE, 4, 'Deboche');
  
  // Resumo final
  console.log(`\n${'='.repeat(60)}`);
  console.log('RESUMO FINAL');
  console.log(`${'='.repeat(60)}`);
  console.log(`Ordinário: ${resultOrdinario.sucessos} sucessos, ${resultOrdinario.erros} erros`);
  console.log(`Deboche: ${resultDeboche.sucessos} sucessos, ${resultDeboche.erros} erros`);
  console.log(`Total: ${resultOrdinario.sucessos + resultDeboche.sucessos} sucessos, ${resultOrdinario.erros + resultDeboche.erros} erros`);
  console.log(`${'='.repeat(60)}`);
}

main().catch(console.error);
