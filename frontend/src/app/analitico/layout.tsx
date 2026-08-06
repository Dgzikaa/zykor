'use client';

// Layout da área Analítico — gate por MÓDULO (não por role).
//
// ANTES: createProtectedDashboardLayout({ requiredRole: 'admin' }) — travava a área
// inteira em admin e barrava funcionário COM módulo analítico, contradizendo o
// route-permissions (área liberada por módulo). Mesmo bug do estrategico/layout.
//
// 05/08/2026 — SEGUNDO bug, mesmo lugar: a porta exigia uma lista FIXA de módulos
// (`analitico_clientes`, `analitico_eventos`, `analitico`, `relatorios`), mas as páginas
// desta pasta foram reagrupadas no menu e hoje pedem módulos `receitas_*` e `ferramentas_*`
// (Visão do Artista = `receitas_visao_do_artista`, Eventos = `receitas_eventos`, NPS por
// Área = `ferramentas_nps_por_area`…). Quem tinha só o módulo NOVO e correto batia em
// "acesso negado" na porta — dar a permissão certa no perfil não adiantava nada.
//
// Agora o módulo exigido é DERIVADO DO MENU pela rota atual (`getModuleIdForPath`), que é a
// fonte única de módulos do projeto. Assim a porta acompanha o menu sozinha: página que mudar
// de seção, ou página nova, não precisa de manutenção aqui. Os módulos antigos ficam como
// alternativa (retrocompat de quem ainda os tem).
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MinimalLayout } from '@/components/layouts';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getModuleIdForPath } from '@/lib/permissions/modules';

/** Módulos antigos da área — mantidos só pra não trancar quem já os tinha. */
const MODULOS_LEGADOS = [
  'analitico_clientes',
  'analitico_eventos',
  'analitico_artistico',
  'analitico',
  'relatorios',
];

/**
 * Módulo da rota, subindo pro pai quando a página não está no menu.
 *
 * `getModuleIdForPath` casa só caminho EXATO. Telas-filhas que existem como botão dentro de
 * outra (ex.: /analitico/atracoes/tagging, o "Taggear Artistas") não estão no menu e cairiam
 * na mesma barreira — quem tem o módulo da tela-mãe tem que passar na filha.
 */
function moduloDaRota(pathname: string): string | null {
  const partes = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean);
  while (partes.length > 1) {
    const modulo = getModuleIdForPath('/' + partes.join('/'));
    if (modulo) return modulo;
    partes.pop();
  }
  return null;
}

export default function AnaliticoLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const moduloDaPagina = moduloDaRota(pathname || '');
  // Basta UM: o módulo certo da página (pelo menu) OU um dos genéricos antigos.
  const modulos = moduloDaPagina ? [moduloDaPagina, ...MODULOS_LEGADOS] : MODULOS_LEGADOS;

  return (
    <ProtectedRoute requiredModules={modulos}>
      <MinimalLayout>{children}</MinimalLayout>
    </ProtectedRoute>
  );
}
