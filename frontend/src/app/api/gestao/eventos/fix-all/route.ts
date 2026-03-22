import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

// Event name mappings to fix encoding issues
const eventMappings = [
  // February 2025
  {
    originalPattern: /Sertanejada com ARNO SANTANA \*OPEN BAR\*/i,
    name: 'Sertanejada com ARNO SANTANA OPEN BAR',
    date: '2025-02-01',
  },
];

export async function POST() {
  try {
    // Inicializar cliente Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    let totalFixed = 0;
    const errors: string[] = [];

    // Fix each mapping
    for (const mapping of eventMappings) {
      try {
        const { error } = await supabase
          .from('eventos_base')
          .update({ nome_evento: mapping.name })
          .eq('bar_id', 1)
          .ilike('nome_evento', `%${mapping.originalPattern.source}%`);

        if (error) {
          errors.push(`Error fixing ${mapping.name}: ${error.message}`);
        } else {
          totalFixed++;
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push(`Exception fixing ${mapping.name}: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      success: true,
      totalFixed,
      errors: errors.length > 0 ? errors : null,
      message: `Fixed ${totalFixed} event names successfully`,
    });
  } catch (error: unknown) {
    console.error('? Error in fix-all endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
