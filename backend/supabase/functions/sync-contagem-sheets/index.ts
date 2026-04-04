import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
import { getGoogleAccessToken, downloadDriveFileAsExcel, parseDataBR } from '../_shared/google-auth.ts'
import { 
  getSyncBaseline, 
  validateSheetStructure, 
  updateSyncBaseline,
  createValidationError,
  logValidationResult,
  isValidationError
} from '../_shared/sheets-validation.ts'
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

/**
 * 📦 EDGE FUNCTION - SYNC-CONTAGEM-SHEETS
 * 
 * Sincroniza dados de contagem de estoque da planilha INSUMOS do Google Sheets
 * para a tabela contagem_estoque_insumos no Supabase.
 * 
 * Fluxo:
 * 1. Busca configuração de spreadsheet_id para cada bar
 * 2. Baixa a planilha como Excel
 * 3. Lê a aba INSUMOS
 * 4. Identifica as colunas de data
 * 5. Extrai estoque_fechado, estoque_flutuante, pedido para cada insumo/data
 * 6. Upsert na tabela contagem_estoque_insumos
 * 
 * v2.0: BLOCO 3A - Agora lê layout_contagem de api_credentials.configuracoes
 *       Fallback para mapeamento hardcoded se não encontrar no banco.
 * 
 * @version 2.0.0
 * @date 2026-03-19
 */

/**
 * Normaliza texto removendo acentos e caracteres especiais
 * para gerar códigos consistentes
 */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '_')      // Substitui não-alfanuméricos por _
    .replace(/_+/g, '_')              // Remove múltiplos underscores
    .replace(/^_|_$/g, '')            // Remove _ no início e fim
    .substring(0, 30)                 // Limita tamanho
}

/**
 * Gera código único para item sem código na planilha
 */
function gerarCodigoAuto(nome: string): string {
  return `auto_${normalizarTexto(nome)}`
}

/**
 * Configuração de layout da planilha de contagem
 */
interface LayoutContagemType {
  linhasDatas: number       // Índice da linha que contém as datas
  linhaCabecalhos: number   // Índice da linha de cabeçalhos
  linhaInicio: number       // Índice da primeira linha de dados
  colunaPreco: number       // Índice da coluna de preço
  colunaCodigo: number      // Índice da coluna de código
  colunaCategoria: number   // Índice da coluna de categoria
  colunaNome: number        // Índice da coluna do nome do insumo
  colunasPorData: number    // Quantas colunas por data (3 = fechado, flutuante, pedido | 2 = fechado, flutuante)
}

// ====== FALLBACK (usado se banco não tiver configuração) ======
// Este fallback usa valores do Ordinário (bar 3) como padrão seguro
const FALLBACK_LAYOUT_CONTAGEM: LayoutContagemType = {
  linhasDatas: 3,        // Linha 4 (índice 3)
  linhaCabecalhos: 5,    // Linha 6 (índice 5)
  linhaInicio: 6,        // Linha 7 (índice 6)
  colunaPreco: 0,        // Coluna A
  colunaCodigo: 3,       // Coluna D
  colunaCategoria: 4,    // Coluna E
  colunaNome: 6,         // Coluna G
  colunasPorData: 3,     // ESTOQUE FECHADO, ESTOQUE FLUTUANTE, PEDIDO (colunas a cada 3)
}

interface ContagemData {
  bar_id: number
  data_contagem: string
  insumo_codigo: string
  insumo_nome: string
  categoria: string
  tipo_local: string
  custo_unitario: number
  estoque_inicial: number | null
  estoque_final: number
  quantidade_pedido: number
  usuario_contagem: string
  observacoes: string
}

/**
 * Mapeia categoria do sheet para tipo_local (cozinha, bar, drinks)
 */
