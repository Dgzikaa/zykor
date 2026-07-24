-- RH / Central de Funcionários — anexo de documentos
--
-- Contexto: PDF escaneado de várias páginas falhava no anexo. Causa: o arquivo subia via função
-- da Vercel, cujo corpo de requisição tem teto de ~4,5 MB — a requisição era rejeitada na borda,
-- antes da função rodar (nenhum log de erro; o front só mostrava "Falha no upload"). Prova: dos
-- 44 documentos já anexados, o maior tem 4,28 MB e nenhum PDF passa de 0,78 MB.
--
-- O upload agora vai DIRETO do browser pro Storage (URL assinada), então o teto real passa a ser
-- o do bucket. 15 MB é apertado pra scan de CTPS com várias páginas -> sobe pra 40 MB.
--
-- Por que 40 e não mais: o projeto Supabase tem teto DURO de 50 MB por arquivo (testado: 49 MB
-- sobe, 50 MB o Storage recusa). Os 10 MB de folga evitam a tela prometer um limite que o Storage
-- rejeita. Pra passar disso, aumentar antes o "Upload file size limit" do projeto no dashboard —
-- mexer só no bucket não adianta.
--
-- Também aceita HEIC/HEIF (iPhone), que a rota já prometia na mensagem de erro mas o bucket barrava.
--
-- Manter em sincronia com frontend/src/lib/rh/documentos.ts (MAX_DOC_BYTES / MIMES_ACEITOS).

update storage.buckets
set file_size_limit  = 41943040, -- 40 MB
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ]
where id = 'rh-documentos';
