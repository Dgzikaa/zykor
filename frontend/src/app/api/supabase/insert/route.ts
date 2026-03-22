import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { table, data } = await request.json()
    
    if (!table || !data) {
      return NextResponse.json({
        success: false,
        error: 'Tabela e dados são obrigatórios'
      }, { status: 400 })
    }

    // Esta API seria conectada ao MCP Supabase para inserção
    // Por enquanto, simular sucesso com um ID gerado
    
    const novoId = Date.now()
    const resultado = {
      id: novoId,
      ...data,
      criado_em: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      result: resultado,
      message: `Registro inserido na tabela ${table} com sucesso`
    })

  } catch (error) {
    console.error('Erro ao inserir dados:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
} 
