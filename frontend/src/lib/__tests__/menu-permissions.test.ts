import { describe, it, expect } from 'vitest';
import { MENU_TREE, isMenuLeaf } from '@/lib/navigation/menu';
import { getModuleIdForPath } from '@/lib/permissions/modules';

/**
 * INVARIANTE ANTI-DESCASAMENTO (dono cansou de bater nessa tecla):
 * O menu tem que mostrar EXATAMENTE o que o perfil concede. Quem concede (tela de Perfis) e
 * quem exige na rota (route-guard) usam o MÓDULO CANÔNICO da rota (getModuleIdForPath = id
 * gerado `categoria_nome`). Se um item do menu declara uma `permission` À MÃO diferente desse
 * id, o perfil dá acesso mas o menu esconde — bug recorrente (controle_producao, desperdicio,
 * fluxo de caixa...). Este teste TRAVA O BUILD se aparecer uma nova divergência.
 *
 * Exceção intencional: Configurações é gateada por um GENERIC ('configuracoes'/'gestao') — é
 * acesso admin, não módulo-por-página. (A rede aditiva da sidebar ainda faz o per-item funcionar
 * se alguém conceder um id específico de config.)
 */
const SECOES_GENERIC_INTENCIONAL = new Set(['Configurações']);

describe('Menu ↔ permissões', () => {
  it('cada folha declara permission = módulo canônico da rota (o que o perfil concede)', () => {
    const divergencias: string[] = [];
    for (const secao of MENU_TREE) {
      if (SECOES_GENERIC_INTENCIONAL.has(secao.label)) continue;
      for (const item of secao.subItems) {
        if (!isMenuLeaf(item)) continue;
        const gerado = getModuleIdForPath(item.href);
        if (item.permission !== gerado) {
          divergencias.push(
            `[${secao.label}] "${item.label}" (${item.href}): permission="${item.permission}" ≠ gerado="${gerado}"`
          );
        }
      }
    }
    expect(
      divergencias,
      `Menu declara permissão diferente do id que a tela de Perfis concede → o item some mesmo com ` +
      `acesso. Alinhe a permission ao id gerado (categoria = label da SEÇÃO):\n${divergencias.join('\n')}`
    ).toEqual([]);
  });
});
