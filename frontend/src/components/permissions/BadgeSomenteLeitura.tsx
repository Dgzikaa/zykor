import { Eye } from 'lucide-react';

/** Selo "Somente leitura" — mostrar no header da página quando o usuário só pode ver o módulo. */
export function BadgeSomenteLeitura({ className = '' }: { className?: string }) {
  return (
    <span
      title="Você tem acesso apenas de visualização neste módulo"
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ${className}`}
    >
      <Eye className="h-3.5 w-3.5" />
      Somente leitura
    </span>
  );
}
