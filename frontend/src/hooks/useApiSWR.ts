'use client';

/**
 * useApiSWR — cache de dados client-side sobre o apiCall existente.
 *
 * PROBLEMA QUE RESOLVE: hoje cada página busca em useEffect e re-busca do zero
 * a cada navegação (não há cache compartilhado). Isso torna a navegação lenta e
 * gera waterfalls. SWR resolve com cache em memória + dedupe + revalidação.
 *
 * MULTI-TENANCY: a chave do cache SEMPRE inclui o bar selecionado. Ao trocar de
 * bar, a chave muda e o SWR busca os dados do bar novo automaticamente — nunca
 * serve dados de um bar em outro. (O apiCall já manda o header x-selected-bar-id
 * lido do localStorage, que o BarContext atualiza na troca.)
 *
 * USO:
 *   const { data, error, isLoading, mutate } = useApiSWR<MinhaResp>('/api/x');
 *   // pausar a busca condicionalmente: passe null como endpoint
 *   const { data } = useApiSWR(pronto ? '/api/x' : null);
 */

import useSWR, { SWRConfiguration, mutate as globalMutate } from 'swr';
import { apiCall } from '@/lib/api-client';
import { useBar } from '@/contexts/BarContext';

const fetcher = (endpoint: string) => apiCall(endpoint);

export function useApiSWR<T = unknown>(
  endpoint: string | null | false | undefined,
  options?: SWRConfiguration<T>
) {
  const { selectedBar } = useBar();

  // Chave = [endpoint, barId]. barId no array garante isolamento por bar.
  // endpoint falsy => key null => SWR não busca (útil para condicional).
  const key =
    endpoint && selectedBar?.id != null
      ? ([endpoint, selectedBar.id] as const)
      : null;

  return useSWR<T>(
    key,
    ([ep]) => fetcher(ep as string) as Promise<T>,
    {
      revalidateOnFocus: false, // não re-buscar a cada foco de aba (dashboards pesados)
      dedupingInterval: 30_000, // 30s: chamadas idênticas dentro da janela reusam o resultado
      keepPreviousData: true, // evita flash de loading ao trocar de filtro/bar
      ...options,
    }
  );
}

/**
 * Invalida manualmente entradas do cache SWR por prefixo de endpoint.
 * Útil após um POST/PUT que muda dados que alguma página exibe.
 * Ex.: revalidateApi('/api/financeiro/dre') revalida qualquer chave desse endpoint.
 */
export function revalidateApi(endpointPrefix: string) {
  return globalMutate(
    (key) =>
      Array.isArray(key) &&
      typeof key[0] === 'string' &&
      key[0].startsWith(endpointPrefix),
    undefined,
    { revalidate: true }
  );
}
