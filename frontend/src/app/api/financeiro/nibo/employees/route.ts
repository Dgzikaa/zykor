import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

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

// GET - Listar funcionários do NIBO
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    const top = Math.min(parseInt(searchParams.get('top') || '1000', 10), 5000);

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório', data: [], total: 0 },
        { status: 400 }
      );
    }

    const barIdNumber = parseInt(barId, 10);
    if (!Number.isFinite(barIdNumber)) {
      return NextResponse.json(
        { success: false, error: 'bar_id inválido', data: [], total: 0 },
        { status: 400 }
      );
    }

    const credencial = await getNiboCredentials(barIdNumber);
    if (!credencial) {
      return NextResponse.json(
        {
          success: false,
          error: 'Credenciais NIBO não encontradas para este bar',
          data: [],
          total: 0,
        },
        { status: 400 }
      );
    }

    const url = `${NIBO_BASE_URL}/employees?apitoken=${credencial.api_token}&$top=${top}`;
    const niboResponse = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        apitoken: credencial.api_token,
      },
    });

    if (!niboResponse.ok) {
      const errorText = await niboResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: `Erro NIBO ${niboResponse.status}: ${errorText.substring(0, 300)}`,
          data: [],
          total: 0,
        },
        { status: niboResponse.status }
      );
    }

    const niboData = await niboResponse.json();
    let items = (niboData.items || niboData || []) as any[];

    // Remove funcionários inativos/deletados quando campos existirem.
    items = items.filter((item: any) => !item.isDeleted && item.isActive !== false);

    if (query) {
      items = items.filter((item: any) => {
        const nome = String(item.name || item.fullName || '').toLowerCase();
        const doc = String(
          item.document?.number || item.documentNumber || item.cpf || item.cnpj || ''
        )
          .replace(/\D/g, '')
          .toLowerCase();
        const matricula = String(item.code || item.employeeCode || '').toLowerCase();
        const pixKey = String(
          item.bankAccountInformation?.pixKey || item.bankingInfo?.pixKeys?.[0]?.key || ''
        )
          .trim()
          .toLowerCase();
        const pixDigits = pixKey.replace(/\D/g, '');
        const queryDigits = query.replace(/\D/g, '');

        return (
          nome.includes(query) ||
          doc.includes(queryDigits) ||
          matricula.includes(query) ||
          pixKey.includes(query) ||
          pixDigits.includes(queryDigits)
        );
      });
    }

    const data = items.map((item: any) => ({
      id: item.id || item.employeeId,
      name: item.name || item.fullName || '',
      document: item.document?.number || item.documentNumber || item.cpf || item.cnpj || '',
      documentType: item.document?.type || item.documentType || null,
      code: item.code || item.employeeCode || null,
      email: item.email || item.communication?.email || null,
      phone: item.phone || item.communication?.phone || null,
      pixKey:
        item.bankAccountInformation?.pixKey ||
        item.bankingInfo?.pixKeys?.[0]?.key ||
        null,
      pixKeyType:
        item.bankAccountInformation?.pixKeyType ||
        item.bankingInfo?.pixKeys?.[0]?.type ||
        null,
      isActive: item.isActive !== false,
      raw: item,
    }));

    return NextResponse.json({
      success: true,
      data,
      total: data.length,
      source: 'nibo_api_employees',
    });
  } catch (error) {
    console.error('[NIBO-EMPLOYEES] Erro ao listar funcionários:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao listar funcionários', data: [], total: 0 },
      { status: 500 }
    );
  }
}
