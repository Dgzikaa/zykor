import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TIPOS_OK = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX = 10 * 1024 * 1024; // 10MB

/**
 * Upload de imagem pra anexar numa mensagem de chamado (print da tela, foto). Vai pro bucket
 * `uploads` em chamados/<bar_id>/… e devolve a URL pública — que o cliente manda no POST da
 * mensagem (campo `anexos`). Só imagem.
 */
export const POST = withAuth(async ({ user, request }) => {
  let form: FormData;
  try { form = await request.formData(); } catch { return fail('Envie o arquivo como multipart/form-data', 400); }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Arquivo ausente', 400);
  if (!TIPOS_OK.includes(file.type)) return fail('Só imagem (jpg, png, webp, gif)', 415);
  if (file.size > MAX) return fail('Imagem muito grande (máx. 10MB)', 413);

  const supabase = await getAdminClient();
  const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-60) || 'print.png';
  const nome = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safe}`;
  const path = `chamados/${user.bar_id ?? 0}/${nome}`;

  const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type,
  });
  if (upErr) return fail(upErr.message || 'Falha no upload', 500);

  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
  return success({ url: urlData.publicUrl, nome: file.name, tipo: file.type });
});
