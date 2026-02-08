import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = '1y4wR3dxIpfIkWQdPdfQ2V889p_NXIDCU1tGt2PWx57Y';

/**
 * Gerar JWT assinado para Google Service Account
 */
async function gerarJWT(clientEmail: string, privateKeyPem: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const base64url = (data: Uint8Array): string => {
    const base64 = Buffer.from(data).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign({
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });

  const signatureB64 = base64url(signature);
  return `${unsignedToken}.${signatureB64}`;
}

async function obterAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = await gerarJWT(clientEmail, privateKey);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao obter access token: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function buscarDadosAba(accessToken: string, aba: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(aba)}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao buscar aba ${aba}: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.values || [];
}

function parseMonetario(valor: string | null | undefined): number {
  if (!valor) return 0;
  const str = valor.toString().trim();
  if (str === '' || str === '-' || str.includes('#REF')) return 0;
  const limpo = str
    .replace(/R\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/\s/g, '')
    .replace(/[()]/g, '');
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

function parsePercentual(valor: string | null | undefined): number {
  if (!valor) return 0;
  const limpo = valor.toString().replace('%', '').replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

// Mapear mês do cabeçalho para número
function parseMesAno(cabecalho: string): { mes: number; ano: number } | null {
  const meses: Record<string, number> = {
    'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'abril': 4,
    'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
    'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
  };
  
  const match = cabecalho.toLowerCase().match(/(\w+)\s*(?:de\s*)?(\d{4})/);
  if (match) {
    const mesNome = match[1];
    const ano = parseInt(match[2]);
    const mes = meses[mesNome];
    if (mes && ano) {
      return { mes, ano };
    }
  }
  return null;
}

interface ProvisaoPlanilha {
  funcionario_nome: string;
  mes: number;
  ano: number;
  salario_bruto_produtividade: number;
  comissao_bonus: number;
  decimo_terceiro: number;
  ferias: number;
  dias_ferias_vencidos: number;
  ferias_vencidas: number;
  terco_ferias: number;
  inss_provisao: number;
  fgts_provisao: number;
  multa_fgts: number;
  provisao_certa: number;
  provisao_eventual: number;
  percentual_salario: number;
}

/**
 * POST /api/rh/importar-provisoes
 * Importa provisões históricas da planilha PROVISÕES
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id } = body;

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // Pegar credenciais
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      return NextResponse.json(
        { error: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada' },
        { status: 500 }
      );
    }

    const credentials = JSON.parse(serviceAccountKey);
    const { client_email, private_key } = credentials;

    const accessToken = await obterAccessToken(client_email, private_key);

    // Buscar dados da aba PROVISÕES
    const dados = await buscarDadosAba(accessToken, 'PROVISÕES');

    if (!dados || dados.length < 2) {
      return NextResponse.json(
        { error: 'Dados não encontrados na aba PROVISÕES' },
        { status: 404 }
      );
    }

    // Parsear provisões
    // A aba tem blocos por mês, começando com "MÊS DE ANO" e depois linhas de funcionários
    const provisoes: ProvisaoPlanilha[] = [];
    let mesAnoAtual: { mes: number; ano: number } | null = null;
    
    for (let i = 0; i < dados.length; i++) {
      const linha = dados[i];
      if (!linha || linha.length === 0) continue;
      
      // Verificar se é cabeçalho de mês (ex: "JANEIRO DE 2022")
      const primeiraColuna = linha[0]?.toString().trim().toUpperCase();
      
      if (primeiraColuna && primeiraColuna.includes('DE 20')) {
        mesAnoAtual = parseMesAno(primeiraColuna);
        continue;
      }
      
      // Pular linha de cabeçalho (Funcionário, Salário, etc)
      if (primeiraColuna === 'FUNCIONÁRIO' || primeiraColuna === 'FUNCIONARIO') {
        continue;
      }
      
      // Linha de funcionário
      if (mesAnoAtual && linha[0] && linha[0].trim().length > 1) {
        const nome = linha[0]?.trim();
        
        // Ignorar se parece ser cabeçalho ou total
        if (nome.toLowerCase().includes('total') || 
            nome.toLowerCase().includes('funcionário') ||
            nome.toLowerCase().includes('salário')) {
          continue;
        }

        // Estrutura esperada da planilha:
        // 0: Funcionário
        // 1: Salário Bruto c/ Produtividade e Noturno
        // 2: ComissãoBruta+Bônus
        // 3: 13º
        // 4: Férias
        // 5: Dias de férias Vencidos
        // 6: (vazio)
        // 7: Férias Vencidas
        // 8: 1/3 Férias
        // 9: 13ª+Férias (ignorar, é soma)
        // 10: INSS (12%)
        // 11: FGTS (8%)
        // 12: Recisão (40%FGTS)
        // 13: Provisão Certa
        // 14: Provisão Eventual
        // 15: %salário

        provisoes.push({
          funcionario_nome: nome,
          mes: mesAnoAtual.mes,
          ano: mesAnoAtual.ano,
          salario_bruto_produtividade: parseMonetario(linha[1]),
          comissao_bonus: parseMonetario(linha[2]),
          decimo_terceiro: parseMonetario(linha[3]),
          ferias: parseMonetario(linha[4]),
          dias_ferias_vencidos: parseInt(linha[5]) || 0,
          ferias_vencidas: parseMonetario(linha[7]),
          terco_ferias: parseMonetario(linha[8]),
          inss_provisao: parseMonetario(linha[10]),
          fgts_provisao: parseMonetario(linha[11]),
          multa_fgts: parseMonetario(linha[12]),
          provisao_certa: parseMonetario(linha[13]),
          provisao_eventual: parseMonetario(linha[14]),
          percentual_salario: parsePercentual(linha[15])
        });
      }
    }

    if (provisoes.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma provisão encontrada na planilha' },
        { status: 404 }
      );
    }

    // Inserir provisões no banco
    const supabase = await getAdminClient();

    const provisoesParaInserir = provisoes.map(p => ({
      bar_id,
      funcionario_nome: p.funcionario_nome,
      funcionario_id: null, // Será vinculado depois se necessário
      mes: p.mes,
      ano: p.ano,
      salario_bruto_produtividade: p.salario_bruto_produtividade,
      comissao_bonus: p.comissao_bonus,
      decimo_terceiro: p.decimo_terceiro,
      ferias: p.ferias,
      dias_ferias_vencidos: p.dias_ferias_vencidos,
      ferias_vencidas: p.ferias_vencidas,
      terco_ferias: p.terco_ferias,
      inss_provisao: p.inss_provisao,
      fgts_provisao: p.fgts_provisao,
      multa_fgts: p.multa_fgts,
      provisao_certa: p.provisao_certa,
      provisao_eventual: p.provisao_eventual,
      percentual_salario: p.percentual_salario
    }));

    // Inserir em lotes
    const batchSize = 100;
    let totalInseridos = 0;
    const erros: string[] = [];

    for (let i = 0; i < provisoesParaInserir.length; i += batchSize) {
      const batch = provisoesParaInserir.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('provisoes_trabalhistas')
        .insert(batch);

      if (error) {
        erros.push(`Lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        totalInseridos += batch.length;
      }
    }

    // Agrupar por mês/ano para resumo
    const resumoPorMes = new Map<string, number>();
    provisoes.forEach(p => {
      const key = `${p.mes}/${p.ano}`;
      resumoPorMes.set(key, (resumoPorMes.get(key) || 0) + 1);
    });

    return NextResponse.json({
      success: erros.length === 0,
      message: `${totalInseridos} provisões importadas com sucesso`,
      total_encontradas: provisoes.length,
      total_inseridas: totalInseridos,
      resumo_por_mes: Object.fromEntries(resumoPorMes),
      erros: erros.length > 0 ? erros : undefined
    });

  } catch (error) {
    console.error('Erro ao importar provisões:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rh/importar-provisoes
 * Preview das provisões que serão importadas
 */
export async function GET() {
  try {
    // Pegar credenciais
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      return NextResponse.json(
        { error: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada' },
        { status: 500 }
      );
    }

    const credentials = JSON.parse(serviceAccountKey);
    const { client_email, private_key } = credentials;

    const accessToken = await obterAccessToken(client_email, private_key);
    const dados = await buscarDadosAba(accessToken, 'PROVISÕES');

    // Contar linhas e meses
    let totalLinhas = 0;
    const mesesEncontrados = new Set<string>();
    let mesAnoAtual: { mes: number; ano: number } | null = null;

    for (const linha of dados) {
      if (!linha || linha.length === 0) continue;
      
      const primeiraColuna = linha[0]?.toString().trim().toUpperCase();
      
      if (primeiraColuna && primeiraColuna.includes('DE 20')) {
        mesAnoAtual = parseMesAno(primeiraColuna);
        if (mesAnoAtual) {
          mesesEncontrados.add(`${mesAnoAtual.mes}/${mesAnoAtual.ano}`);
        }
        continue;
      }
      
      if (primeiraColuna === 'FUNCIONÁRIO' || primeiraColuna === 'FUNCIONARIO') continue;
      
      if (mesAnoAtual && linha[0] && linha[0].trim().length > 1) {
        const nome = linha[0]?.trim().toLowerCase();
        if (!nome.includes('total') && !nome.includes('funcionário') && !nome.includes('salário')) {
          totalLinhas++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      total_linhas: totalLinhas,
      meses_encontrados: Array.from(mesesEncontrados).sort(),
      total_meses: mesesEncontrados.size
    });

  } catch (error) {
    console.error('Erro ao buscar preview:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