function categoriaTipoLocal(categoria: string): string {
  const cat = (categoria || '').toLowerCase().trim()
  
  // DRINKS - Destilados, licores, insumos de drinks
  if (cat.includes('destilado') || cat.includes('licor') || 
      cat.includes('não-alcóolico') || cat.includes('nao-alcoolico') || cat.includes('não-alcoolico') ||
      cat.includes('polpa') || cat.includes('monin') || cat.includes('1883') ||
      cat.includes('xarope') || cat.includes('purê') || cat.includes('pure')) {
    return 'drinks'
  }
  
  // BAR - Cervejas, vinhos, espumantes, etc.
  if (cat.includes('artesanal') || cat.includes('long neck') || 
      cat.includes('lata') || cat.includes('retornáv') || cat.includes('retornav') ||
      cat.includes('vinhos') || cat.includes('vinho') || cat.includes('espumante') ||
      cat.includes('cerveja') || cat.includes('chopp') || cat.includes('beats') ||
      cat.includes('tabacaria') || cat.includes('chicle')) {
    return 'bar'
  }
  
  // Cozinha (padrão)
  return 'cozinha'
}

/**
 * Identifica se a categoria faz parte do CMV de cozinha
 */
function isCmvCozinha(categoria: string): boolean {
  const cat = (categoria || '').toLowerCase().trim()
  return cat.includes('(c)') || cat.includes('cozinha') || cat.includes('produção') || 
         cat.includes('producao') || cat.includes('pães') || cat.includes('paes') || 
         cat.includes('peixe') || cat.includes('proteína') || cat.includes('proteina') ||
         cat.includes('mercado') || cat.includes('hortifruti') || cat.includes('armazém') ||
         cat.includes('armazem')
}

/**
 * Identifica se a categoria faz parte do CMV de bebidas
 */
function isCmvBebidas(categoria: string): boolean {
  const cat = (categoria || '').toLowerCase().trim()
  return cat.includes('destilados') || cat.includes('long neck') || cat.includes('lata') ||
         cat.includes('retornáv') || cat.includes('retornav') || cat.includes('vinhos') ||
         cat.includes('espumante') || cat.includes('não-alcóolic') || cat.includes('nao-alcoolic') ||
         cat.includes('artesanal') || cat.includes('império') || cat.includes('imperio')
}

/**
 * Identifica se a categoria faz parte do CMV de drinks
 */
function isCmvDrinks(categoria: string): boolean {
  const cat = (categoria || '').toLowerCase().trim()
  return cat.includes('polpa') || cat.includes('fruta') || (cat.includes('(f)') && !cat.includes('proteína'))
}

serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  let heartbeatId: number | null = null
  let startTime: number = Date.now()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const url = new URL(req.url)
    const dataParam = url.searchParams.get('data') || new Date().toISOString().split('T')[0]
    const barIdParam = url.searchParams.get('bar_id')
    const diasAtras = parseInt(url.searchParams.get('dias_atras') || '0')
    
    console.log(`📦 sync-contagem-sheets iniciado`)
    console.log(`📅 Data base: ${dataParam}, dias atrás: ${diasAtras}`)

    const hbResult = await heartbeatStart(supabase, 'sync-contagem-sheets', barIdParam ? parseInt(barIdParam) : null, null, 'pgcron')
    heartbeatId = hbResult.heartbeatId
    startTime = hbResult.startTime

    // Calcular datas para processar
    const datasProcessar: string[] = []
    const baseDate = new Date(dataParam + 'T12:00:00Z')
    for (let i = 0; i <= diasAtras; i++) {
      const d = new Date(baseDate)
      d.setDate(d.getDate() - i)
      datasProcessar.push(d.toISOString().split('T')[0])
    }
    
    console.log(`📊 Datas para processar: ${datasProcessar.join(', ')}`)

    // Buscar bares com configuração de planilha
    let query = supabase
      .from('api_credentials')
      .select('bar_id, configuracoes')
      .eq('sistema', 'google_sheets')
    
    if (barIdParam) {
      query = query.eq('bar_id', parseInt(barIdParam))
    }
    
    const { data: credenciais, error: credError } = await query
    
    if (credError) throw new Error(`Erro ao buscar credenciais: ${credError.message}`)
    if (!credenciais || credenciais.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhuma configuração de Google Sheets encontrada'
      }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    console.log(`📋 ${credenciais.length} configurações encontradas`)

    // Obter access token do Google
    const accessToken = await getGoogleAccessToken()
    console.log('✅ Access token obtido')

    const resultados: any[] = []

    // Processar cada bar
    for (const cred of credenciais) {
      const barId = cred.bar_id
      const config = cred.configuracoes as any
      const spreadsheetId = config?.spreadsheet_id
      const abaInsumos = config?.aba_insumos || 'INSUMOS'

      if (!spreadsheetId) {
        console.warn(`⚠️ Bar ${barId}: spreadsheet_id não configurado`)
        continue
      }

      console.log(`\n📊 Processando Bar ${barId} - Planilha: ${spreadsheetId}`)

      try {
        // Baixar planilha como Excel
        const excelBuffer = await downloadDriveFileAsExcel(spreadsheetId, accessToken)
        console.log(`📥 Planilha baixada: ${(excelBuffer.byteLength / 1024).toFixed(1)} KB`)

        // Ler Excel
        const workbook = XLSX.read(new Uint8Array(excelBuffer), { type: 'array' })
        
        // Encontrar aba INSUMOS
        const sheetNames = workbook.SheetNames.map(n => n.toLowerCase())
        const abaIndex = sheetNames.indexOf(abaInsumos.toLowerCase())
        
        if (abaIndex === -1) {
          console.warn(`⚠️ Bar ${barId}: Aba '${abaInsumos}' não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`)
          continue
        }

        const sheet = workbook.Sheets[workbook.SheetNames[abaIndex]]
        const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

        console.log(`📄 Aba ${abaInsumos}: ${jsonData.length} linhas`)

        if (jsonData.length < 7) {
          console.warn(`⚠️ Bar ${barId}: Planilha com poucas linhas`)
          continue
        }

        // BLOCO 3A: Lê layout_contagem do banco, fallback para hardcoded
        const layoutFromDb = config?.layout_contagem as LayoutContagemType | undefined
        const barConfig: LayoutContagemType = layoutFromDb || FALLBACK_LAYOUT_CONTAGEM
        
        if (layoutFromDb) {
          console.log(`📋 [LAYOUT] Bar ${barId}: usando configuração do banco`)
        } else {
          console.log(`⚠️ [LAYOUT] Bar ${barId}: usando fallback hardcoded`)
        }
        
        // ========== VALIDAÇÃO ESTRUTURAL ==========
        const baseline = await getSyncBaseline(supabase, 'contagem', barId, abaInsumos)
        
        // Se baseline estiver ativo, validar estrutura
        if (baseline && baseline.is_active) {
          const validationResult = validateSheetStructure(jsonData, baseline, {
            headerRowIndex: barConfig.linhaCabecalhos,
            allowEmptyBaseline: true
          })
          
          logValidationResult('contagem', barId, validationResult)
          
          if (!validationResult.valid) {
            const errorMsg = validationResult.errors.map(e => e.message).join('; ')
            resultados.push({
              bar_id: barId,
              error: `VALIDATION_FAILED: ${errorMsg}`,
              validation_details: validationResult
            })
            continue
          }
        } else {
          console.log(`  ⚠️ Validação desabilitada para Bar ${barId} - processando sem validação`)
        }
        // ========== FIM VALIDAÇÃO ==========
        
        // Log da configuração de layout
        console.log(`  ⚙️ Layout Bar ${barId}: datas linha ${barConfig.linhasDatas}, dados linha ${barConfig.linhaInicio}, ${barConfig.colunasPorData} cols/data`)

        // ========================================
        // ETAPA 1: CADASTRAR/ATUALIZAR INSUMOS DO BAR
        // ========================================
        console.log(`  📦 Etapa 1: Cadastrando/atualizando insumos do Bar ${barId}...`)
        
        const insumosDoBar: { codigo: string, nome: string, categoria: string, tipo_local: string, preco: number }[] = []
        
        // Mapa para detectar códigos duplicados - conta quantas vezes cada código apareceu
        const codigosContador = new Map<string, number>() // codigo -> contador
        
        for (let row = barConfig.linhaInicio; row < jsonData.length; row++) {
          const linha = jsonData[row]
          if (!linha || linha.length < barConfig.colunaNome + 1) continue

          const codigoRaw = String(linha[barConfig.colunaCodigo] || '').trim()
          const nome = String(linha[barConfig.colunaNome] || '').trim()
          const categoria = String(linha[barConfig.colunaCategoria] || '').trim()
          
          if (!nome) continue

          // Gerar código base
          let codigoBase = codigoRaw && codigoRaw !== '-' 
            ? codigoRaw 
            : gerarCodigoAuto(nome)
          
          // Verificar se já vimos este código - se sim, criar código único com sufixo
          let codigo = codigoBase
          const contador = codigosContador.get(codigoBase) || 0
          
          if (contador > 0) {
            // Código já existe - criar versão única com sufixo numérico ou do nome
            const sufixo = normalizarTexto(nome).substring(0, 10)
            codigo = `${codigoBase}_${sufixo}_${contador}`
            console.log(`  ⚠️ Código duplicado #${contador + 1}: ${codigoBase} - criando ${codigo} para "${nome}"`)
          }
          
          codigosContador.set(codigoBase, contador + 1)

          // Parse do preço
          let precoRaw = linha[barConfig.colunaPreco]
          let preco = 0
          
          if (typeof precoRaw === 'number') {
            preco = precoRaw
          } else if (typeof precoRaw === 'string') {
            const precoStr = String(precoRaw).replace('R$', '').trim()
            if (/,\d{2}$/.test(precoStr)) {
              preco = parseFloat(precoStr.replace(/\./g, '').replace(',', '.')) || 0
            } else if (precoStr.includes(',')) {
              preco = parseFloat(precoStr.replace(',', '.')) || 0
            } else {
              preco = parseFloat(precoStr) || 0
            }
          }

          const tipoLocal = categoriaTipoLocal(categoria)
          
          insumosDoBar.push({ codigo, nome, categoria, tipo_local: tipoLocal, preco })
        }

        console.log(`  📋 ${insumosDoBar.length} insumos encontrados na planilha`)

        // OTIMIZADO: Upsert em batch usando ON CONFLICT
        let insumosAtualizados = 0
        let insumosCriados = 0
        
        // Preparar dados para upsert em batch
        const insumosParaUpsert = insumosDoBar.map(insumo => ({
          bar_id: barId,
          codigo: insumo.codigo,
          nome: insumo.nome,
          categoria: insumo.categoria,
          tipo_local: insumo.tipo_local,
          custo_unitario: insumo.preco,
          ativo: true,
          updated_at: new Date().toISOString()
        }))

        // Upsert em batches de 100
        const batchSize = 100
        for (let i = 0; i < insumosParaUpsert.length; i += batchSize) {
          const batch = insumosParaUpsert.slice(i, i + batchSize)
          const { data: upserted, error: upsertErr } = await supabase
            .from('insumos')
            .upsert(batch, { 
              onConflict: 'bar_id,codigo',
              ignoreDuplicates: false 
            })
            .select('id')

          if (upsertErr) {
            console.error(`  ❌ Erro upsert insumos batch ${i}: ${upsertErr.message}`)
          } else {
            insumosAtualizados += batch.length
          }
        }
        
        console.log(`  ✅ ${insumosAtualizados} insumos upserted`)

        insumosCriados = insumosAtualizados // Para manter compatibilidade

        // Criar mapa de insumos do bar para usar nas contagens
        const { data: insumosCadastrados } = await supabase
          .from('insumos')
          .select('id, codigo, nome, custo_unitario')
          .eq('bar_id', barId)
          .eq('ativo', true)
        
        const mapaInsumos = new Map<string, any>()
        insumosCadastrados?.forEach((i: any) => {
          mapaInsumos.set(i.codigo, i)
        })

        // ========================================
        // ETAPA 2: PROCESSAR CONTAGENS DE ESTOQUE
        // ========================================
        console.log(`  📊 Etapa 2: Processando contagens de estoque...`)

        // Linha de datas conforme configuração do bar
        const linhaDatas = jsonData[barConfig.linhasDatas] || []
        
        // Mapear colunas por data
        const colunasPorData = new Map<string, number>()
        for (let col = 0; col < linhaDatas.length; col++) {
          const valor = linhaDatas[col]
          if (valor) {
            const dataStr = String(valor).trim()
            let dataFormatada: string | null = null
            
            if (dataStr.includes('/')) {
              dataFormatada = parseDataBR(dataStr)
            } else if (!isNaN(Number(valor)) && Number(valor) > 40000 && Number(valor) < 50000) {
              const excelDate = XLSX.SSF.parse_date_code(Number(valor))
              if (excelDate) {
                const d = excelDate.d.toString().padStart(2, '0')
                const m = excelDate.m.toString().padStart(2, '0')
                const y = excelDate.y
                dataFormatada = `${y}-${m}-${d}`
              }
            }
            
            if (dataFormatada && datasProcessar.includes(dataFormatada)) {
              colunasPorData.set(dataFormatada, col)
              console.log(`  📅 Data ${dataFormatada} encontrada na coluna ${col}`)
            }
          }
        }

        if (colunasPorData.size === 0) {
          console.warn(`⚠️ Bar ${barId}: Nenhuma data encontrada para processar nas datas: ${datasProcessar.join(', ')}`)
          resultados.push({
            bar_id: barId,
            insumos_criados: insumosCriados,
            insumos_atualizados: insumosAtualizados,
            contagens: 0,
            mensagem: 'Nenhuma data encontrada para contagem'
          })
          continue
        }

        // Processar cada insumo conforme configuração do bar
        const contagensParaInserir: ContagemData[] = []
        
        // Contador de códigos para contagens (mesma lógica de duplicatas)
        const codigosContadorContagem = new Map<string, number>()

        for (let row = barConfig.linhaInicio; row < jsonData.length; row++) {
          const linha = jsonData[row]
          if (!linha || linha.length < barConfig.colunaNome + 1) continue

          const codigoRaw = String(linha[barConfig.colunaCodigo] || '').trim()
          const nome = String(linha[barConfig.colunaNome] || '').trim()
          const categoria = String(linha[barConfig.colunaCategoria] || '').trim()

          if (!nome) continue

          // Gerar código base
          let codigoBase = codigoRaw && codigoRaw !== '-' 
            ? codigoRaw 
            : gerarCodigoAuto(nome)
          
          // Verificar se já vimos este código - se sim, criar código único
          let codigo = codigoBase
          const contador = codigosContadorContagem.get(codigoBase) || 0
          
          if (contador > 0) {
            const sufixo = normalizarTexto(nome).substring(0, 10)
            codigo = `${codigoBase}_${sufixo}_${contador}`
          }
          
          codigosContadorContagem.set(codigoBase, contador + 1)

          const tipoLocal = categoriaTipoLocal(categoria)
          
          // Buscar preço do cadastro de insumos (já atualizado na Etapa 1)
          const insumoSistema = mapaInsumos.get(codigo)
          const custoUnitario = insumoSistema?.custo_unitario || 0

          // Para cada data encontrada
          for (const [dataStr, colIndex] of colunasPorData.entries()) {
            const estoqueFechado = parseFloat(String(linha[colIndex] || '0').replace(',', '.')) || 0
            const estoqueFlutuante = parseFloat(String(linha[colIndex + 1] || '0').replace(',', '.')) || 0
            const pedido = barConfig.colunasPorData >= 3 
              ? parseFloat(String(linha[colIndex + 2] || '0').replace(',', '.')) || 0 
              : 0

            // Só inserir se tiver algum dado
            if (estoqueFechado > 0 || estoqueFlutuante > 0 || pedido > 0) {
              contagensParaInserir.push({
                bar_id: barId,
                data_contagem: dataStr,
                insumo_codigo: codigo,
                insumo_nome: nome,
                categoria: categoria,
                tipo_local: tipoLocal,
                custo_unitario: custoUnitario,
                estoque_inicial: null,
                estoque_final: estoqueFechado,
                quantidade_pedido: pedido,
                usuario_contagem: 'Sync Automático',
                observacoes: `Sync ${new Date().toISOString().split('T')[0]}`
              })
            }
          }
        }

        console.log(`📊 Bar ${barId}: ${contagensParaInserir.length} registros para processar`)

        // ========================================
        // ETAPA 3: INSERIR/ATUALIZAR OTIMIZADO (BATCH)
        // ========================================
        if (contagensParaInserir.length > 0) {
          let novos = 0
          let atualizados = 0
          let errors = 0

          // Preparar payloads para upsert
          const payloads = contagensParaInserir.map(contagem => ({
            bar_id: contagem.bar_id,
            data_contagem: contagem.data_contagem,
            insumo_codigo: contagem.insumo_codigo,
            insumo_nome: contagem.insumo_nome,
            categoria: contagem.categoria,
            tipo_local: contagem.tipo_local,
            custo_unitario: contagem.custo_unitario,
            estoque_final: contagem.estoque_final,
            quantidade_pedido: contagem.quantidade_pedido,
            usuario_contagem: contagem.usuario_contagem,
            observacoes: contagem.observacoes,
            updated_at: new Date().toISOString()
          }))

          // Upsert em batches de 100
          const batchSize = 100
          for (let i = 0; i < payloads.length; i += batchSize) {
            const batch = payloads.slice(i, i + batchSize)
            const { error: upsertErr } = await supabase
              .from('contagem_estoque_insumos')
              .upsert(batch, {
                onConflict: 'bar_id,data_contagem,insumo_codigo',
                ignoreDuplicates: false
              })
            
            if (upsertErr) {
              console.error(`❌ Erro upsert contagens batch ${i}: ${upsertErr.message}`)
              errors += batch.length
            } else {
              novos += batch.length
            }
          }

          console.log(`✅ Bar ${barId}: ${novos} upserted, ${errors} erros`)
          
          // Atualizar baseline após sync bem-sucedido
          const headerRow = jsonData[barConfig.linhaCabecalhos] || []
          await updateSyncBaseline(supabase, 'contagem', barId, abaInsumos, {
            row_count: jsonData.length - barConfig.linhaInicio,
            column_count: headerRow.length,
            headers: headerRow.slice(0, 10).map((h: any) => String(h || ''))
          })

          // Gravar histórico simplificado (uma entrada por data)
          const datasProcessadas = Array.from(colunasPorData.keys())
          for (const dataStr of datasProcessadas) {
            const qtdData = contagensParaInserir.filter(c => c.data_contagem === dataStr).length
            await supabase
              .from('sync_contagem_historico')
              .insert({
                bar_id: barId,
                data_contagem: dataStr,
                insumos_novos: insumosCriados,
                insumos_atualizados: insumosAtualizados,
                contagens_novas: qtdData,
                contagens_atualizadas: 0,
                contagens_sem_alteracao: 0,
                mudancas: null,
                origem: 'api',
                observacoes: `Sync batch executado em ${new Date().toISOString()}`
              })
          }

          // Propagar estoque inicial (estoque final do dia anterior)
          await propagarEstoqueInicial(supabase, barId, datasProcessar)

          resultados.push({
            bar_id: barId,
            datas: datasProcessar,
            insumos_criados: insumosCriados,
            insumos_atualizados: insumosAtualizados,
            contagens_novas: novos,
            contagens_atualizadas: atualizados,
            contagens_sem_alteracao: 0,
            total_mudancas: novos,
            erros: errors
          })
        }

      } catch (barError: any) {
        console.error(`❌ Erro ao processar Bar ${barId}:`, barError)
        
        const errorType = isValidationError(barError) ? 'VALIDATION_FAILED' : 'SYNC_ERROR'
        
        resultados.push({
          bar_id: barId,
          error: barError instanceof Error ? barError.message : 'Erro desconhecido',
          error_type: errorType,
          validation_details: barError?.validation || null
        })
      }
    }

    // Após sincronizar contagens, calcular estoques semanais para CMV
    console.log('\n📊 Calculando estoques semanais para CMV...')
    await calcularEstoquesSemanaais(supabase, datasProcessar)

    const totalRegistros = resultados.reduce((acc: number, r: any) => acc + (r.contagens_novas || 0), 0)
    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, totalRegistros, { datas_processadas: datasProcessar.length, bares: resultados.length })

    return new Response(JSON.stringify({
      success: true,
      message: 'Sincronização de contagem concluída',
      datas_processadas: datasProcessar,
      resultados,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro geral:', error)
    await heartbeatError(supabase, heartbeatId, startTime, error instanceof Error ? error : String(error))
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  }
})

