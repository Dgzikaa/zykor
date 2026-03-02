/**
 * Testar conexão com Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    console.log('🔍 Testando Supabase...');
    console.log('URL:', supabaseUrl);
    console.log('Anon Key (primeiros 30):', supabaseAnonKey.substring(0, 30));

    // Criar cliente
    const client = createClient(supabaseUrl, supabaseAnonKey);

    // Tentar fazer login de teste
    const testEmail = 'test@test.com';
    const testPassword = 'test123';

    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        error_code: error.status,
        hint: 'Se o erro é "Invalid API key", as chaves do Supabase estão incorretas',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Conexão OK',
      user: data.user?.email,
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
