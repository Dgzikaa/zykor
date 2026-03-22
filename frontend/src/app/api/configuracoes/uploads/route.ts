import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  authenticateUser,
  authErrorResponse,
  permissionErrorResponse,
} from '@/middleware/auth';

export const dynamic = 'force-dynamic'

// =====================================================
// CONFIGURAÇÕES DE UPLOAD
// =====================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
];

const FOLDERS = {
  checklist_photos: 'checklists/photos',
  signatures: 'checklists/signatures',
  profile_photos: 'usuarios/profiles',
};

// =====================================================
// FUNÇÃO DE COMPRESSÃO DE IMAGEM
// =====================================================

// Função compressImage removida - não utilizada

// =====================================================
// VALIDAÇÕES
// =====================================================

function validateFile(file: File): { valid: boolean; error?: string } {
  // Verificar tipo de arquivo
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido. Aceitos: ${ALLOWED_TYPES.join(', ')}`,
    };
  }

  // Verificar tamanho
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

// =====================================================
// POST - UPLOAD DE ARQUIVO
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    // Verificar se tem permissão para uploads
    if (!user.ativo) {
      return permissionErrorResponse('Usuário inativo');
    }

    // Parsear FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string;
    const compress = formData.get('compress') === 'true';
    const maxWidth = parseInt(formData.get('maxWidth') as string) || 1920;
    const quality = parseFloat(formData.get('quality') as string) || 0.8;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhum arquivo fornecido',
        },
        { status: 400 }
      );
    }

    // Validar arquivo
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // Validar pasta
    if (!folder || !FOLDERS[folder as keyof typeof FOLDERS]) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pasta de destino inválida',
        },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Preparar arquivo para upload
    const fileToUpload: File | Blob = file;
    let finalFileName = file.name;

    // Comprimir se solicitado e for imagem
    if (compress && file.type.startsWith('image/')) {
      try {
        // Nota: compressão seria feita no frontend, aqui só validamos
      } catch (error: any) {
        console.warn('⚠️ Erro na compressão, usando arquivo original:', error);
      }
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    finalFileName = `${timestamp}_${randomId}_${safeName}`;

    // Caminho completo no storage
    const folderPath = FOLDERS[folder as keyof typeof FOLDERS];
    const fullPath = `${folderPath}/${user.bar_id}/${finalFileName}`;

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads') // bucket name
      .upload(fullPath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError);
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao fazer upload do arquivo',
        },
        { status: 500 }
      );
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(fullPath);

    // Salvar metadados no banco
    const { data: anexo, error: dbError } = await supabase
      .from('checklist_anexos')
      .insert({
        nome_arquivo: finalFileName,
        nome_original: file.name,
        tipo_arquivo: file.type,
        tamanho_bytes: file.size,
        caminho_storage: fullPath,
        url_publica: urlData.publicUrl,
        pasta: folder,
        uploadado_por: user.auth_id,
        bar_id: user.bar_id,
        metadados: {
          compressed: compress,
          maxWidth: compress ? maxWidth : null,
          quality: compress ? quality : null,
          originalSize: file.size,
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Erro ao salvar metadados:', dbError);

      // Tentar limpar arquivo do storage se o DB falhou
      await supabase.storage
        .from('uploads')
        .remove([fullPath])
        .catch(console.error);

      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao salvar informações do arquivo',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Upload realizado com sucesso',
      data: {
        id: anexo.id,
        filename: finalFileName,
        originalName: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
        folder: folder,
        compressed: compress,
      },
    });
  } catch (error: unknown) {
    console.error('❌ Erro na API de upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// GET - LISTAR UPLOADS DO USUÁRIO
// =====================================================
export async function GET(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = await getAdminClient();

    // Construir query
    let query = supabase
      .from('checklist_anexos')
      .select('*')
      .eq('bar_id', user.bar_id)
      .order('criado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por pasta se especificada
    if (folder) {
      query = query.eq('pasta', folder);
    }

    const { data: anexos, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar uploads:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao buscar arquivos',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: anexos || [],
      pagination: {
        offset,
        limit,
        total: count,
      },
    });
  } catch (error: unknown) {
    console.error('❌ Erro na API de listagem:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - REMOVER ARQUIVO
// =====================================================
export async function DELETE(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID do arquivo é obrigatório',
        },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Buscar arquivo (verificar se pertence ao bar do usuário)
    const { data: anexo, error: fetchError } = await supabase
      .from('checklist_anexos')
      .select('*')
      .eq('id', fileId)
      .eq('bar_id', user.bar_id)
      .single();

    if (fetchError || !anexo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Arquivo não encontrado ou sem permissão',
        },
        { status: 404 }
      );
    }

    // Verificar se pode deletar (só quem fez upload ou admin)
    if (anexo.uploadado_por !== user.auth_id && user.role !== 'admin') {
      return permissionErrorResponse('Sem permissão para deletar este arquivo');
    }

    // Remover do storage
    const { error: storageError } = await supabase.storage
      .from('uploads')
      .remove([anexo.caminho_storage]);

    if (storageError) {
      console.warn('⚠️ Erro ao remover do storage:', storageError);
      // Continuar mesmo com erro no storage
    }

    // Remover do banco
    const { error: dbError } = await supabase
      .from('checklist_anexos')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      console.error('❌ Erro ao remover do banco:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao remover arquivo',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Arquivo removido com sucesso',
    });
  } catch (error: unknown) {
    console.error('❌ Erro na remoção de arquivo:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