/**
 * Propaga estoque inicial baseado no estoque final do dia anterior
 */
async function propagarEstoqueInicial(
  supabase: any,
  barId: number,
  datas: string[]
): Promise<void> {
  console.log(`  🔄 Propagando estoque inicial para Bar ${barId}...`)
  
  // Ordenar datas
  const datasOrdenadas = [...datas].sort()
  
  for (const data of datasOrdenadas) {
    // Calcular dia anterior
    const dateObj = new Date(data + 'T12:00:00Z')
    dateObj.setDate(dateObj.getDate() - 1)
    const dataAnterior = dateObj.toISOString().split('T')[0]

    // Buscar estoque final do dia anterior por insumo
    const { data: estoqueAnterior } = await supabase
      .from('contagem_estoque_insumos')
      .select('insumo_codigo, estoque_final')
      .eq('bar_id', barId)
      .eq('data_contagem', dataAnterior)

    if (estoqueAnterior && estoqueAnterior.length > 0) {
      const mapaEstoque = new Map<string, number>()
      estoqueAnterior.forEach((e: any) => {
        mapaEstoque.set(e.insumo_codigo, e.estoque_final)
      })

      // Atualizar estoque inicial do dia atual
      for (const [codigo, estoqueIni] of mapaEstoque.entries()) {
        await supabase
          .from('contagem_estoque_insumos')
          .update({ estoque_inicial: estoqueIni })
          .eq('bar_id', barId)
          .eq('data_contagem', data)
          .eq('insumo_codigo', codigo)
      }
    }
  }
}

