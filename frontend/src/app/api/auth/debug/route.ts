/**
 * API de debug para verificar configuração
 * REMOVER EM PRODUÇÃO
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const jwtSecret = process.env.JWT_SECRET;

    const config = {
      supabase_url: supabaseUrl ? '✅ Configurado' : '❌ Faltando',
      supabase_anon_key: supabaseAnonKey ? `✅ ${supabaseAnonKey.substring(0, 20)}...` : '❌ Faltando',
      supabase_service_key: supabaseServiceKey ? `✅ ${supabaseServiceKey.substring(0, 20)}...` : '❌ Faltando',
      jwt_secret: jwtSecret ? `✅ ${jwtSecret.substring(0, 20)}...` : '❌ Faltando',
    };

    // Testar conexão com Supabase
    if (supabaseUrl && supabaseServiceKey) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Verificar se consegue acessar a tabela usuarios
      const { data: usuarios, error } = await adminClient
        .from('usuarios')
        .select('id, email, ativo')
        .limit(1);

      config['database_connection'] = error ? `❌ ${error.message}` : `✅ Conectado (${usuarios?.length || 0} usuários encontrados)`;
    }

    return NextResponse.json({
      success: true,
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
