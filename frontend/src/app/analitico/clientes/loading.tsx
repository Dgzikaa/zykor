export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header com título */}
      <div className="h-8 w-56 bg-gray-200 rounded animate-pulse" />

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Tabs (Clientes, Reservantes, Segmentação) */}
      <div className="h-10 w-80 bg-gray-200 rounded animate-pulse" />

      {/* Filtros e busca */}
      <div className="flex gap-4">
        <div className="h-10 flex-1 max-w-md bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Tabela de clientes */}
      <div className="bg-gray-200 rounded-lg animate-pulse">
        <div className="h-12 border-b border-gray-300" />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="h-14 border-b border-gray-300" />
        ))}
      </div>

      {/* Paginação */}
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
