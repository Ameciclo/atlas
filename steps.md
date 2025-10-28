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

## Resultado Esperado
- ✅ Branch resetada para o estado da main
- ✅ Todos os arquivos não rastreados removidos
- ✅ Working tree clean
- ✅ Pronta para novo desenvolvimento

## Observações
- O comando `git reset --hard` é **destrutivo** - não há como desfazer
- Sempre confirme que não há trabalho importante não commitado
- A mensagem sobre divergência com origin é normal após o reset