import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { heartbeatStart, heartbeatEnd, heartbeatError } from "../_shared/heartbeat.ts";
import { withRetry, isRetriableError } from "../_shared/retry.ts";
import { validateFunctionEnv } from "../_shared/env-validator.ts";
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import { 
  TIMEZONE, 
  UTC_OFFSET_STRING_COMPACT, 
  toBRTISOCompact,
  agoraEdgeFunction,
  formatarDataHoraEdge 
} from "../_shared/timezone.ts";

console.log("📊 ContaHub Sync - Coleta de Dados (Processamento via pg_cron)");



function generateDynamicTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
}

// Converte data de YYYY-MM-DD para formato ISO com timezone (formato ContaHub)
// Ex: 2024-10-15 -> 2024-10-15T00:00:00-0300
function toContaHubDateFormat(isoDate: string): string {
  return toBRTISOCompact(isoDate);
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
      title: isError ? '❌ ContaHub Sync - Erro' : '✅ ContaHub Sync',
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
      console.log('📣 Notificação Discord enviada');
    }
  } catch (error) {
    console.error('❌ Erro ao enviar notificação Discord:', error);
  }
}

// Função de login no ContaHub
async function loginContaHub(email: string, password: string): Promise<string> {
  console.log('🔐 Fazendo login no ContaHub...');
  
  return await withRetry(
    async () => {
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
        const error: any = new Error(`Erro no login ContaHub: ${loginResponse.statusText}`);
        error.status = loginResponse.status;
        throw error;
      }
      
      const setCookieHeaders = loginResponse.headers.get('set-cookie');
      if (!setCookieHeaders) {
        throw new Error('Cookies de sessão não encontrados no login');
      }
      
      console.log('✅ Login ContaHub realizado com sucesso');
      return setCookieHeaders;
    },
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      retryOn: isRetriableError
    }
  );
}

// Função para fazer requisições ao ContaHub
async function fetchContaHubData(url: string, sessionToken: string) {
  console.log(`🔍 Fazendo requisição: ${url}`);
  
  return await withRetry(
    async () => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cookie': sessionToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
      });
      
      if (!response.ok) {
        const error: any = new Error(`Erro na requisição ContaHub: ${response.statusText}`);
        error.status = response.status;
        throw error;
      }
      
      const responseText = await response.text();
      return JSON.parse(responseText);
    },
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      retryOn: isRetriableError
    }
  );
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
  const contahubDate = toBRTISOCompact(dataDate);
  
  // 1. Primeiro tentar buscar tudo de uma vez
  try {
    const timestamp = generateTimestamp();
    const url = `${baseUrl}/rest/contahub.cmds.QueryCmd/execQuery/${timestamp}?qry=${queryId}&d0=${contahubDate}&d1=${contahubDate}${extraParams}&local=&emp=${empId}&nfe=1`;
    console.log(`🔄 Tentando buscar ${dataType} completo...`);
    const data = await fetchContaHubData(url, sessionToken);
    console.log(`✅ ${dataType} completo: ${data?.list?.length || 0} registros`);
    return data;
  } catch (error) {
    console.warn(`⚠️ Query ${dataType} completa falhou (possivelmente muito grande), dividindo por local...`);
  }
  
  // 2. Se falhou, dividir por LOCAL (filtro mais eficiente)
  const allRecords: any[] = [];
  const seenKeys = new Set<string>(); // Para deduplicar registros
  
  for (const local of LOCAIS_CONTAHUB) {
    try {
      const timestamp = generateTimestamp();
      const localParam = local ? encodeURIComponent(local) : '';
      const url = `${baseUrl}/rest/contahub.cmds.QueryCmd/execQuery/${timestamp}?qry=${queryId}&d0=${contahubDate}&d1=${contahubDate}${extraParams}&local=${localParam}&emp=${empId}&nfe=1`;
      console.log(`🔄 Buscando ${dataType} local "${local || '(vazio)'}"...`);
      
      const data = await fetchContaHubData(url, sessionToken);
      if (data?.list && Array.isArray(data.list)) {
        let addedCount = 0;
        for (const record of data.list) {
          // Criar chave única usando TODOS os campos do registro
          // Isso garante que só duplicatas EXATAS sejam removidas
          // (mesmo item que passou por múltiplos locais)
          const uniqueKey = JSON.stringify(record);
          
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            allRecords.push(record);
            addedCount++;
          }
        }
        console.log(`✅ Local "${local || '(vazio)'}": ${data.list.length} registros (${addedCount} únicos)`);
      }
      
      // Pequeno delay entre requisições para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (localError) {
      console.warn(`⚠️ ${dataType} Local "${local || '(vazio)'}" falhou`);
    }
  }
  
  console.log(`📊 Total ${dataType} consolidado: ${allRecords.length} registros únicos (de ${allRecords.length + seenKeys.size - allRecords.length} coletados)`);
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

