export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`[ENV] Variável de ambiente obrigatória não configurada: ${name}`);
  }
  return value;
}

export function requireJsonEnv(name: string): Record<string, unknown> {
  const raw = requireEnv(name);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`[ENV] Variável ${name} não é um JSON válido`);
  }
}

export function validateFunctionEnv(functionName: string, requiredVars: string[]): void {
  const missing = requiredVars.filter(v => !Deno.env.get(v));
  if (missing.length > 0) {
    throw new Error(
      `[${functionName}] Variáveis de ambiente faltando: ${missing.join(', ')}`
    );
  }
}
