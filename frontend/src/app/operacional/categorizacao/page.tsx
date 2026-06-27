'use client';

import { Categorizacao } from '@/components/estoque/Categorizacao';
import { Tag } from 'lucide-react';

export default function CategorizacaoPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-100 dark:bg-teal-900/30 rounded-xl"><Tag className="w-6 h-6 text-teal-600 dark:text-teal-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categorização de Insumos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Marque a frequência de contagem (Diária = Curva A), o local e o tipo de cada insumo</p>
          </div>
        </div>
        <Categorizacao />
      </div>
    </div>
  );
}
