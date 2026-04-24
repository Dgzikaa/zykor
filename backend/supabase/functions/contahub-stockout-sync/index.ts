import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { agoraEdgeFunction, formatarDataHoraEdge } from '../_shared/timezone.ts';

console.log("­ƒôª ContaHub Stockout Sync - Controle de Estoque (Multi-Bar)");



function generateDynamicTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
}

// Fun├º├úo para enviar notifica├º├úo Discord
async function sendDiscordNotification(message: string, isError: boolean = false) {
  try {
    const webhookUrl = Deno.env.get('DISCORD_CONTAHUB_WEBHOOK');
    if (!webhookUrl) {
      console.log('ÔÜá´©Å Discord webhook n├úo configurado');
      return;
    }

    const embed = {
      title: isError ? 'ÔØî ContaHub Stockout - Erro' : '­ƒôª ContaHub Stockout',
      description: message,
      color: isError ? 15158332 : 3066993, // Vermelho ou Verde
      timestamp: new Date().toISOString(),
      footer: {
        text: 'SGB Stockout Control'
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
      console.error('ÔØî Erro ao enviar notifica├º├úo Discord:', response.status, response.statusText);
    } else {
      console.log('­ƒôó Notifica├º├úo Discord enviada');
    }
  } catch (error) {
    console.error('ÔØî Erro ao enviar notifica├º├úo Discord:', error);
  }
}

// Interface para credenciais do ContaHub
interface ContaHubCredentials {
  username: string;
  password: string;
  base_url: string;
  empresa_id: string | null;
}

// Fun├º├úo para buscar credenciais do ContaHub do banco de dados
async function getContaHubCredentials(supabase: any, barId: number): Promise<ContaHubCredentials> {
  console.log(`­ƒöÉ Buscando credenciais do ContaHub para bar_id=${barId}...`);
  
  const { data, error } = await supabase
    .from('api_credentials')
    .select('username, password, base_url, empresa_id')
    .eq('sistema', 'contahub')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !data) {
    console.error('ÔØî Erro ao buscar credenciais:', error);
    throw new Error(`Credenciais do ContaHub n├úo encontradas para bar_id=${barId}`);
  }

  console.log(`Ô£à Credenciais encontradas para bar_id=${barId}: ${data.username}`);
  return data;
}

// Fun├º├úo para extrair o ID da empresa do username (formato: usuario@empresa)
function getEmpresaId(credentials: ContaHubCredentials): string {
  // Prioridade 1: usar empresa_id se estiver preenchido
  if (credentials.empresa_id) {
    return credentials.empresa_id;
  }
  
  // Prioridade 2: extrair do username (formato: usuario@empresa)
  if (credentials.username && credentials.username.includes('@')) {
    const empresaId = credentials.username.split('@')[1];
    if (empresaId) {
      return empresaId;
    }
  }
  
  // Fallback: lan├ºar erro pois n├úo temos o ID da empresa
  throw new Error('ID da empresa n├úo encontrado nas credenciais. Preencha empresa_id ou use formato usuario@empresa no username.');
}

