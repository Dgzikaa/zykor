-- Zykor cadastra, Tangerino atualiza (decisão do Rodrigo, 15/08/2026).
--
-- O modelo é esse: a pessoa nasce no Zykor, contratada numa cadeira vaga, e o Tangerino passa a
-- manter os dados dela em dia. Só que a sync casava as pessoas por UM caminho só —
-- `f.tangerino_employee_id = e.employee_id_ext`. Quem nasce no Zykor não tem esse número, então na
-- primeira sync depois que o DP cadastrasse a mesma pessoa no Tangerino a função enxergaria
-- "não existe" e CRIARIA UM SEGUNDO REGISTRO. É exatamente a máquina de duplicata que gerou as ~40
-- da primeira importação, só que agora ligada no automático.
--
-- O que muda aqui:
--
-- 1. ADOÇÃO POR CPF. Antes de criar, procura no Zykor alguém com o mesmo CPF (só dígitos) e ainda
--    sem vínculo com o Tangerino. Achou um e só um -> adota: grava o `tangerino_employee_id` no
--    cadastro que já existe em vez de criar outro.
--    Deliberadamente NÃO casa por nome: nome curto × nome completo foi a origem das duplicatas
--    antigas, e CPF é a única chave que não depende de como a pessoa foi digitada.
--    Dois cadastros com o mesmo CPF, ou dois funcionários do Tangerino com o mesmo CPF, NÃO adotam
--    ninguém — escolher no escuro entre dois é como se erra. Os dois casos saem no relatório em
--    `cpf_ambiguo_zykor` / `cpf_repetido_tangerino` para alguém resolver na mão.
--
-- 2. A CADEIRA MANDA NO CARGO. Agora que contratar é ato da cadeira e é ela que define a função,
--    deixar o `jobRoleDTO` do Tangerino sobrescrever `cargo_id` desfaria a decisão do organograma
--    sozinho — quem senta em CHEFE DE BAR mas está como "Bartender" no Tangerino voltaria a
--    Bartender na sync seguinte, calado. É a mesma armadilha que o `bar_manual` já resolveu para o
--    bar. Quem ocupa cadeira com cargo definido mantém o cargo (e a área) da cadeira; quem não
--    ocupa nenhuma continua seguindo o Tangerino, que é melhor que ficar sem cargo.
--
-- 3. Índice único em `tangerino_employee_id`: não havia nada impedindo dois cadastros apontarem
--    para o mesmo funcionário do Tangerino. Hoje não há nenhum caso (conferido), então a trava
--    entra limpa e a duplicata passa a ser um erro na hora, não uma descoberta meses depois.

create unique index if not exists funcionarios_tangerino_employee_id_uk
  on hr.funcionarios (tangerino_employee_id)
  where tangerino_employee_id is not null;

create or replace function hr.fn_tangerino_sync_funcionarios(p_dry_run boolean default true)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'hr', 'bronze', 'public'
as $function$
DECLARE
  v_report jsonb;
