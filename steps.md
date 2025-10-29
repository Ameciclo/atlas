# Branch Reset Guide

## Propósito
Resetar uma branch de desenvolvimento para o estado exato da branch `main`, removendo todas as modificações, commits e arquivos não rastreados.

## Quando Usar
- Começar uma nova funcionalidade do zero
- Limpar uma branch que ficou bagunçada
- Voltar ao ponto de partida após experimentos
- Sincronizar com o estado atual da main

## Passos Executados

### 1. Verificar Status Atual
```bash
git status
```
**Propósito**: Ver quais arquivos foram modificados e o estado da branch

### 2. Listar Branches
```bash
git branch -a
```
**Propósito**: Confirmar qual branch está ativa e ver branches disponíveis

### 3. Reset Hard para Main
```bash
git reset --hard main
```
**Propósito**: Resetar completamente a branch atual para o estado da main local, descartando todos os commits e modificações

### 4. Limpar Arquivos Não Rastreados
```bash
git clean -fd
```
**Propósito**: Remover todos os arquivos e diretórios não rastreados pelo Git
- `-f`: Force (forçar)
- `-d`: Incluir diretórios

### 5. Verificação Final
```bash
git status
```
**Propósito**: Confirmar que a branch está limpa e no estado desejado

### 6. Instalar Dependências
```bash
pnpm install
```
**Propósito**: Instalar todas as dependências do projeto após o reset

### 7. Criar Novo Serviço
```bash
pnpm create-atlas-app traffic-crashes
```
**Propósito**: Usar a ferramenta de scaffolding para criar um novo serviço com toda a estrutura necessária (API, banco de dados, testes, Docker, CI/CD)

### 8. Configurar Scripts do Database
**Local**: `/packages/database/package.json`

**Adicionar scripts**:
```json
"db:drop": "drizzle-kit drop",
"db:studio": "drizzle-kit studio",
"db:custom": "drizzle-kit generate --custom"
```

**Comandos disponíveis**:
```bash
pnpm --filter @atlas/database db:drop    # Dropar migrações
pnpm --filter @atlas/database db:studio  # Abrir Drizzle Studio
pnpm --filter @atlas/database db:custom  # Gerar SQL customizado
```

### 9. Criar Schema do Banco de Dados
**Local**: `/packages/database/src/schemas/{service-name}/schema.ts`

**Estrutura criada**:
- Tabela principal com campos específicos do domínio
- Campos de timestamp, contadores numéricos
- Campo coordinates (text temporário para depois converter para PostGIS)
- Campo complementary_data (JSONB) para dados extras
- Campos created_at e updated_at padrão
- Schemas Zod para validação
- Tipos TypeScript gerados automaticamente

**⚠️ IMPORTANTE**: Remover a tabela `examples` do schema gerado pelo scaffolding antes de criar o schema personalizado, senão a migração será gerada incorretamente.

**Próximos passos**:
- Gerar migração com `drizzle-kit generate`
- Usar `drizzle-kit custom` para converter coordinates para `geometry(Point, 4326)`

### 10. Migração PostGIS (Se Necessário)
**Quando usar**: Após criar schema com campo coordinates como text placeholder

**Passos**:
1. Gerar migração inicial:
   ```bash
   pnpm --filter @atlas/database db:generate
   ```

2. Criar migração customizada:
   ```bash
   pnpm --filter @atlas/database db:custom
   ```

3. Editar o arquivo SQL gerado com:
   ```sql
   -- Custom SQL migration file, put your code below! --
   
   -- Enable PostGIS extension if not already enabled
   CREATE EXTENSION IF NOT EXISTS postgis;
   
   -- Convert coordinates column from text to PostGIS geometry(Point, 4326)
   ALTER TABLE "geolocated_crashes" 
   ALTER COLUMN "coordinates" TYPE geometry(Point, 4326) 
   USING ST_GeomFromText('POINT(' || coordinates || ')', 4326);
   ```

4. Aplicar migrações:
   ```bash
   pnpm --filter @atlas/database db:migrate
   ```

**Propósito**: 
- Habilitar PostGIS se ainda não estiver habilitado
- Converter coluna coordinates de text para geometry(Point, 4326)
- Usar ST_GeomFromText para converter texto em geometria válida

### 11. Criar Arquivo de Seed
**Local**: `/packages/database/src/seed-{service-name}.ts`

**Estrutura do seed**:
- Seguir padrão do `seed-cyclist-counts.ts`
- Imports: `dotenv/config`, `readFile` (async), `createConnectedDatabase`
- Estrutura: `try/catch/finally` com `closeDatabase`
- Export: função exportada com `DatabaseConfig`
- Interfaces TypeScript para estrutura dos dados (GeoJSON, etc.)

**Processamento dos dados**:
- Ler arquivo de dados (GeoJSON, CSV, etc.)
- Transformar dados para formato do schema
- Construir timestamp a partir de campos separados
- Extrair coordenadas para formato PostGIS
- Separar dados complementares em JSONB
- Inserir em lotes (1000 registros por vez)

**Adicionar comando no package.json**:
```json
"db:seed-{service}": "tsx src/seed-{service-name}.ts"
```

