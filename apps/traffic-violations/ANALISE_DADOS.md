# Análise dos Dados de Traffic Violations

## Estrutura dos Dados

Os dados estão organizados em 3 arquivos principais que se conectam através de IDs:

### 1. `dict_infracoes_v2.json`
- **Função**: Dicionário de tipos de infrações
- **Estrutura**: `"descrição_completa": id_numérico`
- **Exemplo**: `"5894|Art. 201|Deixar de guardar a distância lateral...": 390`

### 2. `dict_locais_v2.json`  
- **Função**: Dicionário de locais onde ocorrem infrações
- **Estrutura**: `"descrição_do_local": id_numérico`
- **Exemplo**: `"AVENIDA GOVERNADOR AGAMENON MAGALHAES, SOB O SEMAFORO N. 069": 2746`

### 3. `infracoes_reduzido.tsv`
- **Função**: Dados das multas aplicadas
- **Estrutura**: TSV com colunas:
  - `datainfracao`: Data da infração
  - `horainfracao`: Hora da infração  
  - `agente_id`: ID do agente que aplicou
  - `infracao_id`: ID da infração (referencia `dict_infracoes_v2.json`)
  - `local_id`: ID do local (referencia `dict_locais_v2.json`)

## Como os Dados se Conectam

```
infracoes_reduzido.tsv
├── infracao_id → dict_infracoes_v2.json (busca descrição da infração)
└── local_id → dict_locais_v2.json (busca descrição do local)
```

## Exemplo de Análise: Art. 201

### Passos da Análise

1. **Identificar IDs do Art. 201**:
   ```javascript
   // Buscar no dict_infracoes_v2.json por "Art. 201"
   // Resultado: IDs [390, 391, 392, 393]
   ```

2. **Filtrar dados TSV**:
   ```javascript
   // No infracoes_reduzido.tsv, filtrar linhas onde infracao_id está em [390, 391, 392, 393]
   // Resultado: 300 multas encontradas
   ```

3. **Agrupar por local**:
   ```javascript
   // Contar ocorrências por local_id
   // Buscar descrição no dict_locais_v2.json
   ```

### Resultados Obtidos

**Total**: 300 multas do Art. 201 (distância de bicicleta)

**Top 3 locais**:
1. Av. Agamenon Magalhães, semáforo 069 → Boa Viagem: **79 multas**
2. Av. Agamenon Magalhães, semáforo 075 → Boa Viagem: **71 multas**  
3. Av. Agamenon Magalhães, semáforo 174 → Boa Viagem: **45 multas**

## Script de Análise

O script `analise-art201.js` demonstra como:
- Carregar os 3 arquivos de dados
- Fazer join entre as tabelas usando os IDs
- Filtrar por tipo específico de infração
- Agrupar e contar por local
- Apresentar resultados ordenados

## Conclusão

✅ **Os dados estão totalmente interligados** e permitem análises complexas cruzando infrações, locais e períodos temporais.