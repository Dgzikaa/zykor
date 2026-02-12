import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log("📥 ContaHub Sync - Coleta de Dados (Processamento via pg_cron)");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateDynamicTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
}

// Converte data de YYYY-MM-DD para formato ISO com timezone (formato ContaHub)
// Ex: 2024-10-15 -> 2024-10-15T00:00:00-0300
function toContaHubDateFormat(isoDate: string): string {
  return `${isoDate}T00:00:00-0300`;
}

// Função para enviar notificação Discord
async function sendDiscordNotification(message: string, isError: boolean = false) {
  try {
    const webhookUrl = Deno.env.get('DISCORD_CONTAHUB_WEBHOOK');
    if (!webhookUrl) {
      console.log('⚠️ Discord webhook não configurado');
      return;
    }

    const embed = {
      title: isError ? '❌ ContaHub Sync - Erro' : '🔄 ContaHub Sync',
      description: message,
      color: isError ? 15158332 : 3066993, // Vermelho ou Verde
      timestamp: new Date().toISOString(),
      footer: {
        text: 'SGB ContaHub Automation'
      }
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      console.error('❌ Erro ao enviar notificação Discord:', response.status, response.statusText);
    } else {
      console.log('📢 Notificação Discord enviada');
    }
  } catch (error) {
    console.error('❌ Erro ao enviar notificação Discord:', error);
  }
}

// Função de login no ContaHub
async function loginContaHub(email: string, password: string): Promise<string> {
  console.log('🔐 Fazendo login no ContaHub...');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordSha1 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const loginData = new URLSearchParams({
    "usr_email": email,
    "usr_password_sha1": passwordSha1
  });
  
  const loginTimestamp = generateDynamicTimestamp();
  const loginResponse = await fetch(`https://sp.contahub.com/rest/contahub.cmds.UsuarioCmd/login/${loginTimestamp}?emp=0`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    },
    body: loginData,
  });
  
  if (!loginResponse.ok) {
    throw new Error(`Erro no login ContaHub: ${loginResponse.statusText}`);
  }
  
  const setCookieHeaders = loginResponse.headers.get('set-cookie');
    if (!setCookieHeaders) {
    throw new Error('Cookies de sessão não encontrados no login');
  }
  
  console.log('✅ Login ContaHub realizado com sucesso');
  return setCookieHeaders;
}

