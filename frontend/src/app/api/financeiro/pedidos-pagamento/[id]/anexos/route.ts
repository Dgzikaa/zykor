import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { fin, podeAprovar } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// Aceita imagem (foto da nota/cupom) E PDF (boleto/nota fiscal) — diferente do
// upload de checklist que só aceita imagem.
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
];
const BUCKET = 'uploads';
const FOLDER = 'pagamentos/anexos';

// POST — upload de anexo (multipart/form-data, campo "file")
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);
  const { id } = await params;

  const supabase = await getAdminClient();
  const { data: pedido } = await fin(supabase)
    .from('pedidos_pagamento')
    .select('id, bar_id, solicitante_id')
    .eq('id', id)
    .maybeSingle();

  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }
  if (!podeAprovar(user) && pedido.solicitante_id !== user.auth_id) {
    return permissionErrorResponse('Sem acesso a este pedido');
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: `Tipo não permitido. Aceitos: imagem ou PDF.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: `Arquivo muito grande (máx ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeName}`;
  const fullPath = `${FOLDER}/${user.bar_id}/${id}/${unique}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, file, { cacheControl: '3600', upsert: false, contentType: file.type });

  if (upErr) {
    console.error('[PEDIDOS-PAG][ANEXO] upload', upErr);
    return NextResponse.json({ success: false, error: 'Falha no upload' }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);

  const { data: anexo, error: dbErr } = await fin(supabase)
    .from('pedidos_pagamento_anexos')
    .insert({
      pedido_id: id,
      bar_id: pedido.bar_id,
      nome_original: file.name,
      tipo_arquivo: file.type,
      tamanho_bytes: file.size,
      caminho_storage: fullPath,
      url_publica: urlData.publicUrl,
      uploadado_por: user.auth_id,
    })
    .select()
    .single();

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([fullPath]).catch(() => {});
    console.error('[PEDIDOS-PAG][ANEXO] db', dbErr);
    return NextResponse.json({ success: false, error: 'Falha ao salvar anexo' }, { status: 500 });
  }

  return NextResponse.json({ success: true, anexo });
}

// DELETE — remove anexo (?anexo_id=)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const { id } = await params;
  const anexoId = new URL(request.url).searchParams.get('anexo_id');
  if (!anexoId) {
    return NextResponse.json({ success: false, error: 'anexo_id é obrigatório' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data: anexo } = await fin(supabase)
    .from('pedidos_pagamento_anexos')
    .select('*')
    .eq('id', anexoId)
    .eq('pedido_id', id)
    .maybeSingle();

  if (!anexo || anexo.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Anexo não encontrado' }, { status: 404 });
  }
  // Só quem subiu ou o financeiro remove.
  if (anexo.uploadado_por !== user.auth_id && !podeAprovar(user)) {
    return permissionErrorResponse('Sem permissão para remover este anexo');
  }

  await supabase.storage.from(BUCKET).remove([anexo.caminho_storage]).catch(() => {});
  const { error } = await fin(supabase).from('pedidos_pagamento_anexos').delete().eq('id', anexoId);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
