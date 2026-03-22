-- Triggers: update_updated_at_column aplicados em múltiplas tabelas
-- Todas usam a mesma função: public.update_updated_at_column()

CREATE TRIGGER update_contahub_analitico_updated_at BEFORE UPDATE ON public.contahub_analitico FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contahub_fatporhora_updated_at BEFORE UPDATE ON public.contahub_fatporhora FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contahub_pagamentos_updated_at BEFORE UPDATE ON public.contahub_pagamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contahub_periodo_updated_at BEFORE UPDATE ON public.contahub_periodo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contahub_processing_queue_updated_at BEFORE UPDATE ON public.contahub_processing_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contahub_tempo_updated_at BEFORE UPDATE ON public.contahub_tempo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_formas_pagamento_updated_at BEFORE UPDATE ON public.formas_pagamento FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fp_categorias_updated_at BEFORE UPDATE ON public.fp_categorias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fp_contas_updated_at BEFORE UPDATE ON public.fp_contas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fp_pluggy_items_updated_at BEFORE UPDATE ON public.fp_pluggy_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fp_regras_updated_at BEFORE UPDATE ON public.fp_regras_categoria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fp_transacoes_updated_at BEFORE UPDATE ON public.fp_transacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grupos_updated_at BEFORE UPDATE ON public.grupos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notas_fiscais_updated_at BEFORE UPDATE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_turnos_updated_at BEFORE UPDATE ON public.turnos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
