/**
 * Edge Function: Sincronizar dados de CMO do Google Sheets
 * 
 * Importa funcionários e provisões da planilha de CMO
 * Planilha ID: 1y4wR3dxIpfIkWQdPdfQ2V889p_NXIDCU1tGt2PWx57Y
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64url } from 'https://deno.land/std@0.168.0/encoding/base64url.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1y4wR3dxIpfIkWQdPdfQ2V889p_NXIDCU1tGt2PWx57Y';

// ==================== AUTH SERVICE ACCOUNT ====================

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

  const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContent = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64url(new Uint8Array(signature));
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

// ==================== HELPERS ====================

function parseMonetario(valor: string | null | undefined): number {
  if (!valor) return 0;
  let str = valor.toString().trim();
  if (str === '' || str === '-' || str === 'R$ -' || str.includes('#REF')) return 0;
  const isNegativo = str.includes('(') && str.includes(')');
  const limpo = str.replace(/R\$/g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/\s/g, '').replace(/\u00A0/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(limpo);
  if (isNaN(num)) return 0;
  return isNegativo ? -num : num;
}

function parsePercentual(valor: string | null | undefined): number {
  if (!valor) return 0;
  const limpo = valor.toString().replace('%', '').replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

// ==================== SHEETS ====================

async function getServiceAccountCredentials(supabase: any, barId: number) {
  const { data, error } = await supabase
    .from('api_credentials')
    .select('configuracoes')
    .eq('sistema', 'google_sheets')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();
  if (error || !data) throw new Error(`Config Google Sheets não encontrada para bar_id=${barId}`);
  const config = data.configuracoes || {};
  if (!config.client_email || !config.private_key) throw new Error(`Service account não configurado para bar_id=${barId}`);
  return { client_email: config.client_email, private_key: config.private_key };
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

// ==================== IMPORTAR FUNCIONÁRIOS ====================

interface FuncionarioPlanilha {
  nome: string;
  tipo: string;
  area: string;
  salario_bruto: number;
}

async function importarFuncionarios(supabase: any, accessToken: string, barId: number) {
  console.log('📥 Buscando funcionários da aba CMO Semana...');
  const dados = await buscarDadosAba(accessToken, 'CMO Semana');

  if (!dados || dados.length < 3) {
    return { success: false, error: 'Dados não encontrados na planilha', total: 0 };
  }

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

  console.log(`📋 ${funcionarios.length} funcionários encontrados na planilha`);

  if (funcionarios.length === 0) {
    return { success: true, message: 'Nenhum funcionário encontrado', total: 0 };
  }

  // Buscar áreas do bar
  const { data: areas } = await supabase
    .from('areas')
    .select('id, nome')
    .eq('bar_id', barId)
    .eq('ativo', true);

  const areaMap = new Map<string, number>();
  areas?.forEach((a: any) => areaMap.set(a.nome.toLowerCase(), a.id));

  // Verificar duplicatas
  const { data: existentes } = await supabase
    .from('funcionarios')
    .select('nome')
    .eq('bar_id', barId);

  const nomesExistentes = new Set(existentes?.map((f: any) => f.nome.toLowerCase()) || []);
  
  const funcionariosNovos = funcionarios
    .filter(f => !nomesExistentes.has(f.nome.toLowerCase()))
    .map(f => ({
      bar_id: barId,
      nome: f.nome,
      tipo_contratacao: f.tipo,
      area_id: areaMap.get(f.area.toLowerCase()) || areaMap.get('salão') || null,
      salario_base: f.salario_bruto,
      vale_transporte_diaria: 11,
      dias_trabalho_semana: 6,
      ativo: true
    }));

  if (funcionariosNovos.length === 0) {
    return { success: true, message: 'Todos os funcionários já existem', total: 0, ignorados: funcionarios.length };
  }

  const { data: inseridos, error } = await supabase
    .from('funcionarios')
    .insert(funcionariosNovos)
    .select();

  if (error) {
    return { success: false, error: error.message, total: 0 };
  }

  console.log(`✅ ${inseridos?.length || 0} funcionários importados`);
  return {
    success: true,
    message: `${inseridos?.length || 0} funcionário(s) importado(s)`,
    total: inseridos?.length || 0,
    ignorados: funcionarios.length - (inseridos?.length || 0)
  };
}

// ==================== IMPORTAR PROVISÕES ====================

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
    if (mes && ano) return { mes, ano };
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

async function importarProvisoes(supabase: any, accessToken: string, barId: number) {
  console.log('📥 Buscando provisões da aba PROVISÕES...');
  const dados = await buscarDadosAba(accessToken, 'PROVISÕES');

  if (!dados || dados.length < 2) {
    return { success: false, error: 'Dados não encontrados', total: 0 };
  }

  const provisoes: ProvisaoPlanilha[] = [];
  let mesAnoAtual: { mes: number; ano: number } | null = null;
  
  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    if (!linha || linha.length === 0) continue;
    
    const primeiraColuna = linha[0]?.toString().trim().toUpperCase();
    
    // Verificar se é cabeçalho de mês
    if (primeiraColuna && primeiraColuna.includes('DE 20')) {
      mesAnoAtual = parseMesAno(primeiraColuna);
      continue;
    }
    
    // Pular linha de cabeçalho
    if (primeiraColuna === 'FUNCIONÁRIO' || primeiraColuna === 'FUNCIONARIO') continue;
    
    // Linha de funcionário
    if (mesAnoAtual && linha[0] && linha[0].trim().length > 1) {
      const nome = linha[0]?.trim();
      
      if (nome.toLowerCase().includes('total') || 
          nome.toLowerCase().includes('funcionário') ||
          nome.toLowerCase().includes('salário')) {
        continue;
      }

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

  console.log(`📋 ${provisoes.length} provisões encontradas`);

  if (provisoes.length === 0) {
    return { success: true, message: 'Nenhuma provisão encontrada', total: 0 };
  }

  // Inserir em lotes
  const provisoesParaInserir = provisoes.map(p => ({
    bar_id: barId,
    funcionario_nome: p.funcionario_nome,
    funcionario_id: null,
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

  const batchSize = 100;
  let totalInseridos = 0;
  const erros: string[] = [];

  for (let i = 0; i < provisoesParaInserir.length; i += batchSize) {
    const batch = provisoesParaInserir.slice(i, i + batchSize);
    const { error } = await supabase.from('provisoes_trabalhistas').insert(batch);
    if (error) {
      erros.push(`Lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
    } else {
      totalInseridos += batch.length;
    }
  }

  console.log(`✅ ${totalInseridos} provisões importadas`);
  return {
    success: erros.length === 0,
    message: `${totalInseridos} provisão(ões) importada(s)`,
    total: totalInseridos,
    erros: erros.length > 0 ? erros : undefined
  };
}

// ==================== HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { bar_id, tipo } = body;
    
    // Default: Ordinário Bar (id=3)
    const barId = bar_id || 3;
    
    console.log(`🔄 Sync CMO Planilha - bar_id=${barId}, tipo=${tipo || 'ambos'}`);

    // Buscar credenciais
    let credentials;
    try {
      credentials = await getServiceAccountCredentials(supabase, barId);
    } catch (e: any) {
      return new Response(
        JSON.stringify({ success: false, error: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter access token
    console.log('🔑 Autenticando com service account...');
    const accessToken = await obterAccessToken(credentials.client_email, credentials.private_key);
    console.log('✅ Autenticado!');

    const resultados: any = {};

    // Importar funcionários
    if (!tipo || tipo === 'funcionarios' || tipo === 'ambos') {
      resultados.funcionarios = await importarFuncionarios(supabase, accessToken, barId);
    }

    // Importar provisões
    if (!tipo || tipo === 'provisoes' || tipo === 'ambos') {
      resultados.provisoes = await importarProvisoes(supabase, accessToken, barId);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Importação concluída', resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
