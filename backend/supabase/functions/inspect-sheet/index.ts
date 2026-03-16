import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
import { getGoogleAccessToken, downloadDriveFileAsExcel } from '../_shared/google-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Normaliza texto removendo acentos e caracteres especiais (igual ao sync-contagem-sheets)
 */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30)
}

function gerarCodigoAuto(nome: string): string {
  return `auto_${normalizarTexto(nome)}`
}

// Configuração por bar (igual ao sync-contagem-sheets)
const CONFIG_POR_BAR: Record<number, {
  linhasDatas: number
  linhaCabecalhos: number
  linhaInicio: number
  colunaPreco: number
  colunaCodigo: number
  colunaCategoria: number
  colunaNome: number
  colunasPorData: number
}> = {
  3: { linhasDatas: 3, linhaCabecalhos: 5, linhaInicio: 6, colunaPreco: 0, colunaCodigo: 3, colunaCategoria: 4, colunaNome: 6, colunasPorData: 3 },
  4: { linhasDatas: 3, linhaCabecalhos: 5, linhaInicio: 6, colunaPreco: 0, colunaCodigo: 3, colunaCategoria: 4, colunaNome: 6, colunasPorData: 2 },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const barId = parseInt(url.searchParams.get('bar_id') || '4')
    const dataComparar = url.searchParams.get('data') // ex: 2026-03-09
    const abaName = url.searchParams.get('aba') || 'INSUMOS'
    const maxRows = parseInt(url.searchParams.get('linhas') || '10')

    // Buscar spreadsheet_id do bar
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: cred } = await supabase
      .from('api_credentials')
      .select('configuracoes')
      .eq('bar_id', barId)
      .eq('sistema', 'google_sheets')
      .single()

    const spreadsheetId = cred?.configuracoes?.spreadsheet_id
    if (!spreadsheetId) {
      return new Response(JSON.stringify({
        success: false,
        error: `Spreadsheet não configurado para bar_id ${barId}`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`📊 Inspecionando planilha bar ${barId}: ${spreadsheetId}, aba: ${abaName}`)

    const accessToken = await getGoogleAccessToken()
    const excelBuffer = await downloadDriveFileAsExcel(spreadsheetId, accessToken)
    
    const workbook = XLSX.read(new Uint8Array(excelBuffer), { type: 'array' })
    
    const abas = workbook.SheetNames
    const sheetNames = workbook.SheetNames.map(n => n.toLowerCase())
    const abaIndex = sheetNames.indexOf(abaName.toLowerCase())
    
    if (abaIndex === -1) {
      return new Response(JSON.stringify({
        success: false,
        error: `Aba '${abaName}' não encontrada`,
        abas_disponiveis: abas
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const sheet = workbook.Sheets[workbook.SheetNames[abaIndex]]
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

    const config = CONFIG_POR_BAR[barId] || CONFIG_POR_BAR[4]

    // Se tiver data para comparar, extrair dados da planilha e comparar com banco
    if (dataComparar) {
      console.log(`🔍 Comparando data ${dataComparar}`)

      // Encontrar coluna da data
      const linhaDatas = jsonData[config.linhasDatas] || []
      let colunaData = -1
      
      for (let col = 0; col < linhaDatas.length; col++) {
        const valor = linhaDatas[col]
        if (typeof valor === 'number' && valor > 40000 && valor < 50000) {
          const excelDate = XLSX.SSF.parse_date_code(valor)
          if (excelDate) {
            const d = excelDate.d.toString().padStart(2, '0')
            const m = excelDate.m.toString().padStart(2, '0')
            const dataStr = `${excelDate.y}-${m}-${d}`
            if (dataStr === dataComparar) {
              colunaData = col
              break
            }
          }
        }
      }

      if (colunaData === -1) {
        return new Response(JSON.stringify({
          success: false,
          error: `Data ${dataComparar} não encontrada na planilha`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Extrair dados da planilha para essa data (mesma lógica de códigos únicos do sync)
      const dadosPlanilha: any[] = []
      const codigosContador = new Map<string, number>()
      
      for (let row = config.linhaInicio; row < jsonData.length; row++) {
        const linha = jsonData[row]
        if (!linha) continue

        const codigoRaw = String(linha[config.colunaCodigo] || '').trim()
        const nome = String(linha[config.colunaNome] || '').trim()
        
        if (!nome) continue
        
        // Gerar código base
        let codigoBase = codigoRaw && codigoRaw !== '-' 
          ? codigoRaw 
          : gerarCodigoAuto(nome)
        
        // Verificar se já vimos este código - se sim, criar código único
        let codigo = codigoBase
        const contador = codigosContador.get(codigoBase) || 0
        
        if (contador > 0) {
          const sufixo = normalizarTexto(nome).substring(0, 10)
          codigo = `${codigoBase}_${sufixo}_${contador}`
        }
        
        codigosContador.set(codigoBase, contador + 1)
        
        // Parse robusto do preço (igual ao sync-contagem-sheets)
        let precoRaw = linha[config.colunaPreco]
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
        
        const estoqueFechado = parseFloat(String(linha[colunaData] || '0').replace(',', '.')) || 0
        const estoqueFlutuante = parseFloat(String(linha[colunaData + 1] || '0').replace(',', '.')) || 0

        if (estoqueFechado > 0 || estoqueFlutuante > 0) {
          dadosPlanilha.push({
            codigo,
            nome,
            preco: preco,
            estoque_fechado: estoqueFechado,
            estoque_flutuante: estoqueFlutuante
          })
        }
      }

      // Buscar dados do banco
      const { data: dadosBanco } = await supabase
        .from('contagem_estoque_insumos')
        .select('insumo_codigo, insumo_nome, custo_unitario, estoque_final')
        .eq('bar_id', barId)
        .eq('data_contagem', dataComparar)

      // Comparar
      const comparacao: any[] = []
      const problemas: any[] = []

      for (const itemPlanilha of dadosPlanilha) {
        const itemBanco = dadosBanco?.find(b => b.insumo_codigo === itemPlanilha.codigo)
        
        const estoqueOk = itemBanco && Math.abs(parseFloat(itemBanco.estoque_final || 0) - itemPlanilha.estoque_fechado) < 0.01
        const precoOk = itemBanco && Math.abs(parseFloat(itemBanco.custo_unitario || 0) - itemPlanilha.preco) < 0.01

        const item = {
          codigo: itemPlanilha.codigo,
          nome: itemPlanilha.nome,
          planilha: {
            estoque: itemPlanilha.estoque_fechado,
            preco: itemPlanilha.preco
          },
          banco: itemBanco ? {
            estoque: parseFloat(itemBanco.estoque_final || 0),
            preco: parseFloat(itemBanco.custo_unitario || 0)
          } : null,
          estoque_ok: estoqueOk,
          preco_ok: precoOk,
          no_banco: !!itemBanco
        }

        comparacao.push(item)
        
        if (!itemBanco || !estoqueOk || !precoOk) {
          problemas.push(item)
        }
      }

      return new Response(JSON.stringify({
        success: true,
        bar_id: barId,
        data: dataComparar,
        coluna_encontrada: colunaData,
        total_planilha: dadosPlanilha.length,
        total_banco: dadosBanco?.length || 0,
        total_ok: comparacao.filter(c => c.estoque_ok && c.preco_ok).length,
        total_problemas: problemas.length,
        problemas: problemas.slice(0, 20),
        amostra_ok: comparacao.filter(c => c.estoque_ok && c.preco_ok).slice(0, 10),
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Preview padrão (sem comparação)
    const preview: any[][] = []
    for (let row = 0; row < Math.min(maxRows, jsonData.length); row++) {
      const linha = jsonData[row] || []
      const linhaPreview: any[] = []
      for (let col = 0; col < 15; col++) {
        const val = linha[col] ?? null
        if (typeof val === 'number' && val > 40000 && val < 50000) {
          const excelDate = XLSX.SSF.parse_date_code(val)
          if (excelDate) {
            const d = excelDate.d.toString().padStart(2, '0')
            const m = excelDate.m.toString().padStart(2, '0')
            linhaPreview.push(`${excelDate.y}-${m}-${d} (${val})`)
          } else {
            linhaPreview.push(val)
          }
        } else {
          linhaPreview.push(val)
        }
      }
      preview.push(linhaPreview)
    }

    // Procurar datas de março/2026
    const datasMarco2026: { linha: number, coluna: number, data: string }[] = []
    for (let row = 0; row < Math.min(10, jsonData.length); row++) {
      const linha = jsonData[row] || []
      for (let col = 0; col < linha.length; col++) {
        const valor = linha[col]
        if (typeof valor === 'number' && valor > 46000 && valor < 47000) {
          const excelDate = XLSX.SSF.parse_date_code(valor)
          if (excelDate && excelDate.y === 2026 && excelDate.m === 3) {
            const d = excelDate.d.toString().padStart(2, '0')
            const m = excelDate.m.toString().padStart(2, '0')
            datasMarco2026.push({ linha: row, coluna: col, data: `${excelDate.y}-${m}-${d}` })
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      spreadsheet_id: spreadsheetId,
      aba: workbook.SheetNames[abaIndex],
      abas_disponiveis: abas,
      total_linhas: jsonData.length,
      total_colunas: jsonData[0]?.length || 0,
      preview: preview,
      datas_marco_2026: datasMarco2026,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
