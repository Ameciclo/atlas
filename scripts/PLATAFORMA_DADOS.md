# Plataforma de Dados — Ameciclo

## Arquitetura

A plataforma de dados da Ameciclo é composta por **11 microsserviços Atlas** que alimentam **16 páginas de dados**, mais um CMS Strapi para metadados e 3 APIs externas.

Cada microsserviço roda independentemente em sua própria porta (`localhost:3000–3050`) e expõe um endpoint `/health` para monitoramento.

---

## Páginas e seus endpoints

### 1. CicloDados (`/dados/ciclodados`)
**Painel interativo com mapa integrado** — todas as camadas de dados geoespaciais sobrepostas em um único mapa.

| Camada | Microsserviço | Endpoint |
|---|---|---|
| Infraestrutura + PDC | cycling-infra (3020) | `/v1/ways/all-ways` |
| Contagens Ameciclo | cyclist-counts (3002) | `/v1/locations` |
| Contagens Prefeitura | Arquivo estático | `/dbs/PCR_CONTAGENS.json` |
| Bicicletários | bicycle-racks (3005) | `/v1/bicycle-racks/geojson` |
| Bike PE | shared-bike (3015) | `/v1/stations` |
| Sinistros | emergency-calls (3010) | `/v2/unsafe-streets/...` |
| Infrações | traffic-tickets (3013) | `/v1/streets/geojson` |
| Perfil de Ciclistas | cyclist-profile (3000) | `/v1/cyclist-profiles/survey-locations` |
| PointInfoPopup | ciclodados (3050) | `/v1/nearby` |

**Possibilidades:**
- Visualizar todas as camadas simultaneamente ou isoladas
- Filtrar infraestrutura por tipo (Ciclovia, Ciclofaixa, Ciclorrota, Calçada compartilhada, Ciclofaixa Compartilhada)
- Filtrar PDC por status (Realizado designado, Não designado, Fora PDC, Não realizado)
- Colorir perfil por métrica: Sinistros (%), Motivação, Idades, Renda, Escolaridade, Raça/Cor
- Filtrar infrações por ano (slider 2007–2025) e severidade (Alta, Média, Baixa)
- Filtrar perfil por ano de edição (2018, 2021, 2024)
- Clicar em qualquer ponto abre popup com dados detalhados
- Buscar ruas e zoom automático

---

### 2. Contagens (`/dados/contagens`)
**Estatísticas e mapa das contagens de ciclistas** realizadas pela Ameciclo e Prefeitura do Recife.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Dados da página | CMS Strapi | `/api/plataformas-de-dados` |
| Contagens Ameciclo | cyclist-counts (3002) | `/v1/locations` |
| Contagens PCR | Arquivo estático | `/dbs/PCR_CONTAGENS.json` |

**Possibilidades:**
- Estatísticas gerais agregadas (total de ciclistas, mulheres, crianças, etc.)
- Cartões informativos por ponto de contagem
- Mapa com pontos de contagem clusterizados
- Modal com detalhes do ponto (características por edição)
- Tabela completa de contagens com filtros
- Comparação entre edições de um mesmo ponto (`/dados/contagens/{slug}`)
- Comparação entre dois pontos diferentes (`/dados/contagens/compare/{slugs}`)

---

### 3. Perfil do Ciclista (`/dados/perfil`)
**Análise sociodemográfica** dos ciclistas entrevistados pela Ameciclo.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Dados da página | CMS Strapi | `/api/plataformas-de-dados` |
| Perfil ciclistas | cyclist-profile (3000) | `/v1/cyclist-profiles/nearby` |

**Possibilidades:**
- Distribuição por gênero, raça, idade, escolaridade, renda
- Motivações para usar bicicleta
- Problemas enfrentados (segurança, infraestrutura)
- Frequência de uso (dias/semana, tempo de viagem)
- Acidentes sofridos

---

### 4. Execução Cicloviária (`/dados/execucao-cicloviaria`)
**Acompanhamento do Plano Diretor Cicloviário (PDC)** da RMR.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Dados da página | CMS Strapi | `/api/plataformas-de-dados` |
| Status PDC | cycling-infra (3020) | `/v1/ways/summary` |
| GeoJSON PDC | cycling-infra (3020) | `/v1/ways/all-ways` |

**Possibilidades:**
- Visualização do status de implementação do PDC
- Estatísticas por cidade e por status (realizado, não realizado)
- Documentos de referência (PDC Vol 1 e 2, podcast, Wiki OSM)

---

### 5. Infrações de Trânsito (`/dados/infracoes`)
**Observatório de infrações de trânsito** registradas no Recife.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Dados da página | CMS Strapi | `/api/plataformas-de-dados` |
| Visão geral | traffic-tickets (3013) | `/v1/overview` |
| Códigos | traffic-tickets (3013) | `/v1/violation-codes` |
| GeoJSON | traffic-tickets (3013) | `/v1/streets/geojson` |
| Lei | traffic-tickets (3013) | `/v1/law-stats` |
| Ruas | traffic-tickets (3013) | `/v1/street-stats` |

**Possibilidades:**
- Visão geral: total de infrações, período, tipos, leis, ruas, bairros
- Distribuição temporal (por ano, mês, dia da semana, hora)
- Quebra por categoria de infração e agente fiscalizador
- Mapa de calor das ruas com mais infrações
- Foco em infrações que afetam vulneráveis (pedestres e ciclistas)

---

