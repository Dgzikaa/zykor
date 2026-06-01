import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Sem fallback adivinhável: se JWT_SECRET não estiver setado, as ops de token
// falham (fail-closed) em vez de usar um segredo conhecido.
const JWT_SECRET = process.env.JWT_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const { email, senha } = await request.json()

    if (!email || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar funcionário no banco de dados
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios_bar')
      .select('id, nome, email, senha_hash, role, ativo, bar_id')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .single()

    if (funcionarioError || !funcionario) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    // Verificar se é funcionário (não admin)
    if (funcionario.role === 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado - Esta área é restrita a funcionários' },
        { status: 403 }
      )
    }

    // Verificar senha (se houver hash de senha)
    if (funcionario.senha_hash) {
      const senhaValida = await bcrypt.compare(senha, funcionario.senha_hash)
      
      if (!senhaValida) {
        return NextResponse.json(
          { error: 'Credenciais inválidas' },
          { status: 401 }
        )
      }
    }

    // Gerar token JWT
    const token = jwt.sign(
      {
        staff_id: funcionario.id,
        email: funcionario.email,
        nome: funcionario.nome,
        bar_id: funcionario.bar_id,
        role: funcionario.role
      },
      JWT_SECRET,
      { expiresIn: '8h' } // Token válido por 8 horas
    )

    // Log de acesso
    await supabase
      .from('fidelidade_qr_scanner_logs')
      .insert({
        funcionario_id: funcionario.id,
        acao: 'login',
        detalhes: { 
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown'
        }
      })

    return NextResponse.json({
      success: true,
      token,
      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
        email: funcionario.email,
        bar_id: funcionario.bar_id
      }
    })

  } catch (error) {
    console.error('🚨 Erro no login de funcionário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
