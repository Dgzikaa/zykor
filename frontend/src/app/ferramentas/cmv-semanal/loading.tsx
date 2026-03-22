export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header com título e ações */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Filtros (ano, status) */}
      <div className="flex gap-4">
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Cards de resumo CMV */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Tabela de semanas CMV */}
      <div className="bg-gray-200 rounded-lg animate-pulse">
        <div className="h-14 border-b border-gray-300" />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-16 border-b border-gray-300" />
        ))}
      </div>

      {/* Gráfico de evolução CMV */}
      <div className="h-72 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}
