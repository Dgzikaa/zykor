import { SupabaseClient } from '@supabase/supabase-js';

export interface Organizador {
  id: number;
  bar_id: number;
  ano: number;
  /** Legado: organizadores criados antes do modelo semestral. */
  trimestre: number | null;
  semestre: number | null;
  tipo: string;
  missao: string | null;
  tema_semestre: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOrganizadores(supabase: SupabaseClient, barId: number): Promise<Organizador[]> {
  const { data, error } = await supabase
    .from('organizador_visao')
    .select('id, bar_id, ano, trimestre, semestre, tipo, missao, tema_semestre, created_at, updated_at')
    .eq('bar_id', barId)
    .order('ano', { ascending: false })
    .order('semestre', { ascending: false, nullsFirst: true })
    .order('trimestre', { ascending: false, nullsFirst: true });

  if (error) {
    console.error('Erro ao buscar organizadores:', error);
    return [];
  }

  return data || [];
}
