import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic'

function parseCSVDate(dateStr: string): string {
  // Converte datas do formato "1-Feb" para "2025-02-01"
  const [day, monthStr] = dateStr.split('-');
  const monthMap: { [key: string]: string } = {
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
  };

  const month = monthMap[monthStr] || '02';
  const paddedDay = day.padStart(2, '0');

  return `2025-${month}-${paddedDay}`;
}

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

    // Ler o arquivo CSV
    const csvPath = path.join(
      process.cwd(),
      'frontend',
      'atracoes_ordinario.csv'
    );
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    // 1. Limpar todos os eventos existentes do Bar Ordinário
    const { error: deleteError } = await supabase
      .from('eventos_base')
      .delete()
      .eq('bar_id', 1);

    if (deleteError) {
      console.error('❌ Erro ao deletar eventos:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao deletar eventos existentes',
        details: deleteError,
      });
    }

    // 2. Processar CSV e inserir eventos
    const eventosParaInserir: any[] = [];

    // Pular o cabeçalho (primeira linha)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse da linha CSV
      const parts = line.split(',');
      if (parts.length < 6) continue;

      const data = parts[0];
      const evento = parts[3];
      const artista = parts[4] && parts[4] !== '' ? parts[4] : null;
      const genero = parts[5];
      const obs = parts[6] && parts[6] !== '' ? parts[6] : null;

      // Converter data para formato SQL
      const dataSQL = parseCSVDate(data);

      eventosParaInserir.push({
        bar_id: 1,
        nome: evento,
        nome_evento: evento,
        artista: artista || null,
        genero: genero,
        observacoes: obs || null,
        data_evento: dataSQL,
        ativo: true,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      });
    }

    // 3. Inserir eventos em lotes
    const { data: insertedEvents, error: insertError } = await supabase
      .from('eventos_base')
      .insert(eventosParaInserir)
      .select();

    if (insertError) {
      console.error('❌ Erro ao inserir novos eventos:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao inserir novos eventos',
        details: insertError,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Eventos importados da CSV com sucesso!',
      totalImported: insertedEvents?.length || 0,
      csvLines: lines.length - 1,
      data: insertedEvents,
    });
  } catch (error: unknown) {
    console.error('❌ Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
