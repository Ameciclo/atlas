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

## Resultado Esperado
- ✅ Branch resetada para o estado da main
- ✅ Todos os arquivos não rastreados removidos
- ✅ Working tree clean
- ✅ Pronta para novo desenvolvimento

## Observações
- O comando `git reset --hard` é **destrutivo** - não há como desfazer
- Sempre confirme que não há trabalho importante não commitado
- A mensagem sobre divergência com origin é normal após o reset