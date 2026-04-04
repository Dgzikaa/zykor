import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const perfil = searchParams.get('perfil'); // FORNECEDOR ou CLIENTE
    const sync = searchParams.get('sync') === 'true';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Se não for para sincronizar, retorna do banco
    if (!sync) {
      let query = supabase
        .from('contaazul_pessoas')
        .select('*')
        .eq('bar_id', parseInt(barId));

      if (perfil) {
        query = query.eq('perfil', perfil);
      }

      const { data, error } = await query.order('nome');

      if (error) {
        console.error('Erro ao buscar pessoas do banco:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ pessoas: data || [] });
    }

    // Buscar credenciais do Conta Azul
    const { data: credentials, error: credError } = await supabase
      .from('api_credentials')
      .select('access_token, expires_at')
      .eq('sistema', 'conta_azul')
      .eq('bar_id', parseInt(barId))
      .single();

    if (credError || !credentials?.access_token) {
      return NextResponse.json(
        { error: 'Credenciais do Conta Azul não encontradas' },
        { status: 404 }
      );
    }

    // Verificar se token expirou
    if (credentials.expires_at && new Date(credentials.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Token expirado. Reconecte o Conta Azul.' },
        { status: 401 }
      );
    }

    const todasPessoas: any[] = [];

    // Buscar fornecedores
    if (!perfil || perfil === 'FORNECEDOR') {
      console.log('Buscando fornecedores...');
      const fornecedoresUrl = new URL(`${CONTA_AZUL_API_URL}/v1/fornecedores`);
      fornecedoresUrl.searchParams.set('page', '1');
      fornecedoresUrl.searchParams.set('size', '500');

      const fornecedoresResponse = await fetch(fornecedoresUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (fornecedoresResponse.ok) {
        const fornecedoresData = await fornecedoresResponse.json();
        const fornecedores = fornecedoresData.content || fornecedoresData.items || [];
        
        fornecedores.forEach((f: any) => {
          todasPessoas.push({
            ...f,
            perfil: 'FORNECEDOR'
          });
        });
        
        console.log(`✓ ${fornecedores.length} fornecedores`);
      }
    }

    // Buscar clientes
    if (!perfil || perfil === 'CLIENTE') {
      console.log('Buscando clientes...');
      const clientesUrl = new URL(`${CONTA_AZUL_API_URL}/v1/clientes`);
      clientesUrl.searchParams.set('page', '1');
      clientesUrl.searchParams.set('size', '500');

      const clientesResponse = await fetch(clientesUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (clientesResponse.ok) {
        const clientesData = await clientesResponse.json();
        const clientes = clientesData.content || clientesData.items || [];
        
        clientes.forEach((c: any) => {
          todasPessoas.push({
            ...c,
            perfil: 'CLIENTE'
          });
        });
        
        console.log(`✓ ${clientes.length} clientes`);
      }
    }

    // Sincronizar com banco local
    const pessoasParaSalvar = todasPessoas.map((pessoa: any) => ({
      bar_id: parseInt(barId),
      contaazul_id: pessoa.id || pessoa.uuid,
      nome: pessoa.nome || pessoa.name || pessoa.razao_social,
      tipo_pessoa: pessoa.tipo_pessoa || pessoa.person_type || (pessoa.cpf ? 'FISICA' : 'JURIDICA'),
      documento: pessoa.cpf || pessoa.cnpj || pessoa.cpf_cnpj || pessoa.document,
      email: pessoa.email,
      telefone: pessoa.telefone || pessoa.phone || pessoa.celular,
      perfil: pessoa.perfil,
      ativo: pessoa.ativo !== false && pessoa.status !== 'INATIVO',
      raw_data: pessoa,
      sincronizado_em: new Date().toISOString()
    }));

    if (pessoasParaSalvar.length > 0) {
      // Usar upsert para evitar duplicatas
      const { error: upsertError } = await supabase
        .from('contaazul_pessoas')
        .upsert(pessoasParaSalvar, {
          onConflict: 'contaazul_id,bar_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('Erro ao salvar pessoas:', upsertError);
        return NextResponse.json(
          { error: 'Erro ao salvar pessoas', details: upsertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      pessoas: pessoasParaSalvar,
      total: pessoasParaSalvar.length,
      fornecedores: pessoasParaSalvar.filter(p => p.perfil === 'FORNECEDOR').length,
      clientes: pessoasParaSalvar.filter(p => p.perfil === 'CLIENTE').length,
      sincronizado_em: new Date().toISOString()
    });

  } catch (err) {
    console.error('Erro ao buscar stakeholders:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
