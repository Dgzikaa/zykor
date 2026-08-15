-- =============================================================================
-- O "Organograma adm." vira o organograma do Escritorio Central — 15/08/2026
-- =============================================================================
--
-- Rodrigo, depois de conversar com o Gonza: "esse Organograma Adm que a gente criou na verdade
-- nao deveria existir, ele e o Organograma normal para o Escritorio Central [...] o escritorio
-- central atende todos os bares da rede".
--
-- Ou seja: nunca foram dois organogramas do Ordinario. Era o quadro de OUTRA empresa (bar 7)
-- pendurado no bar 3 porque nao havia onde por. Depois desta migration, `escopo` deixa de ser
-- um conceito — cada empresa tem UM organograma, e o do Escritorio Central e o administrativo.
--
-- O QUE MOVE (conjuntos calculados, sem id chumbado):
--   cadeiras  escopo='administrativo' do bar 3        -> bar 7, escopo='operacao'
--   pessoas   que ocupam essas cadeiras hoje           -> bar 7, via hr.transferencias
--   cargos    usados por essas cadeiras/pessoas        -> bar 7
--   areas     idem (+ as areas desses cargos)          -> bar 7
--
-- Cargo e area sao POR BAR: sem move-los, o cadastro de alguem no Escritorio Central abriria
-- sem nenhum cargo para escolher.
--
-- CONFLITO QUE EU ACHEI E QUE NAO EXISTIA: contei "Assistente/Auxiliar de Producao" e a area
-- "Producao" como compartilhados com a operacao do Ordinario. Conferindo o uso VIVO: a cadeira
-- operacional "ASSISTENTE DE PRODUCAO 1" esta `ativa = false` (nao aparece na tela) e as duas
-- pessoas que apareciam sao Elias e Juan Pablo, INATIVOS e sem cadeira (cadastros-fantasma da
-- importacao antiga). Nenhum uso vivo — move tudo, sem duplicar nada. Licao: contar linha nao e
-- contar uso; filtrar por ativo/ativa antes de chamar de conflito.
--
-- As pessoas vao por TRANSFERENCIA (nao UPDATE calado) e ganham `bar_manual = true`, que trava
-- a sync do Tangerino — DIEGO GALDINO e NATALIA DIAS estao no workplace "Producao Ordinario" e
-- voltariam sozinhos para o bar 3 na proxima sincronizacao.
-- Ver 20260815_hr_transferencia_entre_empresas.sql e 20260815_tangerino_sync_respeita_transferencia.sql
--
-- Resultado (aplicado via MCP nesta data):
--   bar 3  56 cadeiras · 56 ativos · 25 cargos · 21 areas
--   bar 7  23 cadeiras · 17 ativos · 16 cargos ·  6 areas · 17 transferencias
--   nenhuma cadeira com escopo='administrativo' em lugar nenhum
-- =============================================================================

do $$
declare
  v_cadeiras int; v_pessoas int; v_cargos int; v_areas int;
begin
  create temporary table _adm_cad on commit drop as
    select id, cargo_id, area_id from hr.cadeiras where bar_id = 3 and escopo = 'administrativo';

  create temporary table _adm_pes on commit drop as
    select distinct f.id, f.cargo_id, f.area_id
      from hr.funcionarios f
      join hr.cadeira_ocupacao o on o.funcionario_id = f.id and o.fim is null
      join _adm_cad c on c.id = o.cadeira_id;

  create temporary table _adm_cargos on commit drop as
    select distinct x.cargo_id as id from (
      select cargo_id from _adm_cad where cargo_id is not null
      union select cargo_id from _adm_pes where cargo_id is not null) x;

  create temporary table _adm_areas on commit drop as
    select distinct x.area_id as id from (
      select area_id from _adm_cad where area_id is not null
      union select area_id from _adm_pes where area_id is not null
      union select area_id from hr.cargos where id in (select id from _adm_cargos) and area_id is not null) x;

  update hr.cargos set bar_id = 7 where id in (select id from _adm_cargos) and bar_id = 3;
  get diagnostics v_cargos = row_count;
  update hr.areas  set bar_id = 7 where id in (select id from _adm_areas)  and bar_id = 3;
  get diagnostics v_areas = row_count;

  update hr.cadeiras set bar_id = 7, escopo = 'operacao', atualizado_em = now()
   where id in (select id from _adm_cad);
  get diagnostics v_cadeiras = row_count;

  insert into hr.transferencias (funcionario_id, bar_origem, bar_destino, data, motivo)
  select p.id, 3, 7, current_date,
         'Organograma administrativo passou a ser o do Escritório Central, que atende toda a rede'
    from _adm_pes p
    join hr.funcionarios f on f.id = p.id and f.bar_id = 3;

  update hr.funcionarios set bar_id = 7, bar_manual = true, atualizado_em = now()
   where id in (select id from _adm_pes) and bar_id = 3;
  get diagnostics v_pessoas = row_count;

  raise notice 'movidos -> cadeiras: %, pessoas: %, cargos: %, areas: %',
    v_cadeiras, v_pessoas, v_cargos, v_areas;
end $$;
