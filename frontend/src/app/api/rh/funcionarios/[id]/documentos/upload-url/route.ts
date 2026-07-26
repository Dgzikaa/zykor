import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { BUCKET_DOCS_RH, mimeDoArquivo, nomeSeguro, validaDocumento } from '@/lib/rh/documentos';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * POST -> devolve URL assinada pro browser subir o documento DIRETO no Storage.
 *
 * O arquivo não trafega pela função da Vercel (teto de ~4,5 MB no corpo da requisição, que
 * PDF escaneado de várias páginas estoura). Aqui só validamos escopo/tipo/tamanho e assinamos
 * o destino; a linha na tabela é gravada depois pelo POST /documentos (JSON).
 *
 * Body: { nome_arquivo, mime?, tamanho_bytes }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();
  const { data: func } = await supabase.schema('hr').from('funcionarios')
    .select('id').eq('id', Number(id)).eq('bar_id', user.bar_id).maybeSingle();
  if (!func) return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });

  const body = await request.json().catch(() => ({} as any));
  const nome = String(body?.nome_arquivo || '');
  const bytes = Number(body?.tamanho_bytes || 0);
  const erro = validaDocumento(nome, body?.mime || null, bytes);
  if (erro) return NextResponse.json({ success: false, error: erro }, { status: 400 });

  const path = `${user.bar_id}/${id}/${Date.now()}_${nomeSeguro(nome)}`;
  const { data, error } = await supabase.storage.from(BUCKET_DOCS_RH).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ success: false, error: 'Falha ao preparar upload: ' + (error?.message || 'sem token') }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    bucket: BUCKET_DOCS_RH,
    path: data.path,
    token: data.token,
    mime: mimeDoArquivo(nome, body?.mime || null),
  });
}
