import { SupabaseClient } from '@supabase/supabase-js';

export interface Organizador {
  id: number;
  bar_id: number;
  ano: number;
  trimestre: number | null;
  tipo: string;
  missao: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOrganizadores(supabase: SupabaseClient, barId: number): Promise<Organizador[]> {
  const { data, error } = await supabase
    .from('organizador_visao')
    .select('id, bar_id, ano, trimestre, tipo, missao, created_at, updated_at')
    .eq('bar_id', barId)
    .order('ano', { ascending: false })
    .order('trimestre', { ascending: false, nullsFirst: true });

  if (error) {
    console.error('Erro ao buscar organizadores:', error);
    return [];
  }

  return data || [];
}
