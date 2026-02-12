import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log("📥 ContaHub Sync Retroativo - Sincronização de dados históricos");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateDynamicTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
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
  queryId: number,
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
    console.warn(`⚠️ Query ${dataType} completa falhou, dividindo por local...`);
  }
  
  // 2. Se falhou, dividir por LOCAL
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
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (localError) {
      console.warn(`⚠️ ${dataType} Local "${local || '(vazio)'}" falhou`);
    }
  }
  
  console.log(`📊 Total ${dataType} consolidado: ${allRecords.length} registros`);
  return { list: allRecords };
}

// Funções específicas para cada tipo de relatório
async function fetchAnaliticoComDivisao(baseUrl: string, dataDate: string, empId: string, sessionToken: string, generateTimestamp: () => string): Promise<any> {
  return fetchComDivisaoPorLocal(baseUrl, dataDate, empId, sessionToken, generateTimestamp, 77, 'analitico', '&produto=&grupo=&turno=&mesa=&tipo=');
}

async function fetchTempoComDivisao(baseUrl: string, dataDate: string, empId: string, sessionToken: string, generateTimestamp: () => string): Promise<any> {
  return fetchComDivisaoPorLocal(baseUrl, dataDate, empId, sessionToken, generateTimestamp, 81, 'tempo', '&prod=&grupo=');
}

async function fetchPagamentosComDivisao(baseUrl: string, dataDate: string, empId: string, sessionToken: string, generateTimestamp: () => string): Promise<any> {
  return fetchComDivisaoPorLocal(baseUrl, dataDate, empId, sessionToken, generateTimestamp, 7, 'pagamentos', '&meio=');
}

async function fetchFatPorHoraComDivisao(baseUrl: string, dataDate: string, empId: string, sessionToken: string, generateTimestamp: () => string): Promise<any> {
  return fetchComDivisaoPorLocal(baseUrl, dataDate, empId, sessionToken, generateTimestamp, 101, 'fatporhora', '');
}

async function fetchPeriodoComDivisao(baseUrl: string, dataDate: string, empId: string, sessionToken: string, generateTimestamp: () => string): Promise<any> {
  return fetchComDivisaoPorLocal(baseUrl, dataDate, empId, sessionToken, generateTimestamp, 5, 'periodo', '');
}

async function fetchCancelamentos(baseUrl: string, dataDate: string, empId: string, sessionToken: string, generateTimestamp: () => string): Promise<any> {
  const contahubDate = `${dataDate}T00:00:00-0300`;
  const timestamp = generateTimestamp();
  const url = `${baseUrl}/rest/contahub.cmds.QueryCmd/execQuery/${timestamp}?qry=57&d0=${contahubDate}&d1=${contahubDate}&comanda=&emp=${empId}&nfe=1`;
  const data = await fetchContaHubData(url, sessionToken);
  return data;
}

// Função para salvar JSON bruto
async function saveRawDataOnly(supabase: any, dataType: string, rawData: any, dataDate: string, barId: number) {
  try {
    const { data, error } = await supabase
      .from('contahub_raw_data')
      .upsert({
        bar_id: barId,
        data_type: dataType,
        data_date: dataDate,
        raw_json: rawData,
        processed: false
      }, {
        onConflict: 'bar_id,data_type,data_date',
        ignoreDuplicates: true
      })
      .select('id')
      .single();
        
    if (error) {
      console.error(`❌ Erro ao salvar ${dataType}:`, error);
      throw new Error(`Erro ao salvar ${dataType}: ${error.message}`);
    }
    
    const recordCount = Array.isArray(rawData?.list) ? rawData.list.length : 
                       Array.isArray(rawData) ? rawData.length : 1;
    
    return {
      raw_data_id: data?.id,
      record_count: recordCount,
      data_type: dataType
    };
    
  } catch (error) {
    console.error(`❌ Falha ao salvar ${dataType}:`, error);
    throw error;
  }
}

// Gerar array de datas entre start e end
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  
  return dates;
}