BEGIN
  DROP TABLE IF EXISTS _tg_emp;
  CREATE TEMPORARY TABLE _tg_emp ON COMMIT DROP AS
  WITH wp AS (
    SELECT workplace_id_ext AS id,
      CASE WHEN payload->>'name' ILIKE '%ordin%' THEN 3 WHEN payload->>'name' ILIKE '%deboche%' THEN 4 END AS bar,
      NULLIF(btrim(regexp_replace(payload->>'name', '\s*(ordin[áa]rio|deboche)\s*$', '', 'gi')), '') AS setor
    FROM bronze.bronze_tangerino_workplace
  ),
  jr AS (
    SELECT job_role_id_ext AS id, NULLIF(btrim(payload->>'description'),'') AS cargo
    FROM bronze.bronze_tangerino_job_role
  )
  SELECT
    e.employee_id_ext AS tid,
    NULLIF(btrim(e.payload->>'name'),'') AS nome,
    NULLIF(regexp_replace(COALESCE(e.payload->>'cpf',''),'\D','','g'),'') AS cpf,
    NULLIF(btrim(e.payload->>'email'),'') AS email,
    CASE upper(COALESCE(e.payload->>'gender','')) WHEN 'FEMININO' THEN 'F' WHEN 'MASCULINO' THEN 'M' END AS genero,
    CASE WHEN (e.payload->>'admissionDate') ~ '^\d+$' AND (e.payload->>'admissionDate') <> '0'
         THEN to_timestamp((e.payload->>'admissionDate')::bigint/1000.0)::date END AS admissao,
    COALESCE((e.payload->>'fired')::boolean, false) AS fired,
    NULLIF(e.payload->'currentWorkSchedule'->>'id','')::bigint AS ws_id,
    wsel.bar, wsel.setor, jrsel.cargo AS cargo_nome,
    -- casa primeiro pelo vínculo já existente; sem ele, pelo CPF (adoção)
    COALESCE(f.id, CASE WHEN m.n = 1 THEN m.id END) AS existing_id,
    (f.id IS NULL AND m.n = 1) AS adotar,
    m.n AS cpf_matches,
    COALESCE(f.bar_id, CASE WHEN m.n = 1 THEN m.bar_id END) AS existing_bar,
    COALESCE(f.ativo,  CASE WHEN m.n = 1 THEN m.ativo  END) AS existing_ativo,
    COALESCE(f.nome,   CASE WHEN m.n = 1 THEN m.nome   END) AS existing_nome
  FROM bronze.bronze_tangerino_employee e
  LEFT JOIN LATERAL (
    SELECT w.bar, w.setor FROM jsonb_array_elements(e.payload->'workplaceList') wl
    JOIN wp w ON w.id = (wl->>'id')::bigint WHERE w.bar IS NOT NULL LIMIT 1
  ) wsel ON true
  LEFT JOIN jr jrsel ON jrsel.id = (e.payload->'jobRoleDTO'->>'id')::bigint
  LEFT JOIN hr.funcionarios f ON f.tangerino_employee_id = e.employee_id_ext
  -- agrega em vez de LIMIT 1: precisamos saber se deu MAIS DE UM para não adotar no escuro
  LEFT JOIN LATERAL (
    SELECT count(*) AS n,
           (array_agg(z.id     ORDER BY z.id))[1] AS id,
           (array_agg(z.bar_id ORDER BY z.id))[1] AS bar_id,
           (array_agg(z.ativo  ORDER BY z.id))[1] AS ativo,
           (array_agg(z.nome   ORDER BY z.id))[1] AS nome
    FROM hr.funcionarios z
    WHERE f.id IS NULL
      AND z.tangerino_employee_id IS NULL
      AND NULLIF(regexp_replace(COALESCE(z.cpf,''),'\D','','g'),'')
        = NULLIF(regexp_replace(COALESCE(e.payload->>'cpf',''),'\D','','g'),'')
  ) m ON true;

  -- Mesmo CPF em dois funcionários do Tangerino: os dois disputariam o mesmo cadastro do Zykor e o
  -- índice único derrubaria a sync inteira. Melhor não adotar nenhum e reportar.
  UPDATE _tg_emp t SET existing_id = NULL, adotar = false
  WHERE t.adotar
    AND EXISTS (SELECT 1 FROM _tg_emp o WHERE o.cpf = t.cpf AND o.tid <> t.tid);

  v_report := jsonb_build_object(
    'dry_run', p_dry_run,
    'total_bronze', (SELECT count(*) FROM _tg_emp),
    'criar', (SELECT count(*) FROM _tg_emp WHERE existing_id IS NULL AND bar IS NOT NULL),
    'criar_por_bar', (SELECT jsonb_object_agg(bar, c) FROM (SELECT bar, count(*) c FROM _tg_emp WHERE existing_id IS NULL AND bar IS NOT NULL GROUP BY bar) t),
    -- cadastros nascidos no Zykor que o Tangerino passou a manter em vez de duplicar
    'adotar_por_cpf', (SELECT count(*) FROM _tg_emp WHERE adotar),
    'adotar_nomes', (SELECT jsonb_agg(jsonb_build_object('tangerino', nome, 'zykor', existing_nome)) FROM _tg_emp WHERE adotar),
    'cpf_ambiguo_zykor', (SELECT jsonb_agg(nome) FROM _tg_emp WHERE cpf_matches > 1),
    'cpf_repetido_tangerino', (SELECT jsonb_agg(DISTINCT nome) FROM _tg_emp t
                                WHERE t.cpf IS NOT NULL AND t.cpf_matches = 1 AND NOT t.adotar AND t.existing_id IS NULL),
    'atualizar', (SELECT count(*) FROM _tg_emp WHERE existing_id IS NOT NULL),
    'corrigir_bar', (SELECT jsonb_agg(jsonb_build_object('nome', nome, 'de', existing_bar, 'para', bar))
                      FROM _tg_emp t WHERE existing_id IS NOT NULL AND bar IS NOT NULL AND existing_bar IS DISTINCT FROM bar
                        AND NOT EXISTS (SELECT 1 FROM hr.funcionarios f WHERE f.id = t.existing_id AND f.bar_manual)),
    'bar_travado_por_transferencia', (SELECT count(*) FROM _tg_emp t
                      JOIN hr.funcionarios f ON f.id = t.existing_id
                     WHERE f.bar_manual AND t.bar IS NOT NULL AND t.bar IS DISTINCT FROM f.bar_id),
    -- quem senta em cadeira com cargo definido: o Tangerino não mexe na função
    'cargo_travado_pela_cadeira', (SELECT count(*) FROM _tg_emp t
                     WHERE t.existing_id IS NOT NULL AND EXISTS (
                       SELECT 1 FROM hr.cadeira_ocupacao o JOIN hr.cadeiras c ON c.id = o.cadeira_id
                        WHERE o.funcionario_id = t.existing_id AND o.fim IS NULL AND c.cargo_id IS NOT NULL)),
    'desativar_saiu', (SELECT count(*) FROM _tg_emp WHERE existing_id IS NOT NULL AND existing_ativo = true AND fired = true),
    'com_cargo', (SELECT count(*) FROM _tg_emp WHERE cargo_nome IS NOT NULL),
    'com_area', (SELECT count(*) FROM _tg_emp WHERE setor IS NOT NULL AND bar IS NOT NULL),
    'cargos_novos', (SELECT jsonb_agg(distinct bar||': '||cargo_nome) FROM _tg_emp t WHERE bar IS NOT NULL AND cargo_nome IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM hr.cargos c WHERE c.bar_id=t.bar AND public.normcat(c.nome)=public.normcat(t.cargo_nome))),
    'areas_novas', (SELECT jsonb_agg(distinct bar||': '||setor) FROM _tg_emp t WHERE bar IS NOT NULL AND setor IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM hr.areas a WHERE a.bar_id=t.bar AND public.normcat(a.nome)=public.normcat(t.setor))),
    'sem_bar_nomes', (SELECT jsonb_agg(nome) FROM _tg_emp WHERE bar IS NULL)
  );

  IF NOT p_dry_run THEN
    INSERT INTO hr.cargos (bar_id, nome)
    SELECT DISTINCT t.bar, t.cargo_nome FROM _tg_emp t
    WHERE t.bar IS NOT NULL AND t.cargo_nome IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM hr.cargos c WHERE c.bar_id=t.bar AND public.normcat(c.nome)=public.normcat(t.cargo_nome));
    INSERT INTO hr.areas (bar_id, nome)
    SELECT DISTINCT t.bar, t.setor FROM _tg_emp t
    WHERE t.bar IS NOT NULL AND t.setor IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM hr.areas a WHERE a.bar_id=t.bar AND public.normcat(a.nome)=public.normcat(t.setor));

    -- bar_manual = transferencia registrada por uma pessoa. O workplace do Tangerino NAO
    -- sobrepoe: sem isto, transferir quem bate ponto se desfazia sozinho na proxima sync
    -- (caso DIEGO/NATALIA, que estao no workplace "Producao Ordinario" e foram pro bar 7).
    -- cargo/area seguem o bar EFETIVO da pessoa pelo mesmo motivo.
    UPDATE hr.funcionarios f SET
      nome = COALESCE(e.nome, f.nome),
      bar_id = CASE WHEN f.bar_manual THEN f.bar_id ELSE COALESCE(e.bar, f.bar_id) END,
      cpf = COALESCE(f.cpf, e.cpf),
      email = COALESCE(f.email, e.email),
      genero = COALESCE(e.genero, f.genero),
      data_admissao = COALESCE(f.data_admissao, e.admissao),
      -- adoção: o cadastro que nasceu no Zykor passa a ser o mesmo do Tangerino daqui pra frente
      tangerino_employee_id = COALESCE(f.tangerino_employee_id, e.tid),
      cargo_id = CASE
        WHEN EXISTS (SELECT 1 FROM hr.cadeira_ocupacao o JOIN hr.cadeiras c ON c.id = o.cadeira_id
                      WHERE o.funcionario_id = f.id AND o.fim IS NULL AND c.cargo_id IS NOT NULL)
        THEN f.cargo_id
        ELSE COALESCE((SELECT c.id FROM hr.cargos c WHERE c.bar_id=CASE WHEN f.bar_manual THEN f.bar_id ELSE COALESCE(e.bar,f.bar_id) END AND public.normcat(c.nome)=public.normcat(e.cargo_nome) LIMIT 1), f.cargo_id)
      END,
      area_id = CASE
        WHEN EXISTS (SELECT 1 FROM hr.cadeira_ocupacao o JOIN hr.cadeiras c ON c.id = o.cadeira_id
                      WHERE o.funcionario_id = f.id AND o.fim IS NULL AND c.cargo_id IS NOT NULL AND c.area_id IS NOT NULL)
        THEN f.area_id
        ELSE COALESCE((SELECT a.id FROM hr.areas a WHERE a.bar_id=CASE WHEN f.bar_manual THEN f.bar_id ELSE COALESCE(e.bar,f.bar_id) END AND public.normcat(a.nome)=public.normcat(e.setor) LIMIT 1), f.area_id)
      END,
      tangerino_work_schedule_id = COALESCE(e.ws_id, f.tangerino_work_schedule_id),
      ativo = NOT e.fired,
      atualizado_em = now()
    FROM _tg_emp e WHERE e.existing_id = f.id;

    -- Continua criando quem o Tangerino tem e o Zykor não conhece. Não é contradição com "cadastrar
    -- só pelo Zykor": é a rede de segurança de quem foi admitido direto no Tangerino. Bloquear aqui
    -- deixaria a pessoa INVISÍVEL no Zykor — sem escala, sem CMO, sem ponto ligado a ninguém. Ela
    -- nasce sem cadeira e aparece na lista "Sem cadeira" do organograma, que é a pendência do RH.
    INSERT INTO hr.funcionarios (bar_id, nome, cpf, email, genero, data_admissao, ativo, cargo_id, area_id,
                                 tangerino_employee_id, tangerino_work_schedule_id, criado_em, atualizado_em)
    SELECT e.bar, e.nome, e.cpf, e.email, e.genero, e.admissao, NOT e.fired,
      (SELECT c.id FROM hr.cargos c WHERE c.bar_id=e.bar AND public.normcat(c.nome)=public.normcat(e.cargo_nome) LIMIT 1),
      (SELECT a.id FROM hr.areas  a WHERE a.bar_id=e.bar AND public.normcat(a.nome)=public.normcat(e.setor)      LIMIT 1),
      e.tid, e.ws_id, now(), now()
    FROM _tg_emp e WHERE e.existing_id IS NULL AND e.bar IS NOT NULL;
  END IF;

  RETURN v_report;
END $function$;
