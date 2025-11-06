# APIs Existentes - Projeto Atlas

Este documento mapeia todas as APIs existentes no projeto Atlas para facilitar o desenvolvimento de novos endpoints.

## ✅ **Status das APIs**

**Legenda:**
- ✅ **Implementado** - Endpoint funcionando
- 🚧 **Planejado** - Endpoint a ser implementado
- 📝 **Especificado** - Endpoint documentado, aguardando implementação

## 🚴‍♂️ **1. Bicycle Racks API** (`/bicycle-racks`)

**Serviço:** `apps/bicycle-racks`  
**Descrição:** Gerenciamento de bicicletários e paraciclos

### Endpoints:
- ✅ `GET /bicycle-racks` - Lista bicicletários com filtros
  - Filtros: `covered`, `access`, `capacity_min/max`, `operator`, `city`
- ✅ `GET /bicycle-racks/{id}` - Detalhes de um bicicletário
- ✅ `GET /bicycle-racks/nearby` - Bicicletários próximos
  - Parâmetros: `lat`, `lng`, `radius`, `city`
- ✅ `GET /bicycle-racks/stats` - Estatísticas dos bicicletários
- ✅ `GET /bicycle-racks/geojson` - Dados em formato GeoJSON

---

## 👤 **2. Cyclist Profile API** (`/cyclist-profiles`)

**Serviço:** `apps/cyclist-profile`  
**Descrição:** Perfis de ciclistas

### Endpoints:
- ✅ `GET /cyclist-profiles` - Lista todos os perfis
- ✅ `GET /cyclist-profiles/{id}` - Detalhes de um perfil específico

---

## 📊 **3. Cyclist Counts API** (`/events`, `/locations`, `/sessions`)

**Serviço:** `apps/cyclist-counts`  
**Descrição:** Contagem de ciclistas em eventos

### Endpoints Events:
- ✅ `GET /v1/events` - Lista eventos de contagem
  - Filtros: `location_id`, `city`, `start_date`, `end_date`
- ✅ `GET /v1/events/{id}` - Detalhes de um evento
- ✅ `GET /v1/locations/{id}/events` - Eventos por localização

### Endpoints Locations:
- ✅ `GET /v1/locations` - Lista localizações de contagem
- ✅ `GET /v1/locations/{id}` - Detalhes de uma localização

### Endpoints Sessions:
- ✅ `GET /v1/sessions/{id}` - Detalhes de uma sessão
- ✅ `GET /v1/events/{id}/sessions` - Sessões por evento

---

## 🚨 **4. Emergency Calls API** (`/calls`, `/analytics`)

**Serviço:** `apps/emergency-calls`  
**Descrição:** Chamadas de emergência relacionadas ao trânsito

### Endpoints Calls:
- ✅ `GET /calls` - Lista chamadas de emergência
  - Filtros: `municipality`, `subtype`, `start_date`, `end_date`, `limit`, `offset`
- ✅ `GET /calls/{id}` - Detalhes de uma chamada

### Endpoints Analytics:
- ✅ `GET /analytics` - Análises das chamadas de emergência
- ✅ `GET /calls/summary` - **NOVO** - Resumo geral das chamadas
  - **Resposta:**
    ```json
    {
      "total_calls": 15420,
      "data_period": { "start": "2018-01-01", "end": "2023-12-31" },
      "calls_per_year": {
        "2018": 2850, "2019": 3120, "2020": 2980,
        "2021": 3200, "2022": 3270
      },
      "municipalities_count": 184,
      "top_city": {
        "name": "RECIFE",
        "total_calls": 4520
      }
    }
    ```
- ✅ `GET /calls/cities` - **NOVO** - Ranking completo de cidades
  - **Resposta:**
    ```json
    {
      "cities": [
        {
          "ranking": 1,
          "municipality": "RECIFE",
          "total_calls": 4520,
          "percentage": 29.3
        }
      ]
    }
    ```
