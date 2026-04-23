/**
 * Função de teste - importar calc-operacional completo
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { calcOperacional } from "../_shared/calculators/calc-operacional.ts";

serve(async (req: Request) => {
  return new Response(
    JSON.stringify({
      success: true,
      message: "Boot OK com calc-operacional completo",
      calcOperacional: typeof calcOperacional === 'function',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
});
