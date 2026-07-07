import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getUserAuth } from '@/lib/auth-helper';
import { authenticateUser } from '@/middleware/auth';

// Força runtime dinâmico para evitar erro de static generation
export const dynamic = 'force-dynamic';

// GET - Buscar dados do perfil do usuário logado
export async function GET(request: NextRequest) {
  try {
    // Obter dados do usuário autenticado
    const user = await getUserAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    // Usar cliente administrativo
    const adminClient = await getAdminClient();

    // Buscar dados do perfil no schema atual (auth_custom.usuarios = view de public.usuarios)
    const { data: perfil, error } = await adminClient
      .schema('auth_custom')
      .from('usuarios')
      .select(
        `
        id, auth_id, email, nome, role, modulos_permitidos, ativo,
        foto_perfil, telefone, cpf, data_nascimento, endereco,
        cep, cidade, estado, bio,
        preferencias, ultima_atividade, conta_verificada,
        created_at, updated_at
      `
      )
      .eq('auth_id', user.user_id)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar perfil:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar dados do perfil' },
        { status: 500 }
      );
    }

    if (!perfil) {
      return NextResponse.json(
        { success: false, error: 'Perfil não encontrado' },
        { status: 404 }
      );
    }

    // Nome do bar atual (vem do token; bar vive em operations.bares)
    const { data: barData } = await adminClient
      .schema('operations')
      .from('bares')
      .select('id, nome')
      .eq('id', user.bar_id)
      .single();

    return NextResponse.json({
      success: true,
      perfil: {
        ...perfil,
        bar_id: user.bar_id,
        user_id: perfil.auth_id,
        celular: perfil.telefone,      // alias p/ compat com a tela (campo antigo)
        criado_em: perfil.created_at,  // idem
        atualizado_em: perfil.updated_at,
        bar: barData || null,
      },
    });
  } catch (error) {
    console.error('❌ Erro na API de perfil (GET):', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar dados do perfil do usuário logado
export async function PUT(request: NextRequest) {
  const authUser = await authenticateUser(request);
  if (!authUser) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    // Obter dados do usuário autenticado
    const user = await getUserAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      nome,
      celular,
      telefone,
      cpf,
      data_nascimento,
      endereco,
      cep,
      cidade,
      estado,
      bio,
      foto_perfil,
      preferencias,
    } = body;

    // Usar cliente administrativo
    const adminClient = await getAdminClient();

    // Preparar dados para atualização (apenas campos não vazios)
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
      ultima_atividade: new Date().toISOString(),
    };

    // Adicionar apenas campos que foram enviados (celular e telefone -> coluna telefone)
    if (nome !== undefined) updateData.nome = nome;
    if (celular !== undefined) updateData.telefone = celular;
    if (telefone !== undefined) updateData.telefone = telefone;
    if (cpf !== undefined) updateData.cpf = cpf;
    if (data_nascimento !== undefined)
      updateData.data_nascimento = data_nascimento;
    if (endereco !== undefined) updateData.endereco = endereco;
    if (cep !== undefined) updateData.cep = cep;
    if (cidade !== undefined) updateData.cidade = cidade;
    if (estado !== undefined) updateData.estado = estado;
    if (bio !== undefined) updateData.bio = bio;
    if (foto_perfil !== undefined) updateData.foto_perfil = foto_perfil;
    if (preferencias !== undefined) updateData.preferencias = preferencias;

    // Validações básicas
    if (cpf && cpf.length > 0 && !isValidCPF(cpf)) {
      return NextResponse.json(
        { success: false, error: 'CPF inválido' },
        { status: 400 }
      );
    }

    if (celular && celular.length > 0 && !isValidPhone(celular)) {
      return NextResponse.json(
        { success: false, error: 'Celular inválido' },
        { status: 400 }
      );
    }

    // Atualizar perfil no schema atual
    const { data: perfilAtualizado, error } = await adminClient
      .schema('auth_custom')
      .from('usuarios')
      .update(updateData)
      .eq('auth_id', user.user_id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar perfil:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar perfil' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Perfil atualizado com sucesso!',
      perfil: perfilAtualizado,
    });
  } catch (error) {
    console.error('❌ Erro na API de perfil (PUT):', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função para validar CPF
function isValidCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/[^\d]/g, '');

  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) return false;

  // Verifica se não são todos iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  // Valida dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleanCPF.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleanCPF.charAt(10))) return false;

  return true;
}

// Função para validar telefone
function isValidPhone(phone: string): boolean {
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/[^\d]/g, '');

  // Verifica se tem 10 ou 11 dígitos (com DDD)
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
}
