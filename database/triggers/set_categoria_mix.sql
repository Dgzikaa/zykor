-- Triggers: trg_set_categoria_mix_contahub_analitico e trg_set_categoria_mix_contahub_stockout
-- Define categoria_mix automaticamente baseado em loc_desc e grp_desc

CREATE TRIGGER trg_set_categoria_mix_contahub_analitico
BEFORE INSERT OR UPDATE ON contahub_analitico
FOR EACH ROW
EXECUTE FUNCTION set_categoria_mix_contahub_analitico();

CREATE TRIGGER trg_set_categoria_mix_contahub_stockout
BEFORE INSERT OR UPDATE ON contahub_stockout
FOR EACH ROW
EXECUTE FUNCTION set_categoria_mix_contahub_stockout();
