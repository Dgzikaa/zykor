import { SimpleDashboardLayout } from '@/components/layouts';

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SimpleDashboardLayout>
      <div className="configuracoes-full-width h-full w-full">{children}</div>
    </SimpleDashboardLayout>
  );
}
