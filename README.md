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
npm install
npm run dev            # http://localhost:5173
npm run check          # tipos
npm run test:unit      # Vitest (modo watch)
npm run test:e2e       # Playwright: build + preview em /vida-boa/
npm run build          # gera build/
```

Para ver o app cheio sem importar nada: **Ajustes › Carregar dados de demonstração** (aparece enquanto não há contas).

## Publicação no GitHub Pages

O workflow `.github/workflows/deploy.yml` roda a cada push na `main`. Ele verifica os tipos, roda os testes e faz o build com `BASE_PATH=/<nome-do-repo>`.

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
    dexie/            implementação atual (IndexedDB)
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

## Migração para o Supabase

O modelo já nasceu pronto para sincronizar:

- **UUIDs gerados no cliente**: o mesmo `id` vale localmente e no Postgres.
- **Dinheiro em centavos inteiros** (`bigint` no banco), datas como `date`, timestamps `timestamptz`.
- **Exclusão lógica** (`deletedAt`), para a sincronização saber o que foi apagado.
- `createdAt`/`updatedAt` em tudo, para resolver conflitos por "última escrita vence".

Passos previstos:

1. Criar as tabelas espelhando `src/lib/domain/types.ts`, com `user_id` e políticas RLS `user_id = auth.uid()`.
2. Implementar `createSupabaseStore()` cumprindo o contrato `DataStore` de `src/lib/data/repositories.ts`, e trocar a linha em `src/lib/data/index.ts`.
3. Ligar o Supabase Realtime ao `notifyChange()` de `src/lib/data/changes.ts`. As telas já se atualizam por ele.
4. Migrar os dados locais usando o próprio backup: `exportBackup()` → inserir no Supabase.

Se quiser manter o funcionamento offline depois da migração, o caminho é deixar o Dexie como cache local e sincronizar por `updatedAt`. O contrato não muda.

## Marca

O ícone é o `Gem` do [Lucide](https://lucide.dev) (licença ISC), em latão sobre verde-inglês. O nome "Vida Boa" é escrito na própria Fraunces itálica do app. Os PNGs do PWA ficam em `static/icons/` e o favicon em `static/favicon.svg`.

Fontes: Fraunces e Inter (SIL Open Font License), só o subconjunto latino, servidas localmente.
