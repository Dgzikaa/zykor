/**
 * Edge Function: Sincronizar CMV do Google Sheets
 * 
 * Busca dados de CMV da aba "CMV Semanal" do Google Sheets
 * Usa autenticação via Service Account (JWT) - planilha NÃO precisa ser pública
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64url } from 'https://deno.land/std@0.168.0/encoding/base64url.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== AUTH SERVICE ACCOUNT ====================

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

  const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Importar chave privada
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

/**
 * Obter access token do Google OAuth2
 */
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
  if (str === '' || str === '-' || str === 'R$ -' || str === 'R$  -   ' || str.includes('#REF')) return 0;
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

function converterData(dataStr: string | null | undefined): string | null {
  if (!dataStr) return null;
  const str = dataStr.toString().trim();
  if (!str.includes('/')) return null;
  const partes = str.split('/');
  if (partes.length !== 3) return null;
  const [dia, mes, ano] = partes;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// ==================== SHEETS ====================

interface BarSheetsConfig {
  spreadsheet_id: string;
  client_email: string;
  private_key: string;
}

async function getBarSheetsConfig(supabase: any, barId: number): Promise<BarSheetsConfig> {
  const { data, error } = await supabase
    .from('api_credentials')
    .select('configuracoes')
    .eq('sistema', 'google_sheets')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !data) throw new Error(`Config Google Sheets não encontrada para bar_id=${barId}`);
  const config = data.configuracoes || {};
  
  if (!config.client_email || !config.private_key) {
    throw new Error(`Service account não configurado para bar_id=${barId}`);
  }

  return {
    spreadsheet_id: config.cmv_spreadsheet_id || config.spreadsheet_id,
    client_email: config.client_email,
    private_key: config.private_key,
  };
}

