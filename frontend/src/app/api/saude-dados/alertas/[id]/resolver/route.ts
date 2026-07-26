import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser , permissionErrorResponse } from '@/middleware/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }
  if ((user.role as string) !== 'admin') return permissionErrorResponse('Somente admin');

    const resolvedParams = await params
    const alertaId = parseInt(resolvedParams.id)

    if (isNaN(alertaId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await getAdminClient()

    const { error } = await supabase
      .from('sistema_alertas')
      .update({
        resolvido: true,
        resolvido_por: user.id,
        resolvido_em: new Date().toISOString()
      })
      .eq('id', alertaId)

    if (error) {
      console.error('Erro ao resolver alerta:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Erro ao resolver alerta:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
