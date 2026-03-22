-- Função: formatar_data_brasil
CREATE OR REPLACE FUNCTION public.formatar_data_brasil(data timestamp with time zone) RETURNS text LANGUAGE sql SET search_path TO 'public'
AS $$ SELECT to_char(data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'); $$;
