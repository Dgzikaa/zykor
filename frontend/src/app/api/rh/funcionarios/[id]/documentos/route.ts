import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const BUCKET = 'rh-documentos';

// Mime por extensão — celular/scanner às vezes manda o arquivo SEM content-type (o browser
// deixa file.type vazio), e o bucket rejeitava o fallback 'octet-stream'. Aqui inferimos pela
// extensão pra o arquivo subir com o tipo certo (e abrir/baixar corretamente depois).
const MIME_POR_EXT: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
  bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
};

// Garante que o funcionário existe e é do bar do usuário (escopo + LGPD).
async function checaFuncionario(supabase: any, id: number, barId: number) {
  const { data } = await supabase.schema('hr').from('funcionarios').select('id').eq('id', id).eq('bar_id', barId).maybeSingle();
  return !!data;
}

/** GET -> lista documentos do funcionário com URL assinada (1h). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }

  const { data: docs, error } = await (supabase as any).schema('hr').from('documentos_funcionario')
    .select('*').eq('funcionario_id', Number(id)).order('criado_em', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const documentos = await Promise.all((docs || []).map(async (d: any) => {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600);
    return {
      id: d.id, tipo: d.tipo, descricao: d.descricao, nome_arquivo: d.nome_arquivo,
      mime: d.mime, tamanho_bytes: d.tamanho_bytes, validade: d.validade, criado_em: d.criado_em,
      url: signed?.signedUrl || null,
    };
  }));
  return NextResponse.json({ success: true, documentos });
}

/** POST -> upload de documento (FormData: file, tipo, descricao?, validade?). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const tipo = (form.get('tipo') as string) || 'outro';
  const descricao = (form.get('descricao') as string) || null;
  const validade = (form.get('validade') as string) || null;
  if (!file) return NextResponse.json({ success: false, error: 'Arquivo obrigatório' }, { status: 400 });

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${user.bar_id}/${id}/${Date.now()}_${safeName}`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const contentType = file.type || MIME_POR_EXT[ext] || 'application/octet-stream';

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType, upsert: false,
  });
  if (upErr) {
    // O bucket restringe tipo/tamanho — devolve mensagem legível pra quem está fotografando o doc.
    const msg = /mime|content.?type|not allowed/i.test(upErr.message)
      ? `Tipo de arquivo não aceito (${contentType}). Envie PDF ou foto (JPG/PNG/HEIC).`
      : /size|large|exceeded/i.test(upErr.message)
      ? 'Arquivo muito grande (máx. 15 MB).'
      : 'Falha no upload: ' + upErr.message;
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }

  const { data, error } = await (supabase as any).schema('hr').from('documentos_funcionario').insert({
    funcionario_id: Number(id), tipo, descricao, storage_path: path,
    nome_arquivo: file.name, mime: contentType, tamanho_bytes: file.size,
    validade: validade || null, uploaded_by: user.id,
  }).select().single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]); // rollback do arquivo se a linha falhar
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, documento: data }, { status: 201 });
}

/** DELETE ?doc_id= -> remove arquivo + linha. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const docId = new URL(request.url).searchParams.get('doc_id');
  if (!docId) return NextResponse.json({ success: false, error: 'doc_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }

  const { data: doc } = await (supabase as any).schema('hr').from('documentos_funcionario')
    .select('storage_path').eq('id', docId).eq('funcionario_id', Number(id)).maybeSingle();
  if (doc?.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await (supabase as any).schema('hr').from('documentos_funcionario').delete().eq('id', docId).eq('funcionario_id', Number(id));
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
