import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();

    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || '0');
    const ano = parseInt(searchParams.get('ano') || '0');
    const barId = parseInt(searchParams.get('bar_id') || '3');

    if (!mes || !ano) {
      return NextResponse.json({ error: 'Mês e ano são obrigatórios' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('marketing_mensal')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('mes', mes)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar marketing mensal:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || null });
  } catch (error: any) {
    console.error('Erro ao buscar marketing mensal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getAdminClient();

    const body = await request.json();
    const { bar_id, ano, mes, ...marketingData } = body;

    if (!bar_id || !ano || !mes) {
      return NextResponse.json({ error: 'bar_id, ano e mes são obrigatórios' }, { status: 400 });
    }

    // Verificar se já existe
    const { data: existing } = await supabase
      .from('marketing_mensal')
      .select('id')
      .eq('bar_id', bar_id)
      .eq('ano', ano)
      .eq('mes', mes)
      .single();

    let result;
    if (existing) {
      // UPDATE
      const { data, error } = await supabase
        .from('marketing_mensal')
        .update({
          ...marketingData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar marketing mensal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // INSERT
      const { data, error } = await supabase
        .from('marketing_mensal')
        .insert({
          bar_id,
          ano,
          mes,
          ...marketingData
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar marketing mensal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Erro ao salvar marketing mensal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