- ✅ `GET /calls/cities/{city}/stats` - **NOVO** - Estatísticas por cidade
  - **Resposta:**
    ```json
    {
      "city": "RECIFE",
      "ranking": 1,
      "yearly_history": {
        "2018": 850, "2019": 920, "2020": 880,
        "2021": 950, "2022": 920
      }
    }
    ```
- ✅ `GET /calls/outcomes` - **NOVO** - Desfechos das chamadas
  - **Filtros:** `city` (obrigatório)
  - **Resposta:**
    ```json
    {
      "city": "RECIFE",
      "outcomes_by_year": {
        "2022": {
          "Atendimento Concluído": 650,
          "Removido por Particulares": 180,
          "Removido pelos Bombeiros": 70,
          "Óbito no Local": 20
        }
      }
    }
    ```
- ✅ `GET /calls/profiles` - **NOVO** - Perfis das chamadas
  - **Filtros:** `city` (obrigatório), `start_year`, `end_year`
  - **Resposta:**
    ```json
    {
      "city": "RECIFE",
      "period": { "start_year": 2020, "end_year": 2022 },
      "by_gender": {
        "masculino": 1850, "feminino": 1070
      },
      "by_age_group": {
        "0-17": 120, "18-29": 580, "30-49": 920,
        "50-64": 780, "65+": 520
      },
      "by_transport_mode": {
        "motocicleta": 1200, "carro": 850,
        "bicicleta": 320, "pedestre": 550
      }
    }
    ```

### Endpoints Unsafe Streets:
- ✅ `GET /unsafe-streets/cities/{city}/summary` - **NOVO** - Resumo de sinistros por cidade
  - **Filtros:** `city` (obrigatório)
  - **Resposta:**
    ```json
    {
      "city": "RECIFE",
      "total_accidents": 2850,
      "accidents_per_year": {
        "2020": 580, "2021": 620, "2022": 650
      },
      "total_streets": 1240,
      "most_dangerous_street": {
        "name": "Av. Boa Viagem",
        "total_accidents": 145
      }
    }
    ```
- 📝 `GET /unsafe-streets/cities/{city}/concentration` - **NOVO** - Concentração de sinistros
  - **Filtros:** `city` (obrigatório), `interval` (1, 5, 10, 15, 20)
  - **Resposta:**
    ```json
    {
      "city": "RECIFE",
      "interval": 10,
      "concentration_data": [
        {
          "ranking": 1,
          "total_accidents": 145,
          "street_extension_km": 8.5
        },
        {
          "ranking": 10,
          "total_accidents": 85,
          "street_extension_km": 6.2
        }
      ]
    }
    ```
- 📝 `GET /unsafe-streets/cities/{city}/geojson` - **NOVO** - Dados geoespaciais das vias
  - **Filtros:** `city` (obrigatório), `ranking_from`, `ranking_to`
  - **Resposta:** GeoJSON com propriedades: accidents_count, ranking, extension_km
- ✅ `GET /unsafe-streets/streets/{street_name}/summary` - **NOVO** - Resumo por via específica
  - **Filtros:** `street_name` (obrigatório), `city`
  - **Resposta:**
    ```json
    {
      "street_name": "Av. Boa Viagem",
      "total_victims": 180,
      "victims_per_year": {
        "2020": 35, "2021": 42, "2022": 48
      },
      "street_extension_km": 8.5
    }
    ```
- 📝 `GET /unsafe-streets/streets/{street_name}/profiles` - **NOVO** - Perfil das vítimas por via
  - **Filtros:** `street_name` (obrigatório), `city`
  - **Resposta:**
    ```json
    {
      "street_name": "Av. Boa Viagem",
      "victim_profiles": {
        "by_gender": { "masculino": 110, "feminino": 70 },
        "by_age_group": {
          "0-17": 15, "18-29": 45, "30-49": 65, "50+": 55
        },
        "by_accident_type": {
          "colisao": 85, "atropelamento": 45, "capotamento": 25
        }
      }
    }
    ```
