/**
 * API para validar sessão do usuário
 * Retorna true se há sessão ativa, false caso contrário
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verificar token JWT
    const authToken = request.cookies.get('auth_token')?.value;
    
    if (!authToken) {
      console.log('⚠️ [VALIDATE] Token não encontrado');
      return NextResponse.json({ 
        valid: false, 
        reason: 'no_token' 
      });
    }

    const decoded = validateToken(authToken);
    
    if (!decoded) {
      console.log('⚠️ [VALIDATE] Token inválido ou expirado');
      return NextResponse.json({ 
        valid: false, 
        reason: 'invalid_token' 
      });
    }

    console.log(`✅ [VALIDATE] Token válido para ${decoded.email}`);
    
    // Token válido
    return NextResponse.json({ 
      valid: true,
      user: {
        id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
      }
    });

  } catch (error) {
    console.error('❌ [VALIDATE] Erro ao validar sessão:', error);
    return NextResponse.json({ 
      valid: false, 
      reason: 'error' 
    }, { status: 500 });
  }
}
