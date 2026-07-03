import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/auth/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { enviarEmailBoasVindas } from '@/lib/emails/user-welcome';
import { normalizeEmail } from '@/lib/email-utils';

export const dynamic = 'force-dynamic'

// Senha temporária forte e única por usuário (será trocada no 1º acesso).
function gerarSenhaTemporaria(): string {
  return 'Zk!' + randomUUID().replace(/-/g, '').slice(0, 12);
}

// GET - Listar todos os usuários com seus bares associados
export const GET = requireAdmin(async (request, user) => {
  try {
    const supabase = await getAdminClient();
    
    // Buscar usuários
    const { data: usuarios, error } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Buscar relacionamentos de usuários com bares
    const { data: usuariosBares, error: baresError } = await supabase
      .schema('auth_custom')
      .from('usuarios_bares')
      .select('usuario_id, bar_id');

    if (baresError) {
      console.error('Erro ao buscar relacionamentos usuários-bares:', baresError);
    }

    // Criar mapa de bares por usuário (usando auth_id como chave)
    const baresMap: Record<string, number[]> = {};
    usuariosBares?.forEach(ub => {
      if (!baresMap[ub.usuario_id]) {
        baresMap[ub.usuario_id] = [];
      }
      baresMap[ub.usuario_id].push(ub.bar_id);
    });

    // Garantir que modulos_permitidos seja sempre um array e adicionar bares_ids
    const usuariosFormatados = usuarios?.map(u => {
      let modulosPermitidos: string[] = [];
      
      if (Array.isArray(u.modulos_permitidos)) {
        modulosPermitidos = u.modulos_permitidos;
      } else if (u.modulos_permitidos && typeof u.modulos_permitidos === 'string') {
        // Se vier como string JSON, fazer parse
        try {
          modulosPermitidos = JSON.parse(u.modulos_permitidos);
        } catch {
          modulosPermitidos = [];
        }
      } else if (u.modulos_permitidos && typeof u.modulos_permitidos === 'object') {
        // Se vier como objeto (já parseado pelo Postgres JSONB), usar direto
        modulosPermitidos = u.modulos_permitidos;
      }
      
      return {
        ...u,
        modulos_permitidos: modulosPermitidos,
        // Adicionar array de bares (usando auth_id como chave no mapa)
        bares_ids: baresMap[u.auth_id] || []
      };
    }) || [];

    return NextResponse.json({ success: true, usuarios: usuariosFormatados });
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});

// POST - Criar novo usuário
export const POST = requireAdmin(async (request, user) => {
  try {
    const supabase = await getAdminClient();
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('❌ Erro ao fazer parse do JSON:', jsonError);
      return NextResponse.json(
        { error: 'Dados JSON inválidos' },
        { status: 400 }
      );
    }
    
    const { email: emailBruto, nome, role, bar_id, bares_ids, modulos_permitidos, ativo = true, celular, telefone, cpf, data_nascimento, endereco, cep, cidade, estado } = body;

    // Email SEMPRE normalizado (lowercase+trim). O Supabase Auth guarda o email
    // minúsculo; se a tabela usuarios guardasse com maiúscula, o lookup por email
    // (redefinir-senha, .eq case-sensitive) não achava a linha e dava o enganoso
    // "Usuário sem vínculo de autenticação" no 1º acesso.
    const email = normalizeEmail(emailBruto || '');

    // Suportar tanto bar_id (legado) quanto bares_ids (novo)
    const baresParaAssociar: number[] = bares_ids 
      ? (Array.isArray(bares_ids) ? bares_ids.map((id: string | number) => Number(id)) : [Number(bares_ids)])
      : (bar_id ? [Number(bar_id)] : []);

    if (!email || !nome || !role || baresParaAssociar.length === 0) {
      return NextResponse.json(
        { error: 'Email, nome, role e pelo menos um bar são obrigatórios' },
        { status: 400 }
      );
    }

    // Garantir que modulos_permitidos seja um array
    const modulosArray = Array.isArray(modulos_permitidos) ? modulos_permitidos : [];

    // Senha temporária única (não mais fixa pra todos).
    const senhaTemporaria = gerarSenhaTemporaria();

    // 1. Primeiro criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: senhaTemporaria, // Senha temporária - usuário deve redefinir
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        nome,
        role,
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário no Auth:', authError);
      return NextResponse.json(
        { error: `Erro ao criar usuário: ${authError.message}` },
        { status: 400 }
      );
    }

    if (!authUser.user) {
      return NextResponse.json(
        { error: 'Falha ao criar usuário no sistema de autenticação' },
        { status: 500 }
      );
    }

    // 2. Criar registro na tabela usuarios
    const { data: usuario, error } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .insert({
        auth_id: authUser.user.id, // UUID do usuário criado no Auth
        email,
        nome,
        role,
        modulos_permitidos: modulosArray,
        ativo,
        telefone: celular || telefone || null,
        cpf: cpf || null,
        data_nascimento: data_nascimento || null,
        endereco: endereco || null,
        cep: cep || null,
        cidade: cidade || null,
        estado: estado || null,
        senha_redefinida: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Se falhar ao criar na tabela usuarios, remover usuário do Auth
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw error;
    }

    // 3. Criar relacionamentos na tabela usuarios_bares (múltiplos bares)
    const relacionamentos = baresParaAssociar.map(barId => ({
      usuario_id: usuario.auth_id, // auth_id do usuário (FK aponta para auth_id)
      bar_id: barId
    }));

    const { error: relError } = await supabase
      .schema('auth_custom')
      .from('usuarios_bares')
      .insert(relacionamentos);

    if (relError) {
      console.error('⚠️ Erro ao criar relacionamentos com bares:', relError);
      // Não falhar a operação por isso, pois o usuário já foi criado
    }

    // 4. Enviar email de boas-vindas — chamada DIRETA (sem fetch interno que
    //    dependia de NEXT_PUBLIC_APP_URL, que estava apontando pro domínio antigo).
    let emailSent = false;
    let emailErro: string | null = null;
    try {
      const r = await enviarEmailBoasVindas({
        to: email, nome, email, senha_temporaria: senhaTemporaria, role,
      });
      emailSent = r.success;
      if (!r.success) {
        emailErro = r.error;
        console.warn('⚠️ Email de boas-vindas falhou:', r.error);
      }
    } catch (emailError: any) {
      emailErro = emailError?.message || 'erro';
      console.warn('⚠️ Erro ao enviar email de boas-vindas:', emailError);
    }

    return NextResponse.json({
      success: true,
      usuario: { ...usuario, bares_ids: baresParaAssociar },
      message: emailSent
        ? 'Usuário criado! Email com as credenciais foi enviado.'
        : `Usuário criado! ⚠️ Email não enviado (${emailErro || 'erro'}). Repasse as credenciais abaixo.`,
      emailSent,
      credentials: emailSent ? undefined : {
        email,
        senha_temporaria: senhaTemporaria,
        message: 'Como o email não foi enviado, repasse estas credenciais:',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});

// PUT - Atualizar usuário
export const PUT = requireAdmin(async (request, user) => {
  try {
    const supabase = await getAdminClient();
    const body = await request.json();
    const { id, email: emailBruto, nome, role, bar_id, bares_ids, modulos_permitidos, ativo, celular, telefone, cpf, data_nascimento, endereco, cep, cidade, estado, senha_redefinida } = body;
    // Normalizar email no update também (mesma razão do POST).
    const email = emailBruto ? normalizeEmail(emailBruto) : emailBruto;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // Suportar tanto bar_id (legado) quanto bares_ids (novo)
    const baresParaAssociar: number[] = bares_ids 
      ? (Array.isArray(bares_ids) ? bares_ids.map((bid: string | number) => Number(bid)) : [Number(bares_ids)])
      : (bar_id ? [Number(bar_id)] : []);

    // Garantir que modulos_permitidos seja um array
    const modulosArray = Array.isArray(modulos_permitidos) ? modulos_permitidos : [];

    // 1. Buscar auth_id atual para atualizar Auth
    const { data: currentUser, error: fetchError } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .select('auth_id, email')
      .eq('id', id)
      .single();

    if (fetchError || !currentUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // 2. Atualizar Supabase Auth (se houver auth_id)
    if (currentUser.auth_id) {
      try {
        const authUpdates: Record<string, unknown> = {
          user_metadata: {
            nome,
            role,
          }
        };

        // Se o email mudou, atualizar também
        if (email && email !== currentUser.email) {
          authUpdates.email = email;
        }

        const { error: authError } = await supabase.auth.admin.updateUserById(
          currentUser.auth_id,
          authUpdates
        );

        if (authError) {
          console.warn('⚠️ Erro ao atualizar Auth (continuando):', authError.message);
        }
      } catch (authUpdateError) {
        console.warn('⚠️ Erro ao atualizar Auth:', authUpdateError);
      }
    }

    // 3. Atualizar tabela usuarios
    const updateData: Record<string, unknown> = {
      email,
      nome,
      role,
      modulos_permitidos: modulosArray,
      ativo,
      telefone: celular || telefone || null,
      cpf: cpf || null,
      data_nascimento: data_nascimento || null,
      endereco: endereco || null,
      cep: cep || null,
      cidade: cidade || null,
      estado: estado || null,
      updated_at: new Date().toISOString(),
    };

    // Se senha_redefinida foi enviado explicitamente, incluir na atualização
    if (typeof senha_redefinida === 'boolean') {
      updateData.senha_redefinida = senha_redefinida;
    }

    const { data: usuario, error } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Permissões/role podem ter mudado → força o usuário a relogar (corte por usuário) pra o novo
    // token trazer as perms frescas em todo lugar (front + middleware). O guard do backend já é
    // fresco (relê do banco), mas isso mantém front/token consistentes na hora. Best-effort.
    try {
      await (supabase as any).schema('system').from('user_token_cutoff')
        .upsert({ email: String(email).toLowerCase(), min_iat: Math.floor(Date.now() / 1000), updated_at: new Date().toISOString() }, { onConflict: 'email' });
    } catch { /* noop */ }

    // 4. Atualizar relacionamentos na tabela usuarios_bares
    //    IMPORTANTE: usuarios_bares.usuario_id referencia o auth_id (auth.users.id),
    //    NAO o public.usuarios.id. Usar o id errado aqui deixava o usuario sem vinculo
    //    de bar ao editar -> login nao acha bar -> sem acesso (loop/bounce).
    if (baresParaAssociar.length > 0 && currentUser.auth_id) {
      // Remover relacionamentos antigos
      const { error: deleteError } = await supabase
      .schema('auth_custom')
      .from('usuarios_bares')
        .delete()
        .eq('usuario_id', currentUser.auth_id);

      if (deleteError) {
        console.error('⚠️ Erro ao remover relacionamentos antigos:', deleteError);
      }

      // Inserir novos relacionamentos
      const relacionamentos = baresParaAssociar.map(barId => ({
        usuario_id: currentUser.auth_id,
        bar_id: barId
      }));

      const { error: insertError } = await supabase
      .schema('auth_custom')
      .from('usuarios_bares')
        .insert(relacionamentos);

      if (insertError) {
        console.error('⚠️ Erro ao criar novos relacionamentos:', insertError);
      }
    }

    return NextResponse.json({ 
      success: true,
      usuario: { ...usuario, bares_ids: baresParaAssociar }, 
      message: 'Usuário atualizado com sucesso',
      auth_updated: !!currentUser.auth_id 
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});

// DELETE - Deletar usuário (exclusão completa)
export const DELETE = requireAdmin(async (request, user) => {
  try {
    const supabase = await getAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // 1. Buscar dados do usuário para obter o auth_id do Auth
    const { data: usuario, error: fetchError } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .select('auth_id, email, nome')
      .eq('id', id)
      .single();

    if (fetchError || !usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // 2. Excluir da tabela usuarios
    const { error: deleteTableError } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .delete()
      .eq('id', id);

    if (deleteTableError) {
      console.error('❌ Erro ao excluir da tabela usuarios:', deleteTableError);
      throw deleteTableError;
    }

    // 3. Excluir do Supabase Auth (se auth_id existir)
    if (usuario.auth_id) {
      try {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(usuario.auth_id);
        
        if (authDeleteError) {
          console.warn('⚠️ Erro ao excluir do Auth (usuário pode já ter sido removido):', authDeleteError.message);
        }
      } catch (authError) {
        console.warn('⚠️ Erro na exclusão do Auth:', authError);
        // Não falhar a operação se o Auth der erro
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Usuário ${usuario.nome} (${usuario.email}) foi excluído completamente do sistema`
    });

  } catch (error) {
    console.error('❌ Erro ao excluir usuário:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});
