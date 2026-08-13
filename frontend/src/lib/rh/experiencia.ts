/**
 * Período de experiência.
 *
 * Ata de 13/08/2026: "ao contratar 1 pessoa nova: automaticamente preenche o prazo de período de
 * experiência que é 60 dias, ai ja deixa salvo... faltando 15 dias começa a ir pro alerta".
 *
 * Fica em lib (e não dentro da rota) porque a regra é usada na criação e na edição do funcionário —
 * rota do Next só deve exportar handlers HTTP.
 */

/** Fim do período de experiência: 60 dias a partir da admissão. */
export function fimDaExperiencia(dataAdmissao: string): string {
  const d = new Date(`${String(dataAdmissao).slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
}