/**
 * Calcula estoques semanais agregados por categoria para tabela cmv_semanal
 */
async function calcularEstoquesSemanaais(
  supabase: any,
  datas: string[]
): Promise<void> {
  // Identificar semanas afetadas
  const semanasSet = new Set<string>()
  for (const data of datas) {
    const d = new Date(data + 'T12:00:00Z')
    const dayOfWeek = d.getDay() || 7 // DOM=7
    const monday = new Date(d)
    monday.setDate(d.getDate() - dayOfWeek + 1)
    semanasSet.add(monday.toISOString().split('T')[0])
  }
  
  const semanas = Array.from(semanasSet)
  console.log(`  📆 Semanas para atualizar: ${semanas.join(', ')}`)

  // Buscar bares ativos do banco
  const { data: baresAtivos } = await supabase
    .from('bares')
    .select('id')
    .eq('ativo', true)
    .order('id')
  
  const barIds = baresAtivos?.map((b: { id: number }) => b.id) || [3, 4]

  for (const semanaInicio of semanas) {
    const semanaFim = new Date(semanaInicio + 'T12:00:00Z')
    semanaFim.setDate(semanaFim.getDate() + 6)
    const semanaFimStr = semanaFim.toISOString().split('T')[0]

    // Para cada bar
    for (const barId of barIds) {
      // Buscar primeiro dia da semana com dados
      const { data: primeiroDia } = await supabase
        .from('contagem_estoque_insumos')
        .select('data_contagem, insumo_codigo, categoria, estoque_final, custo_unitario')
        .eq('bar_id', barId)
        .gte('data_contagem', semanaInicio)
        .lte('data_contagem', semanaFimStr)
        .order('data_contagem', { ascending: true })
        .limit(1000)

      // Buscar último dia da semana com dados
      const { data: ultimoDia } = await supabase
        .from('contagem_estoque_insumos')
        .select('data_contagem, insumo_codigo, categoria, estoque_final, custo_unitario')
        .eq('bar_id', barId)
        .gte('data_contagem', semanaInicio)
        .lte('data_contagem', semanaFimStr)
        .order('data_contagem', { ascending: false })
        .limit(1000)

      if (!primeiroDia?.length || !ultimoDia?.length) continue

      // Calcular apenas estoque final (último dia com dados da semana)
      let estoqueFinalCozinha = 0
      let estoqueFinalBebidas = 0
      let estoqueFinalDrinks = 0

      const dataUltimo = ultimoDia[0].data_contagem
      const dadosUltimoDia = ultimoDia.filter((d: any) => d.data_contagem === dataUltimo)
      
      for (const item of dadosUltimoDia) {
        const valor = (item.estoque_final || 0) * (item.custo_unitario || 0)
        if (isCmvCozinha(item.categoria)) estoqueFinalCozinha += valor
        if (isCmvBebidas(item.categoria)) estoqueFinalBebidas += valor
        if (isCmvDrinks(item.categoria)) estoqueFinalDrinks += valor
      }

      const estoqueFinal = estoqueFinalCozinha + estoqueFinalBebidas + estoqueFinalDrinks

      // Atualizar cmv_semanal (se existir) - APENAS estoque final
      const { data: cmvExistente } = await supabase
        .from('cmv_semanal')
        .select('id')
        .eq('bar_id', barId)
        .eq('semana', semanaInicio)
        .single()

      if (cmvExistente) {
        const updateData: any = {
          estoque_final: estoqueFinal,
          estoque_final_cozinha: estoqueFinalCozinha,
          estoque_final_bebidas: estoqueFinalBebidas,
          estoque_final_drinks: estoqueFinalDrinks,
          updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('cmv_semanal')
          .update(updateData)
          .eq('id', cmvExistente.id)

        if (updateError) {
          console.error(`❌ Erro ao atualizar cmv_semanal: ${updateError.message}`)
        } else {
          console.log(`  ✅ CMV Semanal atualizado: Bar ${barId}, Semana ${semanaInicio}`)
          console.log(`     Estoque Final: R$ ${estoqueFinal.toFixed(2)} (Coz: ${estoqueFinalCozinha.toFixed(2)}, Beb: ${estoqueFinalBebidas.toFixed(2)}, Dri: ${estoqueFinalDrinks.toFixed(2)})`)
          
          // REGRA CONTÁBIL: Propagar estoque final como inicial da próxima semana
          const proximaSemanaInicio = new Date(semanaInicio + 'T12:00:00Z')
          proximaSemanaInicio.setDate(proximaSemanaInicio.getDate() + 7)
          const proximaSemanaStr = proximaSemanaInicio.toISOString().split('T')[0]
          
          const { data: proximaSemana } = await supabase
            .from('cmv_semanal')
            .select('id, estoque_final_funcionarios')
            .eq('bar_id', barId)
            .eq('semana', proximaSemanaStr)
            .single()
          
          if (proximaSemana) {
            // Buscar estoque final de funcionários da semana atual para propagar
            const { data: semanaAtualCMA } = await supabase
              .from('cmv_semanal')
              .select('estoque_final_funcionarios')
              .eq('bar_id', barId)
              .eq('semana', semanaInicio)
              .single()
            
            await supabase
              .from('cmv_semanal')
              .update({
                estoque_inicial: estoqueFinal,
                estoque_inicial_cozinha: estoqueFinalCozinha,
                estoque_inicial_bebidas: estoqueFinalBebidas,
                estoque_inicial_drinks: estoqueFinalDrinks,
                estoque_inicial_funcionarios: semanaAtualCMA?.estoque_final_funcionarios || 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', proximaSemana.id)
            
            console.log(`  🔄 Propagado para próxima semana: ${proximaSemanaStr}`)
          }
        }
      } else {
        console.log(`  ⚠️ CMV Semanal não existe: Bar ${barId}, Semana ${semanaInicio} - será criado pelo cmv-semanal-auto`)
      }
    }
  }
}