**Correções comuns**:
- Path correto: `../../../apps/{service-name}/src/db/arquivo-dados`
- Verificar níveis de diretório (três `../` do packages/database)

### 12. Executar Seed
```bash
pnpm --filter @atlas/database db:seed-{service}
```
**Propósito**: Alimentar a base de dados com os dados reais do arquivo fonte

### 13. Criar Queries de Validação
**Local**: `/apps/{service-name}/src/db/random-queries.sql`

**Propósito**: Testar e validar os dados inseridos na base

**Tipos de queries**:
- Contagem total de registros
- Distribuição por período (anos, meses)
- Estatísticas de feridos/mortos
- Validação de coordenadas PostGIS
- Análise de dados complementares (JSONB)
- Verificação de valores nulos
- Queries geoespaciais (se aplicável)

**Como executar**:
- Via Drizzle Studio: `pnpm --filter @atlas/database db:studio`
- Via conexão direta PostgreSQL
- Copiar/colar queries no cliente SQL

### 14. Implementar API REST
**Local**: `/apps/{service-name}/src/routes/`

**Estrutura criada**:
- Diretório `{entity}/` (ex: `crashes/`)
- `{entity}.routes.ts` - definições OpenAPI das rotas
- `{entity}.handlers.ts` - lógica de negócio dos endpoints
- `{entity}.index.ts` - router que conecta rotas aos handlers

**Rotas implementadas**:
- `GET /{entity}` - listar todos com filtros opcionais
- `GET /{entity}/{id}` - buscar por ID específico
- Filtros por query params (ex: `start_date`, `end_date`)

**Correções necessárias**:
- Import correto: `createRouter` de `../../lib/create-app.js`
- Conversão de tipos: `Number(id)` para parâmetros numéricos
- Configuração SSL: adicionar `?sslmode=disable` na `DATABASE_URL`

### 15. Remover API de Exemplo
**Arquivos removidos**:
- `/apps/{service-name}/src/routes/example/` (diretório completo)

**Arquivo atualizado**:
- `/apps/{service-name}/src/app.ts` - trocar import de `exampleRoutes` por `{entity}Routes`

### 16. Gerar Documentação OpenAPI
```bash
pnpm generate-openapi
```
**Propósito**: Gerar especificação OpenAPI automática e atualizar documentação

**Arquivos gerados**:
- `/apps/{service-name}/openapi.json`
- `/specs/{service-name}/v1.json`
- `/apps/docs/public/openapi/{service-name}.json`

### 17. Testar Endpoints
**Configuração necessária**:
- Copiar `.env.example` para `.env`
- Ajustar `DATABASE_URL` com `?sslmode=disable`
- Reiniciar servidor após mudanças no `.env`

**Testes com curl**:
```bash
curl http://localhost:3007/health
curl http://localhost:3007/v1/{entity}
curl "http://localhost:3007/v1/{entity}?start_date=2023-01-01"
curl http://localhost:3007/v1/{entity}/1
```

### 18. Implementar Testes Automatizados
**Local**: `/apps/{service-name}/test/`

**Tipos de testes criados**:
1. `{service-name}.spec.ts` - testes de integração completos
2. `{entity}.handlers.spec.ts` - testes unitários dos handlers
3. `{entity}.routes.spec.ts` - testes das rotas OpenAPI
4. `schema.spec.ts` - validação dos schemas Zod

**Configuração necessária**:
- `vitest.config.ts` - configuração do Vitest
- `test/setup.ts` - setup global dos testes

**Problemas comuns e correções**:
- **Mock mal configurado**: Mock inline correto em vez de mock antes da definição
- **Tipos inconsistentes**: `Date()` em vez de `toISOString()` para consistência com schema
- **Expectativas rígidas**: Usar `[200, 404]` em vez de apenas `200` para flexibilidade
- **Setup global**: Configurar corretamente para evitar dependências externas

**Executar testes**:
```bash
pnpm --filter @atlas/{service-name} test
```

**Resultado esperado**:
- ✅ Todos os testes passando
- ✅ Cobertura completa da API
- ✅ Sem dependências externas
- ✅ Execução rápida

### 19. Verificar Qualidade do Código
**Comandos obrigatórios antes do commit**:

```bash
# Verificar linting
pnpm lint

# Verificar tipos TypeScript
pnpm check-types

# Formatar código (com correções automáticas)
pnpm format --write

# Verificar formatação final
pnpm format
```

**Propósito**: Garantir que o código segue os padrões do projeto antes do commit

### 20. Commit e Push
```bash
# Adicionar arquivos
git add .

# Fazer commit
git commit -m "feat: add {service-name} API with PostGIS support"

# Push para repositório remoto
git push origin {branch-name}
```

**Propósito**: Salvar o trabalho e disponibilizar para revisão/merge

## Resultado Esperado
- ✅ Branch resetada para o estado da main
- ✅ Todos os arquivos não rastreados removidos
- ✅ Working tree clean
- ✅ Pronta para novo desenvolvimento

## Observações
- O comando `git reset --hard` é **destrutivo** - não há como desfazer
- Sempre confirme que não há trabalho importante não commitado
- A mensagem sobre divergência com origin é normal após o reset