- 📝 `GET /unsafe-streets/streets/{street_name}/geojson` - **NOVO** - Via em formato geoespacial
  - **Filtros:** `street_name` (obrigatório), `city`
- 📝 `GET /unsafe-streets/streets/{street_name}/evolution` - **NOVO** - Evolução temporal dos sinistros
  - **Filtros:** `street_name` (obrigatório), `city`, `start_year`, `end_year`
  - **Resposta:**
    ```json
    {
      "street_name": "Av. Boa Viagem",
      "period": { "start_year": 2020, "end_year": 2022 },
      "by_month": { "01": 12, "02": 8, "03": 15 },
      "by_weekday": {
        "segunda": 25, "terca": 22, "quarta": 28
      },
      "by_hour": {
        "06-09": 35, "12-14": 28, "17-19": 42
      }
    }
    ```
- 📝 `GET /unsafe-streets/streets/{street_name}/records` - **NOVO** - Registros de sinistros da via
  - **Filtros:** `street_name` (obrigatório), `city`, `year`
  - **Resposta:**
    ```json
    {
      "street_name": "Av. Boa Viagem",
      "year": 2022,
      "records": [
        {
          "datetime": "2022-03-15T14:30:00Z",
          "category": "COLISÃO",
          "gender": "MASCULINO",
          "age": 35,
          "outcome": "FERIDO"
        }
      ]
    }
    ```

---

## 🚦 **5. Traffic Calls API** (`/calls`)

**Serviço:** `apps/traffic-calls`  
**Descrição:** Chamadas relacionadas ao trânsito

### Endpoints:
- ✅ `GET /calls` - Lista chamadas de trânsito
  - Filtros: `start_date`, `end_date`, `nature`, `neighborhood`
- ✅ `GET /calls/{id}` - Detalhes de uma chamada específica

---

## ☠️ **6. Traffic Deaths API** (múltiplos endpoints)

**Serviço:** `apps/traffic-deaths`  
**Descrição:** Dados de mortes no trânsito

### Endpoints:
- ✅ `GET /v1/deaths/cyclists` - Estatísticas de mortes de ciclistas
  - Filtros: `year`, `city_code`
- ✅ `GET /v1/deaths/by-city` - Mortes agrupadas por cidade
- ✅ `GET /v1/deaths/by-transport-mode` - Mortes por modo de transporte
- ✅ `GET /v1/stats` - Estatísticas gerais
- ✅ `GET /v1/summary` - Resumo das mortes
- ✅ `GET /v1/deaths/time-series` - Série temporal das mortes

---

## 🚔 **7. Traffic Violations API** (`/violations`, `/streets`)

**Serviço:** `apps/traffic-violations`  
**Descrição:** Infrações de trânsito

### Endpoints Violations:
- ✅ `GET /violations` - Lista infrações
  - Filtros: `start_date`, `end_date`, `agent_id`, `violation_type_id`, `location_id`, `limit`, `offset`
- ✅ `GET /violations/{id}` - Detalhes de uma infração
- ✅ `GET /violations/summary` - **NOVO** - Resumo geral das infrações
  - **Resposta:**
    ```json
    {
      "total_violations": 125420,
      "data_period": { "start": "2020-01-01", "end": "2023-12-31" },
      "violations_per_year": {
        "2020": 28500, "2021": 31200, "2022": 32980, "2023": 32740
      },
      "top_violation_type": {
        "id": 5,
        "description": "Estacionar em local proibido",
        "total": 18520
      },
      "most_active_agent": {
        "id": 142,
        "total_violations": 2850
      }
    }
    ```
