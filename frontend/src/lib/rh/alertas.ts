// Alertas do dossiê do funcionário — computados a partir do que já temos
// (documentos, datas, ocorrências). O que depende de ponto/Solides (hora extra,
// faltas automáticas) fica de fora até esses módulos existirem.

export type Alerta = { tipo: string; label: string; nivel: 'alerta' | 'aviso' };

type DocLite = { tipo: string; validade: string | null };
type OcorrLite = { tipo: string; data_inicio: string };
type FuncLite = { ativo: boolean; data_admissao: string | null };
type TreinoLite = { nome: string; validade: string | null };

const LABEL_DOC: Record<string, string> = {
  carteira_trabalho: 'Carteira de Trabalho', exame_admissional: 'Exame admissional',
  contrato: 'Contrato', rg_cpf: 'RG/CPF', outro: 'Documento',
};

export function computarAlertas(f: FuncLite, docs: DocLite[], ocorr: OcorrLite[], treinos: TreinoLite[] = []): Alerta[] {
  if (!f?.ativo) return []; // não alerta sobre inativos
  const out: Alerta[] = [];
  const hoje = new Date();
  const temDoc = (t: string) => docs.some((d) => d.tipo === t);

  if (!temDoc('exame_admissional')) out.push({ tipo: 'sem_exame', label: 'Sem exame admissional', nivel: 'alerta' });
  if (!temDoc('contrato')) out.push({ tipo: 'sem_contrato', label: 'Sem contrato anexado', nivel: 'alerta' });

  for (const d of docs) {
    if (d.validade && new Date(d.validade) < hoje) {
      out.push({ tipo: 'doc_vencido', label: `${LABEL_DOC[d.tipo] || 'Documento'} vencido`, nivel: 'alerta' });
    }
  }

  // Treinamentos/certificações com validade vencida (ex.: Manipulação de Alimentos).
  for (const t of treinos) {
    if (t.validade && new Date(t.validade) < hoje) {
      out.push({ tipo: 'treino_vencido', label: `${t.nome} vencido`, nivel: 'alerta' });
    }
  }

  // Férias: admitido há +12 meses e sem férias registradas nos últimos 12 meses.
  if (f.data_admissao) {
    const adm = new Date(f.data_admissao);
    const meses = (hoje.getFullYear() - adm.getFullYear()) * 12 + (hoje.getMonth() - adm.getMonth());
    if (meses >= 12) {
      const umAno = new Date(hoje); umAno.setFullYear(hoje.getFullYear() - 1);
      const teveFerias = (ocorr || []).some((o) => o.tipo === 'ferias' && new Date(o.data_inicio) >= umAno);
      if (!teveFerias) out.push({ tipo: 'ferias_vencendo', label: 'Férias podem estar vencendo', nivel: 'aviso' });
    }
  }

  return out;
}
