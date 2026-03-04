/**
 * Script de Sincronização Retroativa do NIBO - Deboche Bar
 * 
 * Busca todos os agendamentos PAGOS (contas a pagar/receber) do NIBO
 * desde 02/05/2023 até hoje e insere na tabela nibo_agendamentos
 * 
 * Uso: node scripts/sync-nibo-deboche-retroativo.js
 */

const fs = require('fs');
const path = require('path');

// Carregar .env.local
function loadEnvFile(envPath) {
  try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=');
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
    console.log('✅ Variáveis de ambiente carregadas de .env.local\n');
  } catch (e) {
    console.log('⚠️ Não foi possível carregar .env.local:', e.message);
  }
}

// Tentar carregar .env.local
const envPaths = [
  path.join(process.cwd(), 'frontend', '.env.local'),
  path.join(__dirname, '..', 'frontend', '.env.local')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    loadEnvFile(envPath);
    break;
  }
}

// Importar Supabase
const { createClient } = require('@supabase/supabase-js');

// Configurações
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NIBO_API_TOKEN = '04A44D8D7EDE4F038871ECD294B2662D';
const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';
const BAR_ID = 4; // Deboche Bar
const BAR_NOME = 'Deboche Bar';

// Data inicial: 02/05/2023
const DATA_INICIO = new Date('2023-05-02');
const DATA_FIM = new Date(); // Hoje

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada!');
  console.error('Configure a variável de ambiente ou edite o script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Função para formatar data no padrão YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Função para fazer requisição ao NIBO com retry
async function fetchNiboWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'ApiToken': NIBO_API_TOKEN
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro NIBO (tentativa ${i + 1}/${maxRetries}):`, response.status, errorText);
        
        if (i === maxRetries - 1) {
          throw new Error(`Erro NIBO ${response.status}: ${errorText}`);
        }
        
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        continue;
      }

      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`⚠️ Tentativa ${i + 1} falhou, tentando novamente...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}