- ✅ `GET /violations/by-type` - **NOVO** - Infrações por tipo
  - **Filtros:** `start_date`, `end_date`, `limit`
  - **Resposta:**
    ```json
    {
      "violation_types": [
        {
          "violation_type_id": 5,
          "description": "Estacionar em local proibido",
          "total_violations": 18520,
          "percentage": 14.8,
          "violations_per_year": {
            "2022": 4200, "2023": 4850
          }
        }
      ]
    }
    ```
- ✅ `GET /violations/by-agent` - **NOVO** - Infrações por agente
  - **Filtros:** `start_date`, `end_date`, `limit`
  - **Resposta:**
    ```json
    {
      "agents": [
        {
          "agent_id": 142,
          "total_violations": 2850,
          "ranking": 1,
          "violations_per_month": {
            "2023-01": 245, "2023-02": 220
          }
        }
      ]
    }
    ```
- 📝 `GET /violations/by-location` - **NOVO** - Infrações por localização
  - **Filtros:** `start_date`, `end_date`, `limit`
  - **Resposta:**
    ```json
    {
      "locations": [
        {
          "location_id": 1025,
          "location_description": "Av. Boa Viagem, 1500",
          "total_violations": 1250,
          "ranking": 1,
          "coordinates": "-8.1234,-34.5678"
        }
      ]
    }
    ```
- ✅ `GET /violations/temporal-analysis` - **NOVO** - Análise temporal
  - **Filtros:** `start_date`, `end_date`, `violation_type_id`
  - **Resposta:**
    ```json
    {
      "period": { "start": "2023-01-01", "end": "2023-12-31" },
      "by_month": { "01": 2850, "02": 2650, "03": 3120 },
      "by_weekday": {
        "monday": 4520, "tuesday": 4280, "wednesday": 4650
      },
      "by_hour": {
        "08": 850, "12": 1200, "17": 1450, "19": 980
      }
    }
    ```
- 📝 `GET /violations/hotspots` - **NOVO** - Pontos críticos de infrações
  - **Filtros:** `violation_type_id`, `limit`, `radius_km`
  - **Resposta:** GeoJSON com clusters de infrações
- 📝 `GET /violations/geojson` - **NOVO** - Infrações em formato geoespacial
  - **Filtros:** `start_date`, `end_date`, `violation_type_id`, `agent_id`
  - **Resposta:** GeoJSON com propriedades: violation_type, agent_id, date

### Endpoints Streets:
- ✅ `GET /streets` - Lista ruas com infrações
- 📝 `GET /streets/ranking` - **NOVO** - Ranking de ruas com mais infrações
  - **Filtros:** `start_date`, `end_date`, `violation_type_id`, `limit`
  - **Resposta:**
    ```json
    {
      "streets": [
        {
          "street_code": 1025,
          "official_name": "Avenida Boa Viagem",
          "short_name": "Av. Boa Viagem",
          "neighborhood_name": "Boa Viagem",
          "total_violations": 1850,
          "ranking": 1,
          "violations_per_km": 125.5,
          "transport_corridor": true
        }
      ]
    }
    ```
- 📝 `GET /streets/{street_code}/summary` - **NOVO** - Resumo por rua específica
  - **Resposta:**
    ```json
    {
      "street": {
        "code": 1025,
        "official_name": "Avenida Boa Viagem",
        "neighborhood_name": "Boa Viagem",
        "transport_corridor": true,
        "perimeter_road": false
      },
      "violations_summary": {
        "total_violations": 1850,
        "violations_per_year": {
          "2022": 420, "2023": 485
        },
        "top_violation_types": [
          { "type_id": 5, "description": "Estacionamento proibido", "count": 650 }
        ]
      }
    }
    ```
- 📝 `GET /streets/{street_code}/violations` - **NOVO** - Infrações de uma rua
  - **Filtros:** `start_date`, `end_date`, `violation_type_id`, `limit`, `offset`
  - **Resposta:** Lista paginada de infrações da rua
