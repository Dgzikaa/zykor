import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser , permissionErrorResponse } from '@/middleware/auth'

/**
 * API para executar verificação de saúde dos dados
 * POST /api/saude-dados/verificar
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticar usuário
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      )
    }
  if ((user.role as string) !== 'admin') return permissionErrorResponse('Somente admin');

    const supabase = await getAdminClient()

    // Executar verificação diária
    const { data, error } = await supabase.rpc('verificacao_diaria_confiabilidade')

    if (error) {
      console.error('Erro ao executar verificação:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      resultado: data
    })

  } catch (error: any) {
    console.error('Erro na API de verificação:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
