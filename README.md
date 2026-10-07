# Vida Boa

Finanças pessoais em um PWA instalável. Funciona offline e guarda os dados no próprio aparelho.

- Cadastro de **contas**, **tipos de conta** e **categorias** (31 categorias e 100+ regras já vêm prontas).
- **Importação de OFX** (SGML 1.x e XML 2.x, latin-1 ou UTF-8) com deduplicação, categorização automática e pareamento de transferências.
- **Lançamento manual** de despesas, receitas, transferências e estornos.
- **Recorrentes** (semanal, mensal, anual), lançados sozinhos quando o app é aberto.
- **Regras de categorização** e aprendizado pelo histórico de cada estabelecimento.
- **Início e relatórios**: patrimônio, evolução, entradas × saídas, gastos por categoria.
- Seis paletas com nomes de deuses gregos (Deméter, Afrodite, Poseidon, Dionísio, Héstia e Apolo), cada uma em modo claro e escuro.
- Modo privacidade (oculta valores), backup e restauração em JSON.

## Stack

| Camada    | Escolha                                                                                       |
| --------- | --------------------------------------------------------------------------------------------- |
| UI        | Svelte 5 (runes) + SvelteKit 3, SPA com rotas por hash                                        |
| Estilo    | Tailwind 4 + CSS com tokens (`src/routes/layout.css`)                                         |
| Dados     | IndexedDB via Dexie, atrás de interfaces de repositório                                       |
| Validação | Valibot                                                                                       |
| PWA       | Service worker nativo do SvelteKit (`src/service-worker.ts`) + `static/manifest.webmanifest`  |
| Testes    | Vitest (domínio, OFX, importação, banco com `fake-indexeddb`) e Playwright (fluxos completos) |

## Comandos

```bash
pnpm install
pnpm dev               # http://localhost:5173
pnpm check             # tipos
pnpm test:unit         # Vitest (modo watch)
pnpm test:e2e          # Playwright: build + preview em /vida-boa/
pnpm build             # gera build/
```

Para ver o app cheio sem importar nada: **Ajustes › Carregar dados de demonstração** (aparece enquanto não há contas).

## Publicação no GitHub Pages

O workflow `.github/workflows/deploy.yml` roda a cada push na `main`. Ele instala com pnpm, verifica os tipos, roda os testes e faz o build com `BASE_PATH=/<nome-do-repo>` e as variáveis do Supabase.

Antes do primeiro deploy, configure uma vez no GitHub: **Settings › Pages › Build and deployment › Source: GitHub Actions**.

O app fica em `https://<usuario>.github.io/vida-boa/`. As rotas usam hash (`/#/extrato`), então recarregar qualquer tela funciona sem 404, mesmo no Pages. Com domínio próprio na raiz, basta remover o `BASE_PATH` do workflow.

## Estrutura

```
src/lib/
  domain/        regras puras: tipos, dinheiro em centavos, datas, relatórios, regras, recorrência, seed
  ofx/           parser OFX
  import/        plano de importação: deduplicação, categorização e transferências
  data/
    repositories.ts   contrato da camada de dados (o que as telas usam)
    dexie/            banco local (IndexedDB)
    sync/             replicação com o Supabase (motor, mapeamento, cliente)
    changes.ts        aviso de "dados mudaram" (reatividade independente do banco)
    live.svelte.ts    consulta reativa para componentes
  stores/        estado da UI (dados em memória, toasts, tema, instalação)
  ui/            design system: Sheet, Amount, editor de lançamento, gráficos SVG...
src/routes/      telas (Início, Extrato, Relatórios, Ajustes, Importar, cadastros)
e2e/             testes Playwright e OFX de exemplo
```

## Como a importação decide

1. **Mesmo FITID e mesmo valor** de um lançamento já gravado: duplicata, fica de fora. FITID igual com valor diferente é tratado como lançamento novo, porque alguns bancos reaproveitam o identificador.
2. **Mesma data, valor e descrição**, quando um dos lados não tem FITID: duplicata, contando ocorrências (dois cafés iguais no mesmo dia continuam sendo dois).
3. **Mesmo valor em até 3 dias** contra um lançamento digitado à mão: _talvez repetido_. Vem desmarcado para você decidir.
4. Lançamentos que você excluiu **não voltam** ao reimportar.
5. Categoria: primeiro as regras, depois o histórico do estabelecimento (`UBER *TRIP 12/10 X9` e `UBER *TRIP 15/10 K2` contam como o mesmo).
6. Pagamento de fatura vira **transferência** entre conta e cartão, pareada quando a outra perna já existe, para o gasto não contar em dobro.
7. No fim, o saldo calculado é comparado com o `LEDGERBAL` do banco, e o app oferece ajustar o saldo inicial.

## Nuvem (Supabase)

O app é **local-first**: lê e grava sempre no IndexedDB, então abre na hora e funciona sem internet. Com uma conta (e-mail e senha), o banco local é replicado no Supabase e fica igual em todos os aparelhos.

**Como sincroniza** (`src/lib/data/sync/engine.ts`):

- _Subir_: o que mudou no aparelho desde a última subida (`updatedAt`).
- _Baixar_: o que chegou na nuvem desde o último cursor (`server_updated_at`, relógio do servidor).
- _Conflito_: vence a edição mais recente. O gatilho `vb_before_write` aplica a mesma regra no Postgres.
- _Exclusão_: é lógica (`deleted_at`), então sincroniza como qualquer alteração.
- _Quando_: ao entrar, ao abrir o app, ao voltar a ficar online, 1,5 s depois de cada alteração, a cada 5 min e quando o Realtime avisa que outro aparelho mudou algo.
- _Primeira entrada_: os dados do aparelho sobem para a conta. Um aparelho sem dados adota os da conta (sem duplicar as categorias iniciais). Um aparelho com dados de **outra** conta só entra depois de confirmar que eles serão apagados.

**Configuração (uma vez):**

1. No Supabase, abra o **SQL Editor** e rode `supabase/migrations/20261007000000_vida_boa.sql`. Ele cria as tabelas, o RLS (cada usuário só vê as próprias linhas), o gatilho de conflito e o Realtime. Pode ser rodado de novo sem problema.
2. Em **Authentication › URL Configuration**, defina o _Site URL_ como `https://<usuario>.github.io/vida-boa/` (é para onde vai o link de confirmação de e-mail).
3. Localmente, copie `.env.example` para `.env` e preencha URL e chave _publishable_.
4. No GitHub, em **Settings › Secrets and variables › Actions › Variables**, crie `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

A chave _publishable_ é feita para ficar no navegador; quem protege os dados é o RLS. Sem essas variáveis, o app funciona normalmente, só no aparelho.

## Marca

O ícone é o `Gem` do [Lucide](https://lucide.dev) (licença ISC), em latão sobre verde-inglês. O nome "Vida Boa" é escrito na própria Fraunces itálica do app. Os PNGs do PWA ficam em `static/icons/` e o favicon em `static/favicon.svg`.

Fontes: Fraunces e Inter (SIL Open Font License), só o subconjunto latino, servidas localmente.
