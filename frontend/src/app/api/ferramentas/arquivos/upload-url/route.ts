import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import {
  BUCKET_ARQUIVOS, mimeDoArquivo, nomeArquivoSeguro, nomePastaSeguro, validaArquivo,
} from '@/lib/arquivos/midias';

export const dynamic = 'force-dynamic';

/**
 * POST { pasta, nome_arquivo, mime?, tamanho_bytes } → URL assinada pro browser subir DIRETO
 * no Storage.
 *
 * O arquivo não passa pela função da Vercel: o corpo de requisição lá tem teto de ~4,5 MB e a
 * requisição morre na borda, ANTES da função rodar (sem log nenhum, o front só vê "falhou").
 * Foto de presskit passa fácil disso. Aqui só validamos escopo/tipo/tamanho e assinamos o destino.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const pasta = nomePastaSeguro(String(body?.pasta || ''));
  if (!pasta) return NextResponse.json({ error: 'Escolha uma pasta antes de enviar.' }, { status: 400 });

  const nome = String(body?.nome_arquivo || '');
  const bytes = Number(body?.tamanho_bytes || 0);
  const erro = validaArquivo(nome, body?.mime || null, bytes);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  const supabase = await getAdminClient();
  // Timestamp no nome evita que subir duas fotos com o mesmo nome sobrescreva a primeira.
  const caminho = `${user.bar_id}/${pasta}/${Date.now()}_${nomeArquivoSeguro(nome)}`;
  const { data, error } = await supabase.storage.from(BUCKET_ARQUIVOS).createSignedUploadUrl(caminho);
  if (error || !data) {
    return NextResponse.json({ error: 'Falha ao preparar upload: ' + (error?.message || 'sem token') }, { status: 500 });
  }

  return NextResponse.json({
    bucket: BUCKET_ARQUIVOS,
    path: data.path,
    token: data.token,
    mime: mimeDoArquivo(nome, body?.mime || null),
  });
}
