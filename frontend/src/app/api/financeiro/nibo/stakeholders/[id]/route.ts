import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

// Buscar credenciais do NIBO para um bar
async function getNiboCredentials(barId: number) {
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

// PUT - Atualizar stakeholder (principalmente para chave PIX)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, document, pixKey, pixKeyType = 3, bar_id } = body;

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const credencial = await getNiboCredentials(bar_id);
    
    if (!credencial) {
      return NextResponse.json(
        { success: false, error: 'Credenciais NIBO não encontradas' },
        { status: 400 }
      );
    }

    // Primeiro, buscar o stakeholder para obter dados atuais
    const getResponse = await fetch(`${NIBO_BASE_URL}/stakeholders/${id}?apitoken=${credencial.api_token}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apitoken': credencial.api_token
      }
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error('[NIBO-STAKEHOLDERS] Stakeholder não encontrado:', getResponse.status, errorText);
      return NextResponse.json(
        { success: false, error: `Stakeholder não encontrado: ${getResponse.status}` },
        { status: getResponse.status }
      );
    }

    const currentData = await getResponse.json();

    // Limpar documento
    const cleanDocument = (document || currentData.document?.number || '').replace(/\D/g, '');
    const docType = cleanDocument.length <= 11 ? 'CPF' : 'CNPJ';

    // Preparar payload de atualização - estrutura correta do NIBO
    const updatePayload: any = {
      name: name || currentData.name,
      document: {
        number: cleanDocument,
        type: docType
      },
      type: currentData.type || 'Supplier'
    };
    
    // Adicionar chave PIX se fornecida
    if (pixKey) {
      const cleanPixKey = pixKey.replace(/\D/g, '');
      
      // Determinar tipo de PIX (NIBO usa números: 1=Email, 2=Telefone, 3=CPF/CNPJ, 4=Aleatória)
      let pixType = 3; // Default CPF/CNPJ
      if (pixKeyType === 1 || pixKeyType === 'EMAIL') pixType = 1;
      else if (pixKeyType === 2 || pixKeyType === 'PHONE') pixType = 2;
      else if (pixKeyType === 4 || pixKeyType === 'RANDOM') pixType = 4;
      else pixType = 3; // CPF/CNPJ
      
      // Estrutura correta do NIBO para bankAccountInformation
      updatePayload.bankAccountInformation = {
        ...(currentData.bankAccountInformation || {}),
        pixKey: cleanPixKey,
        pixKeyType: pixType
      };
    }

    const response = await fetch(`${NIBO_BASE_URL}/stakeholders/${id}?apitoken=${credencial.api_token}`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'apitoken': credencial.api_token
      },
      body: JSON.stringify(updatePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NIBO-STAKEHOLDERS] Erro ao atualizar:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Erro NIBO: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const niboData = await response.json();

    // Atualizar cache local
    if (pixKey) {
      const cleanPixKey = pixKey.replace(/\D/g, '');
      await supabase
        .from('nibo_stakeholders')
        .update({
          pix_chave: cleanPixKey,
          pix_tipo: cleanPixKey.length <= 11 ? 'CPF' : 'CNPJ',
          atualizado_em: new Date().toISOString()
        })
        .eq('nibo_id', id);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: niboData.id,
        name: niboData.name,
        document: niboData.document?.number,
        pixKey: niboData.bankAccountInformation?.pixKey,
        pixKeyType: niboData.bankAccountInformation?.pixKeyType
      }
    });

  } catch (error) {
    console.error('[NIBO-STAKEHOLDERS] Erro ao atualizar:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao atualizar stakeholder' },
      { status: 500 }
    );
  }
}

// GET - Buscar stakeholder específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    if (!barIdParam) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    const credencial = await getNiboCredentials(barId);
    
    if (!credencial) {
      // Fallback: buscar no banco local
      const { data, error } = await supabase
        .from('nibo_stakeholders')
        .select('*')
        .eq('nibo_id', id)
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: 'Stakeholder não encontrado' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: data.nibo_id,
          name: data.nome,
          document: data.documento_numero,
          type: data.tipo,
          pixKey: data.pix_chave
        },
        source: 'database'
      });
    }

    const response = await fetch(`${NIBO_BASE_URL}/stakeholders/${id}?apitoken=${credencial.api_token}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apitoken': credencial.api_token
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Stakeholder não encontrado: ${response.status}` },
        { status: response.status }
      );
    }

    const niboData = await response.json();

    return NextResponse.json({
      success: true,
      data: {
        id: niboData.id,
        name: niboData.name,
        document: niboData.document,
        email: niboData.email,
        phone: niboData.phone,
        type: niboData.type,
        pixKey: niboData.pix?.key,
        pixKeyType: niboData.pix?.type
      },
      source: 'nibo_api'
    });

  } catch (error) {
    console.error('[NIBO-STAKEHOLDERS] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar stakeholder' },
      { status: 500 }
    );
  }
}
