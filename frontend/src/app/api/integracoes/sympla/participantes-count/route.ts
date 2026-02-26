import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const eventosIds = ['s322f32', 's322f39', 's322f46', 's322f4f', 's322f58'];
    const counts: Record<string, number> = {};

    // Buscar contagem para cada evento usando COUNT agregado (mais eficiente)
    for (const eventoId of eventosIds) {
      const { count, error } = await supabase
        .from('sympla_participantes')
        .select('*', { count: 'exact', head: true })
        .eq('bar_id', 3)
        .eq('evento_sympla_id', eventoId);

      if (error) {
        console.error(`Erro ao buscar participantes do evento ${eventoId}:`, error);
        counts[eventoId] = 0;
      } else {
        counts[eventoId] = count || 0;
      }
    }

    return NextResponse.json({ counts });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({ counts: {} });
  }
}
