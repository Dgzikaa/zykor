import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser , permissionErrorResponse } from '@/middleware/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }
  if ((user.role as string) !== 'admin') return permissionErrorResponse('Somente admin');

    const { alerta_id } = await request.json()

    if (!alerta_id) {
      return NextResponse.json({ success: false, error: 'ID do alerta não fornecido' }, { status: 400 })
    }

    const supabase = await getAdminClient()

    const { error } = await supabase
      .from('sistema_alertas')
      .update({ 
        resolvido: true, 
        resolvido_em: new Date().toISOString(),
        resolvido_por: user.nome || user.email
      })
      .eq('id', alerta_id)

    if (error) {
      console.error('Erro ao resolver alerta:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Alerta resolvido' })
  } catch (error: any) {
    console.error('Erro na API de resolver alerta:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
