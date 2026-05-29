'use client';

import { Card } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function CentrosCustoPlaceholder() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-emerald-600" /> Centros de Custo</h1>
        <p className="text-sm text-gray-500">Rateio de despesas por centro — em construção.</p>
      </div>
      <Card className="p-6">
        <p className="text-sm text-gray-600">
          Aba para análise de rateio por centro de custo (bronze.bronze_contaazul_centros_custo + agregação por lançamento).
          Quando estiver pronta, vai mostrar quanto cada centro consumiu por mês e responsabilizar gestor.
        </p>
      </Card>
    </main>
  );
}
