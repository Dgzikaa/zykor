import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';
import { UMBLER_API_BASE, UMBLER_ORG_FALLBACK, getUmblerToken, umblerAuthHeaders } from '@/lib/umbler';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/**
 * GET /api/umbler/templates?bar_id=3
 * Lista os templates de WhatsApp APROVADOS da organização. Filtra status "Approved".
 * Fonte: GET /v1/templates/ (Umbler Talk). Auth via UMBLER_API_TOKEN (mesmo dos alertas).
 *
 * Retorna: { templates: [{ id, label, content, category, status, variables: [{name, example}], header, footer }] }
 */
export async function GET(request: NextRequest) {
  await authenticateUser(request);
  try {
    const barId = Number(new URL(request.url).searchParams.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

    // Token da conta (gerenciável na tela) com fallback pro env; org do bar se houver.
    const [{ data: config }, token] = await Promise.all([
      supabase.from('umbler_config').select('organization_id').eq('bar_id', barId).eq('ativo', true).maybeSingle(),
      getUmblerToken(supabase),
    ]);

    if (!token) {
      return NextResponse.json({ error: 'Token da Umbler não configurado (nem na conta, nem no env)' }, { status: 400 });
    }

    const params = new URLSearchParams({
      organizationId: config?.organization_id || UMBLER_ORG_FALLBACK,
      Take: '100',
      OrderBy: 'Label',
      Order: 'Asc',
    });

    const resp = await fetch(`${UMBLER_API_BASE}/v1/templates/?${params.toString()}`, {
      headers: umblerAuthHeaders(token),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return NextResponse.json({ error: 'Erro ao buscar templates na Umbler', details: txt.slice(0, 300) }, { status: resp.status });
    }

    const json = await resp.json();
    const items: any[] = json.items || [];

    // Só aprovados (status vem como string, ex.: "Approved")
    const templates = items
      .filter((t) => String(t.status || '').toLowerCase() === 'approved')
      .map((t) => ({
        id: t.id,
        label: t.label,
        content: t.content || '',
        category: t.category || '',
        status: t.status,
        header: t.header?.text || null,
        footer: t.footer || null,
        variables: Array.isArray(t.variables)
          ? t.variables.map((v: any) => ({ name: v.name, example: v.example }))
          : [],
      }));

    return NextResponse.json({ templates, total: templates.length });
  } catch (error: any) {
    console.error('Erro ao listar templates Umbler:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
