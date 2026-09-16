import type { Job } from "../types/job";

export const MOCK_JOBS: Job[] = [
  {
    id: "mock-1",
    title: "Desenvolvedor Front-end React Júnior",
    company: "Nubank",
    location: "São Paulo, SP (Remoto)",
    workModel: "REMOTO",
    contractType: "CLT",
    seniorityLevel: "JUNIOR",
    salary: "R$ 4.500 - R$ 6.000",
    url: "https://boards.greenhouse.io/nubank/jobs/12345",
    source: "GREENHOUSE",
    stack: ["React", "TypeScript", "Tailwind CSS", "Jest"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
    description: `## Sobre a vaga
Buscamos uma pessoa Desenvolvedora Front-end Júnior para integrar nosso time de engenharia focado na experiência digital de milhões de clientes.

### O que você irá fazer:
- Desenvolver componentes reutilizáveis em React e TypeScript com foco em acessibilidade e performance.
- Trabalhar em conjunto com designers de produto e engenheiros de backend em squads ágeis.
- Escrever testes unitários e de integração com Jest e Testing Library.
- Participar ativamente de code reviews e cerimônias ágeis (Scrum/Kanban).

### O que esperamos de você:
- Conhecimentos sólidos em JavaScript moderno (ES6+), React e TypeScript.
- Vivência com consumo de APIs RESTful e boas práticas de componentização.
- Atenção a detalhes em UI/UX e design responsivo.
- Curiosidade técnica e vontade de aprender com uma equipe referência no mercado.

### Benefícios:
- 100% Home Office com ajuda de custo mensal.
- Plano de saúde e odontológico Bradesco Top Nacional.
- Vale Refeição/Alimentação flexível (Caju).
- Auxílio creche e seguro de vida.`,
    isTech: true,
  },
  {
    id: "mock-2",
    title: "Estágio em Engenharia de Software (Backend Node.js / Python)",
    company: "iFood",
    location: "Campinas, SP (Híbrido)",
    workModel: "HIBRIDO",
    contractType: "ESTAGIO",
    seniorityLevel: "ESTAGIO",
    salary: "R$ 2.400 + Benefícios",
    url: "https://ifood.gupy.io/job/98765",
    source: "GUPY",
    stack: ["Node.js", "Python", "Docker", "PostgreSQL"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2h ago
    description: `## Programa de Estágio Tech iFood 2026

Quer construir a tecnologia por trás de mais de 70 milhões de pedidos por mês?

### Requisitos:
- Cursando Ciência da Computação, Engenharia de Software, Sistemas de Informação ou áreas afins (conclusão prevista a partir de 2027).
- Conhecimento básico em lógica de programação e uma das linguagens: Node.js, Python ou Go.
- Noções de banco de dados relacionais (SQL).
- Disponibilidade para 6 horas diárias (30h semanais).

### O que oferecemos:
- Bolsa auxílio competitiva (R$ 2.400).
- Vale Refeição generoso (iFood Refeição).
- Mentoria semanal com Tech Leads experientes.
- Trilha acelerada de efetivação para Júnior ao concluir o estágio.`,
    isTech: true,
  },
  {
    id: "mock-3",
    title: "Fullstack Engineer (React / Python FastAPI)",
    company: "Brex",
    location: "Remoto Brasil",
    workModel: "REMOTO",
    contractType: "PJ",
    seniorityLevel: "PLENO",
    salary: "USD $4,000 - $5,500 / mês",
    url: "https://jobs.ashbyhq.com/brex/45678",
    source: "ASHBY",
    stack: ["React", "Python", "FastAPI", "PostgreSQL", "AWS"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(), // 4h ago
    description: `## About Brex
Brex is building the financial stack for global businesses. We are expanding our LatAm engineering hub.

### Role Overview:
We are looking for a Mid-Level Fullstack Engineer to help build scalable customer-facing dashboard features and high-throughput financial processing pipelines.

### Requirements:
- 3+ years of professional fullstack experience.
- Strong hands-on proficiency with modern React (Hooks, Context, Next.js) and Python (FastAPI, SQLAlchemy).
- Experience with relational databases, message brokers (Kafka/RabbitMQ), and AWS cloud infra.
- Good English communication skills (written and spoken).

### What We Offer:
- Competitive USD compensation paid directly via international wire or crypto.
- Flexible remote work schedule.
- Yearly learning stipend for books, conferences, and certifications.`,
    isTech: true,
  },
  {
    id: "mock-4",
    title: "Desenvolvedor Backend Java / Spring Boot Pleno",
    company: "Venturus",
    location: "Campinas, SP (Remoto)",
    workModel: "REMOTO",
    contractType: "CLT",
    seniorityLevel: "PLENO",
    url: "https://venturus.inhire.app/vagas/34567",
    source: "INHIRE",
    stack: ["Java", "Spring Boot", "Kafka", "Docker", "Kubernetes"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    description: `## Oportunidade Venturus Inovação
O Venturus desenvolve soluções de missão crítica para os maiores players globais de tecnologia e telecomunicações.

### Atribuições:
- Desenvolver microserviços escaláveis em Java 17+ e Spring Boot.
- Implementar mensageria assíncrona com Apache Kafka e RabbitMQ.
- Otimizar consultas de banco de dados SQL e NoSQL.
- Garantir alta cobertura de testes automatizados e esteiras de CI/CD.

### Requisitos:
- Experiência sólida em desenvolvimento Java corporativo com Spring Boot.
- Conhecimento em arquitetura de microsserviços e APIs REST.
- Experiência prática com Docker e orquestração de containers.`,
    isTech: true,
  },
  {
    id: "mock-5",
    title: "Engenheiro de Dados Sênior (Snowflake & Databricks)",
    company: "QuintoAndar",
    location: "São Paulo, SP (Remoto)",
    workModel: "REMOTO",
    contractType: "CLT",
    seniorityLevel: "SENIOR",
    url: "https://jobs.lever.co/quintoandar/78901",
    source: "LEVER",
    stack: ["Python", "Snowflake", "Databricks", "Airflow", "SQL"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
    description: `## Data Platform no QuintoAndar
Nossa missão é usar inteligência de dados para desburocratizar a moradia de milhões de pessoas na América Latina.

### Suas responsabilidades:
- Arquitetar e manter pipelines de dados distribuídos em larga escala utilizando Apache Spark, Databricks e Snowflake.
- Definir padrões de governança, qualidade de dados e linhagem.
- Colaborar com cientistas de dados e analistas de BI para disponibilizar dados confiáveis em tempo quase real.

### O que buscamos:
- Ampla experiência com engenharia de dados em ambientes cloud (AWS ou GCP).
- Domínio avançado de Python e SQL analítico.
- Vivência com orquestradores (Airflow, Dagster ou Prefect).`,
    isTech: true,
  },
  {
    id: "mock-6",
    title: "Desenvolvedor Mobile Flutter / iOS Júnior",
    company: "PicPay",
    location: "Vitória, ES (Híbrido)",
    workModel: "HIBRIDO",
    contractType: "CLT",
    seniorityLevel: "JUNIOR",
    salary: "R$ 4.000 - R$ 5.200",
    url: "https://picpay.gupy.io/job/56789",
    source: "GUPY",
    stack: ["Flutter", "Dart", "iOS", "Android", "Git"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    description: `## O que fazemos no PicPay
Somos o maior super app financeiro do Brasil, simplificando a vida de milhões de pessoas todos os dias.

### Seu desafio:
- Construir e aprimorar fluxos de pagamentos, transferências e carteira digital no aplicativo PicPay.
- Implementar código performático e testável em Flutter / Dart.
- Integrar com serviços nativos (iOS e Android) quando necessário.

### O que precisamos:
- Experiência em projetos (profissionais, acadêmicos ou pessoais) com Flutter.
- Conhecimento em gerenciamento de estado (Bloc, MobX ou Provider).
- Noções de consumo de APIs e persistência local (SQLite/Hive).`,
    isTech: true,
  },
  {
    id: "mock-7",
    title: "DevOps / SRE Engineer Pleno",
    company: "Stone",
    location: "Rio de Janeiro, RJ (Remoto)",
    workModel: "REMOTO",
    contractType: "CLT",
    seniorityLevel: "PLENO",
    url: "https://boards.greenhouse.io/stone/jobs/99887",
    source: "GREENHOUSE",
    stack: ["Kubernetes", "Terraform", "AWS", "Prometheus", "CI/CD"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 850).toISOString(),
    description: `## Stone Tech
Construímos a infraestrutura que processa bilhões em transações para pequenos e médios empreendedores brasileiros.

### Atuação:
- Gerenciar clusters Kubernetes em produção na AWS (EKS).
- Criar e evoluir infraestrutura como código (IaC) com Terraform.
- Implementar esteiras modernas de CI/CD via GitHub Actions e ArgoCD.
- Monitoramento contínuo com Prometheus, Grafana e Datadog.`,
    isTech: true,
  },
  {
    id: "mock-8",
    title: "Desenvolvedor .NET C# / Azure Pleno",
    company: "FCamara",
    location: "São Paulo, SP (Presencial)",
    workModel: "PRESENCIAL",
    contractType: "CLT",
    seniorityLevel: "PLENO",
    url: "https://fcamara.gupy.io/job/11223",
    source: "GUPY",
    stack: [".NET", "C#", "Azure", "SQL Server", "Docker"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 950).toISOString(),
    description: `## Somos Orange Blood!
A FCamara é líder em transformação digital e desenvolvimento de software corporativo no Brasil e Europa.

### O que você fará:
- Desenvolvimento de APIs de alta performance com .NET 8 e C#.
- Modelagem e integração com banco de dados SQL Server e CosmosDB.
- Deploy em nuvem Microsoft Azure (App Services, Azure Functions).`,
    isTech: true,
  },
  {
    id: "mock-9",
    title: "Estágio em Desenvolvimento Web Frontend",
    company: "Zup Innovation",
    location: "Uberlândia, MG (Remoto)",
    workModel: "REMOTO",
    contractType: "ESTAGIO",
    seniorityLevel: "ESTAGIO",
    salary: "R$ 2.200",
    url: "https://zup.gupy.io/job/33445",
    source: "GUPY",
    stack: ["HTML", "CSS", "JavaScript", "React", "Tailwind CSS"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 1100).toISOString(),
    description: `## Estágio Tech na Zup
Gosta de aprender código e resolver problemas reais? Venha estagiar com nosso time open source e desenvolvimento frontend.

### Requisitos:
- Estudante de Ciência da Computação, ADS ou cursos correlatos.
- Gosto por interfaces web limpas e acessíveis.
- Vontade de aprender React e ecossistema moderno.`,
    isTech: true,
  },
  {
    id: "mock-10",
    title: "Pessoa Desenvolvedora Fullstack (Node.js & Vue.js)",
    company: "Pipefy",
    location: "Curitiba, PR (Remoto)",
    workModel: "REMOTO",
    contractType: "CLT",
    seniorityLevel: "PLENO",
    url: "https://jobs.lever.co/pipefy/55667",
    source: "LEVER",
    stack: ["Node.js", "Vue.js", "TypeScript", "GraphQL", "PostgreSQL"],
    scrapedAt: new Date(Date.now() - 1000 * 60 * 1300).toISOString(),
    description: `## Pipefy Global
O Pipefy empodera times de negócios a automatizarem seus fluxos de trabalho sem código complexo.

### Requisitos:
- Experiência em desenvolvimento de aplicações web modernas com TypeScript.
- Vivência com APIs GraphQL ou REST.
- Experiência com Vue.js ou React.`,
    isTech: true,
  },
];
