'use client';

import { Card } from '@/components/ui/card';
import { Tag, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function CategoriasPlaceholder() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="w-6 h-6 text-emerald-600" /> Categorias</h1>
        <p className="text-sm text-gray-500">Gestão de categorias ContaAzul — em construção.</p>
      </div>
      <Card className="p-6">
        <p className="text-sm text-gray-600 mb-4">
          Aba para visualizar/normalizar categorias do ContaAzul. Hoje as categorias chegam direto do CA mas têm divergência entre os 2 bares (ex: &ldquo;SALARIO&rdquo; vs &ldquo;SALÁRIO&rdquo; com acentuação).
        </p>
        <p className="text-sm text-gray-600 mb-2">Próximos passos sugeridos:</p>
        <ul className="text-sm text-gray-600 list-disc ml-5 space-y-1">
          <li>Listar todas categorias cadastradas por bar</li>
          <li>Mapear sinônimos pra categoria canônica</li>
          <li>Aplicar normalização no ETL silver</li>
        </ul>
        <Link href="/ferramentas/financeiro/lancamentos" className="text-sm text-emerald-600 hover:underline mt-4 inline-flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> Por enquanto vê categorias agregadas em Lançamentos
        </Link>
      </Card>
    </main>
  );
}
