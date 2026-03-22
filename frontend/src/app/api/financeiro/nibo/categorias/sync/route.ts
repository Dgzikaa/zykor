import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

// Buscar credenciais do NIBO para um bar
async function getNiboCredentials(barId: number = 3) {
  const { data: credencial, error } = await supabase
    .from('api_credentials')
    .select('api_token, empresa_id')
    .eq('sistema', 'nibo')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !credencial?.api_token) {
    return null;
  }

  return credencial;
}

// POST - Sincronizar categorias do NIBO
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    const credencial = await getNiboCredentials(barId);
    
    if (!credencial) {
      return NextResponse.json(
        { success: false, error: 'Credenciais NIBO não encontradas para este bar' },
        { status: 400 }
      );
    }

    // Buscar categorias da API do NIBO
    // Endpoint: GET /categories
    const response = await fetch(`${NIBO_BASE_URL}/categories?apitoken=${credencial.api_token}&$top=500`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apitoken': credencial.api_token
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NIBO-CATEGORIAS-SYNC] Erro ao buscar categorias:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Erro NIBO: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const niboData = await response.json();
    const categorias = niboData.items || niboData || [];

    let atualizadas = 0;
    let criadas = 0;
    let erros = 0;

    for (const cat of categorias) {
      try {
        // Tentar atualizar categoria existente pelo nome
        const { data: existente } = await supabase
          .from('nibo_categorias')
          .select('id')
          .ilike('categoria_nome', cat.name || cat.categoryName)
          .single();

        if (existente) {
          // Atualizar com o nibo_id
          const { error: updateError } = await supabase
            .from('nibo_categorias')
            .update({
              nibo_id: cat.id || cat.categoryId,
              categoria_macro: cat.group?.name || cat.groupName || 'Outros',
              atualizado_em: new Date().toISOString()
            })
            .eq('id', existente.id);

          if (updateError) {
            console.error(`Erro ao atualizar categoria ${cat.name}:`, updateError);
            erros++;
          } else {
            atualizadas++;
          }
        } else {
          // Criar nova categoria
          const { error: insertError } = await supabase
            .from('nibo_categorias')
            .insert({
              nibo_id: cat.id || cat.categoryId,
              categoria_nome: cat.name || cat.categoryName,
              categoria_macro: cat.group?.name || cat.groupName || 'Outros',
              ativo: true,
              criado_em: new Date().toISOString(),
              atualizado_em: new Date().toISOString()
            });

          if (insertError) {
            console.error(`Erro ao criar categoria ${cat.name}:`, insertError);
            erros++;
          } else {
            criadas++;
          }
        }
      } catch (catError) {
        console.error(`Erro ao processar categoria:`, catError);
        erros++;
      }
    }

    return NextResponse.json({
      success: true,
      total_nibo: categorias.length,
      atualizadas,
      criadas,
      erros
    });

  } catch (error) {
    console.error('[NIBO-CATEGORIAS-SYNC] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao sincronizar categorias' },
      { status: 500 }
    );
  }
}

// GET - Buscar categorias diretamente do NIBO (para debug)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    const credencial = await getNiboCredentials(barId);
    
    if (!credencial) {
      return NextResponse.json(
        { success: false, error: 'Credenciais NIBO não encontradas' },
        { status: 400 }
      );
    }

    const response = await fetch(`${NIBO_BASE_URL}/categories?apitoken=${credencial.api_token}&$top=500`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apitoken': credencial.api_token
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Erro NIBO: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      categorias: data.items || data || [],
      total: (data.items || data || []).length
    });

  } catch (error) {
    console.error('[NIBO-CATEGORIAS] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
