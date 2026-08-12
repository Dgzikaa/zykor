-- =============================================================================
-- BACKFILL do Plano Operacional (abas JANEIRO..AGOSTO 2026) — 12/08/2026
-- =============================================================================
-- Gerado por scripts/backfill-plano-operacional.js. Idempotente (upsert por chave natural).
--
-- O FIXOS da planilha NÃO entra: era digitado à mão e divergia da escala em quase toda
-- função (só garçom batia). Decisão: a escala manda. `fixos_escala` é contado da
-- operations.escala_dia logo abaixo.
-- =============================================================================

-- 1) o dia planejado
insert into operations.operacao_dia
  (bar_id, data, turno, faturamento_previsto, publico_calculado, pico_calculado,
   programacao_musical, programacao_esportiva, entrada, promocao, plano_chao,
   pilula_treinamento, observacoes)
select 3, v.data::date, v.turno::operations.operacao_turno,
       v.fat, v.publico, v.pico, v.musical, v.esportiva, v.entrada, v.promocao,
       v.chao, v.pilula, v.obs
from (values
  ('2025-12-29','unico',30000,300,230.7692308,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2025-12-30','unico',50000,471.6981132,362.8447025,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2025-12-31','unico',0,0,0,null,null,null,null,null,null,null),
  ('2026-01-01','unico',0,0,0,null,null,null,null,null,null,null),
  ('2026-01-02','unico',70000,619.4690265,476.5146358,'Pagode vira-lata - Papo Em Off','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-03','unico',90000,873.7864078,672.1433906,'Feijoada + Tia Zélia + Beco da Rainha + Pagode Da Gigi','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-04','unico',0,0,0,null,null,null,null,null,null,null),
  ('2026-01-05','unico',30000,300,230.7692308,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
- Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-01-06','unico',40000,400,307.6923077,'Sete na Roda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montagem apertada, apenas parte coberta
- Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-01-07','unico',65000,613.2075472,471.6981132,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montar reservas mais próximas do palco, usar a lateral do Inss
- Não montar o Buraco do INSS
- Priorizar montagem de mesas nas áreas cobertas',null,null),
  ('2026-01-08','unico',20000,190.4761905,146.5201465,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão','- Montar reservas mais próximas do palco, usar a lateral do Inss
- Não montar o Buraco do INSS
- Priorizar montagem de mesas nas áreas cobertas',null,null),
  ('2026-01-09','unico',120000,1061.946903,816.8822328,'Pagode vira-lata - Benzadeus','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar INSS e buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-10','unico',140000,1359.223301,1045.556385,'Feijoada + Roda De Samba Com - Sambadona & Pagode da Gigi','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar INSS e buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-11','unico',65000,619.047619,476.1904762,'Pagode Com - Nossa Galera','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar INSS e buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-12','unico',20000,200,153.8461538,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.
-Reservar corredor do Inss e buraco para a reserva',null,null),
  ('2026-01-13','unico',15000,150,115.3846154,'Terça na Roda - Sete na Roda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montagem apertada, apenas parte coberta
- Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-01-14','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montar reservas mais próximas do palco, usar a lateral do Inss
- Não montar o Buraco do INSS
- Priorizar montagem de mesas nas áreas cobertas',null,null),
  ('2026-01-15','unico',25000,238.0952381,183.1501832,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão','- Montar reservas mais próximas do palco, usar a lateral do Inss
- Não montar o Buraco do INSS
- Priorizar montagem de mesas nas áreas cobertas',null,null),
  ('2026-01-16','unico',110000,973.4513274,748.8087134,'Pagode vira-lata com: Bonsai - Benzadeus
Piseiro com: Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-17','unico',190000,1844.660194,1418.96938,'STZ + Marina Íris e Marcelle Motta + Sambadona + Tá na Medida','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-18','unico',75000,714.2857143,549.4505495,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-19','unico',20000,200,153.8461538,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.
-Reservar corredor do Inss e buraco para a reserva',null,null),
  ('2026-01-20','unico',15000,150,115.3846154,'Terça na Roda - Sete na Roda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montagem apertada, apenas parte coberta
- Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-01-21','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montar reservas mais próximas do palco, usar a lateral do Inss
- Não montar o Buraco do INSS
- Priorizar montagem de mesas nas áreas cobertas',null,null),
  ('2026-01-22','unico',25000,238.0952381,183.1501832,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão','- Montar reservas mais próximas do palco, usar a lateral do Inss
- Não montar o Buraco do INSS
- Priorizar montagem de mesas nas áreas cobertas',null,null),
  ('2026-01-23','unico',135000,1194.690265,918.9925119,'Pagode vira-lata com: Bonsai - Benzadeus
Piseiro com: Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-24','unico',170000,1650.485437,1269.604182,'STZ + Sambadona + RECONVEXA','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-25','unico',60000,571.4285714,439.5604396,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-01-26','unico',15000,150,115.3846154,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-01-27','unico',15000,150,115.3846154,'Terça na Roda - Sete na Roda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montagem apertada, apenas parte coberta
- Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-01-29','unico',20000,188.6792453,145.137881,'Pé no Ordi com -Pé No Chão','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão','- Montagem apertada, apenas parte coberta
- Deixar aberto até a calçada para expandir se necessário',null,null),
  ('2026-01-30','unico',100000,943.3962264,725.6894049,'Pagode Vira-Lata com - Nossa Galera','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área cobert',null,null),
  ('2026-01-31','unico',175000,1650.943396,1269.956459,'Samaba da Tia Zélia + Sambadona + Pagode da Gigi','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área cobert',null,null),
  ('2026-02-01','unico',75000,728.1553398,560.1194922,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área cobert',null,null),
  ('2026-02-02','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-02-03','unico',10000,94.33962264,72.56894049,'7naRoda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-02-04','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-02-05','unico',20000,190.4761905,146.5201465,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-02-06','unico',110000,973.4513274,748.8087134,'BenzaDeus','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-02-07','unico',110000,1067.961165,821.5085885,'Feijoada','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-02-08','unico',50000,476.1904762,366.3003663,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-02-09','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-02-10','unico',15000,141.509434,108.8534107,'7naRoda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-02-11','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-02-12','unico',25000,238.0952381,183.1501832,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão',null,null,null),
  ('2026-02-13','unico',210000,1858.40708,1429.543907,null,'https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss e camarim)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-02-14','unico',140000,1359.223301,1045.556385,null,'https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss e camarim)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-02-15','unico',210000,2000,1538.461538,null,'https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss e camarim)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-02-16','unico',140000,1359.223301,1045.556385,null,'https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss e camarim)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-02-17','unico',90000,849.0566038,653.1204644,null,'https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-02-18','unico',20000,188.6792453,145.137881,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão',null,null,null),
  ('2026-02-19','unico',12000,114.2857143,87.91208791,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão',null,null,null),
  ('2026-02-20','unico',70000,619.4690265,476.5146358,'Pagode vira-lata - Papo Em Off','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-02-21','unico',80000,776.6990291,597.4607916,'Feijoada - Luiza Ceolin 
Roda de samba - Sambadona 
Pagode do DUDU','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-02-22','unico',40000,380.952381,293.040293,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h',null,null,null),
  ('2026-02-23','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-02-24','unico',10000,97.08737864,74.68259895,'7naRoda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-02-25','unico',30000,283.0188679,217.7068215,'Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-02-26','unico',15000,142.8571429,109.8901099,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-02-27','unico',60000,530.9734513,408.4411164,'Pagode Vira Lata - 
Bonsai, Dj Vinny, PAPO EM OFF (GOIÂNIA)
 e Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-02-28','unico',130000,1262.135922,970.8737864,'Legado do Samba - 
STZ, Sambadona,
 Pagode da Gigi e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-01','unico',50000,485.4368932,373.4129948,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25.00','HH Padrão','- Pista um pouco maior, com bistrôs.
- Explorar bem o INSS e o buraco
- Reservas o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área cobert',null,null),
  ('2026-03-02','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha
Entrada Free até ás 19hrs','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-03','unico',10000,94.33962264,72.56894049,'7naRoda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão + Entrada free até ás 19hrs','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-04','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - Jean Mussa','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão + Entrada free até ás 19hrs','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-03-05','unico',20000,190.4761905,146.5201465,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Entrada free até ás 19hrs','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-03-06','unico',130000,1203.703704,925.9259259,'BenzaDeus + Diggo','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta
- Expandir até a rua',null,null),
  ('2026-03-07','unico',70000,679.6116505,522.7781927,'Feijoada com - Tempero de Vó + Sambadona + Pagode do Dudu','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-08','unico',70000,666.6666667,512.8205128,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-09','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-10','unico',10000,94.33962264,72.56894049,'7naRoda e
 Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-11','unico',40000,377.3584906,290.275762,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-03-12','unico',25000,238.0952381,183.1501832,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-13','unico',110000,1018.518519,783.4757835,'Pagode Vira Lata -
 Bonsai, Dj Caju
 Benzadeus e Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-14','unico',100000,970.8737864,746.8259895,'Feijuca do Ordi - 
Dhi Ribeiro + Sambadona
 + Reconvexa e Dj Tiago Gioseffi','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta
- Expandir até a rua',null,null),
  ('2026-03-15','unico',60000,571.4285714,439.5604396,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-16','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol',null,null,'- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-17','unico',15000,141.509434,108.8534107,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol',null,null,'- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-18','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','-Montagem apertada, reservas mais próximas do palco para não da impressão de vazio
-Deixar espaço para bistrôs
-Não montar buraco do INSS',null,null),
  ('2026-03-19','unico',15000,142.8571429,109.8901099,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-20','unico',110000,1018.518519,783.4757835,'Pagode Vira Lata
 - Júlia Moreno, Dj Cxxju,
 Benzadeus e Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-21','unico',150000,1456.31068,1120.238984,'Feijuca do Ordi -
 STZ +
 Sambadona +
 Pagode da Gigi e Dj Ketlen','https://ge.globo.com/agenda/#/futebol','R$ 35 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-22','unico',90000,857.1428571,659.3406593,'Uma Mesa e Um Pagode
 - Doze e Dj Caio Hot','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-23','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-24','unico',15000,145.631068,112.0238984,'7naRoda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-25','unico',45000,424.5283019,326.5602322,'Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-03-26','unico',20000,190.4761905,146.5201465,'Pé no Ordi - 
Pé no Chão e Dj Negritah','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-27','unico',85000,787.037037,605.4131054,'Pagode Vira Lata -
 Bonsai, Dj Caju, Elas que Toquem 
e Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-28','unico',135000,1310.679612,1008.215086,'Feijuca do Ordi Legado do Samba STZ + 
Sambadona + 
Pagode do Dudu e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-29','unico',55000,523.8095238,402.9304029,'Uma Mesa e Um Pagode
 - Doze e Dj Caio Hot','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-03-30','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-03-31','unico',15000,145.631068,112.0238984,'7naRoda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-04-01','unico',65000,631.0679612,485.4368932,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-04-02','unico',80000,776.6990291,597.4607916,'VESPERA DE FERIADO |
 Pé no Ordi - Pé no Chão +
 convidados Fala Comigo, 
Manda Real e Tonzão + Dj Negritah','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-04-03','unico',80000,754.7169811,580.5515239,'FERIADO | 
Pagode Vira Lata -
 Bonsai, Dj Afrika, Benzadeus 
e Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-04-04','unico',90000,849.0566038,653.1204644,'Feijuca do Ordi -
 Dhi Ribeiro +
 Sambadona
 + Pagode do Dudu e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-04-05','unico',55000,523.8095238,402.9304029,'Uma Mesa e Um Pagode
 - Doze e Dj Sidharta','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-04-06','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-04-07','unico',15000,141.509434,108.8534107,'7naRoda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-04-08','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-04-09','unico',20000,190.4761905,146.5201465,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão',null,null,null),
  ('2026-04-10','unico',115000,1017.699115,782.8454731,'Bonsai, Benzadeus, Boka de Sergipe','https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss e camarim)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-04-11','unico',98000,951.4563107,731.8894698,'Dhi Ribeiro + Sambadona + Reconvexa e Dj Tiago Gioseffi','https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss e camarim)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-04-12','unico',55000,523.8095238,402.9304029,'Doze por Oito','https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss e camarim)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-04-13','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss e camarim)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-04-14','unico',15000,141.509434,108.8534107,'7naRoda','https://ge.globo.com/agenda/#/futebol',null,null,'-Pista somente com bistrôs 
-Expandir até a rua
-Três bares de cerveja (PP - corredor do Inss)
-Bar de Drinks 
-Boqueta de comida',null,null),
  ('2026-04-15','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - Breno Alves','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão',null,null,null),
  ('2026-04-16','unico',25000,238.0952381,183.1501832,'Pé no Ordi com Pé no chão','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão',null,null,null),
  ('2026-04-17','unico',115000,1017.699115,782.8454731,'Bonsai, Benzadeus, Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-04-18','unico',150000,1456.31068,1120.238984,'Feijuca do Ordi - STZ + Sambadona + Pagode da Gigi e Dj Ketlen','https://ge.globo.com/agenda/#/futebol','R$ 30 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-04-19','unico',90000,857.1428571,659.3406593,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-04-20','unico',90000,873.7864078,672.1433906,'Pré-Feriado - Clima de Montanha','https://ge.globo.com/agenda/#/futebol','R$ 25.00','Double Drinks + Barrigudinha','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-04-21','unico',35000,339.8058252,261.3890963,'7naRoda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-04-22','unico',30000,283.0188679,217.7068215,'Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão',null,null,null),
  ('2026-04-23','unico',20000,190.4761905,146.5201465,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão',null,null,null),
  ('2026-04-24','unico',105000,929.2035398,714.7719537,'Bonsai, Benzadeus, Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-04-25','unico',115000,1116.504854,858.849888,'Legado do Samba - 
STZ, Sambadona,
 Pagode da Gigi e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-04-26','unico',70000,666.6666667,512.8205128,'Uma Mesa e Um Pagode com: Doze Por Oito','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h',null,null,null),
  ('2026-04-27','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20.00','Double Drinks + Barrigudinha','- Montagem apertada, apenas parte coberta
-Deixar aberto até a calçada para expandir se necessário.',null,null),
  ('2026-04-28','unico',15000,145.631068,112.0238984,'7naRoda','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-04-29','unico',35000,330.1886792,253.9912917,'Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-04-30','unico',65000,619.047619,476.1904762,'Samba da Passarinha
Pré-feriado','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-01','unico',75000,728.1553398,560.1194922,'FERIADO | Pagode Vira Lata - Bonsai,
 Dj Cxxju,
 Elas que Toquem e Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-05-02','unico',100000,970.8737864,746.8259895,'Feijuca do Ordi - 
Dhi Ribeiro +
 Sambadona + 
STZ e Dj Tiago Gioseffi e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-03','unico',40000,377.3584906,290.275762,'Uma Mesa e Um Pagode -
 Doze e Dj A','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-04','unico',0,0,0,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20 - entrada','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-05-05','unico',25000,238.0952381,183.1501832,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-06','unico',35000,339.8058252,261.3890963,'Quarta de Bamba - 
Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','Double Drinks + Barrigudinha','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-07','unico',25000,235.8490566,181.4223512,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-08','unico',100000,943.3962264,725.6894049,'Pagode Vira Lata -
 Bonsai, Dj Cxxju,
 Benzadeus e Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-09','unico',115000,1095.238095,842.4908425,'Feijuca do Ordi - 
Dhi Ribeiro +
 Sambadona + 
Reconvexa e Dj Tiago Gioseffi','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-10','unico',40000,353.9823009,272.2940776,'Uma Mesa e Um Pagode -
 Doze e Dj Sidharta','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert',null,'- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-11','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20 - entrada','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-05-12','unico',25000,238.0952381,183.1501832,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-13','unico',35000,339.8058252,261.3890963,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-14','unico',35000,339.8058252,261.3890963,'Pé no Ordi - 
Heróis de Botequim (GO)
 + Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-15','unico',100000,943.3962264,725.6894049,'Pagode Vira Lata - 
Bonsai, Dj Cxxju, 
Benzadeus e Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-16','unico',100000,952.3809524,732.6007326,'Feijuca do Ordi -
 Dhi Ribeiro +
 Sambadona + STZ e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-17','unico',60000,530.9734513,408.4411164,'Uma Mesa e Um Pagode 
- Doze e Dj Artur Campos','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão
Dose dupla Caipi','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-18','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20 - entrada','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-05-19','unico',25000,238.0952381,183.1501832,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-20','unico',35000,339.8058252,261.3890963,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','Double Drinks + Barrigudinha','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-21','unico',25000,242.7184466,186.7064974,'Pé no Ordi - 
Pé no Chão e Dj Negritah','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-22','unico',70000,660.3773585,507.9825835,'Pagode Vira Lata -
 Bonsai, Dj Cxxju,
 Papo em Off (GO) e 
Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-23','unico',115000,1095.238095,842.4908425,'Feijuca do Ordi -
 Dhi Ribeiro 
+ Sambadona 
+ Samba da Passarinha & 
Dj Libertina e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-24','unico',60000,530.9734513,408.4411164,'Uma Mesa e Um Pagode
 - Doze e Dj Larbac','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-25','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20 - entrada','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-05-26','unico',25000,238.0952381,183.1501832,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-27','unico',35000,339.8058252,261.3890963,'Quarta de Bamba -
 Projeto Favela Sounds | 
Breno Alves +
 Nelson Rufino (BA)
 e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','Double Drinks + Barrigudinha','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-28','unico',25000,242.7184466,186.7064974,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-05-29','unico',90000,849.0566038,653.1204644,'Pagode Vira Lata -
 Bonsai, Dj Cxxju, 
Benzadeus e Boka de Sergipe','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-30','unico',115000,1095.238095,842.4908425,'Feijuca do Ordi - STZ +
 Sambadona +
 Elas que Toquem e Dj Ketlen','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-05-31','unico',50000,442.4778761,340.367597,'Uma Mesa e Um Pagode -
 Doze e Dj Caio Hot','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-01','unico',15000,145.631068,112.0238984,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-06-02','unico',20000,194.1747573,149.3651979,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-03','unico',60000,566.0377358,435.413643,'VÉSPERA DE FERIADO |
 Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta','Treinamento cozinha - Hamburguers',null),
  ('2026-06-04','unico',40000,377.3584906,290.275762,'FERIADO | Pé no Ordi - Projeto C.E.P.
 | Pé no Chão + 
Matheus Pessanha e 
Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 20 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-05','unico',90000,857.1428571,659.3406593,'Pagode Vira Lata -
 Bonsai, Dj Cxxju, Benzadeus e
 Evelyn Santos -
 A foguetinha','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta','Treinamento cozinha - Chapas',null),
  ('2026-06-06','unico',120000,1165.048544,896.1911875,'Feijuca do Ordi 
- Projeto C.E.P. |
 STZ + João Martins (RJ) 
+ Jacob + Sambadona + 
Reconvexa e
 Dj Tiago Gioseffi a confirmar','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-07','unico',50000,471.6981132,362.8447025,'Uma Mesa e Um Pagode - 
Doze e Dj a confirmar','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-08','unico',20000,188.6792453,145.137881,'Segunda da Resenha
GUEST COPA','https://ge.globo.com/agenda/#/futebol','R$ 20 - entrada','Double Drinks + Barrigudinha','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-09','unico',20000,190.4761905,146.5201465,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-10','unico',40000,353.9823009,272.2940776,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-11','unico',25000,242.7184466,186.7064974,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-06-12','unico',50000,476.1904762,366.3003663,'Pagode Vira Lata - 
Bonsai, Dj Vinny, Papo em Off (GO) 
e Evelyn Santos 
- A foguetinha','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão + Dose Dupla Caipirosca de limão até ás 20hrs','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-13','unico',130000,1262.135922,970.8737864,'BRASIL X MARROCOS
 19:00 | STZ','https://ge.globo.com/agenda/#/futebol','ENTRADA',null,'- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-14','unico',40000,388.3495146,298.7303958,'Uma Mesa e Um Pagode -
 Leozinho e Dj Caio Hot','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-15','unico',15000,141.509434,108.8534107,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','Double Drinks + Barrigudinha','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-16','unico',15000,142.8571429,109.8901099,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-17','unico',40000,353.9823009,272.2940776,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-18','unico',25000,242.7184466,186.7064974,'Pé no Ordi -
 Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 20 - entrada','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-06-19','unico',130000,1238.095238,952.3809524,'BRASIL X HAITI 22:00
 | Pagode Vira Lata -
 Bonsai, Dj Cxxju, 
Benzadeus (a confirmar) e Evelyn Santos -
 A foguetinha (a confirmar)','https://ge.globo.com/agenda/#/futebol','ENTRADA',null,'- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-20','unico',78000,757.2815534,582.5242718,'Feijuca do Ordi -
 Dhi Ribeiro + Sambadona +
 Samba da Passarinha
 e Dj Afrika a cofirmar','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-21','unico',45000,436.8932039,336.0716953,'Uma Mesa e Um Pagode - 
Doze e Dj a confirmar','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-22','unico',10000,94.33962264,72.56894049,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20 - COUVERT','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-06-23','unico',15000,142.8571429,109.8901099,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-06-24','unico',90000,796.460177,612.6616746,'BRASIL X ESCÓCIA 19:00 |
 Quarta de Bamba - 
Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','ENTRADA',null,'- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-25','unico',25000,242.7184466,186.7064974,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-06-26','unico',80000,761.9047619,586.0805861,'Pagode Vira Lata -
 Bonsai, Dj Cxxju, 
Benzadeus e 
Evelyn Santos - A foguetinha','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-27','unico',70000,679.6116505,522.7781927,'Feijuca do Ordi - STZ 
+ Sambadona +
 Reconvexa e
 Dj Ketlen a confirmar','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-06-28','unico',40000,388.3495146,298.7303958,'Uma Mesa e Um Pagode
 - Doze e Dj a confirmar','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão + Douple Caipi até 18h','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-06-29','unico',115000,1084.90566,834.5428157,'BRASIL 1º X
 (HOLANDA OU JAPÃO)','https://ge.globo.com/agenda/#/futebol','ENTRADA',null,'- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-06-30','unico',15000,142.8571429,109.8901099,'16º COPA | 
7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-01','unico',25000,242.7184466,186.7064974,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-07-02','unico',15000,145.631068,112.0238984,'Pé no Ordi -
 Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-03','unico',70000,660.3773585,507.9825835,'Pagode Vira Lata -
 Bonsai, Benzadeus,
 Boka de Sergipe e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-04','unico',65000,613.2075472,471.6981132,'Feijuca do Ordi - 
Samba e Pagode Dududu 
+ Sambadona +
Dj a confirmar + 
Dj a confirmar + Oitavas de Copa','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-05','unico',50000,471.6981132,362.8447025,'BRASIL PASSANDO EM PRIMEIRO
 - OITAVAS BRASIL 17HRS 
-> DOZE, DJ LARBAC','https://ge.globo.com/agenda/#/futebol','ENTRADA','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-06','unico',10000,97.08737864,74.68259895,'Segunda da Resenha +
 OITAVAS COPA','https://ge.globo.com/agenda/#/futebol','R$ 20 - couvert','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-07-07','unico',15000,145.631068,112.0238984,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-07-08','unico',35000,330.1886792,253.9912917,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-07-09','unico',15000,141.509434,108.8534107,'QUARTAS Copa ->
 PÉ NO CHÃO E DJ VINNY','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-10','unico',75000,714.2857143,549.4505495,'Pagode Vira Lata -
 Bonsai, Benzadeus,
 Boka de Sergipe e Dj Cxxju','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-11','unico',80000,707.9646018,544.5881552,'Feijuca do Ordi - 
Hoje eu Vou (16h), STZ (20h),
 Dj a New Nay e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-12','unico',45000,436.8932039,336.0716953,'Uma Mesa e Um Pagode -
 Doze e Dj A','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão + Douple Caipi até 18h','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-07-13','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20 - couvert','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-07-14','unico',14300,138.8349515,106.7961165,'SEMIFINAL 16HRS -> 
7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-07-15','unico',35000,330.1886792,253.9912917,'BRASIL PASSANDO EM PRIMEIRO
 - SEMIFINAL BRASIL 16HRS ->
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-07-16','unico',15000,141.509434,108.8534107,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','Double Drinks + Barrigudinha','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-17','unico',75000,714.2857143,549.4505495,'Pagode Vira Lata 
- Bonsai, Benzadeus*,
 Boka de Sergipe e Dj Cxxju','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-18','unico',80000,707.9646018,544.5881552,'STZ na Feijoada - 
Sambadona Depois - DJ','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-19','unico',65000,631.0679612,485.4368932,'FINAL DA COPA AS 16 hrs -
 DOZE, DJ PEPÊ E DJ
 A CONFIRMAR','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-07-20','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 20 - couvert','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-07-21','unico',14300,138.8349515,106.7961165,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-07-22','unico',40000,377.3584906,290.275762,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-07-23','unico',15000,141.509434,108.8534107,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - couvert','Double Drinks + Barrigudinha','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-24','unico',90000,857.1428571,659.3406593,'Pagode Vira Lata - 
Bonsai, Benzadeus*,
 Boka de Sergipe e DJ Cxxju','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-25','unico',60000,530.9734513,408.4411164,'Feijuca do Ordi - 
Samba e Pagode do Dududu,
 Sambadona, 
Dj Tiago Gioseffi e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-07-26','unico',45000,436.8932039,336.0716953,'Uma Mesa e Um Pagode 
- Doze e Dj Sidharta','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-07-27','unico',10000,97.08737864,74.68259895,'Segunda da Resenha','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-07-28','unico',14300,138.8349515,106.7961165,'7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-07-29','unico',75000,707.5471698,544.2670537,'Favela Sounds + Favelas Talks 
| Quarta de Bamba - Breno Alves +
 Nelson Rufino (BA) e
 Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-07-30','unico',45000,424.5283019,326.5602322,'Trio Forró Legal [evento UnB] 
+ Pé no Ordi - 
Pé no Chão e Dj Ketlen','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-07-31','unico',70000,660.3773585,507.9825835,'Pagode Vira Lata - 
Bonsai, Benzadeus, Boka de Sergipe
 e Dj Cxxju','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-08-01','unico',65000,613.2075472,471.6981132,'Feijuca do Ordi - 
Samba e Pagode Dududu,
 Samba da Tia Zélia, 
Dj Tiago Gioseffi e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-08-02','unico',40000,377.3584906,290.275762,'Uma Mesa e Um Pagode
 - Doze por Oito e Dj Pepê','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada','HH Padrão + Douple Caipi até 18h','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-08-03','unico',10000,97.08737864,74.68259895,'Fala Comigo','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-04','unico',15000,145.631068,112.0238984,'Terça na Roda - 
7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-05','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - 
Breno Alves e Dj 
a confirmar (Audiovisual)','Agenda de Jogos de Hoje | ge','R$ 25 - entrada free até ás 19hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-08-06','unico',20000,188.6792453,145.137881,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-07','unico',60000,571.4285714,439.5604396,'Pagode Vira Lata -
 Bonsai, Clima de Montanha,
 Boka de Sergipe e Dj Cxxju','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-08-08','dia',40000,353.9823009,272.2940776,'Feijuca do Ordi - 
Samba e Pagode Dududu','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','-Pista somente com mesas
-Reservas na área coberta, longe do sol
-Montar feijoada na frente da boqueta de comida',null,null),
  ('2026-08-08','noite',30000,265.4867257,204.2205582,'Sambadona, 
Dj Jess Ullun e 
Dj Tiago Gioseffi','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-08-09','unico',45000,436.8932039,336.0716953,'Uma Mesa e Um Pagode
 - Doze por Oito e Dj A','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão + Douple Caipi até 18h','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-08-10','unico',10000,97.08737864,74.68259895,'Fala Comigo','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-11','unico',15000,145.631068,112.0238984,'Terça na Roda
 - 7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-12','unico',35000,330.1886792,253.9912917,'Quarta de Bamba - 
Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-08-13','unico',19000,179.245283,137.8809869,'Pé no Ordi - 
Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-14','unico',70000,666.6666667,512.8205128,'Pagode Vira Lata - 
Bonsai, Benzadeus,
 Evelyn Santos -
 A Foguetinha e Dj Afrika','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-08-15','dia',8000,70.79646018,54.45881552,'Feijuca do Ordi - 
Samba e Pagode Dududu','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','-Pista somente com mesas
-Reservas na área coberta, longe do sol
-Montar feijoada na frente da boqueta de comida
-',null,null),
  ('2026-08-15','noite',45000,398.2300885,306.3308373,'Sambadona, 
Dj Jess Ullun e 
Dj Tiago Gioseffi','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-08-16','unico',45000,436.8932039,336.0716953,'Uma Mesa e Um Pagode - 
Doze por Oito e Dj Larbac','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-08-17','unico',10000,97.08737864,74.68259895,'Fala Comigo','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-18','unico',15000,145.631068,112.0238984,'Terça na Roda - 7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-19','unico',35000,330.1886792,253.9912917,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-08-20','unico',20000,188.6792453,145.137881,'Pé no Ordi - Pé no Chão e Dj Vinny','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-21','unico',85000,809.5238095,622.7106227,'Pagode Vira Lata -
 Bonsai, Benzadeus, 
Boka de Sergipe e Dj Cxxju','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-08-22','dia',8000,70.79646018,54.45881552,'Feijuca do Ordi - 
Samba e Pagode Dududu','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','-Pista somente com mesas
-Reservas na área coberta, longe do sol
-Montar feijoada na frente da boqueta de comida
-',null,null),
  ('2026-08-22','noite',50000,442.4778761,340.367597,'Sambadona, 
Dj Jess Ullun e 
Dj Tiago Gioseffi','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-08-23','unico',45000,436.8932039,336.0716953,'Uma Mesa e Um Pagode -
 Doze por Oito e Dj Sidharta','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null),
  ('2026-08-24','unico',15,0.145631068,0.1120238984,'Fala Comigo','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','Double Drinks + Barrigudinha','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-25','unico',15000,145.631068,112.0238984,'Terça na Roda
7naRoda e Dj Leo Cabral','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-26','unico',35000,330.1886792,253.9912917,'Quarta de Bamba -
 Breno Alves e Dj Jess Ullun','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Montar reservas na área coberta',null,null),
  ('2026-08-27','unico',20000,188.6792453,145.137881,'Pé no Ordi - Pé no Chão e Dj Ketlen','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 19hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS',null,null),
  ('2026-08-28','unico',85000,801.8867925,616.8359942,'Pagode Vira Lata -
 Bonsai, Benzadeus,
 Boka de Sergipe e Dj Cxxju','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-08-29','dia',8000,70.79646018,54.45881552,'Feijuca do Ordi - 
Samba e Pagode Dududu','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','-Pista somente com mesas
-Reservas na área coberta, longe do sol
-Montar feijoada na frente da boqueta de comida
-',null,null),
  ('2026-08-29','noite',65000,575.2212389,442.4778761,'Sambadona, 
Dj Jess Ullun e 
Dj Tiago Gioseffi','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','- Pista um pouco maior, com bistrôs.
- Reservas grandes o mais afastado da pista possível, montar reservas pequenas mais próximas para facilitar a remoção de mesas
- Montar reservas na área coberta',null,null),
  ('2026-08-30','unico',45000,424.5283019,326.5602322,'Uma Mesa e Um Pagode - 
Doze por Oito e Dj Pepê','https://ge.globo.com/agenda/#/futebol','R$ 25 - entrada free até ás 18hrs','HH Padrão','-Montagem mais apertada
-Deixar espaço para bistrôs
-Reservas mais próximas ao palco
-Não montar buraco do INSS
-Não montar corredor do INSS',null,null)
) as v(data, turno, fat, publico, pico, musical, esportiva, entrada, promocao, chao, pilula, obs)
on conflict (bar_id, data, turno) do update
   set faturamento_previsto = excluded.faturamento_previsto,
       publico_calculado    = excluded.publico_calculado,
       pico_calculado       = excluded.pico_calculado,
       programacao_musical  = excluded.programacao_musical,
       programacao_esportiva= excluded.programacao_esportiva,
       entrada              = excluded.entrada,
       promocao             = excluded.promocao,
       plano_chao           = excluded.plano_chao,
       pilula_treinamento   = excluded.pilula_treinamento,
       observacoes          = excluded.observacoes,
       atualizado_em        = now();

-- 2) o TOTAL planejado por função
insert into operations.operacao_dia_funcao (operacao_dia_id, funcao_id, total_calculado)
select d.id, f.id, v.total
from (values
  ('2025-12-29','unico','garcom',10),
  ('2025-12-29','unico','cumim',6),
  ('2025-12-29','unico','host',3),
  ('2025-12-29','unico','asg',3),
  ('2025-12-29','unico','bartender',3),
  ('2025-12-29','unico','barback',4),
  ('2025-12-29','unico','cozinha',2),
  ('2025-12-29','unico','seguranca',1),
  ('2025-12-29','unico','brigadista',0),
  ('2025-12-30','unico','garcom',15),
  ('2025-12-30','unico','cumim',10),
  ('2025-12-30','unico','host',4),
  ('2025-12-30','unico','asg',3),
  ('2025-12-30','unico','bartender',3),
  ('2025-12-30','unico','barback',4),
  ('2025-12-30','unico','cozinha',4),
  ('2025-12-30','unico','seguranca',3),
  ('2025-12-30','unico','brigadista',0),
  ('2025-12-31','unico','garcom',0),
  ('2025-12-31','unico','cumim',0),
  ('2025-12-31','unico','host',0),
  ('2025-12-31','unico','asg',0),
  ('2025-12-31','unico','bartender',0),
  ('2025-12-31','unico','barback',0),
  ('2025-12-31','unico','cozinha',0),
  ('2025-12-31','unico','seguranca',7),
  ('2025-12-31','unico','brigadista',0),
  ('2026-01-01','unico','garcom',0),
  ('2026-01-01','unico','cumim',0),
  ('2026-01-01','unico','host',0),
  ('2026-01-01','unico','asg',0),
  ('2026-01-01','unico','bartender',0),
  ('2026-01-01','unico','barback',5),
  ('2026-01-01','unico','cozinha',0),
  ('2026-01-01','unico','seguranca',3),
  ('2026-01-01','unico','brigadista',0),
  ('2026-01-02','unico','garcom',20),
  ('2026-01-02','unico','cumim',12),
  ('2026-01-02','unico','host',5),
  ('2026-01-02','unico','asg',4),
  ('2026-01-02','unico','bartender',4),
  ('2026-01-02','unico','barback',6),
  ('2026-01-02','unico','cozinha',4),
  ('2026-01-02','unico','seguranca',8),
  ('2026-01-02','unico','brigadista',2),
  ('2026-01-03','unico','garcom',27),
  ('2026-01-03','unico','cumim',17),
  ('2026-01-03','unico','host',8),
  ('2026-01-03','unico','asg',6),
  ('2026-01-03','unico','bartender',4),
  ('2026-01-03','unico','barback',7),
  ('2026-01-03','unico','cozinha',6),
  ('2026-01-03','unico','seguranca',4),
  ('2026-01-03','unico','brigadista',2),
  ('2026-01-04','unico','garcom',12),
  ('2026-01-04','unico','cumim',7),
  ('2026-01-04','unico','host',4),
  ('2026-01-04','unico','asg',4),
  ('2026-01-04','unico','bartender',3),
  ('2026-01-04','unico','barback',4),
  ('2026-01-04','unico','cozinha',4),
  ('2026-01-04','unico','seguranca',9),
  ('2026-01-04','unico','brigadista',0),
  ('2026-01-05','unico','garcom',10),
  ('2026-01-05','unico','cumim',6),
  ('2026-01-05','unico','host',3),
  ('2026-01-05','unico','asg',2),
  ('2026-01-05','unico','bartender',3),
  ('2026-01-05','unico','barback',2),
  ('2026-01-05','unico','cozinha',2),
  ('2026-01-05','unico','seguranca',0),
  ('2026-01-05','unico','brigadista',0),
  ('2026-01-06','unico','garcom',13),
  ('2026-01-06','unico','cumim',8),
  ('2026-01-06','unico','host',4),
  ('2026-01-06','unico','asg',3),
  ('2026-01-06','unico','bartender',3),
  ('2026-01-06','unico','barback',4),
  ('2026-01-06','unico','cozinha',3),
  ('2026-01-06','unico','seguranca',2),
  ('2026-01-06','unico','brigadista',0),
  ('2026-01-07','unico','garcom',19),
  ('2026-01-07','unico','cumim',12),
  ('2026-01-07','unico','host',5),
  ('2026-01-07','unico','asg',4),
  ('2026-01-07','unico','bartender',4),
  ('2026-01-07','unico','barback',5),
  ('2026-01-07','unico','cozinha',4),
  ('2026-01-07','unico','seguranca',5),
  ('2026-01-07','unico','brigadista',0),
  ('2026-01-08','unico','garcom',6),
  ('2026-01-08','unico','cumim',4),
  ('2026-01-08','unico','host',2),
  ('2026-01-08','unico','asg',2),
  ('2026-01-08','unico','bartender',1),
  ('2026-01-08','unico','barback',2),
  ('2026-01-08','unico','cozinha',2),
  ('2026-01-08','unico','seguranca',1),
  ('2026-01-08','unico','brigadista',0),
  ('2026-01-09','unico','garcom',33),
  ('2026-01-09','unico','cumim',21),
  ('2026-01-09','unico','host',9),
  ('2026-01-09','unico','asg',7),
  ('2026-01-09','unico','bartender',6),
  ('2026-01-09','unico','barback',9),
  ('2026-01-09','unico','cozinha',7),
  ('2026-01-09','unico','seguranca',8),
  ('2026-01-09','unico','brigadista',2),
  ('2026-01-10','unico','garcom',33),
  ('2026-01-10','unico','cumim',19),
  ('2026-01-10','unico','host',8),
  ('2026-01-10','unico','asg',7),
  ('2026-01-10','unico','bartender',6),
  ('2026-01-10','unico','barback',9),
  ('2026-01-10','unico','cozinha',5),
  ('2026-01-10','unico','seguranca',10),
  ('2026-01-10','unico','brigadista',2),
  ('2026-01-11','unico','garcom',20),
  ('2026-01-11','unico','cumim',12),
  ('2026-01-11','unico','host',5),
  ('2026-01-11','unico','asg',4),
  ('2026-01-11','unico','bartender',4),
  ('2026-01-11','unico','barback',5),
  ('2026-01-11','unico','cozinha',4),
  ('2026-01-11','unico','seguranca',7),
  ('2026-01-11','unico','brigadista',0),
  ('2026-01-12','unico','garcom',10),
  ('2026-01-12','unico','cumim',8),
  ('2026-01-12','unico','host',2),
  ('2026-01-12','unico','asg',2),
  ('2026-01-12','unico','bartender',2),
  ('2026-01-12','unico','barback',3),
  ('2026-01-12','unico','cozinha',2),
  ('2026-01-12','unico','seguranca',1),
  ('2026-01-12','unico','brigadista',0),
  ('2026-01-13','unico','garcom',5),
  ('2026-01-13','unico','cumim',3),
  ('2026-01-13','unico','host',2),
  ('2026-01-13','unico','asg',2),
  ('2026-01-13','unico','bartender',1),
  ('2026-01-13','unico','barback',3),
  ('2026-01-13','unico','cozinha',1),
  ('2026-01-13','unico','seguranca',2),
  ('2026-01-13','unico','brigadista',0),
  ('2026-01-14','unico','garcom',11),
  ('2026-01-14','unico','cumim',7),
  ('2026-01-14','unico','host',3),
  ('2026-01-14','unico','asg',2),
  ('2026-01-14','unico','bartender',2),
  ('2026-01-14','unico','barback',4),
  ('2026-01-14','unico','cozinha',2),
  ('2026-01-14','unico','seguranca',6),
  ('2026-01-14','unico','brigadista',0),
  ('2026-01-15','unico','garcom',8),
  ('2026-01-15','unico','cumim',5),
  ('2026-01-15','unico','host',2),
  ('2026-01-15','unico','asg',2),
  ('2026-01-15','unico','bartender',2),
  ('2026-01-15','unico','barback',2),
  ('2026-01-15','unico','cozinha',2),
  ('2026-01-15','unico','seguranca',1),
  ('2026-01-15','unico','brigadista',0),
  ('2026-01-16','unico','garcom',30),
  ('2026-01-16','unico','cumim',19),
  ('2026-01-16','unico','host',8),
  ('2026-01-16','unico','asg',6),
  ('2026-01-16','unico','bartender',5),
  ('2026-01-16','unico','barback',8),
  ('2026-01-16','unico','cozinha',6),
  ('2026-01-16','unico','seguranca',9),
  ('2026-01-16','unico','brigadista',2),
  ('2026-01-17','unico','garcom',57),
  ('2026-01-17','unico','cumim',36),
  ('2026-01-17','unico','host',15),
  ('2026-01-17','unico','asg',11),
  ('2026-01-17','unico','bartender',10),
  ('2026-01-17','unico','barback',8),
  ('2026-01-17','unico','cozinha',11),
  ('2026-01-17','unico','seguranca',10),
  ('2026-01-17','unico','brigadista',2),
  ('2026-01-18','unico','garcom',22),
  ('2026-01-18','unico','cumim',14),
  ('2026-01-18','unico','host',6),
  ('2026-01-18','unico','asg',5),
  ('2026-01-18','unico','bartender',4),
  ('2026-01-18','unico','barback',6),
  ('2026-01-18','unico','cozinha',5),
  ('2026-01-18','unico','seguranca',7),
  ('2026-01-18','unico','brigadista',1),
  ('2026-01-19','unico','garcom',10),
  ('2026-01-19','unico','cumim',8),
  ('2026-01-19','unico','host',2),
  ('2026-01-19','unico','asg',2),
  ('2026-01-19','unico','bartender',2),
  ('2026-01-19','unico','barback',3),
  ('2026-01-19','unico','cozinha',2),
  ('2026-01-19','unico','seguranca',1),
  ('2026-01-19','unico','brigadista',0),
  ('2026-01-20','unico','garcom',6),
  ('2026-01-20','unico','cumim',3),
  ('2026-01-20','unico','host',2),
  ('2026-01-20','unico','asg',2),
  ('2026-01-20','unico','bartender',1),
  ('2026-01-20','unico','barback',3),
  ('2026-01-20','unico','cozinha',1),
  ('2026-01-20','unico','seguranca',2),
  ('2026-01-20','unico','brigadista',0),
  ('2026-01-21','unico','garcom',11),
  ('2026-01-21','unico','cumim',7),
  ('2026-01-21','unico','host',4),
  ('2026-01-21','unico','asg',2),
  ('2026-01-21','unico','bartender',2),
  ('2026-01-21','unico','barback',4),
  ('2026-01-21','unico','cozinha',2),
  ('2026-01-21','unico','seguranca',6),
  ('2026-01-21','unico','brigadista',0),
  ('2026-01-22','unico','garcom',8),
  ('2026-01-22','unico','cumim',7),
  ('2026-01-22','unico','host',2),
  ('2026-01-22','unico','asg',3),
  ('2026-01-22','unico','bartender',3),
  ('2026-01-22','unico','barback',4),
  ('2026-01-22','unico','cozinha',2),
  ('2026-01-22','unico','seguranca',3),
  ('2026-01-22','unico','brigadista',0),
  ('2026-01-23','unico','garcom',37),
  ('2026-01-23','unico','cumim',22),
  ('2026-01-23','unico','host',10),
  ('2026-01-23','unico','asg',8),
  ('2026-01-23','unico','bartender',7),
  ('2026-01-23','unico','barback',10),
  ('2026-01-23','unico','cozinha',8),
  ('2026-01-23','unico','seguranca',9),
  ('2026-01-23','unico','brigadista',2),
  ('2026-01-24','unico','garcom',40),
  ('2026-01-24','unico','cumim',32),
  ('2026-01-24','unico','host',13),
  ('2026-01-24','unico','asg',10),
  ('2026-01-24','unico','bartender',9),
  ('2026-01-24','unico','barback',8),
  ('2026-01-24','unico','cozinha',10),
  ('2026-01-24','unico','seguranca',12),
  ('2026-01-24','unico','brigadista',2),
  ('2026-01-25','unico','garcom',18),
  ('2026-01-25','unico','cumim',11),
  ('2026-01-25','unico','host',5),
  ('2026-01-25','unico','asg',4),
  ('2026-01-25','unico','bartender',3),
  ('2026-01-25','unico','barback',5),
  ('2026-01-25','unico','cozinha',4),
  ('2026-01-25','unico','seguranca',7),
  ('2026-01-25','unico','brigadista',1),
  ('2026-01-26','unico','garcom',5),
  ('2026-01-26','unico','cumim',3),
  ('2026-01-26','unico','host',2),
  ('2026-01-26','unico','asg',2),
  ('2026-01-26','unico','bartender',1),
  ('2026-01-26','unico','barback',3),
  ('2026-01-26','unico','cozinha',1),
  ('2026-01-26','unico','seguranca',1),
  ('2026-01-26','unico','brigadista',0),
  ('2026-01-27','unico','garcom',5),
  ('2026-01-27','unico','cumim',3),
  ('2026-01-27','unico','host',2),
  ('2026-01-27','unico','asg',1),
  ('2026-01-27','unico','bartender',1),
  ('2026-01-27','unico','barback',2),
  ('2026-01-27','unico','cozinha',1),
  ('2026-01-27','unico','seguranca',1),
  ('2026-01-27','unico','brigadista',0),
  ('2026-01-29','unico','garcom',6),
  ('2026-01-29','unico','cumim',4),
  ('2026-01-29','unico','host',2),
  ('2026-01-29','unico','asg',2),
  ('2026-01-29','unico','bartender',2),
  ('2026-01-29','unico','barback',2),
  ('2026-01-29','unico','cozinha',2),
  ('2026-01-29','unico','seguranca',3),
  ('2026-01-29','unico','brigadista',0),
  ('2026-01-30','unico','garcom',30),
  ('2026-01-30','unico','cumim',19),
  ('2026-01-30','unico','host',8),
  ('2026-01-30','unico','asg',6),
  ('2026-01-30','unico','bartender',5),
  ('2026-01-30','unico','barback',8),
  ('2026-01-30','unico','cozinha',6),
  ('2026-01-30','unico','seguranca',10),
  ('2026-01-30','unico','brigadista',1),
  ('2026-01-31','unico','garcom',38),
  ('2026-01-31','unico','cumim',20),
  ('2026-01-31','unico','host',9),
  ('2026-01-31','unico','asg',8),
  ('2026-01-31','unico','bartender',8),
  ('2026-01-31','unico','barback',9),
  ('2026-01-31','unico','cozinha',10),
  ('2026-01-31','unico','seguranca',10),
  ('2026-01-31','unico','brigadista',2),
  ('2026-02-01','unico','garcom',23),
  ('2026-02-01','unico','cumim',15),
  ('2026-02-01','unico','host',6),
  ('2026-02-01','unico','asg',5),
  ('2026-02-01','unico','bartender',5),
  ('2026-02-01','unico','barback',6),
  ('2026-02-01','unico','cozinha',5),
  ('2026-02-01','unico','seguranca',6),
  ('2026-02-01','unico','brigadista',0),
  ('2026-02-02','unico','garcom',3),
  ('2026-02-02','unico','cumim',2),
  ('2026-02-02','unico','host',1),
  ('2026-02-02','unico','asg',2),
  ('2026-02-02','unico','bartender',3),
  ('2026-02-02','unico','barback',2),
  ('2026-02-02','unico','cozinha',2),
  ('2026-02-02','unico','seguranca',1),
  ('2026-02-02','unico','brigadista',0),
  ('2026-02-03','unico','garcom',3),
  ('2026-02-03','unico','cumim',2),
  ('2026-02-03','unico','host',1),
  ('2026-02-03','unico','asg',1),
  ('2026-02-03','unico','bartender',2),
  ('2026-02-03','unico','barback',2),
  ('2026-02-03','unico','cozinha',2),
  ('2026-02-03','unico','seguranca',2),
  ('2026-02-03','unico','brigadista',0),
  ('2026-02-04','unico','garcom',11),
  ('2026-02-04','unico','cumim',7),
  ('2026-02-04','unico','host',3),
  ('2026-02-04','unico','asg',3),
  ('2026-02-04','unico','bartender',3),
  ('2026-02-04','unico','barback',4),
  ('2026-02-04','unico','cozinha',4),
  ('2026-02-04','unico','seguranca',4),
  ('2026-02-04','unico','brigadista',0),
  ('2026-02-05','unico','garcom',6),
  ('2026-02-05','unico','cumim',4),
  ('2026-02-05','unico','host',2),
  ('2026-02-05','unico','asg',2),
  ('2026-02-05','unico','bartender',2),
  ('2026-02-05','unico','barback',3),
  ('2026-02-05','unico','cozinha',4),
  ('2026-02-05','unico','seguranca',3),
  ('2026-02-05','unico','brigadista',0),
  ('2026-02-06','unico','garcom',30),
  ('2026-02-06','unico','cumim',19),
  ('2026-02-06','unico','host',8),
  ('2026-02-06','unico','asg',7),
  ('2026-02-06','unico','bartender',6),
  ('2026-02-06','unico','barback',8),
  ('2026-02-06','unico','cozinha',6),
  ('2026-02-06','unico','seguranca',10),
  ('2026-02-06','unico','brigadista',2),
  ('2026-02-07','unico','garcom',45),
  ('2026-02-07','unico','cumim',30),
  ('2026-02-07','unico','host',9),
  ('2026-02-07','unico','asg',7),
  ('2026-02-07','unico','bartender',7),
  ('2026-02-07','unico','barback',9),
  ('2026-02-07','unico','cozinha',7),
  ('2026-02-07','unico','seguranca',9),
  ('2026-02-07','unico','brigadista',2),
  ('2026-02-08','unico','garcom',15),
  ('2026-02-08','unico','cumim',10),
  ('2026-02-08','unico','host',4),
  ('2026-02-08','unico','asg',4),
  ('2026-02-08','unico','bartender',4),
  ('2026-02-08','unico','barback',4),
  ('2026-02-08','unico','cozinha',3),
  ('2026-02-08','unico','seguranca',7),
  ('2026-02-08','unico','brigadista',1),
  ('2026-02-09','unico','garcom',3),
  ('2026-02-09','unico','cumim',2),
  ('2026-02-09','unico','host',1),
  ('2026-02-09','unico','asg',1),
  ('2026-02-09','unico','bartender',1),
  ('2026-02-09','unico','barback',1),
  ('2026-02-09','unico','cozinha',1),
  ('2026-02-09','unico','seguranca',0),
  ('2026-02-09','unico','brigadista',0),
  ('2026-02-10','unico','garcom',5),
  ('2026-02-10','unico','cumim',3),
  ('2026-02-10','unico','host',2),
  ('2026-02-10','unico','asg',2),
  ('2026-02-10','unico','bartender',2),
  ('2026-02-10','unico','barback',2),
  ('2026-02-10','unico','cozinha',1),
  ('2026-02-10','unico','seguranca',0),
  ('2026-02-10','unico','brigadista',0),
  ('2026-02-11','unico','garcom',11),
  ('2026-02-11','unico','cumim',7),
  ('2026-02-11','unico','host',3),
  ('2026-02-11','unico','asg',3),
  ('2026-02-11','unico','bartender',3),
  ('2026-02-11','unico','barback',3),
  ('2026-02-11','unico','cozinha',2),
  ('2026-02-11','unico','seguranca',2),
  ('2026-02-11','unico','brigadista',2),
  ('2026-02-12','unico','garcom',8),
  ('2026-02-12','unico','cumim',5),
  ('2026-02-12','unico','host',2),
  ('2026-02-12','unico','asg',2),
  ('2026-02-12','unico','bartender',2),
  ('2026-02-12','unico','barback',2),
  ('2026-02-12','unico','cozinha',2),
  ('2026-02-12','unico','seguranca',1),
  ('2026-02-12','unico','brigadista',1),
  ('2026-02-13','unico','garcom',25),
  ('2026-02-13','unico','cumim',0),
  ('2026-02-13','unico','host',6),
  ('2026-02-13','unico','asg',0),
  ('2026-02-13','unico','bartender',5),
  ('2026-02-13','unico','barback',13),
  ('2026-02-13','unico','cozinha',5),
  ('2026-02-13','unico','seguranca',22),
  ('2026-02-13','unico','brigadista',3),
  ('2026-02-14','unico','garcom',18),
  ('2026-02-14','unico','cumim',0),
  ('2026-02-14','unico','host',5),
  ('2026-02-14','unico','asg',0),
  ('2026-02-14','unico','bartender',4),
  ('2026-02-14','unico','barback',13),
  ('2026-02-14','unico','cozinha',5),
  ('2026-02-14','unico','seguranca',18),
  ('2026-02-14','unico','brigadista',3),
  ('2026-02-15','unico','garcom',25),
  ('2026-02-15','unico','cumim',0),
  ('2026-02-15','unico','host',6),
  ('2026-02-15','unico','asg',0),
  ('2026-02-15','unico','bartender',5),
  ('2026-02-15','unico','barback',13),
  ('2026-02-15','unico','cozinha',5),
  ('2026-02-15','unico','seguranca',22),
  ('2026-02-15','unico','brigadista',3),
  ('2026-02-16','unico','garcom',18),
  ('2026-02-16','unico','cumim',0),
  ('2026-02-16','unico','host',5),
  ('2026-02-16','unico','asg',0),
  ('2026-02-16','unico','bartender',6),
  ('2026-02-16','unico','barback',12),
  ('2026-02-16','unico','cozinha',5),
  ('2026-02-16','unico','seguranca',22),
  ('2026-02-16','unico','brigadista',3),
  ('2026-02-17','unico','garcom',18),
  ('2026-02-17','unico','cumim',0),
  ('2026-02-17','unico','host',5),
  ('2026-02-17','unico','asg',0),
  ('2026-02-17','unico','bartender',4),
  ('2026-02-17','unico','barback',11),
  ('2026-02-17','unico','cozinha',5),
  ('2026-02-17','unico','seguranca',16),
  ('2026-02-17','unico','brigadista',3),
  ('2026-02-18','unico','garcom',6),
  ('2026-02-18','unico','cumim',4),
  ('2026-02-18','unico','host',2),
  ('2026-02-18','unico','asg',2),
  ('2026-02-18','unico','bartender',2),
  ('2026-02-18','unico','barback',2),
  ('2026-02-18','unico','cozinha',2),
  ('2026-02-18','unico','seguranca',1),
  ('2026-02-18','unico','brigadista',1),
  ('2026-02-19','unico','garcom',4),
  ('2026-02-19','unico','cumim',3),
  ('2026-02-19','unico','host',1),
  ('2026-02-19','unico','asg',1),
  ('2026-02-19','unico','bartender',1),
  ('2026-02-19','unico','barback',1),
  ('2026-02-19','unico','cozinha',1),
  ('2026-02-19','unico','seguranca',0),
  ('2026-02-19','unico','brigadista',0),
  ('2026-02-20','unico','garcom',20),
  ('2026-02-20','unico','cumim',13),
  ('2026-02-20','unico','host',5),
  ('2026-02-20','unico','asg',5),
  ('2026-02-20','unico','bartender',5),
  ('2026-02-20','unico','barback',6),
  ('2026-02-20','unico','cozinha',4),
  ('2026-02-20','unico','seguranca',10),
  ('2026-02-20','unico','brigadista',2),
  ('2026-02-21','unico','garcom',24),
  ('2026-02-21','unico','cumim',19),
  ('2026-02-21','unico','host',10),
  ('2026-02-21','unico','asg',9),
  ('2026-02-21','unico','bartender',6),
  ('2026-02-21','unico','barback',9),
  ('2026-02-21','unico','cozinha',5),
  ('2026-02-21','unico','seguranca',7),
  ('2026-02-21','unico','brigadista',1),
  ('2026-02-22','unico','garcom',12),
  ('2026-02-22','unico','cumim',8),
  ('2026-02-22','unico','host',3),
  ('2026-02-22','unico','asg',3),
  ('2026-02-22','unico','bartender',3),
  ('2026-02-22','unico','barback',3),
  ('2026-02-22','unico','cozinha',3),
  ('2026-02-22','unico','seguranca',7),
  ('2026-02-22','unico','brigadista',1),
  ('2026-02-23','unico','garcom',3),
  ('2026-02-23','unico','cumim',2),
  ('2026-02-23','unico','host',1),
  ('2026-02-23','unico','asg',1),
  ('2026-02-23','unico','bartender',1),
  ('2026-02-23','unico','barback',1),
  ('2026-02-23','unico','cozinha',1),
  ('2026-02-23','unico','seguranca',0),
  ('2026-02-23','unico','brigadista',0),
  ('2026-02-24','unico','garcom',3),
  ('2026-02-24','unico','cumim',2),
  ('2026-02-24','unico','host',1),
  ('2026-02-24','unico','asg',1),
  ('2026-02-24','unico','bartender',1),
  ('2026-02-24','unico','barback',1),
  ('2026-02-24','unico','cozinha',1),
  ('2026-02-24','unico','seguranca',0),
  ('2026-02-24','unico','brigadista',0),
  ('2026-02-25','unico','garcom',9),
  ('2026-02-25','unico','cumim',6),
  ('2026-02-25','unico','host',3),
  ('2026-02-25','unico','asg',3),
  ('2026-02-25','unico','bartender',3),
  ('2026-02-25','unico','barback',3),
  ('2026-02-25','unico','cozinha',2),
  ('2026-02-25','unico','seguranca',4),
  ('2026-02-25','unico','brigadista',1),
  ('2026-02-26','unico','garcom',5),
  ('2026-02-26','unico','cumim',3),
  ('2026-02-26','unico','host',2),
  ('2026-02-26','unico','asg',2),
  ('2026-02-26','unico','bartender',2),
  ('2026-02-26','unico','barback',2),
  ('2026-02-26','unico','cozinha',1),
  ('2026-02-26','unico','seguranca',2),
  ('2026-02-26','unico','brigadista',0),
  ('2026-02-27','unico','garcom',17),
  ('2026-02-27','unico','cumim',11),
  ('2026-02-27','unico','host',5),
  ('2026-02-27','unico','asg',5),
  ('2026-02-27','unico','bartender',6),
  ('2026-02-27','unico','barback',6),
  ('2026-02-27','unico','cozinha',4),
  ('2026-02-27','unico','seguranca',7),
  ('2026-02-27','unico','brigadista',1),
  ('2026-02-28','unico','garcom',40),
  ('2026-02-28','unico','cumim',26),
  ('2026-02-28','unico','host',10),
  ('2026-02-28','unico','asg',10),
  ('2026-02-28','unico','bartender',7),
  ('2026-02-28','unico','barback',10),
  ('2026-02-28','unico','cozinha',8),
  ('2026-02-28','unico','seguranca',10),
  ('2026-02-28','unico','brigadista',2),
  ('2026-03-01','unico','garcom',13),
  ('2026-03-01','unico','cumim',9),
  ('2026-03-01','unico','host',4),
  ('2026-03-01','unico','asg',3),
  ('2026-03-01','unico','bartender',4),
  ('2026-03-01','unico','barback',4),
  ('2026-03-01','unico','cozinha',3),
  ('2026-03-01','unico','seguranca',6),
  ('2026-03-01','unico','brigadista',0),
  ('2026-03-02','unico','garcom',3),
  ('2026-03-02','unico','cumim',2),
  ('2026-03-02','unico','host',1),
  ('2026-03-02','unico','asg',1),
  ('2026-03-02','unico','bartender',1),
  ('2026-03-02','unico','barback',1),
  ('2026-03-02','unico','cozinha',1),
  ('2026-03-02','unico','seguranca',1),
  ('2026-03-02','unico','brigadista',0),
  ('2026-03-03','unico','garcom',3),
  ('2026-03-03','unico','cumim',2),
  ('2026-03-03','unico','host',1),
  ('2026-03-03','unico','asg',1),
  ('2026-03-03','unico','bartender',1),
  ('2026-03-03','unico','barback',1),
  ('2026-03-03','unico','cozinha',1),
  ('2026-03-03','unico','seguranca',1),
  ('2026-03-03','unico','brigadista',0),
  ('2026-03-04','unico','garcom',9),
  ('2026-03-04','unico','cumim',7),
  ('2026-03-04','unico','host',3),
  ('2026-03-04','unico','asg',3),
  ('2026-03-04','unico','bartender',3),
  ('2026-03-04','unico','barback',3),
  ('2026-03-04','unico','cozinha',3),
  ('2026-03-04','unico','seguranca',4),
  ('2026-03-04','unico','brigadista',0),
  ('2026-03-05','unico','garcom',5),
  ('2026-03-05','unico','cumim',4),
  ('2026-03-05','unico','host',2),
  ('2026-03-05','unico','asg',2),
  ('2026-03-05','unico','bartender',2),
  ('2026-03-05','unico','barback',2),
  ('2026-03-05','unico','cozinha',2),
  ('2026-03-05','unico','seguranca',3),
  ('2026-03-05','unico','brigadista',0),
  ('2026-03-06','unico','garcom',31),
  ('2026-03-06','unico','cumim',23),
  ('2026-03-06','unico','host',10),
  ('2026-03-06','unico','asg',8),
  ('2026-03-06','unico','bartender',10),
  ('2026-03-06','unico','barback',10),
  ('2026-03-06','unico','cozinha',8),
  ('2026-03-06','unico','seguranca',10),
  ('2026-03-06','unico','brigadista',2),
  ('2026-03-07','unico','garcom',18),
  ('2026-03-07','unico','cumim',13),
  ('2026-03-07','unico','host',6),
  ('2026-03-07','unico','asg',5),
  ('2026-03-07','unico','bartender',6),
  ('2026-03-07','unico','barback',6),
  ('2026-03-07','unico','cozinha',5),
  ('2026-03-07','unico','seguranca',8),
  ('2026-03-07','unico','brigadista',2),
  ('2026-03-08','unico','garcom',18),
  ('2026-03-08','unico','cumim',13),
  ('2026-03-08','unico','host',6),
  ('2026-03-08','unico','asg',6),
  ('2026-03-08','unico','bartender',6),
  ('2026-03-08','unico','barback',6),
  ('2026-03-08','unico','cozinha',4),
  ('2026-03-08','unico','seguranca',7),
  ('2026-03-08','unico','brigadista',1),
  ('2026-03-09','unico','garcom',3),
  ('2026-03-09','unico','cumim',2),
  ('2026-03-09','unico','host',1),
  ('2026-03-09','unico','asg',1),
  ('2026-03-09','unico','bartender',1),
  ('2026-03-09','unico','barback',1),
  ('2026-03-09','unico','cozinha',1),
  ('2026-03-09','unico','seguranca',0),
  ('2026-03-09','unico','brigadista',0),
  ('2026-03-10','unico','garcom',3),
  ('2026-03-10','unico','cumim',2),
  ('2026-03-10','unico','host',1),
  ('2026-03-10','unico','asg',1),
  ('2026-03-10','unico','bartender',1),
  ('2026-03-10','unico','barback',1),
  ('2026-03-10','unico','cozinha',1),
  ('2026-03-10','unico','seguranca',2),
  ('2026-03-10','unico','brigadista',0),
  ('2026-03-11','unico','garcom',10),
  ('2026-03-11','unico','cumim',7),
  ('2026-03-11','unico','host',3),
  ('2026-03-11','unico','asg',3),
  ('2026-03-11','unico','bartender',3),
  ('2026-03-11','unico','barback',3),
  ('2026-03-11','unico','cozinha',3),
  ('2026-03-11','unico','seguranca',4),
  ('2026-03-11','unico','brigadista',2),
  ('2026-03-12','unico','garcom',7),
  ('2026-03-12','unico','cumim',5),
  ('2026-03-12','unico','host',2),
  ('2026-03-12','unico','asg',2),
  ('2026-03-12','unico','bartender',2),
  ('2026-03-12','unico','barback',2),
  ('2026-03-12','unico','cozinha',2),
  ('2026-03-12','unico','seguranca',2),
  ('2026-03-12','unico','brigadista',0),
  ('2026-03-13','unico','garcom',27),
  ('2026-03-13','unico','cumim',19),
  ('2026-03-13','unico','host',6),
  ('2026-03-13','unico','asg',6),
  ('2026-03-13','unico','bartender',6),
  ('2026-03-13','unico','barback',8),
  ('2026-03-13','unico','cozinha',7),
  ('2026-03-13','unico','seguranca',8),
  ('2026-03-13','unico','brigadista',2),
  ('2026-03-14','unico','garcom',27),
  ('2026-03-14','unico','cumim',20),
  ('2026-03-14','unico','host',10),
  ('2026-03-14','unico','asg',8),
  ('2026-03-14','unico','bartender',7),
  ('2026-03-14','unico','barback',10),
  ('2026-03-14','unico','cozinha',6),
  ('2026-03-14','unico','seguranca',12),
  ('2026-03-14','unico','brigadista',2),
  ('2026-03-15','unico','garcom',15),
  ('2026-03-15','unico','cumim',11),
  ('2026-03-15','unico','host',5),
  ('2026-03-15','unico','asg',5),
  ('2026-03-15','unico','bartender',5),
  ('2026-03-15','unico','barback',5),
  ('2026-03-15','unico','cozinha',4),
  ('2026-03-15','unico','seguranca',6),
  ('2026-03-15','unico','brigadista',1),
  ('2026-03-16','unico','garcom',3),
  ('2026-03-16','unico','cumim',2),
  ('2026-03-16','unico','host',1),
  ('2026-03-16','unico','asg',1),
  ('2026-03-16','unico','bartender',1),
  ('2026-03-16','unico','barback',1),
  ('2026-03-16','unico','cozinha',1),
  ('2026-03-16','unico','seguranca',1),
  ('2026-03-16','unico','brigadista',0),
  ('2026-03-17','unico','garcom',4),
  ('2026-03-17','unico','cumim',3),
  ('2026-03-17','unico','host',2),
  ('2026-03-17','unico','asg',2),
  ('2026-03-17','unico','bartender',2),
  ('2026-03-17','unico','barback',2),
  ('2026-03-17','unico','cozinha',1),
  ('2026-03-17','unico','seguranca',1),
  ('2026-03-17','unico','brigadista',0),
  ('2026-03-18','unico','garcom',9),
  ('2026-03-18','unico','cumim',7),
  ('2026-03-18','unico','host',3),
  ('2026-03-18','unico','asg',3),
  ('2026-03-18','unico','bartender',3),
  ('2026-03-18','unico','barback',3),
  ('2026-03-18','unico','cozinha',2),
  ('2026-03-18','unico','seguranca',4),
  ('2026-03-18','unico','brigadista',2),
  ('2026-03-19','unico','garcom',4),
  ('2026-03-19','unico','cumim',3),
  ('2026-03-19','unico','host',2),
  ('2026-03-19','unico','asg',2),
  ('2026-03-19','unico','bartender',2),
  ('2026-03-19','unico','barback',2),
  ('2026-03-19','unico','cozinha',1),
  ('2026-03-19','unico','seguranca',2),
  ('2026-03-19','unico','brigadista',0),
  ('2026-03-20','unico','garcom',27),
  ('2026-03-20','unico','cumim',19),
  ('2026-03-20','unico','host',6),
  ('2026-03-20','unico','asg',7),
  ('2026-03-20','unico','bartender',6),
  ('2026-03-20','unico','barback',8),
  ('2026-03-20','unico','cozinha',5),
  ('2026-03-20','unico','seguranca',10),
  ('2026-03-20','unico','brigadista',2),
  ('2026-03-21','unico','garcom',33),
  ('2026-03-21','unico','cumim',27),
  ('2026-03-21','unico','host',8),
  ('2026-03-21','unico','asg',8),
  ('2026-03-21','unico','bartender',8),
  ('2026-03-21','unico','barback',14),
  ('2026-03-21','unico','cozinha',9),
  ('2026-03-21','unico','seguranca',15),
  ('2026-03-21','unico','brigadista',3),
  ('2026-03-22','unico','garcom',30),
  ('2026-03-22','unico','cumim',20),
  ('2026-03-22','unico','host',8),
  ('2026-03-22','unico','asg',7),
  ('2026-03-22','unico','bartender',7),
  ('2026-03-22','unico','barback',7),
  ('2026-03-22','unico','cozinha',6),
  ('2026-03-22','unico','seguranca',8),
  ('2026-03-22','unico','brigadista',1),
  ('2026-03-23','unico','garcom',3),
  ('2026-03-23','unico','cumim',2),
  ('2026-03-23','unico','host',1),
  ('2026-03-23','unico','asg',1),
  ('2026-03-23','unico','bartender',1),
  ('2026-03-23','unico','barback',1),
  ('2026-03-23','unico','cozinha',1),
  ('2026-03-23','unico','seguranca',0),
  ('2026-03-23','unico','brigadista',0),
  ('2026-03-24','unico','garcom',4),
  ('2026-03-24','unico','cumim',3),
  ('2026-03-24','unico','host',2),
  ('2026-03-24','unico','asg',2),
  ('2026-03-24','unico','bartender',2),
  ('2026-03-24','unico','barback',2),
  ('2026-03-24','unico','cozinha',1),
  ('2026-03-24','unico','seguranca',1),
  ('2026-03-24','unico','brigadista',1),
  ('2026-03-25','unico','garcom',11),
  ('2026-03-25','unico','cumim',8),
  ('2026-03-25','unico','host',4),
  ('2026-03-25','unico','asg',4),
  ('2026-03-25','unico','bartender',4),
  ('2026-03-25','unico','barback',4),
  ('2026-03-25','unico','cozinha',4),
  ('2026-03-25','unico','seguranca',4),
  ('2026-03-25','unico','brigadista',2),
  ('2026-03-26','unico','garcom',5),
  ('2026-03-26','unico','cumim',4),
  ('2026-03-26','unico','host',2),
  ('2026-03-26','unico','asg',2),
  ('2026-03-26','unico','bartender',2),
  ('2026-03-26','unico','barback',2),
  ('2026-03-26','unico','cozinha',3),
  ('2026-03-26','unico','seguranca',2),
  ('2026-03-26','unico','brigadista',1),
  ('2026-03-27','unico','garcom',23),
  ('2026-03-27','unico','cumim',15),
  ('2026-03-27','unico','host',6),
  ('2026-03-27','unico','asg',7),
  ('2026-03-27','unico','bartender',6),
  ('2026-03-27','unico','barback',10),
  ('2026-03-27','unico','cozinha',6),
  ('2026-03-27','unico','seguranca',9),
  ('2026-03-27','unico','brigadista',1),
  ('2026-03-28','unico','garcom',34),
  ('2026-03-28','unico','cumim',20),
  ('2026-03-28','unico','host',9),
  ('2026-03-28','unico','asg',8),
  ('2026-03-28','unico','bartender',6),
  ('2026-03-28','unico','barback',11),
  ('2026-03-28','unico','cozinha',6),
  ('2026-03-28','unico','seguranca',12),
  ('2026-03-28','unico','brigadista',2),
  ('2026-03-29','unico','garcom',14),
  ('2026-03-29','unico','cumim',10),
  ('2026-03-29','unico','host',5),
  ('2026-03-29','unico','asg',5),
  ('2026-03-29','unico','bartender',5),
  ('2026-03-29','unico','barback',4),
  ('2026-03-29','unico','cozinha',3),
  ('2026-03-29','unico','seguranca',7),
  ('2026-03-29','unico','brigadista',1),
  ('2026-03-30','unico','garcom',4),
  ('2026-03-30','unico','cumim',3),
  ('2026-03-30','unico','host',1),
  ('2026-03-30','unico','asg',1),
  ('2026-03-30','unico','bartender',2),
  ('2026-03-30','unico','barback',1),
  ('2026-03-30','unico','cozinha',1),
  ('2026-03-30','unico','seguranca',0),
  ('2026-03-30','unico','brigadista',0),
  ('2026-03-31','unico','garcom',4),
  ('2026-03-31','unico','cumim',3),
  ('2026-03-31','unico','host',2),
  ('2026-03-31','unico','asg',1),
  ('2026-03-31','unico','bartender',2),
  ('2026-03-31','unico','barback',2),
  ('2026-03-31','unico','cozinha',1),
  ('2026-03-31','unico','seguranca',1),
  ('2026-03-31','unico','brigadista',1),
  ('2026-04-01','unico','garcom',16),
  ('2026-04-01','unico','cumim',12),
  ('2026-04-01','unico','host',4),
  ('2026-04-01','unico','asg',4),
  ('2026-04-01','unico','bartender',4),
  ('2026-04-01','unico','barback',4),
  ('2026-04-01','unico','cozinha',4),
  ('2026-04-01','unico','seguranca',4),
  ('2026-04-01','unico','brigadista',0),
  ('2026-04-02','unico','garcom',19),
  ('2026-04-02','unico','cumim',14),
  ('2026-04-02','unico','host',4),
  ('2026-04-02','unico','asg',5),
  ('2026-04-02','unico','bartender',4),
  ('2026-04-02','unico','barback',7),
  ('2026-04-02','unico','cozinha',4),
  ('2026-04-02','unico','seguranca',2),
  ('2026-04-02','unico','brigadista',0),
  ('2026-04-03','unico','garcom',18),
  ('2026-04-03','unico','cumim',14),
  ('2026-04-03','unico','host',4),
  ('2026-04-03','unico','asg',5),
  ('2026-04-03','unico','bartender',5),
  ('2026-04-03','unico','barback',8),
  ('2026-04-03','unico','cozinha',5),
  ('2026-04-03','unico','seguranca',12),
  ('2026-04-03','unico','brigadista',0),
  ('2026-04-04','unico','garcom',21),
  ('2026-04-04','unico','cumim',16),
  ('2026-04-04','unico','host',5),
  ('2026-04-04','unico','asg',5),
  ('2026-04-04','unico','bartender',6),
  ('2026-04-04','unico','barback',11),
  ('2026-04-04','unico','cozinha',6),
  ('2026-04-04','unico','seguranca',12),
  ('2026-04-04','unico','brigadista',1),
  ('2026-04-05','unico','garcom',13),
  ('2026-04-05','unico','cumim',10),
  ('2026-04-05','unico','host',3),
  ('2026-04-05','unico','asg',3),
  ('2026-04-05','unico','bartender',3),
  ('2026-04-05','unico','barback',3),
  ('2026-04-05','unico','cozinha',4),
  ('2026-04-05','unico','seguranca',10),
  ('2026-04-05','unico','brigadista',1),
  ('2026-04-06','unico','garcom',3),
  ('2026-04-06','unico','cumim',2),
  ('2026-04-06','unico','host',1),
  ('2026-04-06','unico','asg',1),
  ('2026-04-06','unico','bartender',1),
  ('2026-04-06','unico','barback',1),
  ('2026-04-06','unico','cozinha',1),
  ('2026-04-06','unico','seguranca',2),
  ('2026-04-06','unico','brigadista',0),
  ('2026-04-07','unico','garcom',4),
  ('2026-04-07','unico','cumim',3),
  ('2026-04-07','unico','host',1),
  ('2026-04-07','unico','asg',1),
  ('2026-04-07','unico','bartender',1),
  ('2026-04-07','unico','barback',1),
  ('2026-04-07','unico','cozinha',1),
  ('2026-04-07','unico','seguranca',2),
  ('2026-04-07','unico','brigadista',0),
  ('2026-04-08','unico','garcom',8),
  ('2026-04-08','unico','cumim',6),
  ('2026-04-08','unico','host',2),
  ('2026-04-08','unico','asg',2),
  ('2026-04-08','unico','bartender',2),
  ('2026-04-08','unico','barback',2),
  ('2026-04-08','unico','cozinha',4),
  ('2026-04-08','unico','seguranca',4),
  ('2026-04-08','unico','brigadista',0),
  ('2026-04-09','unico','garcom',5),
  ('2026-04-09','unico','cumim',4),
  ('2026-04-09','unico','host',1),
  ('2026-04-09','unico','asg',1),
  ('2026-04-09','unico','bartender',1),
  ('2026-04-09','unico','barback',1),
  ('2026-04-09','unico','cozinha',3),
  ('2026-04-09','unico','seguranca',2),
  ('2026-04-09','unico','brigadista',0),
  ('2026-04-10','unico','garcom',25),
  ('2026-04-10','unico','cumim',19),
  ('2026-04-10','unico','host',6),
  ('2026-04-10','unico','asg',5),
  ('2026-04-10','unico','bartender',6),
  ('2026-04-10','unico','barback',5),
  ('2026-04-10','unico','cozinha',6),
  ('2026-04-10','unico','seguranca',10),
  ('2026-04-10','unico','brigadista',1),
  ('2026-04-11','unico','garcom',23),
  ('2026-04-11','unico','cumim',17),
  ('2026-04-11','unico','host',6),
  ('2026-04-11','unico','asg',5),
  ('2026-04-11','unico','bartender',7),
  ('2026-04-11','unico','barback',5),
  ('2026-04-11','unico','cozinha',6),
  ('2026-04-11','unico','seguranca',8),
  ('2026-04-11','unico','brigadista',1),
  ('2026-04-12','unico','garcom',13),
  ('2026-04-12','unico','cumim',10),
  ('2026-04-12','unico','host',3),
  ('2026-04-12','unico','asg',3),
  ('2026-04-12','unico','bartender',3),
  ('2026-04-12','unico','barback',3),
  ('2026-04-12','unico','cozinha',3),
  ('2026-04-12','unico','seguranca',6),
  ('2026-04-12','unico','brigadista',1),
  ('2026-04-13','unico','garcom',3),
  ('2026-04-13','unico','cumim',2),
  ('2026-04-13','unico','host',1),
  ('2026-04-13','unico','asg',1),
  ('2026-04-13','unico','bartender',1),
  ('2026-04-13','unico','barback',1),
  ('2026-04-13','unico','cozinha',1),
  ('2026-04-13','unico','seguranca',2),
  ('2026-04-13','unico','brigadista',0),
  ('2026-04-14','unico','garcom',4),
  ('2026-04-14','unico','cumim',3),
  ('2026-04-14','unico','host',1),
  ('2026-04-14','unico','asg',1),
  ('2026-04-14','unico','bartender',1),
  ('2026-04-14','unico','barback',1),
  ('2026-04-14','unico','cozinha',3),
  ('2026-04-14','unico','seguranca',2),
  ('2026-04-14','unico','brigadista',0),
  ('2026-04-15','unico','garcom',8),
  ('2026-04-15','unico','cumim',6),
  ('2026-04-15','unico','host',2),
  ('2026-04-15','unico','asg',2),
  ('2026-04-15','unico','bartender',2),
  ('2026-04-15','unico','barback',2),
  ('2026-04-15','unico','cozinha',2),
  ('2026-04-15','unico','seguranca',4),
  ('2026-04-15','unico','brigadista',0),
  ('2026-04-16','unico','garcom',6),
  ('2026-04-16','unico','cumim',5),
  ('2026-04-16','unico','host',2),
  ('2026-04-16','unico','asg',2),
  ('2026-04-16','unico','bartender',2),
  ('2026-04-16','unico','barback',2),
  ('2026-04-16','unico','cozinha',2),
  ('2026-04-16','unico','seguranca',2),
  ('2026-04-16','unico','brigadista',0),
  ('2026-04-17','unico','garcom',25),
  ('2026-04-17','unico','cumim',19),
  ('2026-04-17','unico','host',5),
  ('2026-04-17','unico','asg',5),
  ('2026-04-17','unico','bartender',5),
  ('2026-04-17','unico','barback',8),
  ('2026-04-17','unico','cozinha',5),
  ('2026-04-17','unico','seguranca',11),
  ('2026-04-17','unico','brigadista',2),
  ('2026-04-18','unico','garcom',35),
  ('2026-04-18','unico','cumim',27),
  ('2026-04-18','unico','host',8),
  ('2026-04-18','unico','asg',7),
  ('2026-04-18','unico','bartender',7),
  ('2026-04-18','unico','barback',7),
  ('2026-04-18','unico','cozinha',6),
  ('2026-04-18','unico','seguranca',8),
  ('2026-04-18','unico','brigadista',2),
  ('2026-04-19','unico','garcom',21),
  ('2026-04-19','unico','cumim',16),
  ('2026-04-19','unico','host',5),
  ('2026-04-19','unico','asg',5),
  ('2026-04-19','unico','bartender',5),
  ('2026-04-19','unico','barback',5),
  ('2026-04-19','unico','cozinha',4),
  ('2026-04-19','unico','seguranca',8),
  ('2026-04-19','unico','brigadista',2),
  ('2026-04-20','unico','garcom',21),
  ('2026-04-20','unico','cumim',16),
  ('2026-04-20','unico','host',5),
  ('2026-04-20','unico','asg',5),
  ('2026-04-20','unico','bartender',5),
  ('2026-04-20','unico','barback',5),
  ('2026-04-20','unico','cozinha',5),
  ('2026-04-20','unico','seguranca',8),
  ('2026-04-20','unico','brigadista',5),
  ('2026-04-21','unico','garcom',9),
  ('2026-04-21','unico','cumim',7),
  ('2026-04-21','unico','host',2),
  ('2026-04-21','unico','asg',2),
  ('2026-04-21','unico','bartender',2),
  ('2026-04-21','unico','barback',2),
  ('2026-04-21','unico','cozinha',2),
  ('2026-04-21','unico','seguranca',3),
  ('2026-04-21','unico','brigadista',2),
  ('2026-04-22','unico','garcom',7),
  ('2026-04-22','unico','cumim',6),
  ('2026-04-22','unico','host',2),
  ('2026-04-22','unico','asg',2),
  ('2026-04-22','unico','bartender',2),
  ('2026-04-22','unico','barback',2),
  ('2026-04-22','unico','cozinha',2),
  ('2026-04-22','unico','seguranca',4),
  ('2026-04-22','unico','brigadista',0),
  ('2026-04-23','unico','garcom',5),
  ('2026-04-23','unico','cumim',4),
  ('2026-04-23','unico','host',1),
  ('2026-04-23','unico','asg',1),
  ('2026-04-23','unico','bartender',1),
  ('2026-04-23','unico','barback',1),
  ('2026-04-23','unico','cozinha',1),
  ('2026-04-23','unico','seguranca',2),
  ('2026-04-23','unico','brigadista',0),
  ('2026-04-24','unico','garcom',23),
  ('2026-04-24','unico','cumim',17),
  ('2026-04-24','unico','host',5),
  ('2026-04-24','unico','asg',5),
  ('2026-04-24','unico','bartender',6),
  ('2026-04-24','unico','barback',5),
  ('2026-04-24','unico','cozinha',5),
  ('2026-04-24','unico','seguranca',9),
  ('2026-04-24','unico','brigadista',1),
  ('2026-04-25','unico','garcom',30),
  ('2026-04-25','unico','cumim',20),
  ('2026-04-25','unico','host',6),
  ('2026-04-25','unico','asg',8),
  ('2026-04-25','unico','bartender',7),
  ('2026-04-25','unico','barback',9),
  ('2026-04-25','unico','cozinha',6),
  ('2026-04-25','unico','seguranca',12),
  ('2026-04-25','unico','brigadista',1),
  ('2026-04-26','unico','garcom',16),
  ('2026-04-26','unico','cumim',12),
  ('2026-04-26','unico','host',4),
  ('2026-04-26','unico','asg',4),
  ('2026-04-26','unico','bartender',4),
  ('2026-04-26','unico','barback',4),
  ('2026-04-26','unico','cozinha',4),
  ('2026-04-26','unico','seguranca',9),
  ('2026-04-26','unico','brigadista',1),
  ('2026-04-27','unico','garcom',4),
  ('2026-04-27','unico','cumim',3),
  ('2026-04-27','unico','host',1),
  ('2026-04-27','unico','asg',1),
  ('2026-04-27','unico','bartender',2),
  ('2026-04-27','unico','barback',1),
  ('2026-04-27','unico','cozinha',1),
  ('2026-04-27','unico','seguranca',1),
  ('2026-04-27','unico','brigadista',0),
  ('2026-04-28','unico','garcom',4),
  ('2026-04-28','unico','cumim',3),
  ('2026-04-28','unico','host',1),
  ('2026-04-28','unico','asg',1),
  ('2026-04-28','unico','bartender',1),
  ('2026-04-28','unico','barback',1),
  ('2026-04-28','unico','cozinha',1),
  ('2026-04-28','unico','seguranca',2),
  ('2026-04-28','unico','brigadista',0),
  ('2026-04-29','unico','garcom',8),
  ('2026-04-29','unico','cumim',6),
  ('2026-04-29','unico','host',2),
  ('2026-04-29','unico','asg',2),
  ('2026-04-29','unico','bartender',2),
  ('2026-04-29','unico','barback',2),
  ('2026-04-29','unico','cozinha',2),
  ('2026-04-29','unico','seguranca',5),
  ('2026-04-29','unico','brigadista',0),
  ('2026-04-30','unico','garcom',15),
  ('2026-04-30','unico','cumim',12),
  ('2026-04-30','unico','host',3),
  ('2026-04-30','unico','asg',3),
  ('2026-04-30','unico','bartender',3),
  ('2026-04-30','unico','barback',3),
  ('2026-04-30','unico','cozinha',3),
  ('2026-04-30','unico','seguranca',7),
  ('2026-04-30','unico','brigadista',1),
  ('2026-05-01','unico','garcom',15),
  ('2026-05-01','unico','cumim',12),
  ('2026-05-01','unico','host',4),
  ('2026-05-01','unico','asg',5),
  ('2026-05-01','unico','bartender',5),
  ('2026-05-01','unico','barback',4),
  ('2026-05-01','unico','cozinha',4),
  ('2026-05-01','unico','seguranca',8),
  ('2026-05-01','unico','brigadista',2),
  ('2026-05-02','unico','garcom',20),
  ('2026-05-02','unico','cumim',16),
  ('2026-05-02','unico','host',5),
  ('2026-05-02','unico','asg',6),
  ('2026-05-02','unico','bartender',6),
  ('2026-05-02','unico','barback',5),
  ('2026-05-02','unico','cozinha',5),
  ('2026-05-02','unico','seguranca',10),
  ('2026-05-02','unico','brigadista',2),
  ('2026-05-03','unico','garcom',8),
  ('2026-05-03','unico','cumim',7),
  ('2026-05-03','unico','host',2),
  ('2026-05-03','unico','asg',3),
  ('2026-05-03','unico','bartender',3),
  ('2026-05-03','unico','barback',2),
  ('2026-05-03','unico','cozinha',2),
  ('2026-05-03','unico','seguranca',8),
  ('2026-05-03','unico','brigadista',1),
  ('2026-05-04','unico','garcom',0),
  ('2026-05-04','unico','cumim',0),
  ('2026-05-04','unico','host',0),
  ('2026-05-04','unico','asg',0),
  ('2026-05-04','unico','bartender',0),
  ('2026-05-04','unico','barback',0),
  ('2026-05-04','unico','cozinha',0),
  ('2026-05-04','unico','seguranca',0),
  ('2026-05-04','unico','brigadista',0),
  ('2026-05-05','unico','garcom',5),
  ('2026-05-05','unico','cumim',4),
  ('2026-05-05','unico','host',2),
  ('2026-05-05','unico','asg',2),
  ('2026-05-05','unico','bartender',2),
  ('2026-05-05','unico','barback',2),
  ('2026-05-05','unico','cozinha',2),
  ('2026-05-05','unico','seguranca',3),
  ('2026-05-05','unico','brigadista',0),
  ('2026-05-06','unico','garcom',7),
  ('2026-05-06','unico','cumim',6),
  ('2026-05-06','unico','host',2),
  ('2026-05-06','unico','asg',3),
  ('2026-05-06','unico','bartender',3),
  ('2026-05-06','unico','barback',2),
  ('2026-05-06','unico','cozinha',2),
  ('2026-05-06','unico','seguranca',5),
  ('2026-05-06','unico','brigadista',0),
  ('2026-05-07','unico','garcom',5),
  ('2026-05-07','unico','cumim',4),
  ('2026-05-07','unico','host',2),
  ('2026-05-07','unico','asg',2),
  ('2026-05-07','unico','bartender',2),
  ('2026-05-07','unico','barback',2),
  ('2026-05-07','unico','cozinha',2),
  ('2026-05-07','unico','seguranca',3),
  ('2026-05-07','unico','brigadista',0),
  ('2026-05-08','unico','garcom',20),
  ('2026-05-08','unico','cumim',16),
  ('2026-05-08','unico','host',5),
  ('2026-05-08','unico','asg',6),
  ('2026-05-08','unico','bartender',6),
  ('2026-05-08','unico','barback',7),
  ('2026-05-08','unico','cozinha',5),
  ('2026-05-08','unico','seguranca',9),
  ('2026-05-08','unico','brigadista',2),
  ('2026-05-09','unico','garcom',23),
  ('2026-05-09','unico','cumim',18),
  ('2026-05-09','unico','host',6),
  ('2026-05-09','unico','asg',7),
  ('2026-05-09','unico','bartender',6),
  ('2026-05-09','unico','barback',10),
  ('2026-05-09','unico','cozinha',6),
  ('2026-05-09','unico','seguranca',12),
  ('2026-05-09','unico','brigadista',2),
  ('2026-05-10','unico','garcom',8),
  ('2026-05-10','unico','cumim',6),
  ('2026-05-10','unico','host',2),
  ('2026-05-10','unico','asg',3),
  ('2026-05-10','unico','bartender',3),
  ('2026-05-10','unico','barback',5),
  ('2026-05-10','unico','cozinha',2),
  ('2026-05-10','unico','seguranca',7),
  ('2026-05-10','unico','brigadista',1),
  ('2026-05-11','unico','garcom',2),
  ('2026-05-11','unico','cumim',2),
  ('2026-05-11','unico','host',1),
  ('2026-05-11','unico','asg',1),
  ('2026-05-11','unico','bartender',1),
  ('2026-05-11','unico','barback',1),
  ('2026-05-11','unico','cozinha',4),
  ('2026-05-11','unico','seguranca',2),
  ('2026-05-11','unico','brigadista',0),
  ('2026-05-12','unico','garcom',5),
  ('2026-05-12','unico','cumim',4),
  ('2026-05-12','unico','host',2),
  ('2026-05-12','unico','asg',2),
  ('2026-05-12','unico','bartender',2),
  ('2026-05-12','unico','barback',2),
  ('2026-05-12','unico','cozinha',4),
  ('2026-05-12','unico','seguranca',3),
  ('2026-05-12','unico','brigadista',0),
  ('2026-05-13','unico','garcom',7),
  ('2026-05-13','unico','cumim',6),
  ('2026-05-13','unico','host',2),
  ('2026-05-13','unico','asg',3),
  ('2026-05-13','unico','bartender',3),
  ('2026-05-13','unico','barback',2),
  ('2026-05-13','unico','cozinha',2),
  ('2026-05-13','unico','seguranca',5),
  ('2026-05-13','unico','brigadista',0),
  ('2026-05-14','unico','garcom',7),
  ('2026-05-14','unico','cumim',6),
  ('2026-05-14','unico','host',2),
  ('2026-05-14','unico','asg',3),
  ('2026-05-14','unico','bartender',3),
  ('2026-05-14','unico','barback',2),
  ('2026-05-14','unico','cozinha',4),
  ('2026-05-14','unico','seguranca',3),
  ('2026-05-14','unico','brigadista',0),
  ('2026-05-15','unico','garcom',20),
  ('2026-05-15','unico','cumim',16),
  ('2026-05-15','unico','host',5),
  ('2026-05-15','unico','asg',6),
  ('2026-05-15','unico','bartender',5),
  ('2026-05-15','unico','barback',8),
  ('2026-05-15','unico','cozinha',5),
  ('2026-05-15','unico','seguranca',9),
  ('2026-05-15','unico','brigadista',2),
  ('2026-05-16','unico','garcom',20),
  ('2026-05-16','unico','cumim',16),
  ('2026-05-16','unico','host',5),
  ('2026-05-16','unico','asg',6),
  ('2026-05-16','unico','bartender',6),
  ('2026-05-16','unico','barback',10),
  ('2026-05-16','unico','cozinha',5),
  ('2026-05-16','unico','seguranca',10),
  ('2026-05-16','unico','brigadista',2),
  ('2026-05-17','unico','garcom',11),
  ('2026-05-17','unico','cumim',9),
  ('2026-05-17','unico','host',3),
  ('2026-05-17','unico','asg',4),
  ('2026-05-17','unico','bartender',4),
  ('2026-05-17','unico','barback',5),
  ('2026-05-17','unico','cozinha',3),
  ('2026-05-17','unico','seguranca',7),
  ('2026-05-17','unico','brigadista',1),
  ('2026-05-18','unico','garcom',2),
  ('2026-05-18','unico','cumim',2),
  ('2026-05-18','unico','host',1),
  ('2026-05-18','unico','asg',1),
  ('2026-05-18','unico','bartender',1),
  ('2026-05-18','unico','barback',1),
  ('2026-05-18','unico','cozinha',4),
  ('2026-05-18','unico','seguranca',2),
  ('2026-05-18','unico','brigadista',0),
  ('2026-05-19','unico','garcom',5),
  ('2026-05-19','unico','cumim',4),
  ('2026-05-19','unico','host',2),
  ('2026-05-19','unico','asg',2),
  ('2026-05-19','unico','bartender',2),
  ('2026-05-19','unico','barback',2),
  ('2026-05-19','unico','cozinha',4),
  ('2026-05-19','unico','seguranca',3),
  ('2026-05-19','unico','brigadista',0),
  ('2026-05-20','unico','garcom',7),
  ('2026-05-20','unico','cumim',6),
  ('2026-05-20','unico','host',2),
  ('2026-05-20','unico','asg',3),
  ('2026-05-20','unico','bartender',3),
  ('2026-05-20','unico','barback',2),
  ('2026-05-20','unico','cozinha',4),
  ('2026-05-20','unico','seguranca',5),
  ('2026-05-20','unico','brigadista',0),
  ('2026-05-21','unico','garcom',5),
  ('2026-05-21','unico','cumim',4),
  ('2026-05-21','unico','host',2),
  ('2026-05-21','unico','asg',2),
  ('2026-05-21','unico','bartender',2),
  ('2026-05-21','unico','barback',2),
  ('2026-05-21','unico','cozinha',2),
  ('2026-05-21','unico','seguranca',3),
  ('2026-05-21','unico','brigadista',0),
  ('2026-05-22','unico','garcom',14),
  ('2026-05-22','unico','cumim',11),
  ('2026-05-22','unico','host',4),
  ('2026-05-22','unico','asg',5),
  ('2026-05-22','unico','bartender',5),
  ('2026-05-22','unico','barback',6),
  ('2026-05-22','unico','cozinha',4),
  ('2026-05-22','unico','seguranca',7),
  ('2026-05-22','unico','brigadista',2),
  ('2026-05-23','unico','garcom',23),
  ('2026-05-23','unico','cumim',18),
  ('2026-05-23','unico','host',6),
  ('2026-05-23','unico','asg',6),
  ('2026-05-23','unico','bartender',7),
  ('2026-05-23','unico','barback',6),
  ('2026-05-23','unico','cozinha',6),
  ('2026-05-23','unico','seguranca',10),
  ('2026-05-23','unico','brigadista',2),
  ('2026-05-24','unico','garcom',11),
  ('2026-05-24','unico','cumim',9),
  ('2026-05-24','unico','host',3),
  ('2026-05-24','unico','asg',4),
  ('2026-05-24','unico','bartender',4),
  ('2026-05-24','unico','barback',3),
  ('2026-05-24','unico','cozinha',3),
  ('2026-05-24','unico','seguranca',7),
  ('2026-05-24','unico','brigadista',1),
  ('2026-05-25','unico','garcom',2),
  ('2026-05-25','unico','cumim',2),
  ('2026-05-25','unico','host',1),
  ('2026-05-25','unico','asg',1),
  ('2026-05-25','unico','bartender',1),
  ('2026-05-25','unico','barback',1),
  ('2026-05-25','unico','cozinha',4),
  ('2026-05-25','unico','seguranca',2),
  ('2026-05-25','unico','brigadista',0),
  ('2026-05-26','unico','garcom',5),
  ('2026-05-26','unico','cumim',4),
  ('2026-05-26','unico','host',2),
  ('2026-05-26','unico','asg',2),
  ('2026-05-26','unico','bartender',2),
  ('2026-05-26','unico','barback',2),
  ('2026-05-26','unico','cozinha',4),
  ('2026-05-26','unico','seguranca',3),
  ('2026-05-26','unico','brigadista',0),
  ('2026-05-27','unico','garcom',7),
  ('2026-05-27','unico','cumim',6),
  ('2026-05-27','unico','host',2),
  ('2026-05-27','unico','asg',3),
  ('2026-05-27','unico','bartender',3),
  ('2026-05-27','unico','barback',2),
  ('2026-05-27','unico','cozinha',2),
  ('2026-05-27','unico','seguranca',5),
  ('2026-05-27','unico','brigadista',0),
  ('2026-05-28','unico','garcom',5),
  ('2026-05-28','unico','cumim',4),
  ('2026-05-28','unico','host',2),
  ('2026-05-28','unico','asg',2),
  ('2026-05-28','unico','bartender',2),
  ('2026-05-28','unico','barback',2),
  ('2026-05-28','unico','cozinha',2),
  ('2026-05-28','unico','seguranca',3),
  ('2026-05-28','unico','brigadista',0),
  ('2026-05-29','unico','garcom',18),
  ('2026-05-29','unico','cumim',14),
  ('2026-05-29','unico','host',5),
  ('2026-05-29','unico','asg',6),
  ('2026-05-29','unico','bartender',5),
  ('2026-05-29','unico','barback',7),
  ('2026-05-29','unico','cozinha',5),
  ('2026-05-29','unico','seguranca',8),
  ('2026-05-29','unico','brigadista',2),
  ('2026-05-30','unico','garcom',23),
  ('2026-05-30','unico','cumim',18),
  ('2026-05-30','unico','host',7),
  ('2026-05-30','unico','asg',7),
  ('2026-05-30','unico','bartender',6),
  ('2026-05-30','unico','barback',11),
  ('2026-05-30','unico','cozinha',6),
  ('2026-05-30','unico','seguranca',12),
  ('2026-05-30','unico','brigadista',2),
  ('2026-05-31','unico','garcom',9),
  ('2026-05-31','unico','cumim',8),
  ('2026-05-31','unico','host',3),
  ('2026-05-31','unico','asg',3),
  ('2026-05-31','unico','bartender',3),
  ('2026-05-31','unico','barback',5),
  ('2026-05-31','unico','cozinha',3),
  ('2026-05-31','unico','seguranca',7),
  ('2026-05-31','unico','brigadista',1),
  ('2026-06-01','unico','garcom',3),
  ('2026-06-01','unico','cumim',3),
  ('2026-06-01','unico','host',1),
  ('2026-06-01','unico','asg',1),
  ('2026-06-01','unico','bartender',1),
  ('2026-06-01','unico','barback',1),
  ('2026-06-01','unico','cozinha',1),
  ('2026-06-01','unico','seguranca',2),
  ('2026-06-01','unico','brigadista',0),
  ('2026-06-02','unico','garcom',4),
  ('2026-06-02','unico','cumim',4),
  ('2026-06-02','unico','host',1),
  ('2026-06-02','unico','asg',2),
  ('2026-06-02','unico','bartender',2),
  ('2026-06-02','unico','barback',1),
  ('2026-06-02','unico','cozinha',1),
  ('2026-06-02','unico','seguranca',2),
  ('2026-06-02','unico','brigadista',0),
  ('2026-06-03','unico','garcom',12),
  ('2026-06-03','unico','cumim',8),
  ('2026-06-03','unico','host',3),
  ('2026-06-03','unico','asg',4),
  ('2026-06-03','unico','bartender',4),
  ('2026-06-03','unico','barback',6),
  ('2026-06-03','unico','cozinha',5),
  ('2026-06-03','unico','seguranca',6),
  ('2026-06-03','unico','brigadista',0),
  ('2026-06-04','unico','garcom',8),
  ('2026-06-04','unico','cumim',6),
  ('2026-06-04','unico','host',2),
  ('2026-06-04','unico','asg',3),
  ('2026-06-04','unico','bartender',3),
  ('2026-06-04','unico','barback',2),
  ('2026-06-04','unico','cozinha',3),
  ('2026-06-04','unico','seguranca',4),
  ('2026-06-04','unico','brigadista',1),
  ('2026-06-05','unico','garcom',18),
  ('2026-06-05','unico','cumim',15),
  ('2026-06-05','unico','host',5),
  ('2026-06-05','unico','asg',6),
  ('2026-06-05','unico','bartender',5),
  ('2026-06-05','unico','barback',8),
  ('2026-06-05','unico','cozinha',5),
  ('2026-06-05','unico','seguranca',8),
  ('2026-06-05','unico','brigadista',2),
  ('2026-06-06','unico','garcom',20),
  ('2026-06-06','unico','cumim',17),
  ('2026-06-06','unico','host',7),
  ('2026-06-06','unico','asg',8),
  ('2026-06-06','unico','bartender',6),
  ('2026-06-06','unico','barback',10),
  ('2026-06-06','unico','cozinha',9),
  ('2026-06-06','unico','seguranca',10),
  ('2026-06-06','unico','brigadista',2),
  ('2026-06-07','unico','garcom',10),
  ('2026-06-07','unico','cumim',8),
  ('2026-06-07','unico','host',3),
  ('2026-06-07','unico','asg',3),
  ('2026-06-07','unico','bartender',3),
  ('2026-06-07','unico','barback',3),
  ('2026-06-07','unico','cozinha',3),
  ('2026-06-07','unico','seguranca',7),
  ('2026-06-07','unico','brigadista',1),
  ('2026-06-08','unico','garcom',4),
  ('2026-06-08','unico','cumim',4),
  ('2026-06-08','unico','host',1),
  ('2026-06-08','unico','asg',2),
  ('2026-06-08','unico','bartender',2),
  ('2026-06-08','unico','barback',7),
  ('2026-06-08','unico','cozinha',1),
  ('2026-06-08','unico','seguranca',2),
  ('2026-06-08','unico','brigadista',0),
  ('2026-06-09','unico','garcom',4),
  ('2026-06-09','unico','cumim',4),
  ('2026-06-09','unico','host',1),
  ('2026-06-09','unico','asg',2),
  ('2026-06-09','unico','bartender',2),
  ('2026-06-09','unico','barback',1),
  ('2026-06-09','unico','cozinha',1),
  ('2026-06-09','unico','seguranca',2),
  ('2026-06-09','unico','brigadista',0),
  ('2026-06-10','unico','garcom',8),
  ('2026-06-10','unico','cumim',6),
  ('2026-06-10','unico','host',2),
  ('2026-06-10','unico','asg',3),
  ('2026-06-10','unico','bartender',3),
  ('2026-06-10','unico','barback',2),
  ('2026-06-10','unico','cozinha',2),
  ('2026-06-10','unico','seguranca',5),
  ('2026-06-10','unico','brigadista',0),
  ('2026-06-11','unico','garcom',5),
  ('2026-06-11','unico','cumim',4),
  ('2026-06-11','unico','host',2),
  ('2026-06-11','unico','asg',2),
  ('2026-06-11','unico','bartender',2),
  ('2026-06-11','unico','barback',2),
  ('2026-06-11','unico','cozinha',4),
  ('2026-06-11','unico','seguranca',2),
  ('2026-06-11','unico','brigadista',0),
  ('2026-06-12','unico','garcom',10),
  ('2026-06-12','unico','cumim',8),
  ('2026-06-12','unico','host',3),
  ('2026-06-12','unico','asg',3),
  ('2026-06-12','unico','bartender',3),
  ('2026-06-12','unico','barback',3),
  ('2026-06-12','unico','cozinha',4),
  ('2026-06-12','unico','seguranca',5),
  ('2026-06-12','unico','brigadista',1),
  ('2026-06-13','unico','garcom',15),
  ('2026-06-13','unico','cumim',0),
  ('2026-06-13','unico','host',5),
  ('2026-06-13','unico','asg',0),
  ('2026-06-13','unico','bartender',4),
  ('2026-06-13','unico','barback',12),
  ('2026-06-13','unico','cozinha',3),
  ('2026-06-13','unico','seguranca',14),
  ('2026-06-13','unico','brigadista',2),
  ('2026-06-14','unico','garcom',8),
  ('2026-06-14','unico','cumim',7),
  ('2026-06-14','unico','host',2),
  ('2026-06-14','unico','asg',3),
  ('2026-06-14','unico','bartender',3),
  ('2026-06-14','unico','barback',2),
  ('2026-06-14','unico','cozinha',4),
  ('2026-06-14','unico','seguranca',3),
  ('2026-06-14','unico','brigadista',1),
  ('2026-06-15','unico','garcom',3),
  ('2026-06-15','unico','cumim',3),
  ('2026-06-15','unico','host',1),
  ('2026-06-15','unico','asg',1),
  ('2026-06-15','unico','bartender',1),
  ('2026-06-15','unico','barback',1),
  ('2026-06-15','unico','cozinha',3),
  ('2026-06-15','unico','seguranca',2),
  ('2026-06-15','unico','brigadista',0),
  ('2026-06-16','unico','garcom',3),
  ('2026-06-16','unico','cumim',3),
  ('2026-06-16','unico','host',1),
  ('2026-06-16','unico','asg',1),
  ('2026-06-16','unico','bartender',1),
  ('2026-06-16','unico','barback',1),
  ('2026-06-16','unico','cozinha',3),
  ('2026-06-16','unico','seguranca',2),
  ('2026-06-16','unico','brigadista',0),
  ('2026-06-17','unico','garcom',8),
  ('2026-06-17','unico','cumim',6),
  ('2026-06-17','unico','host',2),
  ('2026-06-17','unico','asg',3),
  ('2026-06-17','unico','bartender',3),
  ('2026-06-17','unico','barback',2),
  ('2026-06-17','unico','cozinha',2),
  ('2026-06-17','unico','seguranca',5),
  ('2026-06-17','unico','brigadista',0),
  ('2026-06-18','unico','garcom',5),
  ('2026-06-18','unico','cumim',4),
  ('2026-06-18','unico','host',2),
  ('2026-06-18','unico','asg',2),
  ('2026-06-18','unico','bartender',2),
  ('2026-06-18','unico','barback',2),
  ('2026-06-18','unico','cozinha',2),
  ('2026-06-18','unico','seguranca',3),
  ('2026-06-18','unico','brigadista',0),
  ('2026-06-19','unico','garcom',12),
  ('2026-06-19','unico','cumim',0),
  ('2026-06-19','unico','host',4),
  ('2026-06-19','unico','asg',0),
  ('2026-06-19','unico','bartender',4),
  ('2026-06-19','unico','barback',13),
  ('2026-06-19','unico','cozinha',5),
  ('2026-06-19','unico','seguranca',14),
  ('2026-06-19','unico','brigadista',2),
  ('2026-06-20','unico','garcom',16),
  ('2026-06-20','unico','cumim',13),
  ('2026-06-20','unico','host',5),
  ('2026-06-20','unico','asg',5),
  ('2026-06-20','unico','bartender',5),
  ('2026-06-20','unico','barback',6),
  ('2026-06-20','unico','cozinha',4),
  ('2026-06-20','unico','seguranca',10),
  ('2026-06-20','unico','brigadista',2),
  ('2026-06-21','unico','garcom',9),
  ('2026-06-21','unico','cumim',8),
  ('2026-06-21','unico','host',2),
  ('2026-06-21','unico','asg',3),
  ('2026-06-21','unico','bartender',3),
  ('2026-06-21','unico','barback',3),
  ('2026-06-21','unico','cozinha',3),
  ('2026-06-21','unico','seguranca',7),
  ('2026-06-21','unico','brigadista',1),
  ('2026-06-22','unico','garcom',2),
  ('2026-06-22','unico','cumim',2),
  ('2026-06-22','unico','host',1),
  ('2026-06-22','unico','asg',1),
  ('2026-06-22','unico','bartender',1),
  ('2026-06-22','unico','barback',1),
  ('2026-06-22','unico','cozinha',1),
  ('2026-06-22','unico','seguranca',2),
  ('2026-06-22','unico','brigadista',0),
  ('2026-06-23','unico','garcom',3),
  ('2026-06-23','unico','cumim',3),
  ('2026-06-23','unico','host',1),
  ('2026-06-23','unico','asg',1),
  ('2026-06-23','unico','bartender',1),
  ('2026-06-23','unico','barback',1),
  ('2026-06-23','unico','cozinha',1),
  ('2026-06-23','unico','seguranca',2),
  ('2026-06-23','unico','brigadista',0),
  ('2026-06-24','unico','garcom',12),
  ('2026-06-24','unico','cumim',0),
  ('2026-06-24','unico','host',4),
  ('2026-06-24','unico','asg',5),
  ('2026-06-24','unico','bartender',5),
  ('2026-06-24','unico','barback',14),
  ('2026-06-24','unico','cozinha',5),
  ('2026-06-24','unico','seguranca',11),
  ('2026-06-24','unico','brigadista',2),
  ('2026-06-25','unico','garcom',5),
  ('2026-06-25','unico','cumim',4),
  ('2026-06-25','unico','host',2),
  ('2026-06-25','unico','asg',2),
  ('2026-06-25','unico','bartender',2),
  ('2026-06-25','unico','barback',2),
  ('2026-06-25','unico','cozinha',4),
  ('2026-06-25','unico','seguranca',0),
  ('2026-06-25','unico','brigadista',0),
  ('2026-06-26','unico','garcom',15),
  ('2026-06-26','unico','cumim',11),
  ('2026-06-26','unico','host',4),
  ('2026-06-26','unico','asg',5),
  ('2026-06-26','unico','bartender',4),
  ('2026-06-26','unico','barback',7),
  ('2026-06-26','unico','cozinha',4),
  ('2026-06-26','unico','seguranca',8),
  ('2026-06-26','unico','brigadista',1),
  ('2026-06-27','unico','garcom',14),
  ('2026-06-27','unico','cumim',12),
  ('2026-06-27','unico','host',4),
  ('2026-06-27','unico','asg',5),
  ('2026-06-27','unico','bartender',5),
  ('2026-06-27','unico','barback',8),
  ('2026-06-27','unico','cozinha',4),
  ('2026-06-27','unico','seguranca',9),
  ('2026-06-27','unico','brigadista',1),
  ('2026-06-28','unico','garcom',8),
  ('2026-06-28','unico','cumim',7),
  ('2026-06-28','unico','host',2),
  ('2026-06-28','unico','asg',3),
  ('2026-06-28','unico','bartender',3),
  ('2026-06-28','unico','barback',2),
  ('2026-06-28','unico','cozinha',2),
  ('2026-06-28','unico','seguranca',7),
  ('2026-06-28','unico','brigadista',1),
  ('2026-06-29','unico','garcom',12),
  ('2026-06-29','unico','cumim',0),
  ('2026-06-29','unico','host',5),
  ('2026-06-29','unico','asg',0),
  ('2026-06-29','unico','bartender',4),
  ('2026-06-29','unico','barback',13),
  ('2026-06-29','unico','cozinha',5),
  ('2026-06-29','unico','seguranca',11),
  ('2026-06-29','unico','brigadista',2),
  ('2026-06-30','unico','garcom',3),
  ('2026-06-30','unico','cumim',3),
  ('2026-06-30','unico','host',1),
  ('2026-06-30','unico','asg',1),
  ('2026-06-30','unico','bartender',1),
  ('2026-06-30','unico','barback',1),
  ('2026-06-30','unico','cozinha',1),
  ('2026-06-30','unico','seguranca',0),
  ('2026-06-30','unico','brigadista',0),
  ('2026-07-01','unico','garcom',5),
  ('2026-07-01','unico','cumim',4),
  ('2026-07-01','unico','host',2),
  ('2026-07-01','unico','asg',2),
  ('2026-07-01','unico','bartender',2),
  ('2026-07-01','unico','barback',2),
  ('2026-07-01','unico','cozinha',2),
  ('2026-07-01','unico','seguranca',3),
  ('2026-07-01','unico','brigadista',0),
  ('2026-07-02','unico','garcom',3),
  ('2026-07-02','unico','cumim',3),
  ('2026-07-02','unico','host',1),
  ('2026-07-02','unico','asg',1),
  ('2026-07-02','unico','bartender',1),
  ('2026-07-02','unico','barback',1),
  ('2026-07-02','unico','cozinha',1),
  ('2026-07-02','unico','seguranca',2),
  ('2026-07-02','unico','brigadista',0),
  ('2026-07-03','unico','garcom',14),
  ('2026-07-03','unico','cumim',11),
  ('2026-07-03','unico','host',4),
  ('2026-07-03','unico','asg',5),
  ('2026-07-03','unico','bartender',4),
  ('2026-07-03','unico','barback',7),
  ('2026-07-03','unico','cozinha',5),
  ('2026-07-03','unico','seguranca',7),
  ('2026-07-03','unico','brigadista',1),
  ('2026-07-04','unico','garcom',13),
  ('2026-07-04','unico','cumim',6),
  ('2026-07-04','unico','host',4),
  ('2026-07-04','unico','asg',4),
  ('2026-07-04','unico','bartender',4),
  ('2026-07-04','unico','barback',9),
  ('2026-07-04','unico','cozinha',5),
  ('2026-07-04','unico','seguranca',9),
  ('2026-07-04','unico','brigadista',2),
  ('2026-07-05','unico','garcom',10),
  ('2026-07-05','unico','cumim',8),
  ('2026-07-05','unico','host',3),
  ('2026-07-05','unico','asg',3),
  ('2026-07-05','unico','bartender',3),
  ('2026-07-05','unico','barback',3),
  ('2026-07-05','unico','cozinha',3),
  ('2026-07-05','unico','seguranca',11),
  ('2026-07-05','unico','brigadista',2),
  ('2026-07-06','unico','garcom',4),
  ('2026-07-06','unico','cumim',4),
  ('2026-07-06','unico','host',2),
  ('2026-07-06','unico','asg',2),
  ('2026-07-06','unico','bartender',2),
  ('2026-07-06','unico','barback',2),
  ('2026-07-06','unico','cozinha',2),
  ('2026-07-06','unico','seguranca',1),
  ('2026-07-06','unico','brigadista',0),
  ('2026-07-07','unico','garcom',5),
  ('2026-07-07','unico','cumim',3),
  ('2026-07-07','unico','host',2),
  ('2026-07-07','unico','asg',1),
  ('2026-07-07','unico','bartender',2),
  ('2026-07-07','unico','barback',2),
  ('2026-07-07','unico','cozinha',2),
  ('2026-07-07','unico','seguranca',1),
  ('2026-07-07','unico','brigadista',0),
  ('2026-07-08','unico','garcom',7),
  ('2026-07-08','unico','cumim',6),
  ('2026-07-08','unico','host',2),
  ('2026-07-08','unico','asg',3),
  ('2026-07-08','unico','bartender',3),
  ('2026-07-08','unico','barback',2),
  ('2026-07-08','unico','cozinha',2),
  ('2026-07-08','unico','seguranca',4),
  ('2026-07-08','unico','brigadista',0),
  ('2026-07-09','unico','garcom',3),
  ('2026-07-09','unico','cumim',3),
  ('2026-07-09','unico','host',1),
  ('2026-07-09','unico','asg',1),
  ('2026-07-09','unico','bartender',1),
  ('2026-07-09','unico','barback',3),
  ('2026-07-09','unico','cozinha',1),
  ('2026-07-09','unico','seguranca',1),
  ('2026-07-09','unico','brigadista',0),
  ('2026-07-10','unico','garcom',15),
  ('2026-07-10','unico','cumim',12),
  ('2026-07-10','unico','host',4),
  ('2026-07-10','unico','asg',5),
  ('2026-07-10','unico','bartender',4),
  ('2026-07-10','unico','barback',7),
  ('2026-07-10','unico','cozinha',5),
  ('2026-07-10','unico','seguranca',7),
  ('2026-07-10','unico','brigadista',1),
  ('2026-07-11','unico','garcom',15),
  ('2026-07-11','unico','cumim',12),
  ('2026-07-11','unico','host',4),
  ('2026-07-11','unico','asg',5),
  ('2026-07-11','unico','bartender',4),
  ('2026-07-11','unico','barback',9),
  ('2026-07-11','unico','cozinha',5),
  ('2026-07-11','unico','seguranca',9),
  ('2026-07-11','unico','brigadista',2),
  ('2026-07-12','unico','garcom',9),
  ('2026-07-12','unico','cumim',8),
  ('2026-07-12','unico','host',3),
  ('2026-07-12','unico','asg',3),
  ('2026-07-12','unico','bartender',3),
  ('2026-07-12','unico','barback',3),
  ('2026-07-12','unico','cozinha',3),
  ('2026-07-12','unico','seguranca',6),
  ('2026-07-12','unico','brigadista',1),
  ('2026-07-13','unico','garcom',4),
  ('2026-07-13','unico','cumim',3),
  ('2026-07-13','unico','host',1),
  ('2026-07-13','unico','asg',3),
  ('2026-07-13','unico','bartender',2),
  ('2026-07-13','unico','barback',2),
  ('2026-07-13','unico','cozinha',2),
  ('2026-07-13','unico','seguranca',1),
  ('2026-07-13','unico','brigadista',0),
  ('2026-07-14','unico','garcom',4),
  ('2026-07-14','unico','cumim',3),
  ('2026-07-14','unico','host',2),
  ('2026-07-14','unico','asg',2),
  ('2026-07-14','unico','bartender',2),
  ('2026-07-14','unico','barback',2),
  ('2026-07-14','unico','cozinha',4),
  ('2026-07-14','unico','seguranca',1),
  ('2026-07-14','unico','brigadista',0),
  ('2026-07-15','unico','garcom',7),
  ('2026-07-15','unico','cumim',6),
  ('2026-07-15','unico','host',2),
  ('2026-07-15','unico','asg',4),
  ('2026-07-15','unico','bartender',3),
  ('2026-07-15','unico','barback',2),
  ('2026-07-15','unico','cozinha',4),
  ('2026-07-15','unico','seguranca',4),
  ('2026-07-15','unico','brigadista',0),
  ('2026-07-16','unico','garcom',3),
  ('2026-07-16','unico','cumim',3),
  ('2026-07-16','unico','host',1),
  ('2026-07-16','unico','asg',2),
  ('2026-07-16','unico','bartender',1),
  ('2026-07-16','unico','barback',1),
  ('2026-07-16','unico','cozinha',4),
  ('2026-07-16','unico','seguranca',1),
  ('2026-07-16','unico','brigadista',0),
  ('2026-07-17','unico','garcom',15),
  ('2026-07-17','unico','cumim',12),
  ('2026-07-17','unico','host',4),
  ('2026-07-17','unico','asg',5),
  ('2026-07-17','unico','bartender',4),
  ('2026-07-17','unico','barback',7),
  ('2026-07-17','unico','cozinha',5),
  ('2026-07-17','unico','seguranca',6),
  ('2026-07-17','unico','brigadista',1),
  ('2026-07-18','unico','garcom',15),
  ('2026-07-18','unico','cumim',12),
  ('2026-07-18','unico','host',4),
  ('2026-07-18','unico','asg',5),
  ('2026-07-18','unico','bartender',5),
  ('2026-07-18','unico','barback',8),
  ('2026-07-18','unico','cozinha',9),
  ('2026-07-18','unico','seguranca',7),
  ('2026-07-18','unico','brigadista',1),
  ('2026-07-19','unico','garcom',13),
  ('2026-07-19','unico','cumim',11),
  ('2026-07-19','unico','host',3),
  ('2026-07-19','unico','asg',4),
  ('2026-07-19','unico','bartender',4),
  ('2026-07-19','unico','barback',5),
  ('2026-07-19','unico','cozinha',4),
  ('2026-07-19','unico','seguranca',9),
  ('2026-07-19','unico','brigadista',1),
  ('2026-07-20','unico','garcom',4),
  ('2026-07-20','unico','cumim',3),
  ('2026-07-20','unico','host',1),
  ('2026-07-20','unico','asg',2),
  ('2026-07-20','unico','bartender',2),
  ('2026-07-20','unico','barback',2),
  ('2026-07-20','unico','cozinha',4),
  ('2026-07-20','unico','seguranca',1),
  ('2026-07-20','unico','brigadista',0),
  ('2026-07-21','unico','garcom',2),
  ('2026-07-21','unico','cumim',2),
  ('2026-07-21','unico','host',2),
  ('2026-07-21','unico','asg',3),
  ('2026-07-21','unico','bartender',2),
  ('2026-07-21','unico','barback',2),
  ('2026-07-21','unico','cozinha',2),
  ('2026-07-21','unico','seguranca',2),
  ('2026-07-21','unico','brigadista',0),
  ('2026-07-22','unico','garcom',8),
  ('2026-07-22','unico','cumim',5),
  ('2026-07-22','unico','host',2),
  ('2026-07-22','unico','asg',6),
  ('2026-07-22','unico','bartender',3),
  ('2026-07-22','unico','barback',2),
  ('2026-07-22','unico','cozinha',4),
  ('2026-07-22','unico','seguranca',4),
  ('2026-07-22','unico','brigadista',0),
  ('2026-07-23','unico','garcom',3),
  ('2026-07-23','unico','cumim',3),
  ('2026-07-23','unico','host',1),
  ('2026-07-23','unico','asg',1),
  ('2026-07-23','unico','bartender',1),
  ('2026-07-23','unico','barback',1),
  ('2026-07-23','unico','cozinha',1),
  ('2026-07-23','unico','seguranca',1),
  ('2026-07-23','unico','brigadista',0),
  ('2026-07-24','unico','garcom',17),
  ('2026-07-24','unico','cumim',15),
  ('2026-07-24','unico','host',5),
  ('2026-07-24','unico','asg',6),
  ('2026-07-24','unico','bartender',4),
  ('2026-07-24','unico','barback',7),
  ('2026-07-24','unico','cozinha',5),
  ('2026-07-24','unico','seguranca',7),
  ('2026-07-24','unico','brigadista',1),
  ('2026-07-25','unico','garcom',11),
  ('2026-07-25','unico','cumim',9),
  ('2026-07-25','unico','host',3),
  ('2026-07-25','unico','asg',6),
  ('2026-07-25','unico','bartender',4),
  ('2026-07-25','unico','barback',8),
  ('2026-07-25','unico','cozinha',7),
  ('2026-07-25','unico','seguranca',6),
  ('2026-07-25','unico','brigadista',1),
  ('2026-07-26','unico','garcom',9),
  ('2026-07-26','unico','cumim',8),
  ('2026-07-26','unico','host',3),
  ('2026-07-26','unico','asg',3),
  ('2026-07-26','unico','bartender',3),
  ('2026-07-26','unico','barback',3),
  ('2026-07-26','unico','cozinha',3),
  ('2026-07-26','unico','seguranca',6),
  ('2026-07-26','unico','brigadista',1),
  ('2026-07-27','unico','garcom',4),
  ('2026-07-27','unico','cumim',3),
  ('2026-07-27','unico','host',1),
  ('2026-07-27','unico','asg',2),
  ('2026-07-27','unico','bartender',2),
  ('2026-07-27','unico','barback',2),
  ('2026-07-27','unico','cozinha',2),
  ('2026-07-27','unico','seguranca',1),
  ('2026-07-27','unico','brigadista',0),
  ('2026-07-28','unico','garcom',4),
  ('2026-07-28','unico','cumim',4),
  ('2026-07-28','unico','host',1),
  ('2026-07-28','unico','asg',2),
  ('2026-07-28','unico','bartender',1),
  ('2026-07-28','unico','barback',2),
  ('2026-07-28','unico','cozinha',3),
  ('2026-07-28','unico','seguranca',1),
  ('2026-07-28','unico','brigadista',0),
  ('2026-07-29','unico','garcom',12),
  ('2026-07-29','unico','cumim',10),
  ('2026-07-29','unico','host',4),
  ('2026-07-29','unico','asg',5),
  ('2026-07-29','unico','bartender',5),
  ('2026-07-29','unico','barback',7),
  ('2026-07-29','unico','cozinha',4),
  ('2026-07-29','unico','seguranca',6),
  ('2026-07-29','unico','brigadista',0),
  ('2026-07-30','unico','garcom',9),
  ('2026-07-30','unico','cumim',7),
  ('2026-07-30','unico','host',4),
  ('2026-07-30','unico','asg',3),
  ('2026-07-30','unico','bartender',3),
  ('2026-07-30','unico','barback',4),
  ('2026-07-30','unico','cozinha',3),
  ('2026-07-30','unico','seguranca',4),
  ('2026-07-30','unico','brigadista',0),
  ('2026-07-31','unico','garcom',14),
  ('2026-07-31','unico','cumim',11),
  ('2026-07-31','unico','host',5),
  ('2026-07-31','unico','asg',5),
  ('2026-07-31','unico','bartender',5),
  ('2026-07-31','unico','barback',5),
  ('2026-07-31','unico','cozinha',4),
  ('2026-07-31','unico','seguranca',6),
  ('2026-07-31','unico','brigadista',1),
  ('2026-08-01','unico','garcom',13),
  ('2026-08-01','unico','cumim',8),
  ('2026-08-01','unico','host',4),
  ('2026-08-01','unico','asg',4),
  ('2026-08-01','unico','bartender',4),
  ('2026-08-01','unico','barback',4),
  ('2026-08-01','unico','cozinha',7),
  ('2026-08-01','unico','seguranca',6),
  ('2026-08-01','unico','brigadista',1),
  ('2026-08-02','unico','garcom',8),
  ('2026-08-02','unico','cumim',7),
  ('2026-08-02','unico','host',2),
  ('2026-08-02','unico','asg',3),
  ('2026-08-02','unico','bartender',3),
  ('2026-08-02','unico','barback',2),
  ('2026-08-02','unico','cozinha',2),
  ('2026-08-02','unico','seguranca',6),
  ('2026-08-02','unico','brigadista',1),
  ('2026-08-03','unico','garcom',2),
  ('2026-08-03','unico','cumim',2),
  ('2026-08-03','unico','host',1),
  ('2026-08-03','unico','asg',1),
  ('2026-08-03','unico','bartender',1),
  ('2026-08-03','unico','barback',1),
  ('2026-08-03','unico','cozinha',2),
  ('2026-08-03','unico','seguranca',1),
  ('2026-08-03','unico','brigadista',0),
  ('2026-08-04','unico','garcom',3),
  ('2026-08-04','unico','cumim',2),
  ('2026-08-04','unico','host',1),
  ('2026-08-04','unico','asg',1),
  ('2026-08-04','unico','bartender',1),
  ('2026-08-04','unico','barback',1),
  ('2026-08-04','unico','cozinha',2),
  ('2026-08-04','unico','seguranca',1),
  ('2026-08-04','unico','brigadista',0),
  ('2026-08-05','unico','garcom',7),
  ('2026-08-05','unico','cumim',6),
  ('2026-08-05','unico','host',2),
  ('2026-08-05','unico','asg',3),
  ('2026-08-05','unico','bartender',2),
  ('2026-08-05','unico','barback',2),
  ('2026-08-05','unico','cozinha',3),
  ('2026-08-05','unico','seguranca',4),
  ('2026-08-05','unico','brigadista',0),
  ('2026-08-06','unico','garcom',4),
  ('2026-08-06','unico','cumim',3),
  ('2026-08-06','unico','host',1),
  ('2026-08-06','unico','asg',2),
  ('2026-08-06','unico','bartender',1),
  ('2026-08-06','unico','barback',1),
  ('2026-08-06','unico','cozinha',3),
  ('2026-08-06','unico','seguranca',2),
  ('2026-08-06','unico','brigadista',0),
  ('2026-08-07','unico','garcom',12),
  ('2026-08-07','unico','cumim',10),
  ('2026-08-07','unico','host',4),
  ('2026-08-07','unico','asg',4),
  ('2026-08-07','unico','bartender',3),
  ('2026-08-07','unico','barback',3),
  ('2026-08-07','unico','cozinha',4),
  ('2026-08-07','unico','seguranca',7),
  ('2026-08-07','unico','brigadista',1),
  ('2026-08-08','dia','garcom',8),
  ('2026-08-08','dia','cumim',6),
  ('2026-08-08','dia','host',3),
  ('2026-08-08','dia','asg',3),
  ('2026-08-08','dia','bartender',2),
  ('2026-08-08','dia','barback',3),
  ('2026-08-08','dia','cozinha',5),
  ('2026-08-08','dia','seguranca',2),
  ('2026-08-08','dia','brigadista',1),
  ('2026-08-08','noite','garcom',6),
  ('2026-08-08','noite','cumim',5),
  ('2026-08-08','noite','host',2),
  ('2026-08-08','noite','asg',2),
  ('2026-08-08','noite','bartender',2),
  ('2026-08-08','noite','barback',2),
  ('2026-08-08','noite','cozinha',4),
  ('2026-08-08','noite','seguranca',6),
  ('2026-08-08','noite','brigadista',1),
  ('2026-08-09','unico','garcom',9),
  ('2026-08-09','unico','cumim',7),
  ('2026-08-09','unico','host',3),
  ('2026-08-09','unico','asg',3),
  ('2026-08-09','unico','bartender',3),
  ('2026-08-09','unico','barback',3),
  ('2026-08-09','unico','cozinha',3),
  ('2026-08-09','unico','seguranca',5),
  ('2026-08-09','unico','brigadista',1),
  ('2026-08-10','unico','garcom',3),
  ('2026-08-10','unico','cumim',2),
  ('2026-08-10','unico','host',1),
  ('2026-08-10','unico','asg',1),
  ('2026-08-10','unico','bartender',2),
  ('2026-08-10','unico','barback',2),
  ('2026-08-10','unico','cozinha',2),
  ('2026-08-10','unico','seguranca',1),
  ('2026-08-10','unico','brigadista',0),
  ('2026-08-11','unico','garcom',3),
  ('2026-08-11','unico','cumim',3),
  ('2026-08-11','unico','host',1),
  ('2026-08-11','unico','asg',1),
  ('2026-08-11','unico','bartender',2),
  ('2026-08-11','unico','barback',1),
  ('2026-08-11','unico','cozinha',2),
  ('2026-08-11','unico','seguranca',1),
  ('2026-08-11','unico','brigadista',0),
  ('2026-08-12','unico','garcom',7),
  ('2026-08-12','unico','cumim',6),
  ('2026-08-12','unico','host',2),
  ('2026-08-12','unico','asg',4),
  ('2026-08-12','unico','bartender',2),
  ('2026-08-12','unico','barback',2),
  ('2026-08-12','unico','cozinha',3),
  ('2026-08-12','unico','seguranca',4),
  ('2026-08-12','unico','brigadista',0),
  ('2026-08-13','unico','garcom',4),
  ('2026-08-13','unico','cumim',3),
  ('2026-08-13','unico','host',1),
  ('2026-08-13','unico','asg',1),
  ('2026-08-13','unico','bartender',1),
  ('2026-08-13','unico','barback',1),
  ('2026-08-13','unico','cozinha',2),
  ('2026-08-13','unico','seguranca',2),
  ('2026-08-13','unico','brigadista',0),
  ('2026-08-14','unico','garcom',14),
  ('2026-08-14','unico','cumim',11),
  ('2026-08-14','unico','host',4),
  ('2026-08-14','unico','asg',5),
  ('2026-08-14','unico','bartender',4),
  ('2026-08-14','unico','barback',5),
  ('2026-08-14','unico','cozinha',4),
  ('2026-08-14','unico','seguranca',7),
  ('2026-08-14','unico','brigadista',1),
  ('2026-08-15','dia','garcom',2),
  ('2026-08-15','dia','cumim',2),
  ('2026-08-15','dia','host',1),
  ('2026-08-15','dia','asg',1),
  ('2026-08-15','dia','bartender',1),
  ('2026-08-15','dia','barback',1),
  ('2026-08-15','dia','cozinha',4),
  ('2026-08-15','dia','seguranca',2),
  ('2026-08-15','dia','brigadista',0),
  ('2026-08-15','noite','garcom',6),
  ('2026-08-15','noite','cumim',5),
  ('2026-08-15','noite','host',3),
  ('2026-08-15','noite','asg',3),
  ('2026-08-15','noite','bartender',3),
  ('2026-08-15','noite','barback',4),
  ('2026-08-15','noite','cozinha',4),
  ('2026-08-15','noite','seguranca',6),
  ('2026-08-15','noite','brigadista',2),
  ('2026-08-16','unico','garcom',9),
  ('2026-08-16','unico','cumim',8),
  ('2026-08-16','unico','host',3),
  ('2026-08-16','unico','asg',2),
  ('2026-08-16','unico','bartender',3),
  ('2026-08-16','unico','barback',3),
  ('2026-08-16','unico','cozinha',3),
  ('2026-08-16','unico','seguranca',5),
  ('2026-08-16','unico','brigadista',1),
  ('2026-08-17','unico','garcom',2),
  ('2026-08-17','unico','cumim',2),
  ('2026-08-17','unico','host',1),
  ('2026-08-17','unico','asg',1),
  ('2026-08-17','unico','bartender',2),
  ('2026-08-17','unico','barback',2),
  ('2026-08-17','unico','cozinha',2),
  ('2026-08-17','unico','seguranca',1),
  ('2026-08-17','unico','brigadista',0),
  ('2026-08-18','unico','garcom',3),
  ('2026-08-18','unico','cumim',3),
  ('2026-08-18','unico','host',1),
  ('2026-08-18','unico','asg',1),
  ('2026-08-18','unico','bartender',2),
  ('2026-08-18','unico','barback',2),
  ('2026-08-18','unico','cozinha',3),
  ('2026-08-18','unico','seguranca',1),
  ('2026-08-18','unico','brigadista',0),
  ('2026-08-19','unico','garcom',7),
  ('2026-08-19','unico','cumim',6),
  ('2026-08-19','unico','host',2),
  ('2026-08-19','unico','asg',3),
  ('2026-08-19','unico','bartender',2),
  ('2026-08-19','unico','barback',2),
  ('2026-08-19','unico','cozinha',3),
  ('2026-08-19','unico','seguranca',3),
  ('2026-08-19','unico','brigadista',0),
  ('2026-08-20','unico','garcom',4),
  ('2026-08-20','unico','cumim',4),
  ('2026-08-20','unico','host',1),
  ('2026-08-20','unico','asg',2),
  ('2026-08-20','unico','bartender',1),
  ('2026-08-20','unico','barback',1),
  ('2026-08-20','unico','cozinha',3),
  ('2026-08-20','unico','seguranca',2),
  ('2026-08-20','unico','brigadista',0),
  ('2026-08-21','unico','garcom',12),
  ('2026-08-21','unico','cumim',10),
  ('2026-08-21','unico','host',5),
  ('2026-08-21','unico','asg',5),
  ('2026-08-21','unico','bartender',5),
  ('2026-08-21','unico','barback',5),
  ('2026-08-21','unico','cozinha',5),
  ('2026-08-21','unico','seguranca',7),
  ('2026-08-21','unico','brigadista',1),
  ('2026-08-22','dia','garcom',2),
  ('2026-08-22','dia','cumim',2),
  ('2026-08-22','dia','host',1),
  ('2026-08-22','dia','asg',1),
  ('2026-08-22','dia','bartender',1),
  ('2026-08-22','dia','barback',1),
  ('2026-08-22','dia','cozinha',4),
  ('2026-08-22','dia','seguranca',2),
  ('2026-08-22','dia','brigadista',0),
  ('2026-08-22','noite','garcom',9),
  ('2026-08-22','noite','cumim',8),
  ('2026-08-22','noite','host',3),
  ('2026-08-22','noite','asg',3),
  ('2026-08-22','noite','bartender',3),
  ('2026-08-22','noite','barback',3),
  ('2026-08-22','noite','cozinha',4),
  ('2026-08-22','noite','seguranca',6),
  ('2026-08-22','noite','brigadista',2),
  ('2026-08-23','unico','garcom',8),
  ('2026-08-23','unico','cumim',7),
  ('2026-08-23','unico','host',3),
  ('2026-08-23','unico','asg',3),
  ('2026-08-23','unico','bartender',3),
  ('2026-08-23','unico','barback',3),
  ('2026-08-23','unico','cozinha',3),
  ('2026-08-23','unico','seguranca',5),
  ('2026-08-23','unico','brigadista',1),
  ('2026-08-24','unico','garcom',1),
  ('2026-08-24','unico','cumim',1),
  ('2026-08-24','unico','host',1),
  ('2026-08-24','unico','asg',1),
  ('2026-08-24','unico','bartender',2),
  ('2026-08-24','unico','barback',2),
  ('2026-08-24','unico','cozinha',4),
  ('2026-08-24','unico','seguranca',1),
  ('2026-08-24','unico','brigadista',0),
  ('2026-08-25','unico','garcom',3),
  ('2026-08-25','unico','cumim',3),
  ('2026-08-25','unico','host',1),
  ('2026-08-25','unico','asg',1),
  ('2026-08-25','unico','bartender',2),
  ('2026-08-25','unico','barback',2),
  ('2026-08-25','unico','cozinha',3),
  ('2026-08-25','unico','seguranca',1),
  ('2026-08-25','unico','brigadista',0),
  ('2026-08-26','unico','garcom',7),
  ('2026-08-26','unico','cumim',6),
  ('2026-08-26','unico','host',2),
  ('2026-08-26','unico','asg',3),
  ('2026-08-26','unico','bartender',2),
  ('2026-08-26','unico','barback',2),
  ('2026-08-26','unico','cozinha',4),
  ('2026-08-26','unico','seguranca',3),
  ('2026-08-26','unico','brigadista',0),
  ('2026-08-27','unico','garcom',4),
  ('2026-08-27','unico','cumim',4),
  ('2026-08-27','unico','host',1),
  ('2026-08-27','unico','asg',2),
  ('2026-08-27','unico','bartender',1),
  ('2026-08-27','unico','barback',1),
  ('2026-08-27','unico','cozinha',4),
  ('2026-08-27','unico','seguranca',3),
  ('2026-08-27','unico','brigadista',0),
  ('2026-08-28','unico','garcom',17),
  ('2026-08-28','unico','cumim',14),
  ('2026-08-28','unico','host',5),
  ('2026-08-28','unico','asg',5),
  ('2026-08-28','unico','bartender',5),
  ('2026-08-28','unico','barback',5),
  ('2026-08-28','unico','cozinha',4),
  ('2026-08-28','unico','seguranca',3),
  ('2026-08-28','unico','brigadista',0),
  ('2026-08-29','dia','garcom',2),
  ('2026-08-29','dia','cumim',2),
  ('2026-08-29','dia','host',1),
  ('2026-08-29','dia','asg',1),
  ('2026-08-29','dia','bartender',1),
  ('2026-08-29','dia','barback',1),
  ('2026-08-29','dia','cozinha',4),
  ('2026-08-29','dia','seguranca',2),
  ('2026-08-29','dia','brigadista',0),
  ('2026-08-29','noite','garcom',12),
  ('2026-08-29','noite','cumim',10),
  ('2026-08-29','noite','host',3),
  ('2026-08-29','noite','asg',4),
  ('2026-08-29','noite','bartender',3),
  ('2026-08-29','noite','barback',3),
  ('2026-08-29','noite','cozinha',4),
  ('2026-08-29','noite','seguranca',6),
  ('2026-08-29','noite','brigadista',2),
  ('2026-08-30','unico','garcom',9),
  ('2026-08-30','unico','cumim',7),
  ('2026-08-30','unico','host',3),
  ('2026-08-30','unico','asg',3),
  ('2026-08-30','unico','bartender',3),
  ('2026-08-30','unico','barback',3),
  ('2026-08-30','unico','cozinha',4),
  ('2026-08-30','unico','seguranca',3),
  ('2026-08-30','unico','brigadista',0)
) as v(data, turno, codigo, total)
join operations.operacao_dia d
  on d.bar_id = 3 and d.data = v.data::date and d.turno = v.turno::operations.operacao_turno
join operations.operacao_funcao f on f.bar_id = 3 and f.codigo = v.codigo
on conflict (operacao_dia_id, funcao_id) do update
   set total_calculado = excluded.total_calculado, atualizado_em = now();

-- 3) fixos_escala = contagem da escala (quem tem horário no dia; FOLGA/FÉRIAS não contam).
--    O sábado casa por turno; os demais dias são 'unico' nas duas pontas.
--    Subquery correlacionada, não UPDATE..FROM lateral: o Postgres não deixa a lateral
--    do FROM referenciar a própria tabela alvo do UPDATE (42P10).
update operations.operacao_dia_funcao df
   set fixos_escala = (
         select count(*)
         from operations.escala_dia e
         join operations.operacao_dia d2 on d2.id = df.operacao_dia_id
         where e.bar_id    = d2.bar_id
           and e.data      = d2.data
           and e.funcao_id = df.funcao_id
           and e.entra is not null
           and (d2.turno = 'unico' or e.turno = d2.turno)
       ),
       atualizado_em = now()
where exists (
  select 1 from operations.operacao_dia d
  where d.id = df.operacao_dia_id and d.bar_id = 3
);