// Função para fazer requisições ao ContaHub
async function fetchContaHubData(url: string, sessionToken: string) {
  console.log(`🔗 Fazendo requisição: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': sessionToken,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    },
  });
  
  if (!response.ok) {
    throw new Error(`Erro na requisição ContaHub: ${response.statusText}`);
  }
  
  const responseText = await response.text();
  return JSON.parse(responseText);
}

// Locais conhecidos do Ordinário Bar (usado para dividir queries grandes)
const LOCAIS_CONTAHUB = [
  'Bar', 'Cozinha 1', 'Cozinha 2', 'Montados', 'Baldes', 
  'Shot e Dose', 'Chopp', 'Batidos', 'Preshh', 'Mexido', 
  'Venda Volante', 'Pegue e Pague', '' // vazio para itens sem local
];

// Função genérica para buscar com divisão quando a query for muito grande
async function fetchComDivisaoPorLocal(
  baseUrl: string, 
  dataDate: string, 
  empId: string, 
  sessionToken: string,
  generateTimestamp: () => string,
  queryId: number, // 77=analitico, 81=tempo, 7=pagamentos, 101=fatporhora, 5=periodo
  dataType: string,
  extraParams: string = ''
): Promise<any> {
  const contahubDate = `${dataDate}T00:00:00-0300`;
  
  // 1. Primeiro tentar buscar tudo de uma vez
  try {
    const timestamp = generateTimestamp();
    const url = `${baseUrl}/rest/contahub.cmds.QueryCmd/execQuery/${timestamp}?qry=${queryId}&d0=${contahubDate}&d1=${contahubDate}${extraParams}&local=&emp=${empId}&nfe=1`;
    console.log(`🔍 Tentando buscar ${dataType} completo...`);
    const data = await fetchContaHubData(url, sessionToken);
    console.log(`✅ ${dataType} completo: ${data?.list?.length || 0} registros`);
    return data;
  } catch (error) {
    console.warn(`⚠️ Query ${dataType} completa falhou (possivelmente muito grande), dividindo por local...`);
  }
  
  // 2. Se falhou, dividir por LOCAL (filtro mais eficiente)
  const allRecords: any[] = [];
  
  for (const local of LOCAIS_CONTAHUB) {
    try {
      const timestamp = generateTimestamp();
      const localParam = local ? encodeURIComponent(local) : '';
      const url = `${baseUrl}/rest/contahub.cmds.QueryCmd/execQuery/${timestamp}?qry=${queryId}&d0=${contahubDate}&d1=${contahubDate}${extraParams}&local=${localParam}&emp=${empId}&nfe=1`;
      console.log(`🔍 Buscando ${dataType} local "${local || '(vazio)'}"...`);
      
      const data = await fetchContaHubData(url, sessionToken);
      if (data?.list && Array.isArray(data.list)) {
        allRecords.push(...data.list);
        console.log(`✅ Local "${local || '(vazio)'}": ${data.list.length} registros`);
      }
      
      // Pequeno delay entre requisições para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (localError) {
      console.warn(`⚠️ ${dataType} Local "${local || '(vazio)'}" falhou`);
    }
  }
  
  console.log(`📊 Total ${dataType} consolidado: ${allRecords.length} registros`);
  return { list: allRecords };
}

// Função para buscar analitico com divisão quando a query for muito grande
async function fetchAnaliticoComDivisao(
  baseUrl: string, 
  dataDate: string, 
  empId: string, 
  sessionToken: string,
  generateTimestamp: () => string
): Promise<any> {
  return fetchComDivisaoPorLocal(
    baseUrl, dataDate, empId, sessionToken, generateTimestamp,
    77, 'analitico', '&produto=&grupo=&turno=&mesa=&tipo='
  );
}

// Função para buscar TEMPO com divisão quando a query for muito grande
async function fetchTempoComDivisao(
  baseUrl: string, 
  dataDate: string, 
  empId: string, 
  sessionToken: string,
  generateTimestamp: () => string
): Promise<any> {
  return fetchComDivisaoPorLocal(
    baseUrl, dataDate, empId, sessionToken, generateTimestamp,
    81, 'tempo', '&prod=&grupo='
  );
}

// Função para buscar PAGAMENTOS com divisão quando a query for muito grande
async function fetchPagamentosComDivisao(
  baseUrl: string, 
  dataDate: string, 
  empId: string, 
  sessionToken: string,
  generateTimestamp: () => string
): Promise<any> {
  return fetchComDivisaoPorLocal(
    baseUrl, dataDate, empId, sessionToken, generateTimestamp,
    7, 'pagamentos', '&meio='
  );
}

// Função para buscar FATPORHORA com divisão quando a query for muito grande  
async function fetchFatPorHoraComDivisao(
  baseUrl: string, 
  dataDate: string, 
  empId: string, 
  sessionToken: string,
  generateTimestamp: () => string
): Promise<any> {
  return fetchComDivisaoPorLocal(
    baseUrl, dataDate, empId, sessionToken, generateTimestamp,
    101, 'fatporhora', ''
  );
}

// Função para buscar PRODPORHORA com divisão quando a query for muito grande
async function fetchProdPorHoraComDivisao(
  baseUrl: string, 
  dataDate: string, 
  empId: string, 
  sessionToken: string,
  generateTimestamp: () => string
): Promise<any> {
  // Query 102 = ProdPorHora no ContaHub
  return fetchComDivisaoPorLocal(
    baseUrl, dataDate, empId, sessionToken, generateTimestamp,
    102, 'prodporhora', '&produto=&grupo='
  );
}

// Função para buscar PERIODO com divisão quando a query for muito grande
async function fetchPeriodoComDivisao(
  baseUrl: string, 
  dataDate: string, 
  empId: string, 
  sessionToken: string,
  generateTimestamp: () => string
): Promise<any> {
  return fetchComDivisaoPorLocal(
    baseUrl, dataDate, empId, sessionToken, generateTimestamp,
    5, 'periodo', ''
  );
}

// Função para buscar CANCELAMENTOS (qry=57 - relatório de cancelamentos)
async function fetchCancelamentos(
  baseUrl: string, 
  dataDate: string, 
  empId: string, 
  sessionToken: string,
  generateTimestamp: () => string
): Promise<any> {
  const contahubDate = `${dataDate}T00:00:00-0300`;
  const timestamp = generateTimestamp();
  const url = `${baseUrl}/rest/contahub.cmds.QueryCmd/execQuery/${timestamp}?qry=57&d0=${contahubDate}&d1=${contahubDate}&comanda=&emp=${empId}&nfe=1`;
  console.log(`🔍 Buscando cancelamentos...`);
  const data = await fetchContaHubData(url, sessionToken);
  console.log(`✅ cancelamentos: ${data?.list?.length || 0} registros`);
  return data;
}

// Função para salvar JSON bruto (SEM PROCESSAMENTO)
async function saveRawDataOnly(supabase: any, dataType: string, rawData: any, dataDate: string, barId: number = 3) {
  console.log(`💾 Salvando JSON bruto para ${dataType}...`);
  
  try {
    const recordCount = Array.isArray(rawData?.list) ? rawData.list.length : 
                       Array.isArray(rawData) ? rawData.length : 1;
    
    // Salvar JSON completo como está - SEM PROCESSAMENTO
    // Usar upsert sem ignoreDuplicates para atualizar se existir
    const { data, error } = await supabase
      .from('contahub_raw_data')
      .upsert({
        bar_id: barId,
        data_type: dataType,
        data_date: dataDate,
        raw_json: rawData,
        processed: false
      }, {
        onConflict: 'bar_id,data_type,data_date'
      })
      .select('id');
          
    if (error) {
      console.error(`❌ Erro ao salvar ${dataType}:`, error);
      throw new Error(`Erro ao salvar ${dataType}: ${error.message}`);
    }
    
    const rawDataId = data && data.length > 0 ? data[0].id : 'updated';
    
    console.log(`✅ ${dataType} salvo: raw_data_id=${rawDataId}, registros=${recordCount}`);
    
    return {
      raw_data_id: rawDataId,
      record_count: recordCount,
      data_type: dataType
    };
    
  } catch (error) {
    console.error(`❌ Falha ao salvar ${dataType}:`, error);
    throw error;
  }
}

// Processamento será feito via pg_cron - função removida

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.text();
    console.log('📥 Body recebido:', requestBody);
    
    const { bar_id, data_date } = JSON.parse(requestBody || '{}');
    
    if (!bar_id || !data_date) {
      throw new Error('bar_id e data_date são obrigatórios');
    }
    
    console.log(`🎯 Processando dados para bar_id=${bar_id}, data=${data_date}`);
    
    // Enviar notificação de início
    await sendDiscordNotification(`🚀 **Iniciando sincronização ContaHub**\n\n📊 **Dados:** ${data_date}\n🏪 **Bar ID:** ${bar_id}\n⏰ **Início:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    
    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar configuração do bar e credenciais do ContaHub
    const { data: barConfig, error: barError } = await supabase
      .from('bars')
      .select('config')
      .eq('id', bar_id)
      .single();
    
    if (barError || !barConfig) {
      throw new Error(`Bar não encontrado: ${bar_id}`);
    }
    
    const emp_id = barConfig.config?.contahub_emp_id;
    if (!emp_id) {
      throw new Error(`ContaHub emp_id não configurado para bar ${bar_id}`);
    }
    
    console.log(`📍 Bar ID: ${bar_id}, ContaHub emp_id: ${emp_id}`);
    
    // Buscar credenciais do ContaHub do banco
    const { data: contahubCreds, error: credsError } = await supabase
      .from('api_credentials')
      .select('username, password')
      .eq('bar_id', bar_id)
      .eq('sistema', 'contahub')
      .eq('ativo', true)
      .single();
    
    if (credsError || !contahubCreds) {
      throw new Error(`Credenciais ContaHub não encontradas para bar ${bar_id}`);
    }
    
    const contahubEmail = contahubCreds.username;
    const contahubPassword = contahubCreds.password;
    const contahubBaseUrl = 'https://sp.contahub.com';
    
    if (!contahubEmail || !contahubPassword) {
      throw new Error('Credenciais do ContaHub inválidas');
    }
    
    // Login no ContaHub
    const sessionToken = await loginContaHub(contahubEmail, contahubPassword);
    
    const results = {
      collected: [] as any[],
      processed: [] as any[],
      errors: [] as any[]
    };
    
    // 1. COLETA E ARMAZENAMENTO DE JSON BRUTO
    console.log('\n📥 FASE 1: Coletando e salvando JSONs brutos...');
    
    const dataTypes = ['analitico', 'fatporhora', 'pagamentos', 'periodo', 'tempo', 'prodporhora', 'vendas', 'cancelamentos'];
    
    // Converter data para formato ContaHub (DD.MM.YYYY)
    const contahubDate = toContaHubDateFormat(data_date);
    console.log(`📅 Data ContaHub: ${contahubDate}`);
    
    // Buscar os turnos disponíveis para a data
    let turnosDisponiveis: number[] = [];
    
    // 1. Primeiro tentar a API getTurnos
    try {
      console.log(`\n🔍 Buscando turnos via API para ${data_date}...`);
      const turnosTimestamp = generateDynamicTimestamp();
      const turnosUrl = `${contahubBaseUrl}/M/guru.facades.GerenciaFacade/getTurnos?emp=${emp_id}&t=${turnosTimestamp}`;
      const turnosResponse = await fetchContaHubData(turnosUrl, sessionToken);
      
      // Filtrar turnos pela data
      if (Array.isArray(turnosResponse)) {
        turnosDisponiveis = turnosResponse
          .filter((t: any) => t.trn_dtgerencial && t.trn_dtgerencial.startsWith(data_date))
          .map((t: any) => t.trn);
        console.log(`✅ Turnos da API: ${turnosDisponiveis.join(', ') || 'nenhum'}`);
      }
    } catch (turnoError) {
      console.warn(`⚠️ Erro ao buscar turnos via API:`, turnoError);
    }
    
    // 2. Se não encontrou via API, buscar TODOS os turnos do banco (contahub_analitico)
    if (turnosDisponiveis.length === 0) {
      try {
        console.log(`🔍 Buscando turnos do banco de dados...`);
        const { data: turnoData, error: turnoError } = await supabase
          .from('contahub_analitico')
          .select('trn')
          .eq('bar_id', bar_id)
          .gte('trn_dtgerencial', data_date)
          .lt('trn_dtgerencial', new Date(new Date(data_date).getTime() + 86400000).toISOString().split('T')[0]);
        
        if (turnoData && turnoData.length > 0) {
          // Pegar turnos únicos
          turnosDisponiveis = [...new Set(turnoData.map((t: any) => t.trn))];
          console.log(`✅ Turnos do banco: ${turnosDisponiveis.join(', ')}`);
        }
      } catch (dbError) {
        console.warn(`⚠️ Turno não encontrado no banco`);
      }
    }
    
    // 3. Se ainda não encontrou, avisar (não calcular para evitar erros)
    if (turnosDisponiveis.length === 0) {
      console.warn(`⚠️ Nenhum turno encontrado para ${data_date} - vendas não serão sincronizadas`);
    }
    
    for (const dataType of dataTypes) {
      try {
        console.log(`\n📊 Coletando ${dataType}...`);
        
        // Gerar timestamp dinâmico para cada query
        const queryTimestamp = generateDynamicTimestamp();
        
        let url: string;
        
        // Construir URL específica para cada tipo de dados
        switch (dataType) {
          case 'analitico':
            // Usar função especial que divide a query se for muito grande
            try {
              const analiticoData = await fetchAnaliticoComDivisao(
                contahubBaseUrl, 
                data_date, 
                emp_id, 
                sessionToken, 
                generateDynamicTimestamp
              );
              const saveResult = await saveRawDataOnly(supabase, 'analitico', analiticoData, data_date, bar_id);
              results.collected.push(saveResult);
              console.log(`✅ analitico: JSON bruto salvo (${saveResult.record_count} registros)`);
            } catch (analiticoError) {
              console.error(`❌ Erro ao buscar analitico:`, analiticoError);
              results.errors.push({ 
                phase: 'collection', 
                data_type: 'analitico', 
                error: analiticoError instanceof Error ? analiticoError.message : String(analiticoError) 
              });
            }
            continue; // Já processou, pular o loop normal
            
          case 'tempo':
            // Usar função com divisão para evitar erro "Resultado muito grande"
            try {
              const tempoData = await fetchTempoComDivisao(
                contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp
              );
              const saveResultTempo = await saveRawDataOnly(supabase, 'tempo', tempoData, data_date, bar_id);
              results.collected.push(saveResultTempo);
              console.log(`✅ tempo: JSON bruto salvo (${saveResultTempo.record_count} registros)`);
            } catch (tempoError) {
              console.error(`❌ Erro ao buscar tempo:`, tempoError);
              results.errors.push({ 
                phase: 'collection', 
                data_type: 'tempo', 
                error: tempoError instanceof Error ? tempoError.message : String(tempoError) 
              });
            }
            continue; // Já processou, pular o loop normal
            
          case 'pagamentos':
            // Usar função com divisão para evitar erro "Resultado muito grande"
            try {
              const pagamentosData = await fetchPagamentosComDivisao(
                contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp
              );
              const saveResultPag = await saveRawDataOnly(supabase, 'pagamentos', pagamentosData, data_date, bar_id);
              results.collected.push(saveResultPag);
              console.log(`✅ pagamentos: JSON bruto salvo (${saveResultPag.record_count} registros)`);
            } catch (pagError) {
              console.error(`❌ Erro ao buscar pagamentos:`, pagError);
              results.errors.push({ 
                phase: 'collection', 
                data_type: 'pagamentos', 
                error: pagError instanceof Error ? pagError.message : String(pagError) 
              });
            }
            continue;
            
          case 'fatporhora':
            // Usar função com divisão para evitar erro "Resultado muito grande"
            try {
              const fatPorHoraData = await fetchFatPorHoraComDivisao(
                contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp
              );
              const saveResultFat = await saveRawDataOnly(supabase, 'fatporhora', fatPorHoraData, data_date, bar_id);
              results.collected.push(saveResultFat);
              console.log(`✅ fatporhora: JSON bruto salvo (${saveResultFat.record_count} registros)`);
            } catch (fatError) {
              console.error(`❌ Erro ao buscar fatporhora:`, fatError);
              results.errors.push({ 
                phase: 'collection', 
                data_type: 'fatporhora', 
                error: fatError instanceof Error ? fatError.message : String(fatError) 
              });
            }
            continue;
            
          case 'periodo':
            // Usar função com divisão para evitar erro "Resultado muito grande"
            try {
              const periodoData = await fetchPeriodoComDivisao(
                contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp
              );
              const saveResultPeriodo = await saveRawDataOnly(supabase, 'periodo', periodoData, data_date, bar_id);
              results.collected.push(saveResultPeriodo);
              console.log(`✅ periodo: JSON bruto salvo (${saveResultPeriodo.record_count} registros)`);
            } catch (periodoError) {
              console.error(`❌ Erro ao buscar periodo:`, periodoError);
              results.errors.push({ 
                phase: 'collection', 
                data_type: 'periodo', 
                error: periodoError instanceof Error ? periodoError.message : String(periodoError) 
              });
            }
            continue;
            
          case 'prodporhora':
            // Usar função com divisão para evitar erro "Resultado muito grande"
            try {
              const prodPorHoraData = await fetchProdPorHoraComDivisao(
                contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp
              );
              const saveResultProdPorHora = await saveRawDataOnly(supabase, 'prodporhora', prodPorHoraData, data_date, bar_id);
              results.collected.push(saveResultProdPorHora);
              console.log(`✅ prodporhora: JSON bruto salvo (${saveResultProdPorHora.record_count} registros)`);
            } catch (prodPorHoraError) {
              console.error(`❌ Erro ao buscar prodporhora:`, prodPorHoraError);
              results.errors.push({ 
                phase: 'collection', 
                data_type: 'prodporhora', 
                error: prodPorHoraError instanceof Error ? prodPorHoraError.message : String(prodPorHoraError) 
              });
            }
            continue;
            
          case 'cancelamentos':
            try {
              const cancelamentosData = await fetchCancelamentos(
                contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp
              );
              const saveResultCancel = await saveRawDataOnly(supabase, 'cancelamentos', cancelamentosData, data_date, bar_id);
              results.collected.push(saveResultCancel);
              console.log(`✅ cancelamentos: JSON bruto salvo (${saveResultCancel.record_count} registros)`);
            } catch (cancelError) {
              console.error(`❌ Erro ao buscar cancelamentos:`, cancelError);
              results.errors.push({
                phase: 'collection',
                data_type: 'cancelamentos',
                error: cancelError instanceof Error ? cancelError.message : String(cancelError)
              });
            }
            continue;

          case 'vendas':
            // 🆕 getTurnoVendas - Dados com vd_hrabertura e vd_hrsaida
            // Precisamos buscar para cada turno disponível
            if (turnosDisponiveis.length === 0) {
              console.log(`⚠️ Nenhum turno disponível para vendas em ${data_date}`);
              continue;
            }
            
            // Consolidar dados de todos os turnos
            const allVendas: any[] = [];
            for (const turno of turnosDisponiveis) {
              const vendasTimestamp = generateDynamicTimestamp();
              const vendasUrl = `${contahubBaseUrl}/M/guru.facades.GerenciaFacade/getTurnoVendas?trn=${turno}&t=${vendasTimestamp}&emp=${emp_id}`;
              console.log(`🔗 Buscando vendas do turno ${turno}: ${vendasUrl}`);
              
              try {
                const vendasData = await fetchContaHubData(vendasUrl, sessionToken);
                // 🔧 FIX: A resposta vem como { data: [...] }, não como array direto
                const vendasArray = Array.isArray(vendasData) ? vendasData : 
                                   (vendasData?.data && Array.isArray(vendasData.data)) ? vendasData.data : [];
                
                if (vendasArray.length > 0) {
                  // Adicionar turno a cada registro
                  vendasArray.forEach((v: any) => v.trn = turno);
                  allVendas.push(...vendasArray);
                  console.log(`✅ Turno ${turno}: ${vendasArray.length} vendas`);
                }
              } catch (vendasTurnoError) {
                console.warn(`⚠️ Erro ao buscar vendas do turno ${turno}:`, vendasTurnoError);
              }
            }
            
            console.log(`📊 Total de vendas coletadas: ${allVendas.length}`);
            
            // Salvar dados de vendas consolidados
            const vendasResult = await saveRawDataOnly(supabase, 'vendas', { list: allVendas }, data_date, bar_id);
            results.collected.push(vendasResult);
            console.log(`✅ vendas: JSON bruto salvo (${vendasResult.record_count} registros)`);
            continue; // Já processou, pular o loop normal
            
          default:
            throw new Error(`Tipo de dados não suportado: ${dataType}`);
        }
        
        console.log(`🔗 URL: ${url}`);
        
        // Buscar dados do ContaHub
        const rawData = await fetchContaHubData(url, sessionToken);
        
        // Salvar JSON bruto (SEM PROCESSAMENTO)
        const saveResult = await saveRawDataOnly(supabase, dataType, rawData, data_date, bar_id);
        results.collected.push(saveResult);
        
        console.log(`✅ ${dataType}: JSON bruto salvo (${saveResult.record_count} registros)`);
        
      } catch (error) {
        console.error(`❌ Erro ao coletar ${dataType}:`, error);
        results.errors.push({ 
          phase: 'collection', 
          data_type: dataType, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    // PROCESSAMENTO SERÁ FEITO VIA PG_CRON
    console.log('\n🔄 PROCESSAMENTO: Dados salvos para processamento automático via pg_cron');
    
    // Resultado final
    const summary = {
      bar_id,
      data_date,
      collected_count: results.collected.length,
      error_count: results.errors.length,
      total_records_collected: results.collected.reduce((sum, item) => sum + item.record_count, 0),
      processing_method: 'pg_cron_background',
      includes_vendas: true // inclui dados de vendas com vd_hrabertura e vd_hrsaida
    };
    
    console.log('\n📊 RESUMO FINAL:');
    console.log(`- Coletados: ${summary.collected_count}/5 tipos`);
    console.log(`- Registros coletados: ${summary.total_records_collected}`);
    console.log(`- Erros: ${summary.error_count}`);
    console.log(`- Processamento: Automático via pg_cron`);
    
    // 🚀 CHAMAR DISCORD NOTIFICATION para CONTAHUB
    try {
      const discordResponse = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/discord-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          title: summary.error_count === 0 ? '✅ ContaHub Sync Concluído' : '⚠️ ContaHub Sync com Erros',
          webhook_type: 'contahub',
          processed_records: summary.total_records_collected,
          bar_id: parseInt(bar_id),
          execution_time: `Dados: ${data_date}`,
          custom_message: `📊 **Coleta ContaHub concluída**\n\n📈 **Resultados:**\n• Coletados: ${summary.collected_count}/5 tipos\n• Registros coletados: ${summary.total_records_collected}\n• Erros: ${summary.error_count}\n\n🔄 **Processamento:** Iniciado automaticamente via pg_cron\n⏰ **Fim:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
        })
      });

      if (!discordResponse.ok) {
        console.error('❌ Erro ao enviar notificação Discord ContaHub:', discordResponse.status);
      } else {
        console.log('📢 Notificação Discord ContaHub enviada');
      }
    } catch (discordError) {
      console.error('❌ Erro ao enviar notificação Discord ContaHub:', discordError);
    }
    
    // 2. PROCESSAR DADOS COLETADOS
    console.log('\n🔄 FASE 2: Processando dados coletados...');
    
    try {
      // Chamar o processor para processar os dados da data atual
      const processorUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-processor';
      
      const processorResponse = await fetch(processorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || ''
        },
        body: JSON.stringify({
          data_date: data_date,
          bar_id: bar_id,
          data_types: ['analitico', 'fatporhora', 'pagamentos', 'periodo', 'tempo', 'prodporhora', 'vendas', 'cancelamentos'] // inclui vendas e cancelamentos
        })
      });
      
      const processorResult = await processorResponse.json();
      
      if (processorResponse.ok) {
        console.log('✅ Processor executado com sucesso:', processorResult.summary);
        results.processed = processorResult.details?.processed || [];
        
        // Notificar sucesso completo
        const processMessage = `✅ **Processamento ContaHub concluído**\n\n📊 Dados processados: ${processorResult.summary?.total_processed || 0}\n❌ Erros: ${processorResult.summary?.total_errors || 0}\n⏰ ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
        await sendDiscordNotification(processMessage);
        
        // 🤖 CHAMAR AGENTE IA PARA ANÁLISE (usa agente-ia-analyzer existente)
        console.log('\n🤖 FASE 3: Enviando dados para análise IA via agente-ia-analyzer...');
        try {
          // Montar scan_data com os dados processados para análise
          const scanData = {
            data_analise: data_date,
            bar_id: parseInt(bar_id),
            coleta: {
              tipos_coletados: results.collected.length,
              total_registros: summary.total_records_collected,
              erros: summary.error_count
            },
            processamento: {
              total_processado: processorResult.summary?.total_processed || 0,
              erros: processorResult.summary?.total_errors || 0
            },
            timestamp: new Date().toISOString()
          };
          
          const analiseResponse = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-ia-analyzer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              bar_id: parseInt(bar_id),
              scan_data: scanData,
              context: ['pos_sync_contahub', data_date]
            })
          });
          
          if (analiseResponse.ok) {
            const analiseResult = await analiseResponse.json();
            console.log('✅ Análise IA concluída:', analiseResult.success ? 'OK' : 'Falhou');
            
            // Se há resumo executivo, enviar para Discord
            if (analiseResult.analysis?.resumo_executivo) {
              const iaMessage = `🤖 **Análise IA - ${data_date}**\n\n${analiseResult.analysis.resumo_executivo}`;
              await sendDiscordNotification(iaMessage);
            }
          } else {
            console.error('⚠️ Erro na análise IA:', analiseResponse.status);
          }
        } catch (analiseError) {
          console.error('⚠️ Erro ao chamar agente-ia-analyzer:', analiseError);
          // Não bloqueia o fluxo principal
        }
      } else {
        console.error('❌ Erro no processor:', processorResult);
        results.errors.push({
          type: 'processor',
          error: processorResult.error || 'Erro ao processar dados'
        });
      }
    } catch (procError) {
      console.error('❌ Erro ao chamar processor:', procError);
      results.errors.push({
        type: 'processor',
        error: procError instanceof Error ? procError.message : String(procError)
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'ContaHub coleta concluída - processamento iniciado',
      summary,
      details: {
        collected: results.collected,
        processed: results.processed,
        errors: results.errors
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    
    // Enviar notificação de erro crítico
    const errorMessage = `❌ **Erro crítico na sincronização ContaHub**\n\n⏰ **Tempo:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n🚨 **Erro:** ${error instanceof Error ? error.message : String(error)}`;
    await sendDiscordNotification(errorMessage, true);
  
  return new Response(JSON.stringify({
    success: false,
      error: error instanceof Error ? error.message : String(error)
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 500
  });
} 
});