- 📝 `GET /streets/neighborhoods` - **NOVO** - Infrações por bairro
  - **Filtros:** `start_date`, `end_date`, `limit`
  - **Resposta:**
    ```json
    {
      "neighborhoods": [
        {
          "neighborhood_code": 101,
          "neighborhood_name": "Boa Viagem",
          "total_violations": 5420,
          "total_streets": 85,
          "violations_per_street": 63.8,
          "ranking": 1
        }
      ]
    }
    ```

---

## 🛣️ **8. Cycling Infrastructure API** (`/infrastructure`, `/ways`)

**Serviço:** `apps/cycling-infra`  
**Descrição:** Infraestrutura cicloviária

### Endpoints Infrastructure:
- ✅ `GET /v1/infrastructure` - Lista infraestrutura existente (ciclomapa)
  - **Filtros:** `type`, `limit`
  - **Descrição:** Infraestrutura cicloviária existente do ciclomapa
- ✅ `GET /v1/infrastructure/{id}` - Detalhes de infraestrutura específica
- ✅ `GET /v1/infrastructure/summary` - Resumo executivo da infraestrutura
  - **Filtros:** `city`, `type`
  - **Resposta:**
    ```json
    {
      "existing_infrastructure_km": 120.5,
      "planned_infrastructure_km": 200.0,
      "implemented_from_plan_km": 45.2,
      "plan_coverage_percentage": 22.6,
      "by_type": {
        "ciclovia": { "existing": 80.2, "planned": 120.0, "implemented": 30.1 },
        "ciclofaixa": { "existing": 40.3, "planned": 80.0, "implemented": 15.1 }
      },
      "last_updated": "2024-01-15T10:30:00Z"
    }
    ```
- ✅ `GET /v1/infrastructure/cycleways` - GeoJSON das ciclovias com métricas
  - **Filtros:** `city`, `type`
  - **Resposta:** FeatureCollection + summary (mesmo formato do summary)
- ✅ `GET /v1/infrastructure/city-coverage` - Cobertura por cidade
  - **Filtros:** `state`, `region`
  - **Resposta:**
    ```json
    {
      "cities": [
        {
          "city_id": 1,
          "city_name": "Recife",
          "existing_infrastructure_km": 85.2,
          "planned_infrastructure_km": 150.0,
          "implemented_from_plan_km": 32.1,
          "plan_coverage_percentage": 21.4,
          "by_type": {
            "ciclovia": { "existing": 60.1, "planned": 90.0, "implemented": 22.5 },
            "ciclofaixa": { "existing": 25.1, "planned": 60.0, "implemented": 9.6 }
          },
          "last_updated": "2024-01-15T10:30:00Z"
        }
      ]
    }
    ```
- ✅ `GET /v1/infrastructure/cities/{city_id}/summary` - Resumo por cidade específica
  - **Resposta:** Summary + dados PDC Recife opcionais
  - **Dados PDC Recife:**
    ```json
    {
      "pdc_recife": {
        "routes": [
          {
            "route_name": "Via Mangue (COD-001)",
            "planned_typology": "Ciclovia",
            "planned_extension_km": 5.2,
            "executed_typology": "Ciclofaixa",
            "executed_extension_km": 3.1
          }
        ]
      }
    }
    ```

### Endpoints Ways:
- ✅ `GET /v1/ways` - Lista vias do PDC (rotas planejadas)
- ✅ `GET /v1/ways/summary` - Resumo estatístico da implementação do PDC
  - **Resposta:**
    ```json
    {
      "all": {
        "pdc_feito": 25000,
        "out_pdc": 5000,
        "pdc_total": 30000,
        "percent": 0.833
      },
      "byCity": {
        "2611606": {
          "pdc_feito": 15000,
          "out_pdc": 3000,
          "pdc_total": 18000,
          "percent": 0.833
        }
      }
    }
    ```
