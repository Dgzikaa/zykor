import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

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

    // Simple test: Update just a few specific events
    const updates = [
      { date: '2025-06-01', name: 'Samba da tia Zelia' },
      { date: '2025-06-02', name: 'Jet - Segunda da Resenha' },
      { date: '2025-06-04', name: 'Quarta de Bamba' },
      { date: '2025-06-06', name: 'Pagode Vira-Lata' },
      { date: '2025-06-09', name: 'Jet - Segunda da Resenha' },
      { date: '2025-06-11', name: 'Quarta de Bamba' },
    ];

    let successCount = 0;
    const results: Array<{
      date: string;
      status: string;
      error?: string;
      rowsAffected?: number;
    }> = [];

    for (const update of updates) {
      const { data, error } = await supabase
        .from('eventos_base')
        .update({ nome_evento: update.name })
        .eq('bar_id', 1)
        .eq('data_evento', update.date)
        .select();

      if (error) {
        console.error(`Error updating ${update.date}:`, error);
        results.push({
          date: update.date,
          status: 'error',
          error: error.message,
        });
      } else {
        successCount++;
        results.push({
          date: update.date,
          status: 'success',
          rowsAffected: data?.length || 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${successCount} out of ${updates.length} events`,
      successCount,
      totalAttempts: updates.length,
      results,
    });
  } catch (error: unknown) {
    console.error('Error:', error);
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
