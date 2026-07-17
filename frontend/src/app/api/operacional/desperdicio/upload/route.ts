import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Upload de foto do desperdício → Supabase Storage.
 * Bucket 'uploads', pasta 'desperdicio/{bar_id}/{yyyymm}/'. Retorna { url, storage_path }
 * pra tela persistir junto do resto do registro no /api/operacional/desperdicio (POST).
 */

const MAX_SIZE = 10 * 1024 * 1024; // 10MB — imagens comprimidas no cliente cabem folgado
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);
  const bar_id = user.bar_id;
  if (!bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ success: false, error: 'arquivo obrigatório' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ success: false, error: `tipo não permitido: ${file.type}` }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ success: false, error: `arquivo excede ${MAX_SIZE / 1024 / 1024}MB` }, { status: 400 });

  const supabase = await getAdminClient();
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 10);
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storage_path = `desperdicio/${bar_id}/${yyyymm}/${Date.now()}_${rand}_${safeName}`;

  const { error: errUp } = await supabase.storage.from('uploads').upload(storage_path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type,
  });
  if (errUp) return NextResponse.json({ success: false, error: errUp.message || 'falha no upload' }, { status: 500 });

  const { data: pub } = supabase.storage.from('uploads').getPublicUrl(storage_path);

  return NextResponse.json({
    success: true,
    url: pub.publicUrl,
    storage_path,
    size_bytes: file.size,
    mime: file.type,
  });
}

/** Remove uma foto do Storage (útil quando cancela o registro no meio). */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;

  const storage_path = new URL(request.url).searchParams.get('storage_path') || '';
  if (!storage_path.startsWith(`desperdicio/${user.bar_id}/`)) {
    return NextResponse.json({ success: false, error: 'path fora do escopo do bar' }, { status: 400 });
  }
  const supabase = await getAdminClient();
  const { error } = await supabase.storage.from('uploads').remove([storage_path]);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