// Função para buscar agendamentos do NIBO (paginado)
async function fetchNiboSchedules(tipo, dataInicio, dataFim) {
  const endpoint = tipo === 'despesa' ? 'schedules/debit' : 'schedules/credit';
  const allItems = [];
  let skip = 0;
  const top = 500; // Limite máximo do NIBO
  
  console.log(`\n📥 Buscando ${tipo}s de ${formatDate(dataInicio)} até ${formatDate(dataFim)}...`);

  while (true) {
    // Filtro OData: data de VENCIMENTO no período
    // Nota: A API do Nibo usa 'dueDate' para filtro, não 'paymentDate'
    const filter = `dueDate ge ${formatDate(dataInicio)} and dueDate le ${formatDate(dataFim)}`;
    const url = `${NIBO_BASE_URL}/${endpoint}?apitoken=${NIBO_API_TOKEN}&$orderby=dueDate&$skip=${skip}&$top=${top}&$filter=${encodeURIComponent(filter)}`;
    
    console.log(`  Página ${Math.floor(skip / top) + 1} (offset: ${skip})...`);
    
    const data = await fetchNiboWithRetry(url);
    const items = data.items || data.value || [];
    
    if (items.length === 0) {
      console.log(`  ✓ Nenhum registro encontrado (fim da paginação)`);
      break;
    }
    
    allItems.push(...items);
    console.log(`  ✓ ${items.length} registros encontrados (total: ${allItems.length})`);
    
    // Se retornou menos que o limite, é a última página
    if (items.length < top) {
      break;
    }
    
    skip += top;
    
    // Aguardar um pouco entre requisições para não sobrecarregar a API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return allItems;
}

// Função para normalizar dados do NIBO para o formato do banco
function normalizarAgendamento(item, tipo) {
  // Extrair categoria principal (primeira categoria do array)
  const categoria = item.categories?.[0] || {};
  
  // Extrair centro de custo (primeiro do array)
  const centroCusto = item.costCenters?.[0] || {};
  
  return {
    nibo_id: item.id,
    bar_id: BAR_ID,
    bar_nome: BAR_NOME,
    tipo: tipo,
    status: item.status || 'pendente',
    valor: Math.abs(parseFloat(item.value || 0)),
    valor_pago: item.paidValue ? Math.abs(parseFloat(item.paidValue)) : null,
    data_vencimento: item.dueDate || null,
    data_pagamento: item.paymentDate || null,
    data_competencia: item.accrualDate || item.dueDate || null,
    descricao: item.description || null,
    observacoes: item.observation || null,
    titulo: item.title || item.description || null,
    categoria_id: categoria.categoryId || null,
    categoria_nome: categoria.categoryName || null,
    stakeholder_id: item.stakeholder?.id || null,
    stakeholder_nome: item.stakeholder?.name || null,
    stakeholder_tipo: item.stakeholder?.type || null,
    conta_bancaria_id: item.bankAccount?.id || null,
    conta_bancaria_nome: item.bankAccount?.name || null,
    centro_custo_id: centroCusto.costCenterId || null,
    centro_custo_nome: centroCusto.costCenterName || null,
    numero_documento: item.documentNumber || null,
    numero_parcela: item.installmentNumber || null,
    total_parcelas: item.totalInstallments || null,
    recorrente: item.isRecurring || false,
    frequencia_recorrencia: item.recurringFrequency || null,
    origem: 'nibo',
    sincronizado_nibo: true,
    deletado: false,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };
}

// Função para inserir em lote (batch insert)
async function insertBatch(agendamentos, batchSize = 100) {
  const total = agendamentos.length;
  let inseridos = 0;
  let erros = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = agendamentos.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from('nibo_agendamentos')
        .upsert(batch, {
          onConflict: 'nibo_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`❌ Erro ao inserir lote ${Math.floor(i / batchSize) + 1}:`, error.message);
        erros += batch.length;
      } else {
        inseridos += batch.length;
        console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(total / batchSize)} inserido (${inseridos}/${total})`);
      }
    } catch (error) {
      console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, error);
      erros += batch.length;
    }

    // Aguardar entre lotes
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { inseridos, erros };
}

// Função principal
async function main() {
  console.log('🚀 ========================================');
  console.log('🚀 SINCRONIZAÇÃO RETROATIVA NIBO - DEBOCHE BAR');
  console.log('🚀 ========================================\n');
  console.log(`📅 Período: ${formatDate(DATA_INICIO)} até ${formatDate(DATA_FIM)}`);
  console.log(`🏢 Bar: ${BAR_NOME} (ID: ${BAR_ID})`);
  console.log(`🔑 Token: ${NIBO_API_TOKEN.substring(0, 8)}...`);
  console.log('');

  try {
    // 1. Verificar credenciais no banco
    console.log('🔍 Verificando credenciais no banco...');
    const { data: credencial, error: credError } = await supabase
      .from('api_credentials')
      .select('id, api_token, ativo')
      .eq('bar_id', BAR_ID)
      .eq('sistema', 'nibo')
      .single();

    if (credError || !credencial) {
      console.error('❌ Credenciais não encontradas no banco!');
      process.exit(1);
    }

    console.log(`✅ Credenciais encontradas (ID: ${credencial.id}, Ativo: ${credencial.ativo})`);

    // 2. Buscar DESPESAS (schedules/debit)
    console.log('\n📊 ETAPA 1/2: Buscando DESPESAS...');
    const despesas = await fetchNiboSchedules('despesa', DATA_INICIO, DATA_FIM);
    console.log(`✅ Total de despesas encontradas: ${despesas.length}`);

    // 3. Buscar RECEITAS (schedules/credit)
    console.log('\n📊 ETAPA 2/2: Buscando RECEITAS...');
    const receitas = await fetchNiboSchedules('receita', DATA_INICIO, DATA_FIM);
    console.log(`✅ Total de receitas encontradas: ${receitas.length}`);

    // 4. Normalizar dados
    console.log('\n🔄 Normalizando dados...');
    const despesasNormalizadas = despesas.map(d => normalizarAgendamento(d, 'despesa'));
    const receitasNormalizadas = receitas.map(r => normalizarAgendamento(r, 'receita'));
    const todosAgendamentos = [...despesasNormalizadas, ...receitasNormalizadas];
    
    console.log(`✅ ${todosAgendamentos.length} agendamentos prontos para inserção`);

    // 5. Inserir no banco
    console.log('\n💾 Inserindo no banco de dados...');
    const { inseridos, erros } = await insertBatch(todosAgendamentos);

    // 6. Estatísticas finais
    console.log('\n📊 ========================================');
    console.log('📊 RESUMO DA SINCRONIZAÇÃO');
    console.log('📊 ========================================');
    console.log(`✅ Total de registros buscados: ${todosAgendamentos.length}`);
    console.log(`   - Despesas: ${despesas.length}`);
    console.log(`   - Receitas: ${receitas.length}`);
    console.log(`✅ Registros inseridos: ${inseridos}`);
    if (erros > 0) {
      console.log(`❌ Erros: ${erros}`);
    }

    // 7. Verificar categorias importantes (Fevereiro/2025)
    console.log('\n🎯 Verificando categorias de custos (Fevereiro/2025)...');
    const { data: custosFev, error: custosFevError } = await supabase
      .from('nibo_agendamentos')
      .select('categoria_nome')
      .eq('bar_id', BAR_ID)
      .gte('data_competencia', '2025-02-01')
      .lt('data_competencia', '2025-03-01');

    if (!custosFevError && custosFev) {
      // Agrupar por categoria
      const categorias = {};
      custosFev.forEach(c => {
        const cat = c.categoria_nome || 'Sem categoria';
        categorias[cat] = (categorias[cat] || 0) + 1;
      });

      console.log('\n📈 Categorias em Fevereiro/2025:');
      Object.entries(categorias)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([cat, count]) => {
          console.log(`   - ${cat}: ${count} registros`);
        });
    }

    // 8. Verificar custos artísticos (Atrações)
    console.log('\n🎭 Verificando custos de Atrações/Eventos...');
    const { data: atracoes, error: atracoesError } = await supabase
      .from('nibo_agendamentos')
      .select('data_competencia, valor, descricao')
      .eq('bar_id', BAR_ID)
      .ilike('categoria_nome', '%atra%')
      .gte('data_competencia', '2025-02-01')
      .lt('data_competencia', '2025-03-01')
      .order('data_competencia');

    if (!atracoesError && atracoes && atracoes.length > 0) {
      const totalAtracoes = atracoes.reduce((sum, a) => sum + parseFloat(a.valor || 0), 0);
      console.log(`✅ Encontradas ${atracoes.length} atrações em Fev/2025`);
      console.log(`💰 Total: R$ ${totalAtracoes.toFixed(2)}`);
      console.log('\nPrimeiras 5 atrações:');
      atracoes.slice(0, 5).forEach(a => {
        console.log(`   ${a.data_competencia}: R$ ${parseFloat(a.valor).toFixed(2)} - ${a.descricao}`);
      });
    } else {
      console.log('⚠️ Nenhuma atração encontrada em Fevereiro/2025');
    }

    console.log('\n✅ ========================================');
    console.log('✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('✅ ========================================\n');

  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error);
    process.exit(1);
  }
}

// Executar
main().catch(console.error);
