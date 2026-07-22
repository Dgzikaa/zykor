import { MinimalLayout } from '@/components/layouts/MinimalLayout';
import { WikiTitle } from '@/components/wiki/WikiTitle';
import { WikiSidebar } from '@/components/wiki/WikiSidebar';
import { getArticlesByArea } from '@/lib/wiki';

/**
 * Layout da Wiki — herda o chrome do sistema (header + menu) como a Central de Chamados.
 * Sem gate de permissão: qualquer usuário autenticado lê a wiki (acesso pelo menu do (?) ).
 * A sidebar (índice por área + busca) é compartilhada por todas as páginas da wiki.
 */
export default function WikiLayout({ children }: { children: React.ReactNode }) {
  const grupos = getArticlesByArea().map(({ area, artigos }) => ({
    area,
    artigos: artigos.map((a) => ({ path: a.path, title: a.title })),
  }));

  return (
    <MinimalLayout>
      <WikiTitle />
      <div className="w-full px-3 sm:px-5 py-5">
        <div className="flex gap-8">
          <WikiSidebar grupos={grupos} />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </MinimalLayout>
  );
}
