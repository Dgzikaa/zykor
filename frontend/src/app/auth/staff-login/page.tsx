import { Suspense } from 'react'
import { StaffLoginForm } from './StaffLoginForm'

// Pagina shell server-rendered. useSearchParams (no form) eh client-only e
// fica dentro do Suspense pra nao opt-out do prerender estatico do layout.
export default function StaffLoginPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-md card-dark rounded-xl p-8 animate-pulse">
          <div className="h-7 w-48 bg-gray-700 rounded mb-2 mx-auto" />
          <div className="h-4 w-64 bg-gray-700/60 rounded mb-6 mx-auto" />
          <div className="space-y-4">
            <div className="h-10 bg-gray-700/40 rounded" />
            <div className="h-10 bg-gray-700/40 rounded" />
            <div className="h-10 bg-amber-700/50 rounded" />
          </div>
        </div>
      }>
        <StaffLoginForm />
      </Suspense>
    </div>
  )
}
