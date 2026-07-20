import { fin } from '@/lib/financeiro/pedidos-pagamento';

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/**
 * Auto-vincula freelas (financial.beneficiarios) ao FORNECEDOR do Conta Azul, por
 * CPF (preferência) e depois por NOME exato. Idempotente: só toca em quem está sem
 * vínculo (contaazul_pessoa_id null) e só quando acha match. Roda no GET da semana de
 * freelas — assim o roster se auto-cura sozinho e o financeiro não vê mais "sem
 * fornecedor no CA" pra quem já existe no CA. Best-effort: falha aqui não derruba a tela.
 *
 * Motivo: os fornecedores de freela no CA frequentemente estão SEM CPF (e duplicados),
 * então o match por CPF só pega quando o CA tiver o documento; o nome exato é o que
 * resolve hoje. Ver [[project_freelas_fluxo_operacao_financeiro]].
 */
export async function autoVincularFreelasCA(
  supabase: any,
  bar_id: number
): Promise<{ vinculados: number; sem_match: number }> {
  const { data: freelas } = await fin(supabase)
    .from('beneficiarios')
    .select('id, nome, cpf_cnpj')
    .eq('bar_id', bar_id)
    .eq('tipo', 'freela')
    .eq('ativo', true)
    .is('contaazul_pessoa_id', null);
  if (!freelas?.length) return { vinculados: 0, sem_match: 0 };

  const { data: forn } = await (supabase.schema('bronze' as any) as any)
    .from('bronze_contaazul_pessoas')
    .select('contaazul_id, nome, documento')
    .eq('bar_id', bar_id)
    .eq('perfil', 'FORNECEDOR')
    .eq('ativo', true);
  if (!forn?.length) return { vinculados: 0, sem_match: freelas.length };

  const porCpf = new Map<string, string>();
  const porNome = new Map<string, string[]>();
  for (const f of forn as any[]) {
    const cpf = digits(f.documento);
    if (cpf.length >= 11 && !porCpf.has(cpf)) porCpf.set(cpf, f.contaazul_id);
    const nk = norm(f.nome);
    if (nk) { const a = porNome.get(nk) || []; a.push(f.contaazul_id); porNome.set(nk, a); }
  }

  let vinculados = 0, sem_match = 0;
  for (const b of freelas as any[]) {
    const cpf = digits(b.cpf_cnpj);
    let alvo = cpf.length >= 11 ? porCpf.get(cpf) : undefined;
    if (!alvo) { const cand = porNome.get(norm(b.nome)); if (cand?.length) alvo = cand[0]; }
    if (!alvo) { sem_match++; continue; }
    const { error } = await fin(supabase)
      .from('beneficiarios')
      .update({ contaazul_pessoa_id: alvo })
      .eq('id', b.id)
      .is('contaazul_pessoa_id', null); // guarda contra corrida
    if (!error) vinculados++;
  }
  return { vinculados, sem_match };
}
