import { redirect } from 'next/navigation';

export default function FinanceiroIndex() {
  redirect('/ferramentas/financeiro/lancamentos');
}

// Nota: DRE não existe mais como aba própria — ela vive em
// /estrategico/orcamentacao (sub-tab "DRE Manual"). A aba
// "Orçamentação + DRE" daqui só redireciona pra lá.
