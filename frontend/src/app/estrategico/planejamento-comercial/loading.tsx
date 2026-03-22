export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header com título e seletor de mês/ano */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-72 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Cards de resumo do mês */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Calendário / Grid de dias */}
      <div className="bg-gray-200 rounded-lg animate-pulse">
        <div className="h-12 border-b border-gray-300" />
        <div className="grid grid-cols-7 gap-1 p-4">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-300 rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Seção de metas e projeções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
