/**
 * Regras da tela de Arquivos (Ferramentas) — pastas e arquivos do marketing.
 *
 * Compartilhado entre o cliente (valida ANTES de subir) e as rotas de API: se os dois lados
 * tiverem listas diferentes, o usuário só descobre o problema depois de esperar o upload inteiro.
 *
 * O arquivo NÃO passa pela função da Vercel (teto de ~4,5 MB no corpo da requisição — acima disso
 * a requisição morre na borda, sem log). O fluxo é o mesmo já usado no RH:
 *   1) POST /api/ferramentas/arquivos/upload-url -> servidor devolve URL assinada do Storage
 *   2) browser sobe DIRETO pro Supabase Storage
 *   3) a tela recarrega a listagem (o Storage é a fonte da verdade — não há tabela espelho)
 */

export const BUCKET_ARQUIVOS = 'arquivos';

/**
 * Teto por arquivo. Mantido em sincronia com storage.buckets.file_size_limit (migration
 * 20260805_bucket_arquivos.sql). 45 MB e não 50 porque o teto DURO do projeto Supabase é 50 MB
 * (medido: 49 MB sobe, 50 MB o Storage recusa) — a folga evita prometer o que o Storage recusa.
 * Precisar de mais exige subir o "Upload file size limit" no dashboard do Supabase antes.
 */
export const MAX_ARQUIVO_BYTES = 45 * 1024 * 1024;

/** Acima disso demora no 4G — a tela avisa, mas não bloqueia. */
export const AVISO_PESADO_BYTES = 15 * 1024 * 1024;

/** Tipos aceitos pelo bucket (storage.buckets.allowed_mime_types). */
export const MIMES_ACEITOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/svg+xml',
  'application/pdf', 'application/zip', 'application/x-zip-compressed',
];

/** Celular e scanner às vezes mandam o arquivo SEM content-type (file.type vazio). */
export const MIME_POR_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  heic: 'image/heic', heif: 'image/heif', svg: 'image/svg+xml',
  pdf: 'application/pdf', zip: 'application/zip',
};

export function mimeDoArquivo(nome: string, tipoInformado?: string | null): string {
  if (tipoInformado && MIMES_ACEITOS.includes(tipoInformado)) return tipoInformado;
  const ext = (nome.split('.').pop() || '').toLowerCase();
  return MIME_POR_EXT[ext] || tipoInformado || 'application/octet-stream';
}

export function formataTamanho(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
}

/** Mensagem de erro (pt-BR) ou null se o arquivo pode subir. */
export function validaArquivo(nome: string, tipoInformado: string | null, bytes: number): string | null {
  if (!nome) return 'Arquivo sem nome.';
  if (!bytes) return 'Arquivo vazio.';
  if (bytes > MAX_ARQUIVO_BYTES) {
    return `${nome}: ${formataTamanho(bytes)} — o limite é ${formataTamanho(MAX_ARQUIVO_BYTES)}. `
      + 'Para foto muito grande, exporte em qualidade menor; para pacote inteiro, use um link do Drive.';
  }
  const mime = mimeDoArquivo(nome, tipoInformado);
  if (!MIMES_ACEITOS.includes(mime)) {
    return `${nome}: tipo não aceito (${mime}). Envie imagem, PDF ou ZIP.`;
  }
  return null;
}

/**
 * Nome de pasta seguro. O Storage não tem pasta de verdade — pasta é PREFIXO no caminho —
 * então barra, ".." e afins viram outro diretório se passarem batido.
 */
/** Acento vira letra simples no path (combining marks: U+0300–U+036F). */
const SEM_ACENTO = /[\u0300-\u036f]/g;

export function nomePastaSeguro(nome: string): string {
  return nome
    .normalize('NFD').replace(SEM_ACENTO, '')  // acento vira letra simples no path
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60);
}

/** Nome de arquivo seguro para o path do Storage (mantém a extensão). */
export function nomeArquivoSeguro(nome: string): string {
  return nome
    .normalize('NFD').replace(SEM_ACENTO, '')
    .replace(/[^\w.\-]+/g, '_')
    .slice(-120);
}

/** Marcador que faz a pasta existir mesmo vazia (Storage não guarda diretório vazio). */
export const ARQUIVO_MARCADOR = '.pasta';

export function ehImagem(mime?: string | null): boolean {
  return !!mime && mime.startsWith('image/') && mime !== 'image/svg+xml';
}
