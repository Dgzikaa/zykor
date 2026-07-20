'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useBar } from '@/contexts/BarContext';
import { usePermissions } from '@/hooks/usePermissions';
import { MENU_TREE, isMenuLeaf } from '@/lib/navigation/menu';

// Todas as rotas-folha do menu (fonte única). Guardar/esconder usam a MESMA lista.
const TODAS_ROTAS_FOLHA = MENU_TREE.flatMap((s) => s.subItems.filter(isMenuLeaf).map((l) => l.href));
// Rotas da seção Configurações — sempre liberadas p/ admin (senão se tranca do bar enxuto).
const ROTAS_CONFIG = new Set(
  MENU_TREE.filter((s) => s.permission === 'configuracoes').flatMap((s) =>
    s.subItems.filter(isMenuLeaf).map((l) => l.href),
  ),
);

const cobre = (rota: string, path: string) => path === rota || path.startsWith(rota + '/');

/**
 * Guard de rota por BAR. Se o bar selecionado tem whitelist de rotas (config.modulos_visiveis)
 * e o usuário digita/abre uma rota de MÓDULO que está fora dela, redireciona pra primeira rota
 * permitida. Só bloqueia rotas que SÃO módulos do menu — páginas utilitárias (minha-conta,
 * detalhes fora do menu) passam. Esconder o item da sidebar não basta: sem isto a URL direta abre.
 */
export function useBarRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedBar, isLoading } = useBar();
  const { hasPermission, loading: permsLoading } = usePermissions();

  useEffect(() => {
    if (isLoading || permsLoading || !pathname) return;
    const permitidas = Array.isArray(selectedBar?.modulos_visiveis) ? selectedBar!.modulos_visiveis : [];
    if (permitidas.length === 0) return; // bar sem restrição = mostra tudo

    // Config é sempre acessível pra admin.
    if (hasPermission('todos') && [...ROTAS_CONFIG].some((r) => cobre(r, pathname))) return;

    // A rota atual corresponde a algum MÓDULO do menu? (match mais específico = href mais longo)
    const folhaAtual = TODAS_ROTAS_FOLHA
      .filter((r) => cobre(r, pathname))
      .reduce<string | null>((best, r) => (!best || r.length > best.length ? r : best), null);

    // Não é um módulo do menu (ex.: /usuarios/minha-conta) → não bloqueia.
    if (!folhaAtual) return;
    // É um módulo e está liberado neste bar → ok.
    if (permitidas.includes(folhaAtual)) return;

    // Módulo escondido neste bar: manda pra primeira rota permitida (ou home como último recurso).
    const destino = permitidas.find((r) => TODAS_ROTAS_FOLHA.includes(r)) || '/home';
    if (!cobre(destino, pathname)) router.replace(destino);
  }, [pathname, selectedBar, isLoading, permsLoading, hasPermission, router]);
}
