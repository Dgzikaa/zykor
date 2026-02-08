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

// GET - Buscar stakeholders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q'); // Busca por CPF/CNPJ ou nome
    const barId = parseInt(searchParams.get('bar_id') || '3');

    console.log(`[NIBO-STAKEHOLDERS] Buscando stakeholders, q=${query}, bar_id=${barId}`);

    // Limpar query - remover formatação do CPF/CNPJ
    const cleanQuery = query?.replace(/\D/g, '') || '';

    const credencial = await getNiboCredentials(barId);
    
    if (!credencial) {
      console.log('[NIBO-STAKEHOLDERS] Sem credenciais NIBO');
      return NextResponse.json({
        success: false,
        error: 'Credenciais NIBO não encontradas',
        data: []
      }, { status: 400 });
    }

    // Buscar na API do NIBO - usando /suppliers que é onde estão os fornecedores/funcionários
    // O endpoint /stakeholders existe mas /suppliers é o mais usado para pagamentos
    const niboUrl = `${NIBO_BASE_URL}/suppliers?apitoken=${credencial.api_token}&$top=1000`;

    console.log('[NIBO-STAKEHOLDERS] Buscando suppliers da API NIBO...');

    const response = await fetch(niboUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apitoken': credencial.api_token
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NIBO-STAKEHOLDERS] Erro na API NIBO:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Erro NIBO: ${response.status}`, data: [] },
        { status: response.status }
      );
    }

    const niboData = await response.json();
    let stakeholders = niboData.items || niboData || [];

    console.log(`[NIBO-STAKEHOLDERS] Encontrados ${stakeholders.length} suppliers no NIBO`);

    // Filtrar localmente se houver query
    if (cleanQuery) {
      stakeholders = stakeholders.filter((s: any) => {
        const docNumber = s.document?.number?.replace(/\D/g, '') || '';
        const name = (s.name || '').toLowerCase();
        return docNumber.includes(cleanQuery) || name.includes(cleanQuery.toLowerCase());
      });
      console.log(`[NIBO-STAKEHOLDERS] Após filtro por query: ${stakeholders.length} stakeholders`);
    }

    // Filtrar arquivados e deletados - só mostrar ativos
    stakeholders = stakeholders.filter((s: any) => !s.isArchived && !s.isDeleted);
    console.log(`[NIBO-STAKEHOLDERS] Após filtro de arquivados: ${stakeholders.length} stakeholders`);

    // Ordenar: priorizar quem tem PIX cadastrado e tipo Supplier
    stakeholders.sort((a: any, b: any) => {
      // Prioridade 1: Tem PIX
      const aHasPix = a.bankAccountInformation?.pixKey ? 1 : 0;
      const bHasPix = b.bankAccountInformation?.pixKey ? 1 : 0;
      if (bHasPix !== aHasPix) return bHasPix - aHasPix;
      
      // Prioridade 2: É Supplier (para pagamentos)
      const aIsSupplier = a.type === 'Supplier' ? 1 : 0;
      const bIsSupplier = b.type === 'Supplier' ? 1 : 0;
      return bIsSupplier - aIsSupplier;
    });

    // Formatar resposta - estrutura correta do NIBO
    const formattedData = stakeholders.map((s: any) => ({
      id: s.id || s.stakeholderId,
      name: s.name,
      document: s.document?.number || '',
      documentType: s.document?.type || 'CPF',
      email: s.communication?.email || s.email,
      phone: s.communication?.phone || s.phone,
      type: s.type || 'Supplier',
      pixKey: s.bankAccountInformation?.pixKey || null,
      pixKeyType: s.bankAccountInformation?.pixKeyType || null,
      isArchived: s.isArchived || false,
      isDeleted: s.isDeleted || false
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
      source: 'nibo_api',
      total: formattedData.length
    });

  } catch (error) {
    console.error('[NIBO-STAKEHOLDERS] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar stakeholders', data: [] },
      { status: 500 }
    );
  }
}

// POST - Criar stakeholder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, document, type = 'fornecedor', bar_id = 3, pixKey, pixKeyType } = body;

    console.log(`[NIBO-STAKEHOLDERS] Criando stakeholder: ${name}, doc=${document}`);

    if (!name || !document) {
      return NextResponse.json(
        { success: false, error: 'Nome e documento são obrigatórios' },
        { status: 400 }
      );
    }

    const credencial = await getNiboCredentials(bar_id);
    
    if (!credencial) {
      return NextResponse.json(
        { success: false, error: 'Credenciais NIBO não encontradas para este bar' },
        { status: 400 }
      );
    }

    const cleanDocument = document.replace(/\D/g, '');
    const docType = cleanDocument.length <= 11 ? 'CPF' : 'CNPJ';
    
    // Mapear tipo para o formato NIBO
    const niboType = type === 'fornecedor' || type === 'Supplier' ? 'Supplier' 
                   : type === 'socio' || type === 'Partner' ? 'Partner' 
                   : type === 'Customer' ? 'Customer'
                   : 'Supplier';

    // Preparar payload para NIBO - estrutura correta
    const stakeholderPayload: any = {
      name,
      document: {
        number: cleanDocument,
        type: docType
      },
      type: niboType
    };

    // Adicionar chave PIX se fornecida
    if (pixKey) {
      // Determinar tipo de PIX
      let pixTypeStr = 'CPF';
      if (pixKeyType === 1 || pixKeyType === 'EMAIL') pixTypeStr = 'EMAIL';
      else if (pixKeyType === 2 || pixKeyType === 'PHONE') pixTypeStr = 'PHONE';
      else if (pixKeyType === 3 || pixKeyType === 'CPF' || pixKeyType === 'CNPJ') pixTypeStr = docType;
      else if (pixKeyType === 4 || pixKeyType === 'RANDOM') pixTypeStr = 'RANDOM';
      
      stakeholderPayload.bankingInfo = {
        pixKeys: [{
          key: pixKey.replace(/\D/g, ''), // Limpar a chave PIX
          type: pixTypeStr
        }]
      };
    }

    console.log('[NIBO-STAKEHOLDERS] Payload:', JSON.stringify(stakeholderPayload, null, 2));

    const response = await fetch(`${NIBO_BASE_URL}/stakeholders?apitoken=${credencial.api_token}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'apitoken': credencial.api_token
      },
      body: JSON.stringify(stakeholderPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NIBO-STAKEHOLDERS] Erro ao criar:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Erro NIBO: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const niboData = await response.json();
    console.log('[NIBO-STAKEHOLDERS] Stakeholder criado:', niboData.id);

    // Também salvar no banco local para cache
    await supabase.from('nibo_stakeholders').upsert({
      nibo_id: String(niboData.id),
      bar_id,
      nome: name,
      documento_numero: cleanDocument,
      documento_tipo: docType,
      tipo: niboType,
      pix_chave: pixKey || null,
      pix_tipo: pixKey ? (docType === 'CPF' ? 'CPF' : 'CNPJ') : null,
      ativo: true,
      atualizado_em: new Date().toISOString()
    }, {
      onConflict: 'nibo_id'
    });

    return NextResponse.json({
      success: true,
      data: {
        id: niboData.id,
        name,
        document: cleanDocument,
        type: niboType,
        pixKey
      }
    });

  } catch (error) {
    console.error('[NIBO-STAKEHOLDERS] Erro ao criar:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao criar stakeholder' },
      { status: 500 }
    );
  }
}
