import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { encryptSecret } from '@/lib/crypto/secretBox';

/**
 * POST /api/stone/conciliacao/cadastrar — cadastra credenciais Stone CIFRADAS,
 * cifrando SERVER-SIDE. A CREDENTIALS_MASTER_KEY é "Sensitive" no Vercel (write-only,
 * ninguém lê o valor de volta) e existe só no runtime — então a cifragem precisa
 * acontecer aqui, dentro do Vercel, e não num script local.
 *
 * Admin/financeiro. Body: [{ bar_id, nome, cnpj?, ambiente?, stone_codes:[...], api_key }]
 * Idempotente: substitui a credencial 'stone' anterior do mesmo (bar_id, empresa_nome).
 * NUNCA ecoa a chave — só id + contagem.
 */
export const dynamic = 'force-dynamic';

function podeUsar(role?: string) {
  return role === 'admin' || role === 'financeiro';
}

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeUsar(user.role)) return permissionErrorResponse('Apenas admin ou financeiro podem cadastrar credenciais Stone');

  const body = await req.json().catch(() => null);
  const lista = Array.isArray(body) ? body : null;
  if (!lista || lista.length === 0) {
    return NextResponse.json({ error: 'Body deve ser uma lista de credenciais.' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const resultados: any[] = [];

  for (const c of lista) {
    try {
      for (const campo of ['bar_id', 'nome', 'api_key', 'stone_codes']) {
        if (!c?.[campo]) throw new Error(`falta o campo obrigatório: ${campo}`);
      }
      const stoneCodes = Array.isArray(c.stone_codes)
        ? c.stone_codes.map((s: any) => String(s).trim()).filter(Boolean)
        : [];
      if (stoneCodes.length === 0) throw new Error('stone_codes deve ser uma lista não-vazia');

      const row = {
        bar_id: c.bar_id,
        sistema: 'stone',
        ambiente: c.ambiente || 'producao',
        client_id: null,
        client_secret: null,
        empresa_nome: c.nome,
        empresa_cnpj: c.cnpj || null,
        ativo: true,
        configuracoes: {
          stone_codes: stoneCodes,
          enc: { api_key: encryptSecret(String(c.api_key)) }, // cifra com a master key do runtime
        },
      };

      // idempotente: remove a credencial stone anterior desse (bar, empresa) antes de inserir
      await (supabase as any).from('api_credentials')
        .delete().eq('bar_id', c.bar_id).eq('sistema', 'stone').eq('empresa_nome', c.nome);

      const { data, error } = await (supabase as any).from('api_credentials')
        .insert(row).select('id').single();
      if (error) throw error;

      resultados.push({ nome: c.nome, bar_id: c.bar_id, ok: true, id: data.id, stone_codes: stoneCodes.length });
    } catch (e: any) {
      resultados.push({ nome: c?.nome ?? '?', bar_id: c?.bar_id ?? null, ok: false, erro: e?.message || 'falha' });
    }
  }

  return NextResponse.json({ success: resultados.every((r) => r.ok), resultados });
}
