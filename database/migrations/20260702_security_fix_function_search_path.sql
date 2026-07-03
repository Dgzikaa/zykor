-- Advisor "Function Search Path Mutable": fixa o search_path das 3 funções (só usam built-ins ou
-- referências qualificadas, então incluir schema próprio + public + pg_catalog é seguro).
alter function operations.derive_embalagem(text, text) set search_path = pg_catalog, public;
alter function public.nextval_ficha_grupo() set search_path = public, pg_catalog;
alter function financial.fn_stone_venc_antecipado(date, integer[]) set search_path = financial, public, pg_catalog;
