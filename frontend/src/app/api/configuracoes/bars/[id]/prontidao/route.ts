import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth/server';

// Checklist de prontidão de um bar: o que já está configurado x pendente.
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
type Status = 'ok' | 'pendente' | 'opcional';

// true se houver algum valor numérico > 0 em qualquer profundidade do JSONB de metas.
function temMetaPreenchida(metas: any): boolean {
  if (typeof metas === 'number') return metas > 0;
  if (metas && typeof metas === 'object') return Object.values(metas).some(temMetaPreenchida);
  return false;
}

export const GET = requireAdmin(async (_request: NextRequest, _user, ctx: Ctx) => {
  try {
    const { id } = await ctx.params;
    const barId = parseInt(id, 10);
    const supabase = await getAdminClient();

    const [barRes, cfgRes, acessoRes, credRes, despRes] = await Promise.all([
      (supabase as any).schema('operations').from('bares')
        .select('nome, cnpj, endereco, metas, ativo').eq('id', barId).maybeSingle(),
      (supabase as any).schema('operations').from('bares_config')
        .select('bar_id, tem_api_contahub, tem_api_yuzer, tem_api_sympla').eq('bar_id', barId).maybeSingle(),
      (supabase as any).schema('auth_custom').from('usuarios_bares')
        .select('usuario_id', { count: 'exact', head: true }).eq('bar_id', barId),
      (supabase as any).from('api_credentials')
        .select('sistema', { count: 'exact', head: false }).eq('bar_id', barId),
      (supabase as any).schema('gold').from('desempenho')
        .select('id', { count: 'exact', head: true }).eq('bar_id', barId),
    ]);

    const bar = barRes.data;
    if (!bar) return NextResponse.json({ success: false, error: 'Bar não encontrado' }, { status: 404 });

    const cfg = cfgRes.data;
    const acessos = acessoRes.count ?? 0;
    const credenciais = (credRes.data || []) as Array<{ sistema: string }>;
    const sistemas = credenciais.map((c) => c.sistema);
    const semanasDesempenho = despRes.count ?? 0;

    const itens: Array<{ chave: string; label: string; status: Status; detalhe: string }> = [
      {
        chave: 'perfil',
        label: 'Perfil do bar',
        status: bar.cnpj && bar.endereco ? 'ok' : 'pendente',
        detalhe: bar.cnpj && bar.endereco ? 'Nome, CNPJ e endereço preenchidos' : 'Falta CNPJ e/ou endereço',
      },
      {
        chave: 'ativo',
        label: 'Bar ativo',
        status: bar.ativo ? 'ok' : 'pendente',
        detalhe: bar.ativo ? 'Aparece no seletor' : 'Inativo — não aparece no seletor',
      },
      {
        chave: 'operacao',
        label: 'Dias de operação',
        status: cfg ? 'ok' : 'pendente',
        detalhe: cfg ? 'Configurados' : 'Definir os dias que o bar abre',
      },
      {
        chave: 'acesso',
        label: 'Acesso de usuários',
        status: acessos > 0 ? 'ok' : 'pendente',
        detalhe: `${acessos} usuário(s) com acesso`,
      },
      {
        chave: 'metas',
        label: 'Metas preenchidas',
        status: temMetaPreenchida(bar.metas) ? 'ok' : 'pendente',
        detalhe: temMetaPreenchida(bar.metas) ? 'Tem metas definidas' : 'Metas zeradas — preencher em Metas',
      },
      {
        chave: 'desempenho',
        label: 'Tabela de desempenho pronta',
        status: semanasDesempenho > 0 ? 'ok' : 'pendente',
        detalhe: semanasDesempenho > 0
          ? `${semanasDesempenho} semanas disponíveis p/ preencher`
          : 'Sem semanas — marketing manual não terá onde ser lançado',
      },
      {
        chave: 'integracoes',
        label: 'Integrações do bar',
        status: sistemas.length > 0 ? 'ok' : 'opcional',
        detalhe: sistemas.length > 0
          ? `Configuradas: ${sistemas.join(', ')}`
          : 'Nenhuma integração configurada (ok para bar manual)',
      },
    ];

    const pendentes = itens.filter((i) => i.status === 'pendente').length;
    const concluidos = itens.filter((i) => i.status === 'ok').length;

    return NextResponse.json({
      success: true,
      resumo: { total: itens.length, concluidos, pendentes },
      itens,
    });
  } catch (error: any) {
    console.error('Erro prontidão bar:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
