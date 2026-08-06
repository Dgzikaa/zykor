-- Bucket da tela de Arquivos (Ferramentas → Arquivos): pastas + fotos do marketing.
--
-- Pedido da Ana Paula (05/08/2026): um lugar no Zykor pra ela guardar as fotos/presskit dos
-- artistas em pastas, no lugar do Drive que só ela mantém.
--
-- PRIVADO de propósito: o bucket `uploads` é público e serve logo/imagem de tela; aqui vai
-- material de terceiros (foto de artista), então a leitura passa por URL assinada de 1h gerada
-- na rota, e não por link eterno que vaza se for repassado.
--
-- 45 MB por arquivo (47185920 bytes): o teto DURO do projeto Supabase é 50 MB (medido — 49 MB
-- sobe, 50 MB o Storage recusa). A folga evita a tela prometer um limite que o Storage rejeita
-- na hora H. Precisar de mais exige subir antes o "Upload file size limit" no dashboard.
--
-- text/plain está na lista por causa do marcador de pasta vazia (.pasta, 0 byte) — o Storage não
-- guarda diretório vazio, então a pasta só existe se houver um objeto dentro.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arquivos',
  'arquivos',
  false,
  47185920,
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/svg+xml',
    'application/pdf','application/zip','application/x-zip-compressed','text/plain'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;
