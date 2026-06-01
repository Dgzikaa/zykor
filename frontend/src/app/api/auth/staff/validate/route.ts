import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET || ''

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization')
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      )
    }

    const token = authorization.substring(7)

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any
      
      if (!decoded.staff_id || decoded.tipo !== 'funcionario') {
        return NextResponse.json(
          { error: 'Token inválido para funcionário' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        valid: true,
        funcionario: {
          id: decoded.staff_id,
          nome: decoded.nome,
          email: decoded.email,
          bar_id: decoded.bar_id,
          tipo: decoded.tipo
        }
      })

    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      )
    }

  } catch (error) {
    console.error('🚨 Erro na validação do token de funcionário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
