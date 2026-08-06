import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { BUCKET_ARQUIVOS, ARQUIVO_MARCADOR, nomePastaSeguro } from '@/lib/arquivos/midias';

export const dynamic = 'force-dynamic';

/**
 * POST { nome } — cria uma pasta do bar.
 *
 * O Supabase Storage não tem diretório de verdade (pasta é prefixo do caminho), então uma pasta
 * vazia só "existe" se houver algum objeto dentro. Gravamos um marcador de 0 byte; a listagem
 * esconde ele.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const nome = nomePastaSeguro(String(body?.nome || ''));
  if (!nome) {
    return NextResponse.json({ error: 'Nome de pasta inválido. Use letras, números, espaço ou hífen.' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const caminho = `${user.bar_id}/${nome}/${ARQUIVO_MARCADOR}`;

  const { data: ja } = await supabase.storage.from(BUCKET_ARQUIVOS).list(`${user.bar_id}/${nome}`, { limit: 1 });
  if ((ja || []).length > 0) {
    return NextResponse.json({ error: `A pasta "${nome}" já existe.` }, { status: 409 });
  }

  // text/plain porque o bucket só aceita mime de lista branca (imagem/PDF/ZIP + este);
  // octet-stream seria recusado pelo próprio Storage.
  const { error } = await supabase.storage.from(BUCKET_ARQUIVOS).upload(caminho, new Blob([]), {
    contentType: 'text/plain',
    upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, pasta: nome });
}
