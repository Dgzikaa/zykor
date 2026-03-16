/**
 * 📊 SYNC CMV SHEETS
 * 
 * Edge Function para sincronizar dados do CMV Semanal da planilha Google Sheets.
 * 
 * A planilha tem formato HORIZONTAL:
 * - Cada COLUNA é uma semana (Semana 51, 52, 01, 02, ...)
 * - Cada LINHA é uma métrica (Estoque Inicial, Compras, Estoque Final, etc.)
 * 
 * Dados sincronizados (NÃO vêm do NIBO):
 * - Estoque Inicial/Final (total e por categoria)
 * - Consumos (Sócios, Benefícios, RH, Artista)
 * - CMV Teórico (%)
 * - Bonificações
 * - Seção Alimentação (CMA)
 * 
 * Dados NÃO sincronizados (vêm de outras fontes):
 * - Compras (vêm do NIBO via cmv-semanal-auto)
 * - Faturamento (vem de desempenho_semanal)
 * 
 * @version 1.0.0
 * @date 2026-03-12
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { read, utils } from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'
import { getGoogleAccessToken, downloadDriveFileAsExcel } from '../_shared/google-auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  bar_id?: number
  ano?: number
  semana?: number
  todas_semanas?: boolean
}

interface BarConfig {
  bar_id: number
  nome: string
  cmv_spreadsheet_id: string | null
}

interface SemanaData {
  semana: number
  periodo?: string
  // Estoques totais
  estoque_inicial?: number
  estoque_final?: number
  // Estoques por categoria
  estoque_inicial_cozinha?: number
  estoque_inicial_bebidas?: number
  estoque_inicial_drinks?: number
  estoque_final_cozinha?: number
  estoque_final_bebidas?: number
  estoque_final_drinks?: number
  // Consumos
  total_consumo_socios?: number
  mesa_beneficios_cliente?: number
  consumo_rh?: number
  mesa_banda_dj?: number
  // Ajustes
  ajuste_bonificacoes?: number
  outros_ajustes?: number
  bonificacao_contrato_anual?: number
  // Percentuais
  cmv_teorico_percentual?: number
  // CMA - Alimentação
  estoque_inicial_funcionarios?: number
  estoque_final_funcionarios?: number
}

// Função auxiliar para parsear valores monetários da planilha
function parseMonetario(val: any): number {
  if (val === null || val === undefined || val === '' || val === '-') return 0
  
  const str = String(val).trim()
  
  // Remover "R$" e espaços
  let cleaned = str.replace(/R\$\s*/gi, '').replace(/\s/g, '')
  
  // Tratar formato brasileiro (1.234,56) vs americano (1,234.56)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Se tem ambos, verificar qual é separador de milhares
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    
    if (lastComma > lastDot) {
      // Formato BR: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // Formato US: 1,234.56
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    // Apenas vírgula - formato BR
    cleaned = cleaned.replace(',', '.')
  }
  
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// Função auxiliar para parsear percentuais
function parsePercentual(val: any): number {
  if (val === null || val === undefined || val === '' || val === '-') return 0
  
  const str = String(val).trim().replace('%', '').replace(',', '.')
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

// Extrair número da semana do header (ex: "Semana 51" -> 51)
function extrairNumeroSemana(header: string): number | null {
  if (!header) return null
  const match = String(header).match(/semana\s*(\d+)/i)
  return match ? parseInt(match[1]) : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: SyncRequest = await req.json().catch(() => ({}))
    const { bar_id, ano, semana, todas_semanas = true } = body

    const anoAtual = ano || new Date().getFullYear()
    
    console.log('📊 Sync CMV Sheets - Iniciando', { bar_id, ano: anoAtual, semana, todas_semanas })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // 1. Buscar configurações dos bares
    const baresQuery = supabase
      .from('api_credentials')
      .select('bar_id, configuracoes')
      .eq('sistema', 'google_sheets')
      .eq('ativo', true)

    if (bar_id) {
      baresQuery.eq('bar_id', bar_id)
    }

    const { data: credenciais, error: errCred } = await baresQuery

    if (errCred) {
      throw new Error(`Erro ao buscar credenciais: ${errCred.message}`)
    }

    // Buscar nomes dos bares
    const { data: bares } = await supabase
      .from('bares')
      .select('id, nome')
      .in('id', credenciais?.map(c => c.bar_id) || [])

    const baresMap = new Map(bares?.map(b => [b.id, b.nome]) || [])

    // Filtrar bares que têm cmv_spreadsheet_id
    const baresConfig: BarConfig[] = credenciais
      ?.map(c => ({
        bar_id: c.bar_id,
        nome: baresMap.get(c.bar_id) || `Bar ${c.bar_id}`,
        cmv_spreadsheet_id: (c.configuracoes as any)?.cmv_spreadsheet_id || null
      }))
      .filter(b => b.cmv_spreadsheet_id) || []

    if (baresConfig.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nenhum bar com cmv_spreadsheet_id configurado',
          message: 'Configure cmv_spreadsheet_id em api_credentials.configuracoes'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🏪 Processando ${baresConfig.length} bar(es)`)

    // 2. Obter access token do Google
    const accessToken = await getGoogleAccessToken()

    const resultadosPorBar: any[] = []

    for (const barConfig of baresConfig) {
      console.log(`\n🍺 Processando: ${barConfig.nome} (bar_id=${barConfig.bar_id})`)
      console.log(`📋 Planilha: ${barConfig.cmv_spreadsheet_id}`)

      try {
        // 3. Baixar planilha
        const arrayBuffer = await downloadDriveFileAsExcel(barConfig.cmv_spreadsheet_id!, accessToken)
        console.log(`✅ Planilha baixada (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB)`)

        const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' })
        
        // 4. Encontrar aba CMV Semanal
        const abasCMV = workbook.SheetNames.filter((name: string) => 
          name.toLowerCase().includes('cmv') && name.toLowerCase().includes('semanal')
        )
        
        let targetSheetName = abasCMV[0]
        if (!targetSheetName) {
          // Tentar outras variações
          targetSheetName = workbook.SheetNames.find((name: string) => 
            name.toLowerCase().includes('cmv') || 
            name.toLowerCase().includes('semanal')
          )
        }
        
        if (!targetSheetName) {
          console.warn(`⚠️ Aba CMV não encontrada em ${barConfig.nome}. Abas disponíveis: ${workbook.SheetNames.join(', ')}`)
          resultadosPorBar.push({
            bar_id: barConfig.bar_id,
            bar_nome: barConfig.nome,
            success: false,
            error: `Aba CMV não encontrada. Abas: ${workbook.SheetNames.join(', ')}`
          })
          continue
        }

        console.log(`📑 Usando aba: "${targetSheetName}"`)
        
        const sheet = workbook.Sheets[targetSheetName]
        const jsonData = utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as any[][]

        // 5. Identificar estrutura da planilha (horizontal)
        // Linha 0 ou 1: Headers com nomes das semanas
        // Coluna 0: Nomes das métricas
        
        // Encontrar linha de headers (primeira linha que tem "Semana" em alguma célula)
        let headerRowIndex = -1
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
          const row = jsonData[i]
          if (row.some((cell: any) => String(cell).toLowerCase().includes('semana'))) {
            headerRowIndex = i
            break
          }
        }

        if (headerRowIndex === -1) {
          console.warn(`⚠️ Header de semanas não encontrado em ${barConfig.nome}`)
          resultadosPorBar.push({
            bar_id: barConfig.bar_id,
            bar_nome: barConfig.nome,
            success: false,
            error: 'Header de semanas não encontrado na planilha'
          })
          continue
        }

        const headers = jsonData[headerRowIndex]
        console.log(`📅 Headers encontrados na linha ${headerRowIndex + 1}`)

        // Mapear colunas para semanas
        const colunaParaSemana: Map<number, number> = new Map()
        for (let col = 1; col < headers.length; col++) {
          const numSemana = extrairNumeroSemana(headers[col])
          if (numSemana !== null) {
            colunaParaSemana.set(col, numSemana)
          }
        }

        console.log(`📊 ${colunaParaSemana.size} semanas identificadas`)

        // 6. Mapear linhas para métricas
        // Estrutura da planilha CMV Semanal (baseado nas planilhas Ordinário e Deboche):
        // Linhas 4-21: Métricas principais (Estoque Inicial/Final total, Consumos, CMV Teórico, etc.)
        // Linhas 23-27: Seção ESTOQUE INICIAL detalhado (Cozinha, Bebidas, Drinks, TOTAL)
        // Linhas 29-33: Seção ESTOQUE FINAL detalhado (Cozinha, Bebidas, Drinks, TOTAL)
        // Linhas 54+: CONTAS ESPECIAIS (valores absolutos das mesas)
        // Linhas 65+: Saída Alimentação (Estoque Inicial/Final funcionários)
        
        const metricasPorLinha: Map<string, number> = new Map()
        
        // Estado para rastrear seções
        let currentSection = 'main' // main, estoque_inicial_det, estoque_final_det, compras, contas_especiais, alimentacao
        
        for (let row = headerRowIndex + 1; row < jsonData.length; row++) {
          const rawLabel = String(jsonData[row][0] || '')
          const label = rawLabel.toLowerCase().trim()
          
          // Skip linhas vazias ou só com números (anos)
          if (!label || /^\d{4}$/.test(label)) continue
          
          // Detectar mudança de seção
          if (label === 'estoque inicial' && currentSection === 'main') {
            // Primeira ocorrência na seção principal = estoque total
            metricasPorLinha.set('estoque_inicial', row)
            continue
          }
          
          if (label === 'estoque final' && currentSection === 'main') {
            metricasPorLinha.set('estoque_final', row)
            continue
          }
          
          // Seções detalhadas (título em maiúsculas ou específico)
          if (rawLabel.toUpperCase() === 'ESTOQUE INICIAL' || label === 'estoque inicial' && !metricasPorLinha.has('estoque_inicial_cozinha')) {
            currentSection = 'estoque_inicial_det'
            continue
          }
          
          if (rawLabel.toUpperCase() === 'ESTOQUE FINAL' || label === 'estoque final' && metricasPorLinha.has('estoque_inicial_drinks')) {
            currentSection = 'estoque_final_det'
            continue
          }
          
          if (rawLabel.toUpperCase() === 'COMPRAS' || label === 'compras') {
            currentSection = 'compras'
            continue
          }
          
          if (label.includes('contas especiais')) {
            currentSection = 'contas_especiais'
            continue
          }
          
          if (label.includes('saída alimentação') || (label.includes('alimentação') && currentSection !== 'main')) {
            currentSection = 'alimentacao'
            continue
          }
          
          // Mapear métricas por seção
          switch (currentSection) {
            case 'main':
              // Consumos (valores já calculados com %)
              if (label.includes('consumo') && label.includes('sócio')) {
                metricasPorLinha.set('consumo_socios_pct', row)
              } else if (label.includes('consumo') && label.includes('benefício')) {
                metricasPorLinha.set('consumo_beneficios_pct', row)
              } else if (label.includes('consumo') && label.includes('rh') && label.includes('operação')) {
                metricasPorLinha.set('consumo_rh_operacao_pct', row)
              } else if (label.includes('consumo') && label.includes('rh') && label.includes('escritório')) {
                metricasPorLinha.set('consumo_rh_escritorio_pct', row)
              } else if (label.includes('consumo') && label.includes('artista')) {
                metricasPorLinha.set('consumo_artista_pct', row)
              } else if (label.includes('outros ajustes')) {
                metricasPorLinha.set('outros_ajustes', row)
              } else if (label.includes('ajuste') && label.includes('bonifica')) {
                metricasPorLinha.set('ajuste_bonificacoes', row)
              } else if (label.includes('cmv') && label.includes('teórico')) {
                metricasPorLinha.set('cmv_teorico_percentual', row)
              } else if (label.includes('giro') && label.includes('estoque')) {
                // Giro de estoque - skip, é calculado
              }
              break
              
            case 'estoque_inicial_det':
              if (label.includes('cozinha')) {
                metricasPorLinha.set('estoque_inicial_cozinha', row)
              } else if (label.includes('bebida') || label.includes('tabacaria')) {
                metricasPorLinha.set('estoque_inicial_bebidas', row)
              } else if (label.includes('drink')) {
                metricasPorLinha.set('estoque_inicial_drinks', row)
              } else if (label === 'total') {
                metricasPorLinha.set('estoque_inicial_total', row)
              }
              break
              
            case 'estoque_final_det':
              if (label.includes('cozinha')) {
                metricasPorLinha.set('estoque_final_cozinha', row)
              } else if (label.includes('bebida') || label.includes('tabacaria')) {
                metricasPorLinha.set('estoque_final_bebidas', row)
              } else if (label.includes('drink')) {
                metricasPorLinha.set('estoque_final_drinks', row)
              } else if (label === 'total') {
                metricasPorLinha.set('estoque_final_total', row)
              }
              break
              
            case 'compras':
              // Compras vêm do NIBO, não sincronizamos daqui
              break
              
            case 'contas_especiais':
              // Valores absolutos das mesas (antes de aplicar %)
              if (label.includes('consumo') && label.includes('sócio')) {
                metricasPorLinha.set('total_consumo_socios', row)
              } else if (label.includes('mesa') && label.includes('benefício')) {
                metricasPorLinha.set('mesa_beneficios_cliente', row)
              } else if (label.includes('mesa') && (label.includes('banda') || label.includes('dj'))) {
                metricasPorLinha.set('mesa_banda_dj', row)
              } else if (label.includes('mesa') && label.includes('rh') && label.includes('operação')) {
                metricasPorLinha.set('mesa_rh_operacao', row)
              } else if (label.includes('mesa') && label.includes('rh') && label.includes('escritório')) {
                metricasPorLinha.set('mesa_rh_escritorio', row)
              }
              break
              
            case 'alimentacao':
              if (label.includes('estoque inicial')) {
                metricasPorLinha.set('estoque_inicial_funcionarios', row)
              } else if (label.includes('estoque final')) {
                metricasPorLinha.set('estoque_final_funcionarios', row)
              }
              // Compras alimentação vêm do NIBO
              break
          }
          
          // Bonificações (podem aparecer em qualquer lugar)
          if (label.includes('bonificaç') && label.includes('contrato')) {
            metricasPorLinha.set('bonificacao_contrato_anual', row)
          } else if (label.includes('outras bonificaç')) {
            metricasPorLinha.set('outras_bonificacoes', row)
          }
        }

        console.log(`📋 Métricas mapeadas (${metricasPorLinha.size} campos):`, Object.fromEntries(metricasPorLinha))

        // 7. Extrair dados por semana
        const dadosPorSemana: Map<number, SemanaData> = new Map()

        for (const [col, numSemana] of colunaParaSemana) {
          // Filtrar por semana específica se solicitado
          if (semana && !todas_semanas && numSemana !== semana) {
            continue
          }

          const dados: SemanaData = { semana: numSemana }

          // Extrair cada métrica
          for (const [metrica, row] of metricasPorLinha) {
            const valor = jsonData[row]?.[col]
            
            // Percentuais
            if (metrica === 'cmv_teorico_percentual') {
              dados.cmv_teorico_percentual = parsePercentual(valor)
              continue
            }
            
            // Estoques totais (da seção principal ou do TOTAL da seção detalhada)
            if (metrica === 'estoque_inicial' || metrica === 'estoque_inicial_total') {
              const v = parseMonetario(valor)
              if (v > 0) dados.estoque_inicial = v
              continue
            }
            if (metrica === 'estoque_final' || metrica === 'estoque_final_total') {
              const v = parseMonetario(valor)
              if (v > 0) dados.estoque_final = v
              continue
            }
            
            // Estoques por categoria
            if (metrica === 'estoque_inicial_cozinha') {
              dados.estoque_inicial_cozinha = parseMonetario(valor)
              continue
            }
            if (metrica === 'estoque_inicial_bebidas') {
              dados.estoque_inicial_bebidas = parseMonetario(valor)
              continue
            }
            if (metrica === 'estoque_inicial_drinks') {
              dados.estoque_inicial_drinks = parseMonetario(valor)
              continue
            }
            if (metrica === 'estoque_final_cozinha') {
              dados.estoque_final_cozinha = parseMonetario(valor)
              continue
            }
            if (metrica === 'estoque_final_bebidas') {
              dados.estoque_final_bebidas = parseMonetario(valor)
              continue
            }
            if (metrica === 'estoque_final_drinks') {
              dados.estoque_final_drinks = parseMonetario(valor)
              continue
            }
            
            // Consumos - da seção CONTAS ESPECIAIS (valores absolutos)
            if (metrica === 'total_consumo_socios') {
              dados.total_consumo_socios = parseMonetario(valor)
              continue
            }
            if (metrica === 'mesa_beneficios_cliente') {
              dados.mesa_beneficios_cliente = parseMonetario(valor)
              continue
            }
            if (metrica === 'mesa_banda_dj') {
              dados.mesa_banda_dj = parseMonetario(valor)
              continue
            }
            if (metrica === 'mesa_rh_operacao') {
              dados.consumo_rh = (dados.consumo_rh || 0) + parseMonetario(valor)
              continue
            }
            if (metrica === 'mesa_rh_escritorio') {
              dados.consumo_rh = (dados.consumo_rh || 0) + parseMonetario(valor)
              continue
            }
            
            // Bonificações
            if (metrica === 'bonificacao_contrato_anual') {
              dados.bonificacao_contrato_anual = parseMonetario(valor)
              continue
            }
            if (metrica === 'ajuste_bonificacoes') {
              dados.ajuste_bonificacoes = parseMonetario(valor)
              continue
            }
            if (metrica === 'outros_ajustes' || metrica === 'outras_bonificacoes') {
              dados.outros_ajustes = parseMonetario(valor)
              continue
            }
            
            // CMA - Alimentação funcionários
            if (metrica === 'estoque_inicial_funcionarios') {
              dados.estoque_inicial_funcionarios = parseMonetario(valor)
              continue
            }
            if (metrica === 'estoque_final_funcionarios') {
              dados.estoque_final_funcionarios = parseMonetario(valor)
              continue
            }
          }

          // Só adicionar se tem algum dado útil
          const temDados = dados.estoque_inicial || dados.estoque_final || 
                          dados.estoque_inicial_cozinha || dados.estoque_final_cozinha ||
                          dados.total_consumo_socios || dados.cmv_teorico_percentual

          if (temDados) {
            dadosPorSemana.set(numSemana, dados)
          }
        }

        console.log(`📊 ${dadosPorSemana.size} semanas com dados extraídos`)

        // 8. Atualizar banco de dados
        let semanasAtualizadas = 0
        let semanasErro = 0

        for (const [numSemana, dados] of dadosPorSemana) {
          // Verificar se a semana existe no cmv_semanal
          const { data: existente } = await supabase
            .from('cmv_semanal')
            .select('id')
            .eq('bar_id', barConfig.bar_id)
            .eq('ano', anoAtual)
            .eq('semana', numSemana)
            .single()

          // Preparar update (só campos da planilha, não sobrescrever dados do NIBO)
          const updateData: any = {
            updated_at: new Date().toISOString()
          }

          // Estoques totais
          if (dados.estoque_inicial !== undefined && dados.estoque_inicial > 0) {
            updateData.estoque_inicial = dados.estoque_inicial
          }
          if (dados.estoque_final !== undefined && dados.estoque_final > 0) {
            updateData.estoque_final = dados.estoque_final
          }
          
          // Estoques por categoria
          if (dados.estoque_inicial_cozinha !== undefined && dados.estoque_inicial_cozinha > 0) {
            updateData.estoque_inicial_cozinha = dados.estoque_inicial_cozinha
          }
          if (dados.estoque_inicial_bebidas !== undefined && dados.estoque_inicial_bebidas > 0) {
            updateData.estoque_inicial_bebidas = dados.estoque_inicial_bebidas
          }
          if (dados.estoque_inicial_drinks !== undefined && dados.estoque_inicial_drinks > 0) {
            updateData.estoque_inicial_drinks = dados.estoque_inicial_drinks
          }
          if (dados.estoque_final_cozinha !== undefined && dados.estoque_final_cozinha > 0) {
            updateData.estoque_final_cozinha = dados.estoque_final_cozinha
          }
          if (dados.estoque_final_bebidas !== undefined && dados.estoque_final_bebidas > 0) {
            updateData.estoque_final_bebidas = dados.estoque_final_bebidas
          }
          if (dados.estoque_final_drinks !== undefined && dados.estoque_final_drinks > 0) {
            updateData.estoque_final_drinks = dados.estoque_final_drinks
          }
          
          // Consumos (valores da planilha são os totais das contas especiais)
          if (dados.total_consumo_socios !== undefined) {
            updateData.total_consumo_socios = dados.total_consumo_socios
          }
          if (dados.mesa_beneficios_cliente !== undefined) {
            updateData.mesa_beneficios_cliente = dados.mesa_beneficios_cliente
          }
          if (dados.consumo_rh !== undefined) {
            updateData.consumo_rh = dados.consumo_rh
          }
          if (dados.mesa_banda_dj !== undefined) {
            updateData.mesa_banda_dj = dados.mesa_banda_dj
          }
          
          // Bonificações
          if (dados.bonificacao_contrato_anual !== undefined && dados.bonificacao_contrato_anual > 0) {
            updateData.bonificacao_contrato_anual = dados.bonificacao_contrato_anual
          }
          if (dados.ajuste_bonificacoes !== undefined) {
            updateData.ajuste_bonificacoes = dados.ajuste_bonificacoes
          }
          if (dados.outros_ajustes !== undefined) {
            updateData.outros_ajustes = dados.outros_ajustes
          }
          
          // Percentuais
          if (dados.cmv_teorico_percentual !== undefined && dados.cmv_teorico_percentual > 0) {
            updateData.cmv_teorico_percentual = dados.cmv_teorico_percentual
          }
          
          // CMA - Alimentação funcionários
          if (dados.estoque_inicial_funcionarios !== undefined) {
            updateData.estoque_inicial_funcionarios = dados.estoque_inicial_funcionarios
          }
          if (dados.estoque_final_funcionarios !== undefined) {
            updateData.estoque_final_funcionarios = dados.estoque_final_funcionarios
          }

          if (existente) {
            // Update
            const { error: updateError } = await supabase
              .from('cmv_semanal')
              .update(updateData)
              .eq('id', existente.id)

            if (updateError) {
              console.error(`❌ Erro ao atualizar semana ${numSemana}:`, updateError)
              semanasErro++
            } else {
              semanasAtualizadas++
            }
          } else {
            // A semana não existe - cmv-semanal-auto deve criá-la primeiro
            console.log(`⚠️ Semana ${numSemana} não existe no banco - será criada pelo cmv-semanal-auto`)
          }
        }

        console.log(`✅ ${barConfig.nome}: ${semanasAtualizadas} semanas atualizadas, ${semanasErro} erros`)

        resultadosPorBar.push({
          bar_id: barConfig.bar_id,
          bar_nome: barConfig.nome,
          success: true,
          semanas_encontradas: dadosPorSemana.size,
          semanas_atualizadas: semanasAtualizadas,
          semanas_erro: semanasErro,
          metricas_mapeadas: Array.from(metricasPorLinha.keys())
        })

      } catch (barError: any) {
        console.error(`❌ Erro ao processar ${barConfig.nome}:`, barError)
        resultadosPorBar.push({
          bar_id: barConfig.bar_id,
          bar_nome: barConfig.nome,
          success: false,
          error: barError.message
        })
      }
    }

    const totalAtualizadas = resultadosPorBar
      .filter(r => r.success)
      .reduce((acc, r) => acc + (r.semanas_atualizadas || 0), 0)

    return new Response(
      JSON.stringify({
        success: true,
        message: `CMV Sheets sincronizado: ${resultadosPorBar.length} bar(es), ${totalAtualizadas} semanas atualizadas`,
        resultados_por_bar: resultadosPorBar,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('❌ Erro ao sincronizar CMV Sheets:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