// Fun├º├úo de login no ContaHub
async function loginContaHub(credentials: ContaHubCredentials): Promise<string> {
  console.log(`­ƒöÉ Fazendo login no ContaHub com ${credentials.username}...`);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(credentials.password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordSha1 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const loginData = new URLSearchParams({
    "usr_email": credentials.username,
    "usr_password_sha1": passwordSha1
  });
  
  const loginTimestamp = generateDynamicTimestamp();
  
  // Usar a base_url das credenciais
  const baseUrl = credentials.base_url.replace('/api', ''); // Remover /api se existir
  const loginUrl = `${baseUrl}/rest/contahub.cmds.UsuarioCmd/login/${loginTimestamp}?emp=0`;
  
  console.log(`­ƒöù URL de login: ${loginUrl}`);
  
  const loginResponse = await fetch(loginUrl, {
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
    throw new Error('Cookies de sess├úo n├úo encontrados no login');
  }
  
  console.log('Ô£à Login ContaHub realizado com sucesso');
  return setCookieHeaders;
}

// Fun├º├úo para fazer requisi├º├Áes ao ContaHub
async function fetchContaHubData(url: string, sessionToken: string) {
  console.log(`­ƒöù Fazendo requisi├º├úo: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': sessionToken,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    },
  });
  
  if (!response.ok) {
    throw new Error(`Erro na requisi├º├úo ContaHub: ${response.statusText}`);
  }
  
  const responseText = await response.text();
  
  // Log detalhado da resposta
  console.log('­ƒôÑ Resposta ContaHub (primeiros 200 chars):', responseText.substring(0, 200));
  console.log('­ƒôÅ Tamanho da resposta:', responseText.length);
  
  // Limpar poss├¡veis caracteres invis├¡veis no in├¡cio
  const cleanedText = responseText.trim().replace(/^\uFEFF/, ''); // Remove BOM se existir
  
  try {
    return JSON.parse(cleanedText);
  } catch (parseError) {
    console.error('ÔØî Erro ao fazer parse da resposta ContaHub:', parseError);
    console.error('­ƒôÑ Resposta original:', responseText);
    console.error('­ƒôÑ Resposta limpa:', cleanedText);
    throw new Error(`Erro no parsing da resposta ContaHub: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Persistência medallion: bronze raw (public.contahub_stockout foi removida do projeto). */
async function processStockoutData(supabase: any, rawData: any, dataDate: string, barId: number) {
  console.log('📦 Processando dados de stockout → bronze...');

  if (!rawData?.list || !Array.isArray(rawData.list)) {
    console.log('⚠️ Nenhum dado de produto encontrado');
    return { processed: 0, errors: 0, skipped: 0 };
  }

  let errors = 0;
  const prefixosExcluidos = ['[HH]', '[DD]', '[IN]'];
  let skipped = 0;
  for (const item of rawData.list) {
    const prdDesc = item.prd_desc || '';
    if (prefixosExcluidos.some((prefixo) => prdDesc.startsWith(prefixo))) {
      skipped++;
    }
  }

  const horaColetaReal = new Date().toISOString();
  const rawRecords = rawData.list.map((item: any) => ({
    bar_id: barId,
    data_consulta: dataDate,
    hora_consulta_real: horaColetaReal,
    emp: strOrNull(item.emp),
    prd: strOrNull(item.prd),
    loc: strOrNull(item.loc),
    prd_desc: strOrNull(item.prd_desc),
    prd_venda: strOrNull(item.prd_venda),
    prd_ativo: strOrNull(item.prd_ativo),
    prd_produzido: strOrNull(item.prd_produzido),
    prd_unid: strOrNull(item.prd_unid),
    prd_precovenda: numOrNull(item.prd_precovenda),
    prd_estoque: numOrNull(item.prd_estoque),
    prd_controlaestoque: strOrNull(item.prd_controlaestoque),
    prd_validaestoquevenda: strOrNull(item.prd_validaestoquevenda),
    prd_opcoes: strOrNull(item.prd_opcoes),
    prd_venda7: numOrNull(item.prd_venda7),
    prd_venda30: numOrNull(item.prd_venda30),
    prd_venda180: numOrNull(item.prd_venda180),
    prd_nfencm: strOrNull(item.prd_nfencm),
    prd_nfeorigem: strOrNull(item.prd_nfeorigem),
    prd_nfecsosn: strOrNull(item.prd_nfecsosn),
    prd_nfecstpiscofins: strOrNull(item.prd_nfecstpiscofins),
    prd_nfepis: numOrNull(item.prd_nfepis),
    prd_nfecofins: numOrNull(item.prd_nfecofins),
    prd_nfeicms: numOrNull(item.prd_nfeicms),
    prd_qtddouble: strOrNull(item.prd_qtddouble),
    prd_disponivelonline: strOrNull(item.prd_disponivelonline),
    prd_cardapioonline: strOrNull(item.prd_cardapioonline),
    prd_semcustoestoque: strOrNull(item.prd_semcustoestoque),
    prd_balanca: strOrNull(item.prd_balanca),
    prd_delivery: strOrNull(item.prd_delivery),
    prd_entregaimediata: strOrNull(item.prd_entregaimediata),
    prd_semrepique: strOrNull(item.prd_semrepique),
    prd_naoimprimeproducao: strOrNull(item.prd_naoimprimeproducao),
    prd_agrupaimpressao: strOrNull(item.prd_agrupaimpressao),
    prd_contagemehperda: strOrNull(item.prd_contagemehperda),
    prd_naodesmembra: strOrNull(item.prd_naodesmembra),
    prd_naoimprimeficha: strOrNull(item.prd_naoimprimeficha),
    prd_servico: strOrNull(item.prd_servico),
    prd_zeraestoquenacompra: strOrNull(item.prd_zeraestoquenacompra),
    loc_desc: strOrNull(item.loc_desc),
    loc_inativo: strOrNull(item.loc_inativo),
    loc_statusimpressao: strOrNull(item.loc_statusimpressao),
    raw_data: item,
  }));

  const { error: delError } = await supabase
    .schema('bronze')
    .from('bronze_contahub_operacional_stockout_raw')
    .delete()
    .eq('bar_id', barId)
    .eq('data_consulta', dataDate);

  if (delError) {
    console.error('⚠️ Erro ao limpar bronze (mesmo bar/data) antes do insert:', delError);
  }

  const BATCH = 400;
  for (let i = 0; i < rawRecords.length; i += BATCH) {
    const chunk = rawRecords.slice(i, i + BATCH);
    const { error: insError } = await supabase
      .schema('bronze')
      .from('bronze_contahub_operacional_stockout_raw')
      .insert(chunk);

    if (insError) {
      console.error('❌ Erro ao inserir bronze stockout raw:', insError);
      throw new Error(`Erro ao salvar stockout: ${insError.message}`);
    }
  }

  console.log(
    `✅ ${rawRecords.length} registros salvos em bronze.bronze_contahub_operacional_stockout_raw (prefixos HH/DD/IN apenas contados: ${skipped})`,
  );
  return { processed: rawRecords.length, errors, skipped };
}


Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validar autenticação (JWT ou CRON_SECRET)
  const authError = requireAuth(req);
  if (authError) return authError;

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ success: false, error: 'Variáveis do Supabase não encontradas' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const requestBody = await req.text();
    console.log('📝 Body recebido:', requestBody);
    
    let parsedBody: { bar_id?: number; data_date?: string } = {};
    try {
      if (requestBody && requestBody.trim() !== '') {
        parsedBody = JSON.parse(requestBody);
      }
    } catch (jsonError) {
      console.error('❌ Erro ao fazer parse do JSON:', jsonError);
      throw new Error(`Erro no parsing do JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    }
    
    const { bar_id, data_date } = parsedBody;
    
    if (!bar_id || !data_date) {
      throw new Error('bar_id e data_date são obrigatórios');
    }

    const hbResult = await heartbeatStart(supabase, 'contahub-stockout-sync', bar_id, null, 'pgcron');
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;
    
    console.log(`🎯 Coletando STOCKOUT para bar_id=${bar_id}, data=${data_date}`);
    
    // Buscar credenciais do ContaHub para o bar espec├¡fico
    const credentials = await getContaHubCredentials(supabase, bar_id);
    
    // Extrair ID da empresa das credenciais
    const empresaId = getEmpresaId(credentials);
    
    console.log(`­ƒÅ¬ Bar ID: ${bar_id}`);
    console.log(`­ƒÅó Empresa ID: ${empresaId}`);
    console.log(`­ƒöù Base URL: ${credentials.base_url}`);
    
    // Enviar notifica├º├úo de in├¡cio
    await sendDiscordNotification(`­ƒÜÇ **Iniciando coleta Stockout**\n\n­ƒôè **Data:** ${data_date}\n­ƒÅ¬ **Bar ID:** ${bar_id}\n­ƒÅó **Empresa:** ${empresaId}\nÔÅ░ **In├¡cio:** ${formatarDataHoraEdge(agoraEdgeFunction())}`);
    
    // Login no ContaHub
    const sessionToken = await loginContaHub(credentials);
    
    // Gerar timestamp din├ómico
    const queryTimestamp = generateDynamicTimestamp();
    
    // Usar a base_url das credenciais
    const baseUrl = credentials.base_url.replace('/api', ''); // Remover /api se existir
    
    // URL para buscar produtos (API correta) - usando empresaId din├ómico
    const url = `${baseUrl}/rest/contahub.cmds.ProdutoCmd/getProdutos/${queryTimestamp}?emp=${empresaId}&prd_desc=%20&grp=-29&nfe=1`;
    
    console.log(`­ƒöù URL Produtos: ${url}`);
    
    // Buscar dados do ContaHub
    const rawData = await fetchContaHubData(url, sessionToken);
    
    console.log(`­ƒôè Dados recebidos do ContaHub: ${rawData?.list?.length || 0} produtos`);
    
    // Processar e salvar dados em bronze (delete do dia + insert em lotes)
    const result = await processStockoutData(supabase, rawData, data_date, bar_id);
    
    // Calcular estatísticas (excluindo [HH], [DD] e [IN])
    const prefixosExcluidosStats = ['[HH]', '[DD]', '[IN]'];
    const produtosFiltrados = rawData?.list?.filter((item: any) => {
      const prdDesc = item.prd_desc || '';
      return !prefixosExcluidosStats.some(prefixo => prdDesc.startsWith(prefixo));
    }) || [];
    
    const totalProdutos = produtosFiltrados.length;
    const produtosAtivos = produtosFiltrados.filter((item: any) => item.prd_venda === "S").length;
    const produtosInativos = totalProdutos - produtosAtivos;
    const percentualStockout = totalProdutos > 0 ? ((produtosInativos / totalProdutos) * 100).toFixed(2) : '0.00';
    
    // Resultado final
    const summary = {
      bar_id,
      empresa_id: empresaId,
      data_date,
      data_type: 'stockout',
      total_produtos: totalProdutos,
      produtos_ativos: produtosAtivos,
      produtos_inativos: produtosInativos,
      percentual_stockout: `${percentualStockout}%`,
      registros_processados: result.processed,
      produtos_happy_hour_excluidos: result.skipped,
      erros: result.errors,
      processamento_completo: true
    };
    
    console.log('\n­ƒôè RESUMO STOCKOUT:');
    console.log(`- Bar ID: ${bar_id}`);
    console.log(`- Empresa ID: ${empresaId}`);
    console.log(`- Data: ${data_date}`);
    console.log(`- Total produtos: ${summary.total_produtos}`);
    console.log(`- Produtos ativos: ${summary.produtos_ativos}`);
    console.log(`- Produtos inativos: ${summary.produtos_inativos}`);
    console.log(`- % Stockout: ${summary.percentual_stockout}`);
    console.log(`- Registros processados: ${summary.registros_processados}`);
    
    const successMessage = `✅ **Stockout processado com sucesso**\n\n🏪 **Bar ID:** ${bar_id}\n🏢 **Empresa:** ${empresaId}\n\n📊 **Resultados:**\n• Total produtos: ${summary.total_produtos}\n• Produtos ativos: ${summary.produtos_ativos}\n• Produtos inativos: ${summary.produtos_inativos}\n• % Stockout: ${summary.percentual_stockout}\n\n⏱ **Fim:** ${formatarDataHoraEdge(agoraEdgeFunction())}`;
    await sendDiscordNotification(successMessage);

    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, summary.registros_processados, { total_produtos: summary.total_produtos, percentual_stockout: summary.percentual_stockout });
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Stockout coletado e processado completamente',
      summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    
    await heartbeatError(supabase, heartbeatId, startTime, error instanceof Error ? error : String(error));
    
    const errorMessage = `❌ **Erro na coleta Stockout**\n\n⏱ **Tempo:** ${formatarDataHoraEdge(agoraEdgeFunction())}\n🚨 **Erro:** ${error instanceof Error ? error.message : String(error)}`;
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
