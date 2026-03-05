import { redirect } from 'next/navigation';

export default function AdministracaoIndexPage() {
  redirect('/configuracoes/administracao/usuarios');
}
