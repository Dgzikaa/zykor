/**
 * "Stone fechada até": maior dia-calendário (reference_date) cujo arquivo de conciliação
 * a Stone já entregou (http 200) para o bar.
 *
 * Como a Conferência/Conciliação usa DIA OPERACIONAL (corte 6h), a madrugada de um dia mora
 * no arquivo do dia-calendário SEGUINTE. Logo, um dia operacional D só fecha 100% quando o
 * arquivo de D+1 chega — e a Stone só libera esse arquivo depois que D+1 vira data passada
 * (regra "Conciliation generation is only permitted in past dates"), tipicamente em D+2.
 *
 * Regra derivada no cliente: dia `data` ainda está PARCIAL quando `data >= stone_fechado_ate`
 * (precisa do arquivo `data+1`, que só existe quando `data+1 <= stone_fechado_ate`).
 */
export async function getStoneFechadoAte(supabase: any, barId: number): Promise<string | null> {
  const { data } = await supabase
    .schema('bronze')
    .from('bronze_stone_conciliacao')
    .select('reference_date')
    .eq('bar_id', barId)
    .eq('http_status', 200)
    .order('reference_date', { ascending: false })
    .limit(1);
  return data?.[0]?.reference_date ?? null;
}