### 6. Chamados de Emergência (`/dados/chamados-emergencia`)
**Análise dos chamados do SAMU** relacionados a sinistros de trânsito.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Dados da página | CMS Strapi | `/api/plataformas-de-dados` |
| Resumo | emergency-calls (3010) | `/v1/summary` |
| Cidades | emergency-calls (3010) | `/v1/cities` |
| Chamados | emergency-calls (3010) | `/v1/calls` |
| Desfechos | emergency-calls (3010) | `/v1/calls/outcomes` |
| Perfis | emergency-calls (3010) | `/v1/calls/profiles` |

**Possibilidades:**
- Mapa interativo de sinistros por cidade
- Filtros por ano, gravidade, tipo de vítima
- Estatísticas gerais: total de chamados, perfil das vítimas, desfechos
- Documentos de apoio

---

### 7. Vias Inseguras (`/dados/vias-inseguras`)
**Ranking das vias mais perigosas** para ciclistas e pedestres, baseado nos chamados do SAMU.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Dados da página | CMS Strapi | `/api/plataformas-de-dados` |
| Sumário | emergency-calls (3010) | `/v2/unsafe-streets/cities/RECIFE/summary` |
| Concentração | emergency-calls (3010) | `/v2/unsafe-streets/cities/RECIFE/concentration` |
| GeoJSON top 150 | emergency-calls (3010) | `/v2/unsafe-streets/cities/RECIFE/geojson` |
| Histórico rua | emergency-calls (3010) | `/v2/streets/history` |
| Busca | emergency-calls (3010) | `/v1/streets/search` |

**Possibilidades:**
- Dashboard com ranking das 150 vias mais perigosas
- Gráfico de evolução temporal por via
- Detalhamento por gênero e faixa etária das vítimas
- Página individual por via (`/dados/vias-inseguras/{slug}`)

---

### 8. Sinistros Fatais (`/dados/sinistros-fatais`)
**Dados do DATASUS** sobre mortes no trânsito na RMR.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Dados da página | CMS Strapi | `/api/plataformas-de-dados` |
| Sumário | traffic-deaths (3003) | `/v1/summary` |
| Cidades/ano | traffic-deaths (3003) | `/v1/cities-by-year` |
| Filtros | traffic-deaths (3003) | `/v1/filtros` |
| Matriz | traffic-deaths (3003) | `/v1/matrix` |
| Causas secundárias | traffic-deaths (3003) | `/v1/causas-secundarias` |

**Possibilidades:**
- Mapa de mortalidade por cidade e ano
- Filtros por local do óbito (via pública, hospital, etc.)
- Filtros por tipo de vítima (pedestre, ciclista, motociclista, ocupante)
- Matriz de cruzamento de variáveis
- Análise de causas secundárias

---

### 9. Orçamento PE (`/dados/orcamento-pernambuco`)
**Orçamento do estado de Pernambuco** para mobilidade ativa.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Orçamento estadual | state-budget (3017) | `/v1/budget/state` |

---

### 10. Orçamento Recife (`/dados/orcamento-recife`)
**Orçamento do município do Recife** para mobilidade ativa.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Orçamento municipal | recife-budget (3018) | `/v1/budget/recife` |

---

### 11. IDECiclo (`/dados/ideciclo`)
**Índice de Desenvolvimento da Estrutura Cicloviária** — avaliação colaborativa da infraestrutura.

| Fonte | API externa | Endpoint |
|---|---|---|
| Avaliações | api.ideciclo.ameciclo.org | `/reviews` |
| Estruturas | api.ideciclo.ameciclo.org | `/structures` |
| Formulários | api.ideciclo.ameciclo.org | `/forms` |

---

### 12. Documentos (`/dados/documentos`)
**Repositório de documentos** e publicações da Ameciclo.

| Fonte | Microsserviço | Endpoint |
|---|---|---|
| Metadados | CMS Strapi | `/api/plataformas-de-dados` |

---

## Microsserviços Atlas

| # | Serviço | Porta | Função |
|---|---|---|---|
| 1 | cyclist-profile | 3000 | Perfil de ciclistas |
| 2 | cyclist-counts | 3002 | Contagens de ciclistas |
| 3 | traffic-deaths | 3003 | DATASUS — sinistros fatais |
| 4 | bicycle-racks | 3005 | Bicicletários |
| 5 | emergency-calls | 3010 | SAMU — chamados de emergência |
| 6 | traffic-tickets | 3013 | Infrações de trânsito |
| 7 | shared-bike | 3015 | Estações Bike PE |
| 8 | pcr-streets | 3016 | Vias da Prefeitura do Recife |
| 9 | state-budget | 3017 | Orçamento estadual |
| 10 | recife-budget | 3018 | Orçamento municipal |
| 11 | traffic-calls | 3019 | Chamados de trânsito |
| 12 | cycling-infra | 3020 | Infraestrutura cicloviária + PDC |
| 13 | ciclodados | 3050 | API agregada (nearby) |

## APIs Externas

| API | Uso |
|---|---|
| Strapi CMS (`do.strapi.ameciclo.org`) | Metadados das páginas, projetos |
| OpenRouteService | Rotas de ciclismo |
| IDECiclo | Avaliações colaborativas |
| LOA RMR | Lei Orçamentária Anual |

## Monitoramento

Cada microsserviço expõe `GET /health` retornando:
```json
{"status":"ok","timestamp":"...","service":"nome","database":"connected"}
```

O painel CicloDados exibe o status de 7 serviços em tempo real no canto inferior direito do mapa.
