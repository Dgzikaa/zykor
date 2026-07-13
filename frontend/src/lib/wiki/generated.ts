/* eslint-disable */
// ⚠️ ARQUIVO GERADO por scripts/build-wiki.mjs — NÃO EDITE À MÃO.
// Fonte: content/wiki/**/*.md. Rode `npm run wiki:build` pra regenerar.

export interface WikiHeading { level: number; text: string; }
export interface WikiArticle {
  path: string;
  slug: string;
  area: string;
  title: string;
  description: string;
  route: string;
  order: number;
  icon: string;
  headings: WikiHeading[];
  excerpt: string;
  body: string;
}

export const WIKI_ARTICLES: WikiArticle[] = [
  {
    "path": "comecando/bem-vindo",
    "slug": "bem-vindo",
    "area": "comecando",
    "title": "Bem-vindo à Wiki do Zykor",
    "description": "O que você encontra aqui e como a documentação está organizada.",
    "route": "/wiki",
    "order": 1,
    "icon": "BookOpen",
    "headings": [
      {
        "level": 2,
        "text": "Como está organizada"
      },
      {
        "level": 2,
        "text": "Como usar"
      },
      {
        "level": 2,
        "text": "Conceitos que aparecem em todo lugar"
      }
    ],
    "excerpt": "Bem vindo à Wiki do Zykor Esta é a central de conhecimento do Zykor — o sistema de gestão dos bares do Grupo. Aqui você encontra, tela por tela , o que cada página faz, como cada número é calculado e passo a passo de como executar cada tarefa. Como está organizada A wiki segue as mesmas áreas do menu lateral do sistema: Estratégico — visão geral, desempenho, planejamento e orçamentação. Receitas —",
    "body": "# Bem-vindo à Wiki do Zykor\n\nEsta é a central de conhecimento do **Zykor** — o sistema de gestão dos bares do Grupo. Aqui você encontra, **tela por tela**, o que cada página faz, **como cada número é calculado** e **passo a passo** de como executar cada tarefa.\n\n## Como está organizada\n\nA wiki segue as mesmas áreas do menu lateral do sistema:\n\n- **Estratégico** — visão geral, desempenho, planejamento e orçamentação.\n- **Receitas** — dashboards de faturamento, clientes, eventos e artistas.\n- **RH** — funcionários, escala, freelas, ponto e custo de mão de obra.\n- **Relatórios Financeiros** — DRE, DFC, Balanço e Business Plan.\n- **Ferramentas Financeiro** — agendamentos, pagamentos, conciliação e Conta Azul.\n- **Produção · CMV** — CMV, desvios, insumos, fichas técnicas, compras e produção.\n- **Ferramentas** — análises avançadas e diagnósticos operacionais.\n- **Configurações** — bares, integrações, usuários e permissões.\n\n## Como usar\n\n1. Use a **busca** no topo pra achar rápido uma tela, uma coluna ou um conceito.\n2. Navegue pela **barra lateral** por área.\n3. Em cada artigo de tela você encontra: **o que é**, **como usar (passo a passo)**, **o cálculo de cada coluna** e **dúvidas comuns**.\n\n> A wiki é sempre um retrato do sistema atual. Se algo na tela mudou e o texto não bate, avise pelo botão **Abrir chamado** (mesmo menu do ícone **?**).\n\n## Conceitos que aparecem em todo lugar\n\n- **Bar selecionado** — quase tudo no Zykor é filtrado pelo bar ativo (seletor no topo). Trocar de bar troca os dados de toda a tela.\n- **Competência × Vencimento** — competência é o mês/dia a que o valor pertence (regime de competência); vencimento é quando o dinheiro efetivamente entra ou sai.\n- **Data gerencial** — o dia operacional do bar (a \"virada\" não é meia-noite; vendas da madrugada contam no dia anterior).\n- **Camadas de dados (medallion)** — os números nascem crus das integrações (bronze), são tratados (silver) e viram indicadores prontos (gold). Quando um artigo cita a \"fonte\", é a tabela/visão de onde o número sai."
  }
];
