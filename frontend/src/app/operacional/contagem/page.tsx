import { redirect } from 'next/navigation';

// Tela de contagem antiga descontinuada: o "Fazer contagem" agora vive em Estoque — Histórico.
export default function ContagemRedirect() {
  redirect('/operacional/estoque-historico');
}