async function buscarDadosSheets(range: string, spreadsheetId: string, accessToken: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao acessar planilha: ${response.status} - ${err}`);
  }
  const data = await response.json();
  return data.values || [];
}

// ==================== PROCESSAMENTO ====================

function processarSemana(linhas: any[][], colunaIdx: number, semana: number, ano: number, barId: number) {
  const getValor = (linhaIdx: number) => {
    if (linhaIdx >= linhas.length) return null;
    const linha = linhas[linhaIdx];
    if (!linha || colunaIdx >= linha.length) return null;
    return linha[colunaIdx];
  };

  // Estrutura da planilha:
  // 0: Cabeçalho | 1: de | 2: a | 3: Est.Ini | 4: Compras | 5: Est.Fin
  // 6: Cons.Sócios | 7: Cons.Benef | 8: Cons.ADM | 9: Cons.RH | 10: Cons.Artista
  // 11: Outros Ajustes | 12: Bonificações | 13: CMV Real | 14: Fat.CMVível
  // 15: CMV Limpo% | 16: CMV Teórico% | 17: Gap | 18: Fat.Total
  const dataInicio = converterData(getValor(1));
  const dataFim = converterData(getValor(2));
  const estoqueInicial = parseMonetario(getValor(3));
  const compras = parseMonetario(getValor(4));
  const estoqueFinal = parseMonetario(getValor(5));
  const consumoSocios = parseMonetario(getValor(6));
  const consumoBeneficios = parseMonetario(getValor(7));
  const consumoAdm = parseMonetario(getValor(8));
  const consumoRh = parseMonetario(getValor(9));
  const consumoArtista = parseMonetario(getValor(10));
  const outrosAjustes = parseMonetario(getValor(11));
  const ajusteBonificacoes = parseMonetario(getValor(12));
  const cmvReal = parseMonetario(getValor(13));
  const faturamentoCmvivel = parseMonetario(getValor(14));
  const cmvLimpoPercent = parsePercentual(getValor(15));
  const cmvTeoricoPercent = parsePercentual(getValor(16));
  const faturamentoTotal = parseMonetario(getValor(18));

  return {
    bar_id: barId, ano, semana,
    data_inicio: dataInicio, data_fim: dataFim,
    estoque_inicial: estoqueInicial, compras_periodo: compras, estoque_final: estoqueFinal,
    consumo_socios: consumoSocios, consumo_beneficios: consumoBeneficios,
    consumo_adm: consumoAdm, consumo_rh: consumoRh, consumo_artista: consumoArtista,
    outros_ajustes: outrosAjustes, ajuste_bonificacoes: ajusteBonificacoes,
    cmv_real: cmvReal, faturamento_cmvivel: faturamentoCmvivel,
    cmv_limpo_percentual: cmvLimpoPercent, cmv_teorico_percentual: cmvTeoricoPercent,
    gap: cmvLimpoPercent - cmvTeoricoPercent,
    faturamento_bruto: faturamentoTotal, vendas_brutas: faturamentoTotal,
    updated_at: new Date().toISOString()
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
    const { bar_id, semana: semanaEspecifica, ano } = body;
    const anoEspecifico = ano || new Date().getFullYear();
    
    const { data: todosOsBares } = await supabase.from('bars').select('id, nome').eq('ativo', true);
    if (!todosOsBares?.length) {
      return new Response(JSON.stringify({ success: false, error: 'Nenhum bar ativo' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const baresParaProcessar = bar_id ? todosOsBares.filter(b => b.id === bar_id) : todosOsBares;
    console.log(`🔄 Sync CMV Sheets para ${baresParaProcessar.length} bar(es)...`);
    
    const resultadosPorBar: any[] = [];
    
    for (const bar of baresParaProcessar) {
      console.log(`\n🏪 ${bar.nome} (ID: ${bar.id})`);
      
      let sheetsConfig;
      try {
        sheetsConfig = await getBarSheetsConfig(supabase, bar.id);
      } catch (e: any) {
        console.log(`⚠️ ${bar.nome}: ${e.message}`);
        resultadosPorBar.push({ bar_id: bar.id, bar_nome: bar.nome, success: false, error: e.message });
        continue;
      }
      
      try {
        // Autenticar com service account
        console.log(`🔑 Autenticando com service account...`);
        const accessToken = await obterAccessToken(sheetsConfig.client_email, sheetsConfig.private_key);
        console.log(`✅ Autenticado!`);
        
        // Buscar dados
        console.log(`📊 Buscando aba "cmv semanal" da planilha ${sheetsConfig.spreadsheet_id}...`);
        const linhas = await buscarDadosSheets("'cmv semanal'!A1:DZ25", sheetsConfig.spreadsheet_id, accessToken);
        
        if (linhas.length < 15) {
          resultadosPorBar.push({ bar_id: bar.id, bar_nome: bar.nome, success: false, error: 'Dados insuficientes na planilha' });
          continue;
        }

        const cabecalho = linhas[0];
        console.log(`📋 ${cabecalho.length} colunas encontradas`);

        const resultados: any[] = [];
        const semanasProcessadas: number[] = [];

        for (let i = 1; i < cabecalho.length; i++) {
          const col = cabecalho[i];
          if (!col || !col.toString().includes('Semana')) continue;
          
          const match = col.toString().match(/Semana\s*(\d+)/i);
          if (!match) continue;
          
          const semana = parseInt(match[1]);
          if (semanaEspecifica && semana !== semanaEspecifica) continue;

          const dataInicio = linhas[1]?.[i];
          let anoSemana = anoEspecifico;
          if (dataInicio && dataInicio.includes('/')) {
            const partes = dataInicio.split('/');
            if (partes.length === 3) anoSemana = parseInt(partes[2]);
          }

          try {
            const dados = processarSemana(linhas, i, semana, anoSemana, bar.id);
            
            if (dados.cmv_real !== 0 || dados.estoque_inicial !== 0) {
              const { error } = await supabase.from('cmv_semanal').upsert(dados, { onConflict: 'bar_id,ano,semana' });
              if (error) {
                console.error(`❌ Semana ${semana}:`, error.message);
                resultados.push({ semana, ano: anoSemana, success: false, error: error.message });
              } else {
                console.log(`✅ S${semana}/${anoSemana}: Est.Ini R$ ${dados.estoque_inicial.toFixed(0)} | Est.Fin R$ ${dados.estoque_final.toFixed(0)} | CMV R$ ${dados.cmv_real.toFixed(0)} (${dados.cmv_limpo_percentual.toFixed(1)}%)`);
                resultados.push({ semana, ano: anoSemana, success: true, estoque_inicial: dados.estoque_inicial, estoque_final: dados.estoque_final, cmv_real: dados.cmv_real });
                semanasProcessadas.push(semana);
              }
            }
          } catch (err: any) {
            resultados.push({ semana, success: false, error: err.message });
          }
        }

        console.log(`✅ ${bar.nome}: ${semanasProcessadas.length} semanas sincronizadas`);
        resultadosPorBar.push({ bar_id: bar.id, bar_nome: bar.nome, success: true, semanas_processadas: semanasProcessadas.length, resultados });
        
      } catch (e: any) {
        console.error(`❌ ${bar.nome}:`, e.message);
        resultadosPorBar.push({ bar_id: bar.id, bar_nome: bar.nome, success: false, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'CMV Sheets sincronizado', resultados_por_bar: resultadosPorBar }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
