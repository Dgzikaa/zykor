import type { AuthenticatedUser } from '@/middleware/auth';

/**
 * Quem é "a minha equipe" — a árvore de cadeiras ABAIXO da cadeira que a pessoa logada ocupa.
 *
 * Regra da ata de 13/08/2026 ("chefe de fila luan tem que dar check so nas pessoas abaixo dele...
 * de acordo com o usuario logado"), estendida em 19/08/2026 para a Escala da Operação: o líder
 * abre a escala e vê só a gente dele, e só pode adicionar gente de dentro da própria árvore.
 *
 * Sai da ÁRVORE, não de uma lista fixa de área: assim continua certa quando alguém troca de
 * chefe no organograma, sem ninguém atualizar escala nenhuma.
 *
 * Devolve `ids = null` para quem deve ver a casa toda:
 *   - usuário sem vínculo com funcionário (RH, admin, financeiro)
 *   - quem ocupa cadeira mas não tem ninguém abaixo (não é líder de nada)
 * Sem isso o líder sem equipe cadastrada abriria a tela vazia e acharia que quebrou.
 */
export type Equipe = {
  /** ids de funcionário que a pessoa pode ver/editar; null = a casa toda */
  ids: Set<number> | null;
  /** nome de quem lidera, quando a visão está restrita (a tela mostra "equipe de X") */
  lider: string | null;
};

export async function equipeDoUsuario(supabase: any, user: AuthenticatedUser): Promise<Equipe> {
  const livre: Equipe = { ids: null, lider: null };
  try {
    const { data: usr } = await supabase
      .from('usuarios').select('funcionario_id, nome').eq('id', user.id).maybeSingle();
    if (!usr?.funcionario_id) return livre;

    const { data: equipe } = await supabase.schema('hr')
      .rpc('fn_equipe_do_funcionario', { p_funcionario_id: usr.funcionario_id });

    const ids = new Set<number>(((equipe || []) as any[]).map((e) => e.funcionario_id));
    // a função devolve a própria pessoa também; 1 = só ela mesma = não lidera ninguém
    if (ids.size <= 1) return livre;

    return { ids, lider: usr.nome || null };
  } catch {
    // Falha na resolução NÃO pode virar tela vazia nem tela aberta por acidente: cai no
    // comportamento de antes (vê tudo), que é o que a permissão de rota já governa.
    return livre;
  }
}
