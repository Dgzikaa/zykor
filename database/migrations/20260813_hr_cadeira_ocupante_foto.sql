-- Foto de quem ocupa a cadeira SEM ser funcionário (sócio) — ata de 13/08/2026.
--
-- Contexto que apareceu na conversa: não existe upload de foto em lugar nenhum do RH. A coluna
-- hr.funcionarios.foto_url existe desde sempre, mas NUNCA teve tela para preencher — por isso os 57
-- ativos do Ordinário aparecem no organograma pela selfie do Tangerino, e quem não bate ponto (PJ,
-- liderança, sócio) fica só nas iniciais.
--
-- Agora a caixa do organograma tem upload, e um botão só resolve os dois casos: cadeira ocupada por
-- funcionário grava em funcionarios.foto_url; cadeira com nome digitado grava aqui.
--
-- O arquivo vai do browser DIRETO para o bucket público `uploads` (que já existe e só aceita
-- imagem), sem passar pela função da Vercel, que tem teto de ~4,5 MB no corpo da requisição.
alter table hr.cadeiras add column if not exists ocupante_foto_url text;

comment on column hr.cadeiras.ocupante_foto_url is
  'Rosto de quem ocupa a cadeira quando NÃO há cadastro de funcionário (sócio). Quem tem cadastro usa a foto do funcionário ou a selfie do ponto.';
