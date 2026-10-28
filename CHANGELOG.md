# 📝 Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.8.1](https://github.com/ApenasGabs/querovagas/compare/v1.8.0...v1.8.1) (2026-10-28)

### 🐛 Bug Fixes

* **companies:** habilitar botao de sugestao para login e salvar rascunho (Refs [#18](https://github.com/ApenasGabs/querovagas/issues/18)) ([#19](https://github.com/ApenasGabs/querovagas/issues/19)) ([8dc268e](https://github.com/ApenasGabs/querovagas/commit/8dc268e3b7dffc50d4a2c7dfc73cfdbda9a0a530))

## [1.8.0](https://github.com/ApenasGabs/querovagas/compare/v1.7.1...v1.8.0) (2026-10-22)

### ✨ Features

* **radar:** carregar empresas e sugestões dinamicamente da tabela companies no Supabase ([#17](https://github.com/ApenasGabs/querovagas/issues/17)) ([02e2436](https://github.com/ApenasGabs/querovagas/commit/02e243607c7a05412f8d67400f8985e2f834b04e)), closes [#16](https://github.com/ApenasGabs/querovagas/issues/16) [#16](https://github.com/ApenasGabs/querovagas/issues/16) [#16](https://github.com/ApenasGabs/querovagas/issues/16) [#16](https://github.com/ApenasGabs/querovagas/issues/16)

## [1.7.1](https://github.com/ApenasGabs/querovagas/compare/v1.7.0...v1.7.1) (2026-10-22)

### 🐛 Bug Fixes

* **api:** remover import .ts relativo em api/index.ts e corrigir tipagem BodyInit na Vercel (Refs [#14](https://github.com/ApenasGabs/querovagas/issues/14)) ([d010dc0](https://github.com/ApenasGabs/querovagas/commit/d010dc08182d70dade01df5cae8fdf31dda07aa0))

## [1.7.0](https://github.com/ApenasGabs/querovagas/compare/v1.6.0...v1.7.0) (2026-10-22)

### ✨ Features

* **auth:** unificar autenticação exclusivamente via sessão do Utterances ([#13](https://github.com/ApenasGabs/querovagas/issues/13)) ([88f63d6](https://github.com/ApenasGabs/querovagas/commit/88f63d6c563fe49daf7e1e0cb8cb08784e4d751e)), closes [#12](https://github.com/ApenasGabs/querovagas/issues/12) [#12](https://github.com/ApenasGabs/querovagas/issues/12) [#12](https://github.com/ApenasGabs/querovagas/issues/12)

## [1.6.0](https://github.com/ApenasGabs/querovagas/compare/v1.5.1...v1.6.0) (2026-10-21)

### ✨ Features

* **companies:** priorizar busca no Radar de Empresas e migrar Agibank ([#10](https://github.com/ApenasGabs/querovagas/issues/10)) ([064bab6](https://github.com/ApenasGabs/querovagas/commit/064bab607ed6bee81dda902b773bb7cb20041eaf))

## [1.5.1](https://github.com/ApenasGabs/querovagas/compare/v1.5.0...v1.5.1) (2026-10-21)

### 🐛 Bug Fixes

* **auth:** atualizar placeholder e corrigir bundle serverless na vercel (Refs [#7](https://github.com/ApenasGabs/querovagas/issues/7)) ([384219a](https://github.com/ApenasGabs/querovagas/commit/384219abc48ddeb2bc3ad848a17313c58a67eb6e))

## [1.5.0](https://github.com/ApenasGabs/querovagas/compare/v1.4.1...v1.5.0) (2026-10-18)

### ✨ Features

* **community:** implement direct github oauth flow and sanitize api responses ([c7e057f](https://github.com/ApenasGabs/querovagas/commit/c7e057f2e405aa5d893f0394d17d877ae6f3cbd4))
* **community:** refine company radar, suggestions flow and session integration ([216e8ee](https://github.com/ApenasGabs/querovagas/commit/216e8ee8ccdc5e747866997eadc3cb3be6179f23))

### 🐛 Bug Fixes

* **build:** remove unused openModal variable causing tsc -b error ([27b33d9](https://github.com/ApenasGabs/querovagas/commit/27b33d96ef9637a93a8d0884cc43ad6a779613f8))
* **community:** add direct github profile verification modal for contributor access ([9056474](https://github.com/ApenasGabs/querovagas/commit/90564747d281d727a0d236ee3acad4d8e33a1de5))
* **community:** address qa review findings with stealth api hardening and lint cleanups ([01e6c78](https://github.com/ApenasGabs/querovagas/commit/01e6c78fb08cac07432d8447075016bad5330a76))

## [1.4.1](https://github.com/ApenasGabs/querovagas/compare/v1.4.0...v1.4.1) (2026-10-14)

### 🐛 Bug Fixes

* **api:** converter catalogo para ts, tipar hasTechJobs e sanitizar query do parser (Refs [#3](https://github.com/ApenasGabs/querovagas/issues/3)) ([71efc31](https://github.com/ApenasGabs/querovagas/commit/71efc312e77e83b790c4cc556156cc234a496d88))
* **services:** implementar fallback resiliente para Supabase no frontend (Refs [#3](https://github.com/ApenasGabs/querovagas/issues/3)) ([e67e9a2](https://github.com/ApenasGabs/querovagas/commit/e67e9a221c83d131df5d8084f6d8e51af6e88f4b))
* **vite:** adicionar proxy /api para dev e preview (Refs [#3](https://github.com/ApenasGabs/querovagas/issues/3)) ([512ccc5](https://github.com/ApenasGabs/querovagas/commit/512ccc56c93924c4ae52adef89780bf2391d507a))

## [1.4.0](https://github.com/ApenasGabs/querovagas/compare/v1.3.1...v1.4.0) (2026-10-14)

### ✨ Features

* **api:** implementar endpoints de empresas e sugestoes comunitarias com testes (Refs [#1](https://github.com/ApenasGabs/querovagas/issues/1)) ([7a37df6](https://github.com/ApenasGabs/querovagas/commit/7a37df6c32e9bb728a5b8cbf924283e08252e4bf))
* **services:** implementar CompanyService com busca, fallback e upvote (Refs [#1](https://github.com/ApenasGabs/querovagas/issues/1)) ([9c88478](https://github.com/ApenasGabs/querovagas/commit/9c884788bbf6c46a18276a8a6ae58a24e3a03e63))
* **types:** definir interfaces e catalogo inicial para radar de empresas (Refs [#1](https://github.com/ApenasGabs/querovagas/issues/1)) ([7929f4e](https://github.com/ApenasGabs/querovagas/commit/7929f4e44f19b1e3578249d7ed948c67fa98741a))
* **ui:** implementar componentes do Radar de Empresas, formulario e DevPedia (Refs [#1](https://github.com/ApenasGabs/querovagas/issues/1)) ([615d6a9](https://github.com/ApenasGabs/querovagas/commit/615d6a922ee05ac2c953737e718c206cf1ea7199))
* **utils:** criar utilitario de deteccao automatica de ATS com testes (Refs [#1](https://github.com/ApenasGabs/querovagas/issues/1)) ([a81c467](https://github.com/ApenasGabs/querovagas/commit/a81c4679a738e7304d94a57f1a1d8ea08df9866e))

## [1.3.1](https://github.com/ApenasGabs/querovagas/compare/v1.3.0...v1.3.1) (2026-10-14)

### 🐛 Bug Fixes

* 🐛 corrige function invocation failed na vercel e adicionar parser de jobs ([7184aa7](https://github.com/ApenasGabs/querovagas/commit/7184aa73a5464b8055f215ce48be2b1dda5cebb5))

## [1.3.0](https://github.com/ApenasGabs/querovagas/compare/v1.2.0...v1.3.0) (2026-10-14)

### ✨ Features

* ✨ implementa proxy reverso express ([c5511e1](https://github.com/ApenasGabs/querovagas/commit/c5511e165cc54a49d7c94ddc85f472233e4c8968))

## [1.2.0](https://github.com/ApenasGabs/querovagas/compare/v1.1.1...v1.2.0) (2026-09-16)

### ✨ Features

* **filters:** convert location filter to rich select grouped by regions, cities and states ([5dff6e0](https://github.com/ApenasGabs/querovagas/commit/5dff6e0ff4943bd098759a9be5b7cc09400c1b4d))

## [1.1.1](https://github.com/ApenasGabs/querovagas/compare/v1.1.0...v1.1.1) (2026-09-16)

### 🐛 Bug Fixes

* **supabase:** quote location.ilike patterns in PostgREST logic tree ([a48a164](https://github.com/ApenasGabs/querovagas/commit/a48a16416d6dfa42fb0301ba5efcc737577eec83))

## [1.1.0](https://github.com/ApenasGabs/querovagas/compare/v1.0.0...v1.1.0) (2026-09-16)

### ✨ Features

* **ui:** align brand left, remove tech only and hero title, add SP region location filter ([f90d0c9](https://github.com/ApenasGabs/querovagas/commit/f90d0c9ee5a2512921de5fbbff0b18d9528c97fa))

## 1.0.0 (2026-09-16)

### ✨ Features

* ✨ adiciona sistema de release automática com Semantic Release ([210df0d](https://github.com/ApenasGabs/querovagas/commit/210df0df678597c026300275c7f7159054566898))
* ✨ adicionar novos componentes e melhorias ([9acec7e](https://github.com/ApenasGabs/querovagas/commit/9acec7e2c4e0d959f341d83ac3a10308121d48a8))
* ✨ adicionar testes, lint do Tailwind e diretrizes de qualidade ([0ed0e81](https://github.com/ApenasGabs/querovagas/commit/0ed0e815796d72b0c0a9112fae77fa6a69e3bb17))
* ✨ melhora destaque do repositório GitHub e adiciona regra de validação de commits ([9925038](https://github.com/ApenasGabs/querovagas/commit/9925038e7d7d6286f19f7bd659f153ec5644fe53))
* 🐙 adicionar link para repositório GitHub na página inicial ([d8a2c4b](https://github.com/ApenasGabs/querovagas/commit/d8a2c4bedb92a7d79249546024181369d7179322))
* adiciona documentacao e instalador de extensoes do vs code ([0be58ad](https://github.com/ApenasGabs/querovagas/commit/0be58ad4bdc3ee3fd04fb47a93726dc10310a6d1))
* **portal:** implement public tech jobs portal with agnostic data layer and DaisyUI components ([01d30c5](https://github.com/ApenasGabs/querovagas/commit/01d30c5c547e543474b58fd4dfa66a751e3250f0))
* **supabase:** add schema.sql and optimize vitest timeout ([d00ab2e](https://github.com/ApenasGabs/querovagas/commit/d00ab2eb6360a13337581b724cf98f70ab903370))

### 🐛 Bug Fixes

* 🐛 adiciona --legacy-peer-deps ao workflow de release ([54147f8](https://github.com/ApenasGabs/querovagas/commit/54147f8771377b7066806763c04dd47188f2d068))
* **ci:** use yarn install in release workflow and remove private agents context ([4bf5b02](https://github.com/ApenasGabs/querovagas/commit/4bf5b02b8ece580337039f6bb5e8e310a9ec7773))
* converte script para ES modules ([e9ff6a7](https://github.com/ApenasGabs/querovagas/commit/e9ff6a7a596824d6e3dc51a7b9fb5a39c4af9445))
* **deploy:** configure node 22, yarnrc ignore-engines and clean App JSX ([b311e96](https://github.com/ApenasGabs/querovagas/commit/b311e96e836693490d122b1e4ecf5b3cad2a51ac))

### 📚 Documentation

* 📚 adiciona guia de arquiteturas para web scraping ([d520b71](https://github.com/ApenasGabs/querovagas/commit/d520b713a01945f01574bf1afbc5f624c84bcb40))
* 📚 adicionar priorização de componentes daisyUI nas diretrizes ([6ff3903](https://github.com/ApenasGabs/querovagas/commit/6ff39034c087b17cb03316b97dda913f6eabee03))
* 📚 atualiza padrão de commits para usar imperativo/presente ([6ac3d97](https://github.com/ApenasGabs/querovagas/commit/6ac3d9702f378626c96eb1b207ef3a1089e2b34a))
* 📚 atualiza workflow de git para trabalhar com branches ([829d6e0](https://github.com/ApenasGabs/querovagas/commit/829d6e0173a8136f1ca72757da922611b9952134))
* 📚 reforçar ordem de uso de componentes ([451c908](https://github.com/ApenasGabs/querovagas/commit/451c908580f1bf6aeef417d2c423577dd4618c64))
* **anytype:** add Anytype documentation note ID ([27a8791](https://github.com/ApenasGabs/querovagas/commit/27a879131bc212fdccffabb3c23785a3c07e486f))

### ♻️ Refactoring

* ♻️ padronizar uso de ReactElement em todos os componentes ([a1da4d5](https://github.com/ApenasGabs/querovagas/commit/a1da4d53f5c511f28c3c4a6367c7db6b9515a7ad))

### 🧪 Tests

* 🧪 cobrir componentes base e ajustar tipagem do Card ([fe24cae](https://github.com/ApenasGabs/querovagas/commit/fe24cae0bc9084758a9503d5ae4ce97056de4b66))

### 🔧 Chores

* 🔧 adiciona EditorConfig e configurações do VS Code ([095eeb6](https://github.com/ApenasGabs/querovagas/commit/095eeb6993467824e7e8f5c04aba2a00ac3ac57c))
* 🔧 reexecuta pipeline de release\n\n- Força nova execução com workflow atualizado\n- Evita re-run de job antigo ([0a33ac3](https://github.com/ApenasGabs/querovagas/commit/0a33ac3ea3c4308e0faf7bdfad94f04d09d1fc44))
* **release:** 0.1.1 [skip ci] ([0558851](https://github.com/ApenasGabs/querovagas/commit/0558851a9b4f915be7e4322f028d6000c9614b22))
* **release:** 0.2.0 [skip ci] ([8aa534c](https://github.com/ApenasGabs/querovagas/commit/8aa534c8ccfb7865d67513dc93fea1f084efb9a4))

## [0.2.0](https://github.com/ApenasGabs/ApenasTemplate/compare/v0.1.1...v0.2.0) (2026-01-25)

### ✨ Features

* adiciona documentacao e instalador de extensoes do vs code ([0be58ad](https://github.com/ApenasGabs/ApenasTemplate/commit/0be58ad4bdc3ee3fd04fb47a93726dc10310a6d1))

### 🐛 Bug Fixes

* converte script para ES modules ([e9ff6a7](https://github.com/ApenasGabs/ApenasTemplate/commit/e9ff6a7a596824d6e3dc51a7b9fb5a39c4af9445))

### 🔧 Chores

* 🔧 adiciona EditorConfig e configurações do VS Code ([095eeb6](https://github.com/ApenasGabs/ApenasTemplate/commit/095eeb6993467824e7e8f5c04aba2a00ac3ac57c))

## [0.1.1](https://github.com/ApenasGabs/ApenasTemplate/compare/v0.1.0...v0.1.1) (2026-01-24)

### 🐛 Bug Fixes

* 🐛 adiciona --legacy-peer-deps ao workflow de release ([54147f8](https://github.com/ApenasGabs/ApenasTemplate/commit/54147f8771377b7066806763c04dd47188f2d068))

### 🔧 Chores

* 🔧 reexecuta pipeline de release\n\n- Força nova execução com workflow atualizado\n- Evita re-run de job antigo ([0a33ac3](https://github.com/ApenasGabs/ApenasTemplate/commit/0a33ac3ea3c4308e0faf7bdfad94f04d09d1fc44))
