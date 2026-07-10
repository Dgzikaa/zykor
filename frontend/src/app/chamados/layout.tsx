import { MinimalLayout } from '@/components/layouts/MinimalLayout';

/**
 * Layout da Central de Chamados — só herda o chrome do sistema (header + menu lateral).
 * Sem gate de permissão: qualquer usuário autenticado abre/acompanha chamados (o acesso
 * é pelo ícone (?) no header, não pelo menu). A trava de "só suporte vê tudo" é na API.
 */
export default function ChamadosLayout({ children }: { children: React.ReactNode }) {
  return <MinimalLayout>{children}</MinimalLayout>;
}