// Delay entre requisições
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.text();
    console.log('📥 Body recebido:', requestBody);
    
    const { 
      bar_id, 
      start_date, 
      end_date, 
      data_types = ['analitico', 'fatporhora', 'pagamentos', 'periodo', 'tempo', 'vendas', 'cancelamentos'],
      delay_ms = 2000, // Delay entre dias para não sobrecarregar
      process_after = true // Processar dados após coleta
    } = JSON.parse(requestBody || '{}');
    
    if (!bar_id || !start_date || !end_date) {
      throw new Error('bar_id, start_date e end_date são obrigatórios');
    }
    
    console.log(`🎯 Sincronização retroativa para bar_id=${bar_id}`);
    console.log(`📅 Período: ${start_date} até ${end_date}`);
    
    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar configuração do bar
    const { data: barConfig, error: barError } = await supabase
      .from('bars')
      .select('nome, config')
      .eq('id', bar_id)
      .single();
    
    if (barError || !barConfig) {
      throw new Error(`Bar não encontrado: ${bar_id}`);
    }
    
    const emp_id = barConfig.config?.contahub_emp_id;
    if (!emp_id) {
      throw new Error(`ContaHub emp_id não configurado para bar ${bar_id}`);
    }
    
    console.log(`📍 Bar: ${barConfig.nome}, ContaHub emp_id: ${emp_id}`);
    
    // Buscar credenciais do ContaHub
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
    
    // Login no ContaHub
    const sessionToken = await loginContaHub(contahubEmail, contahubPassword);
    
    // Gerar datas
    const dates = generateDateRange(start_date, end_date);
    console.log(`📆 Total de ${dates.length} dias para processar`);
    
    const results = {
      total_days: dates.length,
      collected: [] as any[],
      errors: [] as any[],
      skipped: [] as string[]
    };
    
    // Processar cada dia
    for (let i = 0; i < dates.length; i++) {
      const data_date = dates[i];
      console.log(`\n📅 [${i + 1}/${dates.length}] Processando ${data_date}...`);
      
      const dayResult = {
        date: data_date,
        collected: [] as any[],
        errors: [] as any[]
      };
      
      for (const dataType of data_types) {
        try {
          // Verificar se já existe
          const { data: existing } = await supabase
            .from('contahub_raw_data')
            .select('id')
            .eq('bar_id', bar_id)
            .eq('data_type', dataType)
            .eq('data_date', data_date)
            .single();
          
          if (existing) {
            console.log(`⏭️ ${dataType} já existe para ${data_date}, pulando...`);
            continue;
          }
          
          const queryTimestamp = generateDynamicTimestamp();
          
          let url: string;
          
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
                dayResult.collected.push(saveResult);
                console.log(`✅ analitico: ${saveResult.record_count} registros`);
              } catch (analiticoError) {
                console.error(`❌ Erro ao buscar analitico:`, analiticoError);
                dayResult.errors.push({
                  data_type: 'analitico',
                  error: analiticoError instanceof Error ? analiticoError.message : String(analiticoError)
                });
              }
              continue; // Já processou, pular o loop normal
            case 'tempo':
              // Usar função com divisão para evitar erro "Resultado muito grande"
              try {
                const tempoData = await fetchTempoComDivisao(contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp);
                const saveResultTempo = await saveRawDataOnly(supabase, 'tempo', tempoData, data_date, bar_id);
                dayResult.collected.push(saveResultTempo);
                console.log(`✅ tempo: ${saveResultTempo.record_count} registros`);
              } catch (tempoError) {
                console.error(`❌ Erro ao buscar tempo:`, tempoError);
                dayResult.errors.push({ data_type: 'tempo', error: tempoError instanceof Error ? tempoError.message : String(tempoError) });
              }
              continue;
            case 'pagamentos':
              try {
                const pagamentosData = await fetchPagamentosComDivisao(contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp);
                const saveResultPag = await saveRawDataOnly(supabase, 'pagamentos', pagamentosData, data_date, bar_id);
                dayResult.collected.push(saveResultPag);
                console.log(`✅ pagamentos: ${saveResultPag.record_count} registros`);
              } catch (pagError) {
                console.error(`❌ Erro ao buscar pagamentos:`, pagError);
                dayResult.errors.push({ data_type: 'pagamentos', error: pagError instanceof Error ? pagError.message : String(pagError) });
              }
              continue;
            case 'fatporhora':
              try {
                const fatPorHoraData = await fetchFatPorHoraComDivisao(contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp);
                const saveResultFat = await saveRawDataOnly(supabase, 'fatporhora', fatPorHoraData, data_date, bar_id);
                dayResult.collected.push(saveResultFat);
                console.log(`✅ fatporhora: ${saveResultFat.record_count} registros`);
              } catch (fatError) {
                console.error(`❌ Erro ao buscar fatporhora:`, fatError);
                dayResult.errors.push({ data_type: 'fatporhora', error: fatError instanceof Error ? fatError.message : String(fatError) });
              }
              continue;
            case 'periodo':
              try {
                const periodoData = await fetchPeriodoComDivisao(contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp);
                const saveResultPeriodo = await saveRawDataOnly(supabase, 'periodo', periodoData, data_date, bar_id);
                dayResult.collected.push(saveResultPeriodo);
                console.log(`✅ periodo: ${saveResultPeriodo.record_count} registros`);
              } catch (periodoError) {
                console.error(`❌ Erro ao buscar periodo:`, periodoError);
                dayResult.errors.push({ data_type: 'periodo', error: periodoError instanceof Error ? periodoError.message : String(periodoError) });
              }
              continue;
            case 'cancelamentos':
              try {
                const cancelData = await fetchCancelamentos(contahubBaseUrl, data_date, emp_id, sessionToken, generateDynamicTimestamp);
                const saveResultCancel = await saveRawDataOnly(supabase, 'cancelamentos', cancelData, data_date, bar_id);
                dayResult.collected.push(saveResultCancel);
                console.log(`✅ cancelamentos: ${saveResultCancel.record_count} registros`);
              } catch (cancelError) {
                console.error(`❌ Erro ao buscar cancelamentos:`, cancelError);
                dayResult.errors.push({ data_type: 'cancelamentos', error: cancelError instanceof Error ? cancelError.message : String(cancelError) });
              }
              continue;
            case 'vendas':
              // 🆕 getTurnoVendas - Dados com vd_hrabertura e vd_hrsaida
              // Buscar turnos de 3 formas: API, banco ou cálculo
              try {
                let turnosDisponiveis: number[] = [];
                
                // 1. Tentar API getTurnos
                try {
                  const turnosUrl = `${contahubBaseUrl}/M/guru.facades.GerenciaFacade/getTurnos?emp=${emp_id}&t=${queryTimestamp}`;
                  const turnosResponse = await fetchContaHubData(turnosUrl, sessionToken);
                  
                  if (Array.isArray(turnosResponse)) {
                    turnosDisponiveis = turnosResponse
                      .filter((t: any) => t.trn_dtgerencial && t.trn_dtgerencial.startsWith(data_date))
                      .map((t: any) => t.trn);
                    if (turnosDisponiveis.length > 0) {
                      console.log(`✅ Turnos da API: ${turnosDisponiveis.join(', ')}`);
                    }
                  }
                } catch (apiError) {
                  console.warn(`⚠️ API getTurnos falhou, tentando outras fontes...`);
                }
                
                // 2. Se não encontrou via API, buscar TODOS os turnos do banco
                if (turnosDisponiveis.length === 0) {
                  try {
                    const { data: turnoData } = await supabase
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
                    // Ignora erro do banco
                  }
                }
                
                // 3. Se ainda não encontrou, avisar (não calcular para evitar erros)
                if (turnosDisponiveis.length === 0) {
                  console.warn(`⚠️ Nenhum turno encontrado para ${data_date} - vendas não serão sincronizadas`);
                }
                
                if (turnosDisponiveis.length === 0) {
                  console.log(`⚠️ Nenhum turno disponível para vendas em ${data_date}`);
                  continue;
                }
                
                // Consolidar dados de todos os turnos
                const allVendas: any[] = [];
                for (const turno of turnosDisponiveis) {
                  const vendasTimestamp = generateDynamicTimestamp();
                  const vendasUrl = `${contahubBaseUrl}/M/guru.facades.GerenciaFacade/getTurnoVendas?trn=${turno}&t=${vendasTimestamp}&emp=${emp_id}`;
                  
                  try {
                    const vendasData = await fetchContaHubData(vendasUrl, sessionToken);
                    // 🔧 FIX: A resposta vem como { data: [...] }, não como array direto
                    const vendasArray = Array.isArray(vendasData) ? vendasData : 
                                       (vendasData?.data && Array.isArray(vendasData.data)) ? vendasData.data : [];
                    
                    if (vendasArray.length > 0) {
                      vendasArray.forEach((v: any) => v.trn = turno);
                      allVendas.push(...vendasArray);
                      console.log(`✅ Turno ${turno}: ${vendasArray.length} vendas`);
                    }
                  } catch (vendasTurnoError) {
                    console.warn(`⚠️ Erro ao buscar vendas do turno ${turno}:`, vendasTurnoError);
                  }
                  await delay(300); // Pequeno delay entre turnos
                }
                
                if (allVendas.length > 0) {
                  const vendasResult = await saveRawDataOnly(supabase, 'vendas', { list: allVendas }, data_date, bar_id);
                  dayResult.collected.push(vendasResult);
                  console.log(`✅ vendas: ${vendasResult.record_count} registros`);
                } else {
                  console.log(`⚠️ Nenhuma venda encontrada em ${data_date}`);
                }
              } catch (vendasError) {
                console.error(`❌ Erro ao buscar vendas:`, vendasError);
                dayResult.errors.push({
                  data_type: 'vendas',
                  error: vendasError instanceof Error ? vendasError.message : String(vendasError)
                });
              }
              continue; // Já processou, pular o loop normal
            default:
              continue;
          }
          
          const rawData = await fetchContaHubData(url, sessionToken);
          const saveResult = await saveRawDataOnly(supabase, dataType, rawData, data_date, bar_id);
          
          dayResult.collected.push(saveResult);
          console.log(`✅ ${dataType}: ${saveResult.record_count} registros`);
          
          // Pequeno delay entre tipos de dados
          await delay(500);
          
        } catch (error) {
          console.error(`❌ Erro em ${dataType}:`, error);
          dayResult.errors.push({
            data_type: dataType,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      results.collected.push(dayResult);
      
      // Delay entre dias
      if (i < dates.length - 1) {
        await delay(delay_ms);
      }
    }
    
    // Processar dados coletados se solicitado
    if (process_after) {
      console.log('\n🔄 Processando dados coletados...');
      
      try {
        const processorUrl = `${supabaseUrl}/functions/v1/contahub-processor`;
        
        for (const day of results.collected) {
          if (day.collected.length > 0) {
            await fetch(processorUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || ''
              },
              body: JSON.stringify({
                data_date: day.date,
                bar_id: bar_id,
                data_types: data_types
              })
            });
            
            await delay(1000);
          }
        }
        
        console.log('✅ Processamento concluído');
      } catch (procError) {
        console.error('❌ Erro no processamento:', procError);
      }
    }
    
    const summary = {
      bar_id,
      bar_nome: barConfig.nome,
      period: `${start_date} até ${end_date}`,
      total_days: results.total_days,
      days_collected: results.collected.filter(d => d.collected.length > 0).length,
      total_records: results.collected.reduce((sum, day) => 
        sum + day.collected.reduce((s: number, c: any) => s + (c.record_count || 0), 0), 0),
      errors_count: results.collected.reduce((sum, day) => sum + day.errors.length, 0)
    };
    
    console.log('\n📊 RESUMO FINAL:');
    console.log(`- Bar: ${summary.bar_nome}`);
    console.log(`- Período: ${summary.period}`);
    console.log(`- Dias processados: ${summary.days_collected}/${summary.total_days}`);
    console.log(`- Total de registros: ${summary.total_records}`);
    console.log(`- Erros: ${summary.errors_count}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Sincronização retroativa concluída',
      summary,
      details: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
