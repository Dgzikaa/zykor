// Alertas do dossiê do funcionário — computados a partir do que já temos
// (documentos, datas, ocorrências). O que depende de ponto/Solides (hora extra,
// faltas automáticas) fica de fora até esses módulos existirem.

import { DOCS_OBRIGATORIOS, LABEL_DOC } from './documentos';

export type Alerta = { tipo: string; label: string; nivel: 'alerta' | 'aviso' };

type DocLite = { tipo: string; validade: string | null };
type OcorrLite = { tipo: string; data_inicio: string };
type FuncLite = { ativo: boolean; data_admissao: string | null; data_fim_experiencia?: string | null };
type TreinoLite = { nome: string; validade: string | null };
type OnbLite = { item: string; concluido: boolean; prazo?: string | null };

const DIA = 86400000;
/** Dias inteiros entre hoje e uma data ISO (negativo = já passou). */
function emDias(iso: string): number {
  const alvo = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / DIA);
}

export function computarAlertas(
  f: FuncLite,
  docs: DocLite[],
  ocorr: OcorrLite[],
  treinos: TreinoLite[] = [],
  onboarding: OnbLite[] = [],
): Alerta[] {
  if (!f?.ativo) return []; // não alerta sobre inativos
  const out: Alerta[] = [];
  const hoje = new Date();
  const temDoc = (t: string) => docs.some((d) => d.tipo === t);

  // Todo documento obrigatório que ainda não foi anexado (antes só olhava exame e contrato).
  for (const t of DOCS_OBRIGATORIOS) {
    if (!temDoc(t.id)) out.push({ tipo: `sem_${t.id}`, label: `Sem ${t.label.toLowerCase()}`, nivel: 'alerta' });
  }

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

  // Fim do período de experiência — é o bloco "Datas próximas de finalizar período de experiência"
  // da mensagem de segunda. Avisa a partir de 15 dias antes; depois de vencido não insiste, porque
  // aí a decisão (efetivar ou desligar) já passou pela mesa.
  if (f.data_fim_experiencia) {
    const dias = emDias(f.data_fim_experiencia);
    if (dias >= 0 && dias <= 15) {
      out.push({
        tipo: 'experiencia_vencendo',
        label: dias === 0 ? 'Período de experiência termina hoje' : `Período de experiência termina em ${dias} dia${dias > 1 ? 's' : ''}`,
        nivel: 'alerta',
      });
    }
  }

  // Onboarding com prazo estourado (ex.: treinamento de integração, 15 dias após a admissão).
  for (const o of onboarding) {
    if (!o.concluido && o.prazo && emDias(o.prazo) < 0) {
      out.push({ tipo: 'onboarding_atrasado', label: `Onboarding atrasado: ${o.item}`, nivel: 'alerta' });
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