// Função para buscar CANCELAMENTOS com divisão quando a query for muito grande
// Query ID 57 = Cancelamentos (confirmado via ContaHub)
async function fetchCancelamentosComDivisao(
  baseUrl: string, 
  dataDate: string, 
  empId: string, 
  sessionToken: string,
  generateTimestamp: () => string
): Promise<any> {
  return fetchComDivisaoPorLocal(
    baseUrl, dataDate, empId, sessionToken, generateTimestamp,
    57, 'cancelamentos', '&comanda='
  );
}

// Função para salvar JSON bruto (SEM PROCESSAMENTO)
async function saveRawDataOnly(supabase: any, dataType: string, rawData: any, dataDate: string, barId: number = 3) {
  console.log(`💾 Salvando JSON bruto para ${dataType}...`);
  
  try {
    const recordCount = Array.isArray(rawData?.list) ? rawData.list.length : 
                       Array.isArray(rawData) ? rawData.length : 1;
    
    // CRÍTICO: Não salvar dados vazios no banco
    // Isso evita criar registros "fantasma" que bloqueiam o processamento
    if (recordCount === 0) {
      console.warn(`⚠️ ${dataType}: ContaHub retornou 0 registros - NÃO salvando no banco`);
      throw new Error(`ContaHub retornou dados vazios para ${dataType} em ${dataDate}. Dia pode não ter fechado ainda.`);
    }
    
    // Calcular hash dos dados para detectar mudanças
    const dataHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(rawData))
    );
    const hashArray = Array.from(new Uint8Array(dataHash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Verificar se já existe registro para esta data
    const { data: existingRecord } = await supabase
      .from('contahub_raw_data')
      .select('id, data_hash, processed')
      .eq('bar_id', barId)
      .eq('data_type', dataType)
      .eq('data_date', dataDate)
      .single();
    
    let needsReprocess = false;
    let isUpdate = false;
    
    if (existingRecord) {
      isUpdate = true;
      // Se hash mudou, marcar para reprocessar
      if (existingRecord.data_hash !== hashHex) {
        needsReprocess = true;
        console.log(`🔄 ${dataType}: Dados mudaram (hash diferente), marcando para reprocessar`);
      } else {
        console.log(`✅ ${dataType}: Dados idênticos (hash igual), mantendo como está`);
      }
    }
    
    // Salvar ou atualizar dados
    const { data, error } = await supabase
      .from('contahub_raw_data')
      .upsert({
        bar_id: barId,
        data_type: dataType,
        data_date: dataDate,
        raw_json: rawData,
        record_count: recordCount,
        data_hash: hashHex,
        processed: needsReprocess ? existingRecord.processed : false,
        needs_reprocess: needsReprocess
      }, {
        onConflict: 'bar_id,data_type,data_date'
      })
      .select('id');
          
    if (error) {
      console.error(`❌ Erro ao salvar ${dataType}:`, error);
      throw new Error(`Erro ao salvar ${dataType}: ${error.message}`);
    }
    
    const rawDataId = data && data.length > 0 ? data[0].id : 'updated';
    const action = isUpdate ? (needsReprocess ? 'atualizado (reprocessar)' : 'mantido (sem mudanças)') : 'criado';
    
    console.log(`✅ ${dataType} ${action}: raw_data_id=${rawDataId}, registros=${recordCount}`);
    
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
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validar autenticação (JWT ou CRON_SECRET)
  const authError = requireAuth(req);
  if (authError) return authError;

  // 💓 Heartbeat: variáveis no escopo externo para acesso no catch
  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  try {
    // Validar variáveis de ambiente obrigatórias
    validateFunctionEnv('contahub-sync-automatico', [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]);

    const requestBody = await req.text();
    console.log('📊 Body recebido:', requestBody);
    
    const { 
      bar_id, 
      data_date, 
      data_inicio,  // Para backfill: data inicial do range
      data_fim,     // Para backfill: data final do range
      only_cancelamentos, // Se true, busca apenas cancelamentos (para backfill rápido)
      emp_id: empIdFromPayload, 
      contahub_emp_id: contahubEmpIdFromPayload 
    } = JSON.parse(requestBody || '{}');
    
    // Se tem data_inicio e data_fim, é um backfill de range
    if (data_inicio && data_fim && only_cancelamentos) {
      console.log(`🔄 Modo BACKFILL: Buscando cancelamentos de ${data_inicio} a ${data_fim} para bar_id=${bar_id}`);
      // Será tratado abaixo
    } else if (!bar_id || !data_date) {
      throw new Error('bar_id e data_date são obrigatórios (ou data_inicio/data_fim para backfill)');
    }
    
    console.log(`🎯 Processando dados para bar_id=${bar_id}, data=${data_date || `${data_inicio} a ${data_fim}`}`);
    
    // Enviar notificação de início
    await sendDiscordNotification(`🚀 **Iniciando sincronização ContaHub**\n\n📊 **Dados:** ${data_date}\n🍺 **Bar ID:** ${bar_id}\n⏰ **Início:** ${formatarDataHoraEdge(agoraEdgeFunction())}`);
    
    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 💓 Heartbeat: registrar início da execução com advisory lock
    const hbResult = await heartbeatStart(
      supabase,
      'contahub-sync-automatico',
      bar_id || null,
      data_inicio && data_fim ? 'backfill' : 'sync',
      'pgcron',
      true, // useLock
      30    // timeout 30 minutos
    );
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;
    
    // Se não conseguiu o lock, abortar execução
    if (!hbResult.lockAcquired) {
      console.log('🔒 Sync já em execução para este bar, abortando');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Sync já em execução para este bar',
          lock_acquired: false 
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Resolver emp_id do ContaHub:
    // 1) payload (emp_id/contahub_emp_id), 2) bares.config.contahub_emp_id, 3) api_credentials.empresa_id
    let emp_id: string | null =
      empIdFromPayload != null
        ? String(empIdFromPayload)
        : contahubEmpIdFromPayload != null
        ? String(contahubEmpIdFromPayload)
        : null;

    const { data: barConfig, error: barError } = await supabase
      .from('bares')
      .select('config')
      .eq('id', bar_id)
      .maybeSingle();

    if (barError) {
      console.warn(`⚠️ Falha ao consultar bar ${bar_id} em bares:`, barError.message);
    }

    if (!emp_id) {
      const fromBarConfig = barConfig?.config?.contahub_emp_id;
      if (fromBarConfig != null) {
        emp_id = String(fromBarConfig);
      }
    }

    if (!emp_id) {
      const { data: credComEmpresaId, error: credEmpError } = await supabase
        .from('api_credentials')
        .select('empresa_id')
        .eq('bar_id', bar_id)
        .eq('sistema', 'contahub')
        .eq('ativo', true)
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (credEmpError) {
        console.warn(`⚠️ Falha ao buscar empresa_id em api_credentials para bar ${bar_id}:`, credEmpError.message);
      }

      if (credComEmpresaId?.empresa_id != null) {
        emp_id = String(credComEmpresaId.empresa_id);
      }
    }

    if (!emp_id) {
      throw new Error(`ContaHub emp_id não configurado para bar ${bar_id} (payload, bares.config e api_credentials.empresa_id)`);
    }
    
    console.log(`📌 Bar ID: ${bar_id}, ContaHub emp_id: ${emp_id}`);
    
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
    
    // MODO BACKFILL: Buscar apenas cancelamentos para um range de datas
    if (data_inicio && data_fim && only_cancelamentos) {
      console.log(`\n🔄 MODO BACKFILL CANCELAMENTOS: ${data_inicio} a ${data_fim}`);
      
      const startDate = new Date(data_inicio);
      const endDate = new Date(data_fim);
      let currentDate = startDate;
      let totalDias = 0;
      let totalRegistros = 0;
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        try {
          console.log(`📅 Buscando cancelamentos para ${dateStr}...`);
          const cancelamentosData = await fetchCancelamentosComDivisao(
            contahubBaseUrl, dateStr, emp_id, sessionToken, generateDynamicTimestamp
          );
          const saveResult = await saveRawDataOnly(supabase, 'cancelamentos', cancelamentosData, dateStr, bar_id);
          totalRegistros += saveResult.record_count;
          totalDias++;
          console.log(`✅ ${dateStr}: ${saveResult.record_count} cancelamentos`);
          
          // Pequeno delay para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`❌ Erro em ${dateStr}:`, error);
          results.errors.push({ date: dateStr, error: String(error) });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      const summary = {
        bar_id,
        mode: 'backfill_cancelamentos',
        data_inicio,
        data_fim,
        total_dias: totalDias,
        total_registros: totalRegistros,
        errors: results.errors.length,
        timestamp: new Date().toISOString()
      };
      
      console.log('📊 Backfill concluído:', JSON.stringify(summary));
      
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // 1. COLETA E ARMAZENAMENTO DE JSON BRUTO (modo normal)
    console.log('\n📊 FASE 1: Coletando e salvando JSONs brutos...');
    
    const dataTypes = ['analitico', 'fatporhora', 'pagamentos', 'periodo', 'tempo', 'vendas', 'cancelamentos'];
    
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
            
          case 'vendas':
            // 📞 getTurnoVendas - Dados com vd_hrabertura e vd_hrsaida
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
              console.log(`🔍 Buscando vendas do turno ${turno}: ${vendasUrl}`);
              
              try {
                const vendasData = await fetchContaHubData(vendasUrl, sessionToken);
                // 🔺 FIX: A resposta vem como { data: [...] }, não como array direto
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
            
          case 'cancelamentos':
            // Usar função com divisão para evitar erro "Resultado muito grande"
            try {
              const cancelamentosData = await fetchCancelamentosComDivisao(
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
            
          default:
            throw new Error(`Tipo de dados não suportado: ${dataType}`);
        }
        
        console.log(`🔍 URL: ${url}`);
        
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
    console.log('\n✅ PROCESSAMENTO: Dados salvos para processamento automático via pg_cron');
    
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
    
    // Gravar log de sincronização
    try {
      await supabase.from('sync_logs_contahub').insert({
        bar_id,
        data_sync: data_date,
        status: summary.error_count === 0 ? 'sucesso' : 'parcial',
        inicio_execucao: new Date().toISOString(),
        fim_execucao: new Date().toISOString(),
        total_analitico: results.collected.find(r => r.data_type === 'analitico')?.record_count || 0,
        total_fatporhora: results.collected.find(r => r.data_type === 'fatporhora')?.record_count || 0,
        total_pagamentos: results.collected.find(r => r.data_type === 'pagamentos')?.record_count || 0,
        total_periodo: results.collected.find(r => r.data_type === 'periodo')?.record_count || 0,
        total_tempo: results.collected.find(r => r.data_type === 'tempo')?.record_count || 0,
        total_registros: summary.total_records_collected,
        triggered_by: 'pgcron',
        detalhes: { collected: results.collected, errors: results.errors }
      });
      console.log('✅ Log de sincronização gravado');
    } catch (logError) {
      console.error('⚠️ Erro ao gravar log:', logError);
    }
    
    // 🔄 ATUALIZAR CACHE DE CLIENTE_ESTATISTICAS
    console.log('\n📊 Atualizando cache de cliente_estatisticas...');
    try {
      // Usar função UPSERT que não faz DELETE (compatível com trigger de proteção)
      const { error: cacheError } = await supabase.rpc('refresh_cliente_estatisticas_upsert', { 
        p_bar_id: bar_id,
        p_data_visita: data_date 
      });
      
      if (cacheError) {
        console.error('❌ Erro ao atualizar cache de clientes:', cacheError);
      } else {
        console.log('✅ Cache de clientes atualizado (upsert)');
      }
    } catch (cacheErr) {
      console.error('❌ Erro ao atualizar cache de clientes:', cacheErr);
    }
    
    // 🚀 CHAMAR DISCORD NOTIFICATION para CONTAHUB
    try {
      const discordResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/discord-dispatcher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          action: 'notification',
          title: summary.error_count === 0 ? '✅ ContaHub Sync Concluído' : '⚠️ ContaHub Sync com Erros',
          webhook_type: 'contahub',
          processed_records: summary.total_records_collected,
          bar_id: parseInt(bar_id),
          execution_time: `Dados: ${data_date}`,
          custom_message: `📊 **Coleta ContaHub concluída**\n\n📈 **Resultados:**\n• Coletados: ${summary.collected_count}/5 tipos\n• Registros coletados: ${summary.total_records_collected}\n• Erros: ${summary.error_count}\n\n✅ **Processamento:** Iniciado automaticamente via pg_cron\n⏰ **Fim:** ${formatarDataHoraEdge(agoraEdgeFunction())}`
        })
      });

      if (!discordResponse.ok) {
        console.error('❌ Erro ao enviar notificação Discord ContaHub:', discordResponse.status);
      } else {
        console.log('📣 Notificação Discord ContaHub enviada');
      }
    } catch (discordError) {
      console.error('❌ Erro ao enviar notificação Discord ContaHub:', discordError);
    }
    
    // 💓 Heartbeat: registrar sucesso e liberar lock
    await heartbeatEnd(
      supabase,
      heartbeatId,
      summary.error_count === 0 ? 'success' : 'partial',
      startTime,
      summary.total_records_collected,
      { 
        collected_count: summary.collected_count,
        error_count: summary.error_count,
        data_date: summary.data_date
      },
      undefined,
      'contahub-sync-automatico',
      bar_id || null,
      true // releaseLock
    );
    
    // 🔄 Chamar processor automaticamente após sync bem-sucedido
    console.log('🔄 Chamando contahub-processor automaticamente...');
    try {
      const processorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/contahub-processor`;
      const processorResponse = await fetch(processorUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          process_all: true,
          bar_id: bar_id
        })
      });
      
      if (processorResponse.ok) {
        console.log('✅ Processor chamado com sucesso');
      } else {
        console.warn(`⚠️ Processor retornou status ${processorResponse.status}`);
      }
    } catch (processorError) {
      console.error('❌ Erro ao chamar processor:', processorError);
      // Não falhar o sync se o processor falhar
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
    
    // 💓 Heartbeat: registrar erro e liberar lock (precisa recriar supabase client se falhou antes)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseForError = createClient(supabaseUrl, supabaseServiceKey);
        await heartbeatError(
          supabaseForError, 
          heartbeatId, 
          startTime, 
          error instanceof Error ? error : String(error),
          undefined,
          'contahub-sync-automatico',
          undefined,
          true // releaseLock
        );
      }
    } catch (hbErr) {
      console.warn('⚠️ Erro ao registrar heartbeat de erro:', hbErr);
    }
    
    // Enviar notificação de erro crítico
    const errorMessage = `❌ **Erro crítico na sincronização ContaHub**\n\n⏰ **Tempo:** ${formatarDataHoraEdge(agoraEdgeFunction())}\n🔥 **Erro:** ${error instanceof Error ? error.message : String(error)}`;
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
