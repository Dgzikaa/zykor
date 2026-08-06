import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { BUCKET_ARQUIVOS, ARQUIVO_MARCADOR, nomePastaSeguro } from '@/lib/arquivos/midias';

export const dynamic = 'force-dynamic';

/**
 * Arquivos do bar (tela Ferramentas → Arquivos).
 *
 * Não há tabela espelho: o Storage é a fonte da verdade. Uma tabela paralela só criaria
 * divergência (arquivo apagado no painel e linha viva no banco, ou vice-versa).
 *
 * Caminho no bucket: `bar_id/pasta/arquivo` — o bar_id vem SEMPRE do usuário autenticado,
 * nunca do corpo/query. É o que impede um bar de ler ou apagar a pasta do outro.
 */

/** Uma pasta "vazia" existe por causa do marcador; ele nunca aparece na tela. */
const ehMarcador = (nome: string) => nome === ARQUIVO_MARCADOR;

// GET ?pasta=  → sem pasta: lista as pastas do bar. Com pasta: lista os arquivos dela.
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const pastaBruta = new URL(request.url).searchParams.get('pasta') || '';
  const pasta = pastaBruta ? nomePastaSeguro(pastaBruta) : '';
  const supabase = await getAdminClient();
  const raiz = `${user.bar_id}`;
  const prefixo = pasta ? `${raiz}/${pasta}` : raiz;

  const { data, error } = await supabase.storage.from(BUCKET_ARQUIVOS).list(prefixo, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const itens = data || [];

  if (!pasta) {
    // Na raiz o Storage devolve as "pastas" como entradas sem metadata.
    const pastas = itens.filter((i) => !i.metadata).map((i) => i.name);
    const contagens = await Promise.all(
      pastas.map(async (nome) => {
        const { data: dentro } = await supabase.storage.from(BUCKET_ARQUIVOS).list(`${raiz}/${nome}`, { limit: 1000 });
        const arquivos = (dentro || []).filter((a) => a.metadata && !ehMarcador(a.name));
        return {
          nome,
          arquivos: arquivos.length,
          bytes: arquivos.reduce((s, a) => s + Number((a.metadata as { size?: number })?.size || 0), 0),
        };
      }),
    );
    return NextResponse.json({ pastas: contagens, arquivos: [] });
  }

  const arquivos = itens.filter((i) => i.metadata && !ehMarcador(i.name));
  // URL assinada de 1h: o bucket é privado de propósito (material de terceiros), então a tela
  // recebe um link temporário em vez de um endereço eterno que vaza se for repassado.
  const caminhos = arquivos.map((a) => `${prefixo}/${a.name}`);
  const { data: assinadas } = caminhos.length
    ? await supabase.storage.from(BUCKET_ARQUIVOS).createSignedUrls(caminhos, 3600)
    : { data: [] as { path?: string | null; signedUrl: string }[] };
  const urlPorCaminho = new Map((assinadas || []).map((s) => [s.path || '', s.signedUrl]));

  return NextResponse.json({
    pastas: [],
    arquivos: arquivos.map((a) => {
      const meta = (a.metadata || {}) as { size?: number; mimetype?: string };
      return {
        nome: a.name,
        caminho: `${prefixo}/${a.name}`,
        bytes: Number(meta.size || 0),
        mime: meta.mimetype || null,
        atualizado_em: a.updated_at || a.created_at || null,
        url: urlPorCaminho.get(`${prefixo}/${a.name}`) || null,
      };
    }),
  });
}

// DELETE ?caminho=  → apaga um arquivo. ?pasta= apaga a pasta inteira (com o que tiver dentro).
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const supabase = await getAdminClient();
  const raiz = `${user.bar_id}/`;

  const caminho = sp.get('caminho');
  if (caminho) {
    // Anti-IDOR: só apaga dentro da pasta do próprio bar, mesmo que mandem outro caminho.
    if (!caminho.startsWith(raiz)) {
      return NextResponse.json({ error: 'Caminho fora do bar' }, { status: 403 });
    }
    const { error } = await supabase.storage.from(BUCKET_ARQUIVOS).remove([caminho]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const pasta = nomePastaSeguro(sp.get('pasta') || '');
  if (!pasta) return NextResponse.json({ error: 'Informe caminho ou pasta' }, { status: 400 });
  const { data: dentro } = await supabase.storage.from(BUCKET_ARQUIVOS).list(`${raiz}${pasta}`, { limit: 1000 });
  const alvos = (dentro || []).map((a) => `${raiz}${pasta}/${a.name}`);
  if (alvos.length) {
    const { error } = await supabase.storage.from(BUCKET_ARQUIVOS).remove(alvos);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, apagados: alvos.length });
}
