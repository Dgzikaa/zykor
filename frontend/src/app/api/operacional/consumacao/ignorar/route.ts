import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// Marca (POST) ou desmarca (DELETE) uma linha de consumação como "ignorada". A linha
// é identificada pela chave_hash gerada em /api/operacional/consumacao (MD5 de campos
// que caracterizam a linha). Ignoradas não entram no resumo/totais do controle.

interface Body {
  chaves?: string[];
  motivo?: string;
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Body;
  // dedup: quando a mesa agrupa vários lançamentos e dois deles têm produto/valor/qtd/
  // motivo idênticos, o hash colide (intencional — linhas 100% iguais somem juntas).
  // Sem o Set, o upsert dispara "ON CONFLICT DO UPDATE cannot affect row a second time"
  // porque tenta atualizar a mesma (bar_id, chave_hash) 2× no mesmo comando.
  const chaves = Array.from(
    new Set((body.chaves || []).filter((c) => typeof c === 'string' && c.length > 0)),
  );
  if (chaves.length === 0) {
    return NextResponse.json({ success: false, error: 'chaves é obrigatório' }, { status: 400 });
  }

  const rows = chaves.map((c) => ({
    bar_id: Number(user.bar_id),
    chave_hash: c,
    motivo: body.motivo || null,
    criado_por: user.id ?? null,
  }));

  const { error } = await (supabase as any)
    .schema('financial')
    .from('consumo_ignorados')
    .upsert(rows, { onConflict: 'bar_id,chave_hash' });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ignoradas: chaves.length });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const chavesParam = sp.get('chaves');
  const chaves = Array.from(new Set((chavesParam || '').split(',').map((s) => s.trim()).filter(Boolean)));
  if (chaves.length === 0) {
    return NextResponse.json({ success: false, error: 'chaves é obrigatório' }, { status: 400 });
  }

  const { error } = await (supabase as any)
    .schema('financial')
    .from('consumo_ignorados')
    .delete()
    .eq('bar_id', Number(user.bar_id))
    .in('chave_hash', chaves);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, restauradas: chaves.length });
}