- ✅ `GET /v1/ways/all-ways` - Todas as vias como GeoJSON
  - **Resposta:**
    ```json
    {
      "all": {
        "type": "FeatureCollection",
        "features": [...]
      },
      "byCity": {
        "2611606": {
          "type": "FeatureCollection",
          "features": [...]
        }
      }
    }
    ```

---

## 🚲 **9. Shared Bike API** (`/stations`)

**Serviço:** `apps/shared-bike`  
**Descrição:** Estações de bike compartilhado

### Endpoints:
- ✅ `GET /v1/stations` - Lista estações
- ✅ `GET /v1/stations/{id}` - Detalhes de uma estação

---



## 📋 **Padrões Identificados**

### Estrutura Comum:
- Todos os serviços seguem padrão REST
- Uso de Hono + Zod OpenAPI
- Validação de parâmetros com Zod
- Respostas padronizadas com códigos HTTP
- Documentação automática OpenAPIo de Hono + Zod OpenAPI
- Validação de parâmetros com Zod
- Respostas padronizadas com códigos HTTP
- Documentação automática OpenAPI

### Filtros Comuns:
- **Datas:** `start_date`, `end_date`
- **Localização:** `city`, `municipality`, `neighborhood`
- **Paginação:** `limit`, `offset`
- **IDs:** `id`, `location_id`, `agent_id`

### Endpoints de Saúde:
- Todos os serviços têm `GET /health`

### Formatos de Resposta:
- JSON padrão
- GeoJSON para dados geográficos
- Paginação com `total`, `limit`, `offset`

---

## 🎯 **Próximos Passos**

1. **Identificar lacunas** - Quais APIs precisam ser criadas/expandidas?
2. **Padronizar filtros** - Unificar parâmetros comuns entre serviços
3. **Adicionar endpoints** - CRUD completo onde necessário
4. **Melhorar documentação** - Expandir descrições e exemplos
5. **Implementar autenticação** - Se necessário para alguns endpoints

---

---

## 📊 **Resumo de Implementação**

### **Status Geral:**
- ✅ **Implementados:** 27 endpoints
- 📝 **Especificados (não implementados):** 13 endpoints  
- 🚧 **Planejados:** 0 endpoints
- **Total:** 40 endpoints

### **Por Serviço:**

| Serviço | ✅ Implementados | 📝 Especificados | 🚧 Planejados | Total |
|---------|:---------------:|:----------------:|:-------------:|:-----:|
| **Bicycle Racks** | 5 | 0 | 0 | 5 |
| **Cyclist Profile** | 2 | 0 | 0 | 2 |
| **Cyclist Counts** | 6 | 0 | 0 | 6 |
| **Emergency Calls** | 7 | 6 | 0 | 13 |
| **Traffic Calls** | 2 | 0 | 0 | 2 |
| **Traffic Deaths** | 6 | 0 | 0 | 6 |
| **Traffic Violations** | 6 | 7 | 0 | 13 |
| **Cycling Infrastructure** | 8 | 0 | 0 | 8 |
| **Shared Bike** | 2 | 0 | 0 | 2 |

### **Próximas Prioridades:**

**🔥 Alta Prioridade (13 endpoints):**
- Emergency Calls - Unsafe Streets: 6 endpoints restantes
- Traffic Violations - Streets: 4 endpoints restantes  
- Traffic Violations - Análises: 3 endpoints restantes



### **Filtros Comuns:**
- **Datas:** `start_date`, `end_date`
- **Localização:** `city`, `municipality`, `neighborhood`
- **Paginação:** `limit`, `offset`
- **IDs:** `id`, `location_id`, `agent_id`

### **Endpoints de Saúde:**
- Todos os serviços têm `GET /health`

### **Formatos de Resposta:**
- JSON padrão
- GeoJSON para dados geográficos
- Paginação com `total`, `limit`, `offset`

---

**Última atualização:** Janeiro 2025  
**Total de serviços:** 9  
**Total de endpoints:** 40 (27 ✅ + 13 📝)