import { SimpleDashboardLayout } from '@/components/layouts';
import { AlertTriangle } from 'lucide-react';

// Shell padrão (MinimalSidebar) para a área RH + aviso de "em construção" no topo.
// O módulo inteiro ainda está em testes; o banner deixa claro pra quem entra que os
// dados podem estar incompletos e serve de convite pra feedback.
export default function RhLayout({ children }: { children: React.ReactNode }) {
  return (
    <SimpleDashboardLayout>
      <div className="flex items-center gap-2 border-b border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          <strong>Módulo RH em construção.</strong> Ainda em testes — os dados podem estar incompletos. Feedback é bem-vindo!
        </span>
      </div>
      {children}
    </SimpleDashboardLayout>
  );
}
