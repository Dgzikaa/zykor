// Script para processar pagamentos de Vale Transporte - 30/01/2026
// Execução: node scripts/pagamentos-vt-30-jan.js

// Usar localhost se disponível, senão produção
const BASE_URL = process.env.LOCAL ? 'http://localhost:3001' : 'https://zykor.com.br';

// Dados do Ordinário (bar_id = 3)
const pagamentosOrdinario = [
  { nome_beneficiario: "ALEXANDRE JOSE DA SILVA BRITO", chave_pix: "BRITTOALEXANDRE1@GMAIL.COM", valor: "R$ 424,20", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ANA CLARA NUNES", chave_pix: "059.049.731-60", valor: "R$ 363,30", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ANA JULIA RIBEIRO DOS SANTOS", chave_pix: "075.572.151-92", valor: "R$ 327,60", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ANA LUÍZA ARAÚJO DE SOUZA", chave_pix: "091.992.491-38", valor: "R$ 428,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "BEATRIZ DOS ANJOS SOUZA REIS", chave_pix: "4519ab5f-6bf0-48a2-ba66-911645251792", valor: "R$ 363,30", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "BRUNO DA SILVA DE OLIVEIRA", chave_pix: "(61) 9 9642-2475", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "DAKOTA OASIS LEVY DE OLIVEIRA GODOY", chave_pix: "(61) 9 96925505", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "DIEGO GALDINO RIBEIRO", chave_pix: "(61) 9 93365088", valor: "R$ 264,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "EDNA JULIA GOMES DE OLIVEIRA CRUZ", chave_pix: "ednajulia892@gmail.com", valor: "R$ 209,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ELIAS COSTA LIMA SILVA", chave_pix: "61995020995", valor: "R$ 276,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "EDUARDO DA SILVA LIMA", chave_pix: "(61) 9 92251525", valor: "R$ 449,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ELSON DE SOUSA BARBOSA", chave_pix: "elsonsousab@gmail.com", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "FRANCINETE GONÇAVES DE OLIVEIRA", chave_pix: "(61) 9 95429732", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "GELCI DE SOUSA", chave_pix: "076.663.661-59", valor: "R$ 220,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "GABRIEL DA SILVA OLIVEIRA", chave_pix: "gs5052648@gmail.com", valor: "R$ 449,40", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "GUSTAVO DE SOUSA RODRIGUES", chave_pix: "065.424.961-06", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "GEOVANE BARBOSA DA SILVA", chave_pix: "4817147156", valor: "R$ 462,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "HADASSA LEITE", chave_pix: "890.181.762-49", valor: "R$ 327,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "HÉLIO DE ALMEIDA", chave_pix: "051.035.691-59", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ISAAC DE ARAÚJO CARVALHO", chave_pix: "070.560.621-05", valor: "R$ 363,30", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "JEDYEL RUBENS RODRIGUES DA SILVA COSTA", chave_pix: "068.504.971-03", valor: "R$ 363,30", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "JHEYDI NATHALY GONTIJO DE MENDEIROS", chave_pix: "041.287.651-55", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "JHULY NAYLI PAIXÃO REIS", chave_pix: "616.860.623-89", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "JOÃO VITOR PINHEIRO DUARTE", chave_pix: "6745957183", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "JABER PAZ DE BARROS CLEMENTINO", chave_pix: "102.506.691-02", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "JOYCE DE SOUZA BRITO", chave_pix: "013.114.121-07", valor: "R$ 424,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "KATHLEN LORRANE DE SOUZA FERNANDES", chave_pix: "61 996794187", valor: "R$ 462,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "KAUAN OTAVIANO DE OLIVEIRA", chave_pix: "055.262.401-26", valor: "R$ 484,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "LAUANE MOREIRA DOS SANTOS", chave_pix: "(61) 9 9444-6735", valor: "R$ 338,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "LUAN SALLES RODRIGUES DE MENDONCA", chave_pix: "044.071.011-13", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "LUCIA ELENA DA SILVA", chave_pix: "(61) 9 85333769", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "MARCELO DO NASCIMENTO", chave_pix: "027.491.761-07", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "MATHEUS LIMA DE JESUS", chave_pix: "088.580.111-39", valor: "R$ 374,30", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "MATHEUS MONTENEGRO", chave_pix: "(61) 9 9286-9259", valor: "R$ 468,30", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "MATHEUS OLIVEIRA QUEIROZ", chave_pix: "050.471.241-18", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "MIRELLY FERREIRA DA SILVA", chave_pix: "(61) 9 94500236", valor: "R$ 220,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "NAYARA GONÇALVES DA CONCEICAO", chave_pix: "182.312.286-83", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "PAULA SILVA RODRIGUES", chave_pix: "041.570.211-93", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "PAULO EMANUEL SANCHO ALVES RODRIGUES", chave_pix: "10283427132", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "PHELIPE FERREIRA DA SILVA", chave_pix: "017.880.441-00", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "RENAN VICTOR SANTANA DA SILVA", chave_pix: "renaannvicsan@gmail.com", valor: "R$ 327,60", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "RENATO AUGUSTO BATISTA", chave_pix: "(61) 9 83334523", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "RICARDO SOARES DOS SANTOS", chave_pix: "wolly2508@gmail.com", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "RITA DE CÁSSIA SILVA DOS SANTOS", chave_pix: "silvaritadecassia092@gmail.com", valor: "R$ 327,60", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "TALITA TEIXEIRA", chave_pix: "tallysantos2004@gmail.com", valor: "R$ 327,60", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "THAYLSON LIMA DE OLIVEIRA", chave_pix: "THAYLSON.LIMA@HOTMAIL.COM", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "WENDEL CABRAL", chave_pix: "042.930.661-01", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "VIVIAN PEREIRA DOS SANTOS", chave_pix: "089.618.651-29", valor: "R$ 468,30", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "MARIA FERNANDA OLIVEIRA BASTOS", chave_pix: "056.417.079-88", valor: "R$ 371,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ANDREIA PEREIRA DA SILVA", chave_pix: "070.396.301-50", valor: "R$ 231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ANA PAULA RODRIGUES MARTINS", chave_pix: "010.309.081-92", valor: "R$ 170,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "DANIEL BARCELOS", chave_pix: "987.552.851-04", valor: "R$ 242,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
];

// Dados do Deboche (bar_id = 4)
const pagamentosDeboche = [
  { nome_beneficiario: "ALAN PEREIRA LISBOA", chave_pix: "(61) 9 9256-3198", valor: "R$286,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ALANE DE JESUS SANTOS", chave_pix: "053.315.551-79", valor: "R$380,60", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "RAISSA AYANNA HADASSAH GADHRIRRAH MACHADO GOMES", chave_pix: "(61) 9 9859-4048", valor: "R$176,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "BEATRIZ SANTOS DA SILVA", chave_pix: "056.517.371-54", valor: "R$253,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "CAMYLLA DOS SANTOS ALVES", chave_pix: "031.874.471-63", valor: "R$253,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "CAUÃ MATEUS DOS SANTOS", chave_pix: "089.698.631-41", valor: "R$380,60", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "DEIVID HENRIQUE COSTA MORAES", chave_pix: "henricostamoraes@gmail.com", valor: "R$242,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ESTER VITORIA RAMOS DE JESUS", chave_pix: "(61) 97402-4180", valor: "R$176,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ISAIAS CARNEIRO GOMES SANTOS", chave_pix: "(61) 9 94387667", valor: "R$242,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "LAUANE MOREIRA DOS SANTOS", chave_pix: "(61) 9 9444-6735", valor: "R$413,60", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "MANOELA GOMES DO NASCIMENTO", chave_pix: "(61) 9 8458-6958", valor: "R$242,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "MICHELE SILVA DA COSTA", chave_pix: "015.608.931-92", valor: "R$242,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "RAQUEL RODRIGUES DE ARAUJO", chave_pix: "006.694.101-60", valor: "R$470,80", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "THAIS HIGINO DOS SANTOS", chave_pix: "071.459.801-18", valor: "R$231,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "THIAGO BORGES MORAIS", chave_pix: "017.776.051-64", valor: "R$242,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "YAGO LOPO ALECRIM", chave_pix: "(61) 9 9888-8055", valor: "R$242,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ARTUR AMARAL PELINSKY", chave_pix: "043.386.461-36", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "ANA ELIZA MACHADO MARTINS CHAVES", chave_pix: "020.414.241-50", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "DÉBORA TEREZA EVANGELISTA ROBERTO", chave_pix: "(61) 9 83138169", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "DANIELI SANTOS DIEB DA GUARDA", chave_pix: "(61) 9 8374-9088", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "DAVID MARQUES LUCAS BELMIRO", chave_pix: "61 991919149", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "THAÍS DIAS PEREIRA GOUVEIA", chave_pix: "thatadpg@gmail.com", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "PAULO ANDRÉ DE LAVOR MIRANDA", chave_pix: "022.275.861-92", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "CAIRO MATHEUS GARCIA FRANCO", chave_pix: "(61) 9 8259-7198", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "CAIO TRAVASSOS CAVALCANTI", chave_pix: "094.406.331-40", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "KATRINNY SENA CALDEIRA", chave_pix: "katrinnysenacaldeira@gmail.com", valor: "R$170,00", descricao: "AJUDA DE CUSTO", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
  { nome_beneficiario: "LUCAS MARQUES DIAS ARAUJO LOUZEIRO", chave_pix: "(61) 9 82690702", valor: "R$297,00", descricao: "VALE TRANSPORTE", data_pagamento: "30/01/2026", data_competencia: "30/01/2026" },
];

// IDs das categorias (PREENCHA COM OS IDs CORRETOS DO SEU NIBO)
// Para encontrar os IDs, acesse a página de agendamento e veja no dropdown
const CATEGORIAS_ORDINARIO = {
  'VALE TRANSPORTE': null, // Será preenchido automaticamente ou use ID fixo
  'AJUDA DE CUSTO': null,
};

const CATEGORIAS_DEBOCHE = {
  'VALE TRANSPORTE': null,
  'AJUDA DE CUSTO': null,
};

// Função para buscar categorias do NIBO
async function buscarCategorias(barId) {
  try {
    console.log(`   Buscando categorias para bar_id=${barId}...`);
    const response = await fetch(`${BASE_URL}/api/financeiro/nibo/categorias?bar_id=${barId}`);
    const data = await response.json();
    
    console.log('   Resposta da API:', JSON.stringify(data).substring(0, 500));
    
    if (data.categorias && Array.isArray(data.categorias)) {
      // Criar mapa de nome -> id
      const mapa = {};
      data.categorias.forEach(cat => {
        if (!cat) return;
        // O nome pode estar em diferentes campos
        const nome = cat.categoria_nome || cat.name || cat.nome || cat.description || '';
        if (!nome) return;
        
        const nomeNormalizado = nome.toUpperCase().trim();
        const id = cat.nibo_id || cat.id || cat.categoryId;
        
        mapa[nomeNormalizado] = id;
        
        // Verificar se é vale transporte ou ajuda de custo
        if (nomeNormalizado.includes('VALE') && nomeNormalizado.includes('TRANSPORTE')) {
          mapa['VALE TRANSPORTE'] = id;
        }
        if (nomeNormalizado.includes('AJUDA') && nomeNormalizado.includes('CUSTO')) {
          mapa['AJUDA DE CUSTO'] = id;
        }
        if (nomeNormalizado.includes('VT') || nomeNormalizado === 'VT') {
          mapa['VALE TRANSPORTE'] = id;
        }
        if (nomeNormalizado.includes('TRANSPORTE')) {
          mapa['VALE TRANSPORTE'] = id;
        }
        // Fallback: usar Recursos Humanos ou Salário Funcionários se VT não existir
        if (nomeNormalizado === 'RECURSOS HUMANOS' || nomeNormalizado === 'SALÁRIO FUNCIONÁRIOS') {
          if (!mapa['FALLBACK_RH']) mapa['FALLBACK_RH'] = id;
        }
        if (nomeNormalizado.includes('AJUDA')) {
          mapa['AJUDA DE CUSTO'] = id;
        }
      });
      
      console.log('   Categorias mapeadas:', Object.entries(mapa).slice(0, 5).map(([k,v]) => `${k}=${v}`).join(', '));
      return mapa;
    }
    
    console.log('   Nenhuma categoria encontrada na resposta');
    return {};
  } catch (error) {
    console.error('   Erro ao buscar categorias:', error.message);
    return {};
  }
}

// Função para detectar tipo de chave PIX
function detectarTipoPix(chave) {
  const chaveLimpa = chave.replace(/\D/g, '');
  
  if (chave.includes('@')) return 'EMAIL';
  if (chaveLimpa.length === 11 && !chave.includes('(')) return 'CPF';
  if (chaveLimpa.length === 14) return 'CNPJ';
  if (chave.includes('(') || chave.includes('-') || chaveLimpa.length === 10 || chaveLimpa.length === 11) return 'PHONE';
  if (chave.includes('-') && chave.length > 20) return 'RANDOM'; // UUID
  
  return 'CPF'; // fallback
}

// Função para formatar valor
function formatarValor(valorStr) {
  // Remover R$, espaços, e converter separadores
  let limpo = valorStr
    .replace('R$', '')
    .replace(/\s/g, '')  // Remove todos os espaços
    .trim();
  
  // Se tem ponto e vírgula, é formato brasileiro (1.234,56)
  if (limpo.includes('.') && limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes(',')) {
    // Se só tem vírgula, é decimal brasileiro (234,56)
    limpo = limpo.replace(',', '.');
  }
  
  const valor = parseFloat(limpo);
  console.log(`   Valor parseado: "${valorStr}" -> ${valor}`);
  return valor;
}

// Função para formatar data para YYYY-MM-DD
function formatarData(dataStr) {
  const [dia, mes, ano] = dataStr.split('/');
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// Função principal para processar pagamentos
async function processarPagamentos(pagamentos, barId, contaNome) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processando ${pagamentos.length} pagamentos - ${contaNome} (bar_id: ${barId})`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Buscar categorias do NIBO
  console.log('🔍 Buscando categorias do NIBO...');
  const categorias = await buscarCategorias(barId);
  
  // Se não encontrou VT, usar fallback
  if (!categorias['VALE TRANSPORTE'] && categorias['FALLBACK_RH']) {
    console.log('⚠️ Categoria "Vale Transporte" não encontrada, usando "Recursos Humanos" como fallback');
    categorias['VALE TRANSPORTE'] = categorias['FALLBACK_RH'];
  }
  
  if (!categorias['VALE TRANSPORTE']) {
    console.error('❌ Nenhuma categoria adequada encontrada! Verifique as categorias no NIBO.');
    console.log('Categorias disponíveis:', Object.keys(categorias).join(', '));
    return { sucessos: 0, erros: pagamentos.length, errosDetalhados: [{ nome: 'TODOS', erro: 'Categoria não encontrada' }] };
  }
  
  console.log(`✅ Categoria VT: ${categorias['VALE TRANSPORTE']}`);
  if (categorias['AJUDA DE CUSTO']) {
    console.log(`✅ Categoria Ajuda de Custo: ${categorias['AJUDA DE CUSTO']}`);
  }
  
  let sucessos = 0;
  let erros = 0;
  const errosDetalhados = [];
  
  for (let i = 0; i < pagamentos.length; i++) {
    const pag = pagamentos[i];
    const tipoPix = detectarTipoPix(pag.chave_pix);
    const categoriaId = categorias[pag.descricao] || categorias['VALE TRANSPORTE'];
    
    console.log(`[${i + 1}/${pagamentos.length}] ${pag.nome_beneficiario} - ${pag.valor}`);
    
    try {
      // A API espera valor como string no formato "R$ 123,45" ou "123.45"
      const valorString = pag.valor; // Manter como string original
      
      const payload = {
        nome_beneficiario: pag.nome_beneficiario,
        chave_pix: pag.chave_pix,
        tipo: tipoPix,
        valor: valorString, // Enviar como string
        descricao: pag.descricao,
        data_pagamento: pag.data_pagamento, // Formato DD/MM/YYYY
        data_competencia: pag.data_competencia, // Formato DD/MM/YYYY
        categoria_id: categoriaId,
        bar_id: barId,
        conta: contaNome
      };
      
      const response = await fetch(`${BASE_URL}/api/agendamento/processar-automatico`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`   ✅ Sucesso - NIBO ID: ${result.nibo_id || 'N/A'}`);
        sucessos++;
      } else {
        console.log(`   ❌ Erro: ${result.error}`);
        erros++;
        errosDetalhados.push({ nome: pag.nome_beneficiario, erro: result.error });
      }
    } catch (error) {
      console.log(`   ❌ Erro de conexão: ${error.message}`);
      erros++;
      errosDetalhados.push({ nome: pag.nome_beneficiario, erro: error.message });
    }
    
    // Delay entre requisições para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Resumo ${contaNome}:`);
  console.log(`  ✅ Sucessos: ${sucessos}`);
  console.log(`  ❌ Erros: ${erros}`);
  console.log(`${'='.repeat(60)}\n`);
  
  if (errosDetalhados.length > 0) {
    console.log('Detalhes dos erros:');
    errosDetalhados.forEach(e => console.log(`  - ${e.nome}: ${e.erro}`));
  }
  
  return { sucessos, erros, errosDetalhados };
}

// Executar
async function main() {
  console.log('🚀 Iniciando processamento de pagamentos...\n');
  console.log(`📅 Data de pagamento: 30/01/2026`);
  console.log(`📅 Data de competência: 30/01/2026\n`);
  
  // Processar Ordinário
  const resultOrdinario = await processarPagamentos(pagamentosOrdinario, 3, 'Ordinário');
  
  // Processar Deboche
  const resultDeboche = await processarPagamentos(pagamentosDeboche, 4, 'Deboche');
  
  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`Ordinário: ${resultOrdinario.sucessos} sucessos, ${resultOrdinario.erros} erros`);
  console.log(`Deboche: ${resultDeboche.sucessos} sucessos, ${resultDeboche.erros} erros`);
  console.log(`Total: ${resultOrdinario.sucessos + resultDeboche.sucessos} sucessos, ${resultOrdinario.erros + resultDeboche.erros} erros`);
  console.log('='.repeat(60));
}

main().catch(console.error);
