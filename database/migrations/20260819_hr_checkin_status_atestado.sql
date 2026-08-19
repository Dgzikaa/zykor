-- Check-in do dia ganha o status ATESTADO (pedido do Gonza, 19/08/2026).
--
-- A lista que ele pediu pro líder marcar é: Presente / Presente Atrasado / Faltou / Atestado /
-- Não está na Escala. Os quatro primeiros já existiam como ok / ok_atraso / falta / escala_errada;
-- faltava atestado. Ele não é "falta" — é ausência JUSTIFICADA, e vira ocorrência de tipo
-- 'atestado' no dossiê (tipo que hr.funcionario_ocorrencias já aceita), não de tipo 'falta'.
--
-- A troca de status também passou a apagar a ocorrência anterior quando o TIPO muda: marcar falta
-- e depois corrigir pra atestado deixava a falta no histórico da pessoa pra sempre.
alter table hr.checkin drop constraint if exists checkin_status_check;
alter table hr.checkin add constraint checkin_status_check
  check (status = any (array['ok'::text, 'ok_atraso'::text, 'escala_errada'::text, 'falta'::text, 'atestado'::text]));
