// Server Component (RSC) — PILOTO de migração 'use client' -> Server Component.
// Lê o bar do cookie (sgb_bar_id, setado pelo BarContext) e já busca os dados no
// servidor, entregando o 1º paint COM dados (sem skeleton) no caso comum (aba única).
// A interatividade (troca de bar, revalidação, título) fica na ilha client.
// Degrada com segurança: sem cookie ou em erro, initialData=null e a ilha busca via SWR
// exatamente como antes.
import { cookies } from 'next/headers';
import { getPainelExecutivo } from '@/app/api/estrategico/painel-executivo/data';
import PainelExecutivoClient from './PainelExecutivoClient';

export const dynamic = 'force-dynamic';

export default async function PainelExecutivoPage() {
  const store = await cookies();
  const barId = Number(store.get('sgb_bar_id')?.value) || null;

  let initialData: any = null;
  if (barId) {
    try {
      initialData = await getPainelExecutivo(barId);
    } catch {
      initialData = null; // falha no servidor -> ilha client busca via SWR (comportamento antigo)
    }
  }

  return <PainelExecutivoClient initialBar={barId} initialData={initialData} />;
}
