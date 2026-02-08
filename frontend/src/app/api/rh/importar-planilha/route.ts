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

interface FuncionarioPlanilha {
  nome: string;
  tipo: string;
  area: string;
  salario_bruto: number;
}

/**
 * POST /api/rh/importar-planilha
 * Importa funcionários da planilha CMO
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, tipo } = body;

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // Pegar credenciais da Service Account
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      return NextResponse.json(
        { error: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada' },
        { status: 500 }
      );
    }

    const credentials = JSON.parse(serviceAccountKey);
    const { client_email, private_key } = credentials;

    // Obter access token
    const accessToken = await obterAccessToken(client_email, private_key);

    // Buscar dados da aba CMO Semana (ou CMO Mês)
    const abaFuncionarios = tipo === 'mes' ? 'Simulação CMO Mês' : 'CMO Semana';
    const dados = await buscarDadosAba(accessToken, abaFuncionarios);

    if (!dados || dados.length < 3) {
      return NextResponse.json(
        { error: 'Dados não encontrados na planilha' },
        { status: 404 }
      );
    }

    // Parsear funcionários (pulando cabeçalhos)
    // Estrutura: coluna 2 = tipo (Liderança, etc), coluna 3 = nome, coluna 4 = tipo contrato, coluna 5 = área, coluna 7 = salário
    const funcionariosPlanilha: FuncionarioPlanilha[] = [];
    
    for (let i = 2; i < dados.length; i++) {
      const linha = dados[i];
      if (!linha || linha.length < 7) continue;
      
      const nome = linha[2]?.trim();
      const tipoContrato = linha[3]?.trim()?.toUpperCase();
      const area = linha[4]?.trim();
      const salarioBruto = parseMonetario(linha[6]);
      
      if (nome && nome.length > 1 && salarioBruto > 0) {
        funcionariosPlanilha.push({
          nome,
          tipo: tipoContrato === 'PJ' ? 'PJ' : 'CLT',
          area: area || 'Salão',
          salario_bruto: salarioBruto
        });
      }
    }

    if (funcionariosPlanilha.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum funcionário encontrado na planilha' },
        { status: 404 }
      );
    }

    // Buscar áreas do bar para mapear
    const supabase = await getAdminClient();
    
    const { data: areas } = await supabase
      .from('areas')
      .select('id, nome')
      .eq('bar_id', bar_id)
      .eq('ativo', true);

    const areaMap = new Map<string, number>();
    areas?.forEach(a => areaMap.set(a.nome.toLowerCase(), a.id));

    // Inserir funcionários
    const funcionariosParaInserir = funcionariosPlanilha.map(f => ({
      bar_id,
      nome: f.nome,
      tipo_contratacao: f.tipo,
      area_id: areaMap.get(f.area.toLowerCase()) || areaMap.get('salão') || null,
      salario_base: f.salario_bruto,
      vale_transporte_diaria: 11, // Valor padrão
      dias_trabalho_semana: 6,
      ativo: true
    }));

    // Verificar duplicatas (por nome)
    const { data: funcionariosExistentes } = await supabase
      .from('funcionarios')
      .select('nome')
      .eq('bar_id', bar_id);

    const nomesExistentes = new Set(funcionariosExistentes?.map(f => f.nome.toLowerCase()) || []);
    
    const funcionariosNovos = funcionariosParaInserir.filter(
      f => !nomesExistentes.has(f.nome.toLowerCase())
    );

    if (funcionariosNovos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Todos os funcionários já existem no cadastro',
        total_planilha: funcionariosPlanilha.length,
        total_novos: 0,
        total_ignorados: funcionariosPlanilha.length
      });
    }

    const { data: inseridos, error } = await supabase
      .from('funcionarios')
      .insert(funcionariosNovos)
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${inseridos?.length || 0} funcionário(s) importado(s) com sucesso`,
      total_planilha: funcionariosPlanilha.length,
      total_novos: inseridos?.length || 0,
      total_ignorados: funcionariosPlanilha.length - (inseridos?.length || 0),
      funcionarios: inseridos
    });

  } catch (error) {
    console.error('Erro ao importar funcionários:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rh/importar-planilha
 * Preview dos funcionários que serão importados
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'semana';

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

    const abaFuncionarios = tipo === 'mes' ? 'Simulação CMO Mês' : 'CMO Semana';
    const dados = await buscarDadosAba(accessToken, abaFuncionarios);

    // Parsear funcionários
    const funcionarios: FuncionarioPlanilha[] = [];
    
    for (let i = 2; i < dados.length; i++) {
      const linha = dados[i];
      if (!linha || linha.length < 7) continue;
      
      const nome = linha[2]?.trim();
      const tipoContrato = linha[3]?.trim()?.toUpperCase();
      const area = linha[4]?.trim();
      const salarioBruto = parseMonetario(linha[6]);
      
      if (nome && nome.length > 1 && salarioBruto > 0) {
        funcionarios.push({
          nome,
          tipo: tipoContrato === 'PJ' ? 'PJ' : 'CLT',
          area: area || 'Salão',
          salario_bruto: salarioBruto
        });
      }
    }

    return NextResponse.json({
      success: true,
      aba: abaFuncionarios,
      total: funcionarios.length,
      funcionarios
    });

  } catch (error) {
    console.error('Erro ao buscar preview:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
