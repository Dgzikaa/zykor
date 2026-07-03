import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

interface ItemResposta {
  item_chave?: string;
  nota?: number;
  texto?: string;
}

/** Salva as respostas do usuário e marca a pesquisa como respondida (1x por usuário). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const body = await request.json().catch(() => null);
  const pesquisaId = Number(body?.pesquisa_id);
  const respostas: ItemResposta[] = Array.isArray(body?.respostas) ? body.respostas : [];
  if (!pesquisaId) {
    return NextResponse.json({ success: false, error: 'pesquisa_id obrigatório' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const agora = new Date().toISOString();

  const { data: row, error } = await supabase
    .schema('feedback')
    .from('respostas')
    .upsert(
      {
        pesquisa_id: pesquisaId,
        email: user.email,
        usuario_id: user.auth_id ?? null,
        bar_id: user.bar_id ?? null,
        status: 'respondida',
        respondida_em: agora,
        updated_at: agora,
      },
      { onConflict: 'pesquisa_id,email' }
    )
    .select('id')
    .single();

  if (error || !row) {
    return NextResponse.json({ success: false, error: 'Falha ao salvar resposta' }, { status: 500 });
  }

  // Regrava os itens (idempotente — permite reenvio sem duplicar)
  await supabase.schema('feedback').from('respostas_itens').delete().eq('resposta_id', row.id);

  const itens = respostas
    .filter((r) => r && typeof r.item_chave === 'string')
    .map((r) => ({
      resposta_id: row.id,
      item_chave: r.item_chave as string,
      nota: typeof r.nota === 'number' && r.nota >= 1 && r.nota <= 10 ? Math.round(r.nota) : null,
      texto: typeof r.texto === 'string' && r.texto.trim() ? r.texto.trim().slice(0, 2000) : null,
    }))
    .filter((r) => r.nota != null || r.texto != null);

  if (itens.length) {
    await supabase.schema('feedback').from('respostas_itens').insert(itens);
  }

  return NextResponse.json({ success: true });
}
