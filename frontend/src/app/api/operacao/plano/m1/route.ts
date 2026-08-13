import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { sincronizarM1 } from '@/lib/operacao/m1';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// =====================================================
// POST /api/operacao/plano/m1  { de, ate }
//
// Puxa o faturamento do M1 do planejamento comercial para o período e roda a cadeia
// por cima. É explícito (botão na tela) e não automático na leitura porque GET não
// escreve — e porque o M1 do comercial muda, e a operação precisa ver quando mudou.
//
// Dia com faturamento digitado não muda: o manual continua ganhando do M1.
// =====================================================
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const de = String(body.de || '');
  const ate = String(body.ate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    return NextResponse.json({ error: 'Informe de e ate (AAAA-MM-DD)' }, { status: 400 });
  }

  try {
    const r = await sincronizarM1(sb(), user.bar_id, de, ate);
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Falhou ao puxar o M1' }, { status: 500 });
  }
}
