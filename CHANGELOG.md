# 📝 Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
