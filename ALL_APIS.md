# Documentação Completa das APIs - Garfo

Este documento lista todas as APIs disponíveis no sistema Garfo, organizadas por módulo, com seus filtros e exemplos de resposta JSON.

## 1. Global APIs

### 1.1 Cities
**Endpoint:** `GET /cities`

**Filtros:** Nenhum

**Resposta JSON:**
```json
[
  {
    "id": 2611606,
    "name": "Recife",
    "state": "PE",
    "rmr": true
  }
]
```

## 2. Cyclist Counts APIs

### 2.1 Cyclist Counts Summary
**Endpoint:** `GET /cyclist-counts`

**Filtros:** Nenhum

**Resposta JSON:**
```json
{
  "counts": [
    {
      "id": 1,
      "slug": "1-2023-10-15-contagem-exemplo",
      "name": "Contagem Exemplo",
      "date": "2023-10-15T00:00:00.000Z",
      "city": {
        "id": 2611606,
        "name": "Recife",
        "state": "PE"
      },
      "total_cyclists": 150
    }
  ],
  "summary": {
    "total_cyclists": 1500,
    "number_counts": 10,
    "different_counts_points": 5,
    "where_max_count": {
      "slug": "1-2023-10-15-contagem-exemplo",
      "total_cyclists": 150,
      "date": "2023-10-15"
    },
    "total_cargo": 25,
    "total_helmet": 120,
    "total_juveniles": 30,
    "total_motor": 5,
    "total_ride": 80,
    "total_service": 15,
    "total_shared_bike": 40,
    "total_sidewalk": 20,
    "total_women": 60,
    "total_wrong_way": 10
  }
}
```

### 2.2 Cyclist Count Edition Details
**Endpoint:** `GET /cyclist-counts/edition/:id`

**Filtros:** 
- `id` (path parameter) - ID da edição

**Resposta JSON:**
```json
{
  "id": 1,
  "slug": "1-2023-10-15-contagem-exemplo",
  "name": "Contagem Exemplo",
  "date": "2023-10-15T00:00:00.000Z",
  "city": {
    "id": 2611606,
    "name": "Recife",
    "state": "PE"
  },
  "coordinates": [
    {
      "point": {
        "x": -34.8813,
        "y": -8.0476
      },
      "type": "Point",
      "name": "Contagem Exemplo"
    }
  ],
  "directions": {
    "N": "Norte",
    "S": "Sul"
  },
  "sessions": {
    "1": {
      "start_time": "2023-10-15T07:00:00.000Z",
      "end_time": "2023-10-15T08:00:00.000Z",
      "total_cyclists": 75,
      "quantitative": {
        "N_S": 40,
        "S_N": 35
      },
      "characteristics": {
        "helmet": 60,
        "women": 30,
        "cargo": 10
      }
    }
  },
  "summary": {
    "max_hour": 75,
    "total_cyclists": 150,
    "total_cargo": 25,
    "total_helmet": 120,
    "total_juveniles": 30,
    "total_motor": 5,
    "total_ride": 80,
    "total_service": 15,
    "total_shared_bike": 40,
    "total_sidewalk": 20,
    "total_women": 60,
    "total_wrong_way": 10
  }
}
```

## 3. Cyclist Infrastructure APIs

### 3.1 Cyclist Infrastructure Relations
**Endpoint:** `GET /cyclist-infra/relations`

**Filtros:** Nenhum

**Resposta JSON:**
```json
[
  {
    "id": 1,
    "name": "Ciclovia Exemplo",
    "pdcRef": "PDC001",
    "pdcNotes": "Notas sobre a ciclovia",
    "pdcTypology": "Ciclovia",
    "pdcKm": 5.2,
    "pdcStretch": "Trecho A-B",
    "pdcCities": "Recife",
    "osmId": 123456,
    "notes": "Observações gerais"
  }
]
```

### 3.2 Cyclist Infrastructure Relations by City
**Endpoint:** `GET /cyclist-infra/relationsByCity`

**Filtros:** Nenhum

**Resposta JSON:**
```json
{
  "2611606": {
    "city_id": 2611606,
    "name": "Recife",
    "state": "PE",
    "relations": [
      {
        "relation_id": 1,
        "pdc_ref": "PDC001",
        "name": "Ciclovia Exemplo",
        "cod_name": "(PDC001) Ciclovia Exemplo",
        "length": 5200,
        "has_cycleway_length": 3500,
        "pdc_typology": "Ciclovia",
        "typologies_str": "Ciclovia, Ciclofaixa",
        "typologies": {
          "Ciclovia": 3500,
          "Ciclofaixa": 1700
        }
      }
    ]
  }
}
```

### 3.3 Cyclist Infrastructure Relation Details
**Endpoint:** `GET /cyclist-infra/relation/:relationId`

**Filtros:**
- `relationId` (path parameter) - ID da relação OSM

**Resposta JSON:**
```json
{
  "relationId": 16000464,
  "ways": [
    {
      "id": 123456,
      "tags": {
        "highway": "cycleway",
        "name": "Ciclovia Exemplo"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-34.8813, -8.0476], [-34.8820, -8.0480]]
      }
    }
  ]
}
```

### 3.4 Cyclist Infrastructure Ways
**Endpoint:** `GET /cyclist-infra/ways`

**Filtros:** Nenhum

**Resposta JSON:**
```json
[
  {
    "osmId": 123456,
    "name": "Ciclovia Exemplo",
    "length": 1500,
    "highway": "cycleway",
    "hasCycleway": true,
    "cyclewayTypology": "Ciclovia",
    "relationId": 1,
    "geojson": {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "LineString",
            "coordinates": [[-34.8813, -8.0476], [-34.8820, -8.0480]]
          },
          "properties": {
            "name": "Ciclovia Exemplo"
          }
        }
      ]
    },
    "lastUpdated": "2023-10-15T10:00:00.000Z",
    "cityId": 2611606,
    "dualCarriageway": false,
    "pdcTypology": "Ciclovia"
  }
]
```

### 3.5 Cyclist Infrastructure Ways Summary
**Endpoint:** `GET /cyclist-infra/ways/summary`

**Filtros:** Nenhum

**Resposta JSON:**
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

### 3.6 Cyclist Infrastructure All Ways GeoJSON
**Endpoint:** `GET /cyclist-infra/ways/all-ways`

**Filtros:** Nenhum

**Resposta JSON:**
```json
{
  "all": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "LineString",
          "coordinates": [[-34.8813, -8.0476], [-34.8820, -8.0480]]
        },
        "properties": {
          "id": 1,
          "name": "Ciclovia Exemplo",
          "STATUS": "Realizada"
        }
      }
    ]
  },
  "byCity": {
    "2611606": {
      "type": "FeatureCollection",
      "features": []
    }
  }
}
```

## 4. DATASUS Deaths APIs

### 4.1 DATASUS Deaths Summary
**Endpoint:** `GET /datasus-deaths/summary`

**Filtros:**
- `localOcorrenciaObito` (query) - Local de ocorrência do óbito

**Resposta JSON:**
```json
{
  "porLocalOcorrencia": {
    "totalSinistrosUltimos10Anos": 1250,
    "totalUltimoAno": 125,
    "ultimoAno": 2023,
    "crescimentoRelacaoAnoAnterior": 5.2,
    "anoMaisViolento": {
      "ano": 2022,
      "total": 135
    },
    "dadosPorAno": [
      {
        "ano": 2014,
        "total": 110
      },
      {
        "ano": 2015,
        "total": 115
      }
    ]
  },
  "porLocalResidencia": {
    "totalSinistrosUltimos10Anos": 1180,
    "totalUltimoAno": 118,
    "ultimoAno": 2023,
    "crescimentoRelacaoAnoAnterior": 3.8,
    "anoMaisViolento": {
      "ano": 2022,
      "total": 128
    },
    "dadosPorAno": [
      {
        "ano": 2014,
        "total": 105
      }
    ]
  }
}
```

### 4.2 DATASUS Deaths Cities by Year
**Endpoint:** `GET /datasus-deaths/cities-by-year`

**Filtros:**
- `type` / `tipo` (query) - 'residence' ou 'occurrence'
- `deathLocation` / `localOcorrenciaObito` (query) - Local de ocorrência do óbito

**Resposta JSON:**
```json
{
  "locationType": "Occurrence Location",
  "deathLocation": {
    "value": "4",
    "description": "Via pública"
  },
  "years": [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
  "transportModes": ["Pedestre", "Ciclista", "Motociclista", "Ocupante de automóvel"],
  "cities": [
    {
      "id": 2611606,
      "name": "Recife",
      "2014": 45,
      "2015": 48,
      "2016": 52,
      "total": 500,
      "transportModes": {
        "Pedestre": {
          "2014": 20,
          "2015": 22,
          "total": 200
        },
        "Motociclista": {
          "2014": 15,
          "2015": 16,
          "total": 180
        }
      }
    }
  ]
}
```

### 4.3 DATASUS Deaths Filters
**Endpoint:** `GET /datasus-deaths/filtros`

**Filtros:**
- `cityId` / `municipio` (query) - ID da cidade
- `locationType` / `tipoLocal` (query) - 'residence' ou 'occurrence'
- `startYear` / `anoInicio` (query) - Ano inicial
- `endYear` / `anoFim` (query) - Ano final
- `gender` / `sexo` (query) - Sexo
- `race` / `racacor` (query) - Raça/cor
- `ageMin` / `faixaEtariaMin` (query) - Idade mínima
- `ageMax` / `faixaEtariaMax` (query) - Idade máxima
- `transportMode` / `modoTransporte` (query) - Modo de transporte
- `deathLocation` / `localOcorrenciaObito` (query) - Local de ocorrência do óbito

**Resposta JSON:**
```json
{
  "filtrosAplicados": {
    "cityId": 2611606,
    "locationType": "occurrence",
    "startYear": 2014,
    "endYear": 2023
  },
  "totalGeral": 1250,
  "resumo": {
    "porAno": {
      "2014": 110,
      "2015": 115,
      "2016": 120
    },
    "porSexo": {
      "Masculino": 900,
      "Feminino": 350
    },
    "porRacaCor": {
      "Parda": 600,
      "Branca": 400,
      "Preta": 200
    },
    "porFaixaEtaria": {
      "18-29 anos": 400,
      "30-49 anos": 500,
      "50-64 anos": 250
    },
    "porMunicipio": {
      "Recife": 800,
      "Olinda": 300,
      "Jaboatão": 150
    },
    "porModoTransporte": {
      "Motociclista": 500,
      "Pedestre": 400,
      "Ocupante de automóvel": 250
    },
    "porLocalOcorrenciaObito": {
      "Via pública": 800,
      "Hospital": 300,
      "Outros": 150
    }
  },
  "dados": [
    {
      "ano": 2023,
      "municipio": {
        "id": 2611606,
        "nome": "Recife"
      },
      "sexo": {
        "codigo": "1",
        "descricao": "Masculino"
      },
      "racacor": {
        "codigo": "3",
        "descricao": "Parda"
      },
      "idade": 25,
      "idadeOriginal": 425,
      "faixaEtaria": "18-29 anos",
      "modoTransporte": {
        "codigo": "V2",
        "descricao": "Motociclista"
      },
      "localOcorrenciaObito": {
        "codigo": "4",
        "descricao": "Via pública"
      },
      "causabas": "V234",
      "total": 15
    }
  ]
}
```

### 4.4 DATASUS Deaths Matrix
**Endpoint:** `GET /datasus-deaths/matrix`

**Filtros:**
- `cityId` (query) - ID da cidade
- `startYear` (query) - Ano inicial
- `endYear` (query) - Ano final
- `byResidence` (query) - true/false para local de residência
- `deathLocation` (query) - Local de ocorrência do óbito

**Resposta JSON:**
```json
{
  "matrix": {
    "pedestre": {
      "pedestre": 0,
      "ciclista": 15,
      "motociclista": 120,
      "automovel": 200,
      "onibus": 50,
      "outros": 25,
      "objeto_fixo": 10,
      "sem_colisao": 5,
      "nao_especificado": 30,
      "total": 455
    },
    "ciclista": {
      "pedestre": 5,
      "ciclista": 8,
      "motociclista": 25,
      "automovel": 80,
      "onibus": 15,
      "outros": 10,
      "objeto_fixo": 20,
      "sem_colisao": 15,
      "nao_especificado": 12,
      "total": 190
    },
    "total": {
      "pedestre": 5,
      "ciclista": 23,
      "motociclista": 145,
      "automovel": 280,
      "onibus": 65,
      "outros": 35,
      "objeto_fixo": 30,
      "sem_colisao": 20,
      "nao_especificado": 42,
      "total": 645
    }
  },
  "metadata": {
    "cityId": 2611606,
    "startYear": 2014,
    "endYear": 2023,
    "byResidence": false,
    "deathLocation": "4",
    "locationType": "Local de Ocorrência",
    "description": "Matriz de colisão mostrando o número de mortes por tipo de vítima e contraparte"
  }
}
```

### 4.5 DATASUS Deaths Secondary Causes
**Endpoint:** `GET /datasus-deaths/causas-secundarias`

**Filtros:**
- `cityId` (query) - ID da cidade
- `startYear` / `anoInicio` (query) - Ano inicial
- `endYear` / `anoFim` (query) - Ano final
- `ageMin` / `idadeMin` (query) - Idade mínima
- `ageMax` / `idadeMax` (query) - Idade máxima
- `gender` / `sexo` (query) - Sexo
- `transportMode` / `modoTransporte` (query) - Modo de transporte
- `deathLocation` / `localOcorrenciaObito` (query) - Local de ocorrência do óbito
- `locationType` / `tipoLocal` (query) - 'residence' ou 'occurrence'

**Resposta JSON:**
```json
{
  "filtrosAplicados": {
    "city": 2611606,
    "locationType": "occurrence",
    "yearPeriod": {
      "start": 2014,
      "end": 2023
    }
  },
  "totalRegistros": 1250,
  "causasSecundarias": {
    "linhaa": [
      {
        "codigo": "S72",
        "count": 150
      },
      {
        "codigo": "S06",
        "count": 120
      }
    ],
    "linhab": [
      {
        "codigo": "T79",
        "count": 80
      }
    ],
    "linhac": [],
    "linhad": [],
    "linhaii": [
      {
        "codigo": "Y85",
        "count": 200
      }
    ]
  },
  "descricao": "Causas secundárias das mortes por sinistro de trânsito"
}
```

## 5. SAMU Calls APIs

### 5.1 SAMU Calls Summary
**Endpoint:** `GET /samu-calls/summary`

**Filtros:**
- `incluir_invalidos` (query) - true/false para incluir desfechos inválidos

**Resposta JSON:**
```json
{
  "totalChamadas": 15000,
  "totalDesfechosValidos": 12000,
  "totalDesfechosInvalidos": 3000,
  "cidadeMaisViolenta": {
    "municipio": "Recife",
    "totalValidas": 8000,
    "totalInvalidas": 2000,
    "total": 10000,
    "evolucaoAnual": [
      {
        "ano": 2020,
        "totalValidas": 1800,
        "totalInvalidas": 400,
        "total": 2200
      }
    ]
  },
  "porCategoria": [
    {
      "categoria": "Acidente de Moto",
      "count": 6000
    },
    {
      "categoria": "Acidente de Carro",
      "count": 4000
    }
  ],
  "porMotivoFinalizacao": [
    {
      "motivo_fin_cat": "Atendimento Realizado",
      "count": 8000
    }
  ],
  "porMotivoDesfecho": [
    {
      "motivo_desf_cat": "Atendimento Concluído com Êxito",
      "count": 7000
    }
  ],
  "evolucaoAnual": [
    {
      "ano": 2020,
      "count": 2200,
      "ultimaData": "2020-12-31",
      "projecao": null
    },
    {
      "ano": 2023,
      "count": 2800,
      "ultimaData": "2023-10-15",
      "projecao": 3200
    }
  ],
  "periodo": {
    "inicio": 2018,
    "fim": 2023,
    "ultimoMes": "2023.10",
    "ultimoDia": "2023-10-15",
    "totalDiasComDados": 1825
  },
  "filtros": {
    "incluir_invalidos": false
  }
}
```

### 5.2 SAMU Calls Cities
**Endpoint:** `GET /samu-calls/cities`

**Filtros:**
- `filter` (query) - 'validos', 'invalidos' ou 'totais'

**Resposta JSON:**
```json
{
  "cidades": [
    {
      "municipio_samu": "Recife",
      "count": 8000,
      "id": 2611606,
      "name": "Recife",
      "rmr": true,
      "ranking": 1,
      "historico_anual": [
        {
          "ano": 2020,
          "total_chamados": 1800,
          "ultimaData": "2020-12-31",
          "validos": {
            "total": 1500,
            "atendimento_concluido": 1200,
            "removido_particulares": 200,
            "removido_bombeiros": 80,
            "obito_local": 20
          },
          "invalidos": 300,
          "por_sexo": {
            "masculino": 1200,
            "feminino": 500,
            "nao_informado": 100
          },
          "por_faixa_etaria": {
            "0_17_anos": 200,
            "18_29_anos": 600,
            "30_49_anos": 700,
            "50_64_anos": 250,
            "65_mais_anos": 50,
            "nao_informado": 0
          },
          "por_categoria": {
            "sinistro_moto": 800,
            "sinistro_carro": 500,
            "atropelamento_carro": 300,
            "atropelamento_moto": 150,
            "sinistro_bicicleta": 50,
            "nao_informado": 0
          },
          "projecao_total_chamados": null
        }
      ]
    }
  ],
  "total": 15,
  "recife_id": 2611606,
  "filtro_aplicado": "validos",
  "periodo": {
    "inicio": 2018,
    "fim": 2023,
    "ultimoMes": "2023.10",
    "ultimoDia": "2023-10-15",
    "totalDiasComDados": 1825
  }
}
```

### 5.3 SAMU Calls Filters
**Endpoint:** `GET /samu-calls/filtros`

**Filtros:**
- `cityId` / `municipio` (query) - ID da cidade
- `startYear` / `anoInicio` (query) - Ano inicial
- `endYear` / `anoFim` (query) - Ano final
- `gender` / `sexo` (query) - Sexo
- `ageMin` / `idadeMin` (query) - Idade mínima
- `ageMax` / `idadeMax` (query) - Idade máxima
- `category` / `categoria` (query) - Categoria do sinistro
- `subtype` / `subtipo` (query) - Subtipo do sinistro
- `startHour` / `horaInicio` (query) - Hora inicial
- `endHour` / `horaFim` (query) - Hora final
- `finalizationReason` / `motivoFinalizacao` (query) - Motivo de finalização
- `outcomeReason` / `motivoDesfecho` (query) - Motivo de desfecho
- `includeInvalid` / `incluirInvalidos` (query) - true/false para incluir inválidos

**Resposta JSON:**
```json
{
  "filtrosAplicados": {
    "cityId": 2611606,
    "startYear": 2020,
    "endYear": 2023,
    "includeInvalid": false
  },
  "totalGeral": 8000,
  "resumo": {
    "porAno": {
      "2020": 1800,
      "2021": 2000,
      "2022": 2100,
      "2023": 2100
    },
    "porSexo": {
      "Masculino": 5600,
      "Feminino": 2000,
      "Não informado": 400
    },
    "porFaixaEtaria": {
      "18-29 anos": 2400,
      "30-49 anos": 2800,
      "50-64 anos": 1000,
      "0-17 anos": 800
    },
    "porMunicipio": {
      "Recife": 8000
    },
    "porCategoria": {
      "Acidente de Moto": 3200,
      "Acidente de Carro": 2000,
      "Atropelamento por Carro": 1200
    },
    "porSubtipo": {
      "Colisão": 4000,
      "Capotamento": 1500,
      "Atropelamento": 2500
    },
    "porHora": {
      "7": 400,
      "8": 500,
      "18": 600,
      "19": 550
    }
  },
  "dados": [
    {
      "ano": 2023,
      "mes": 10,
      "hora": 8,
      "municipio": {
        "nome": "Recife"
      },
      "sexo": {
        "codigo": "Masculino",
        "descricao": "Masculino"
      },
      "idade": 25,
      "faixaEtaria": "18-29 anos",
      "categoria": {
        "codigo": "Acidente de Moto",
        "descricao": "Acidente de Moto"
      },
      "subtipo": {
        "codigo": "Colisão",
        "descricao": "Colisão"
      },
      "motivoFinalizacao": {
        "codigo": "Atendimento Realizado",
        "descricao": "Atendimento Realizado"
      },
      "motivoDesfecho": {
        "codigo": "Atendimento Concluído com Êxito",
        "descricao": "Atendimento Concluído com Êxito"
      },
      "total": 15
    }
  ]
}
```

### 5.4 SAMU Calls Streets Summary
**Endpoint:** `GET /samu-calls/streets/summary`

**Filtros:**
- `cityId` (query) - ID da cidade (padrão: 2611606 - Recife)
- `desfechos` (query) - 'validos', 'invalidos' ou 'todos'

**Resposta JSON:**
```json
{
  "totalSinistros": 8000,
  "totalViasIdentificadas": 7500,
  "totalVias": 1200,
  "extensaoTotalKm": 2500.75,
  "extensaoMediaKm": 2.08,
  "periodoInicio": "2018",
  "periodoFim": "2023",
  "mesUltimoDado": "2023.10",
  "anoMaisPerigoso": {
    "ano": "2022",
    "total": 1650
  },
  "viaMaisPerigosa": {
    "nome": "Avenida Boa Viagem",
    "id": 1,
    "total": 120,
    "percentual": 1.5,
    "extensao": 2321
  },
  "filtros": {
    "cityId": 2611606,
    "desfechos": "validos"
  }
}
```

### 5.5 SAMU Calls Streets Top
**Endpoint:** `GET /samu-calls/streets/top`

**Filtros:**
- `intervalo` (query) - Intervalo de agrupamento (padrão: 1)
- `anoInicio` (query) - Ano inicial
- `anoFim` (query) - Ano final
- `limite` (query) - Limite de resultados (padrão: 50)
- `cityId` (query) - ID da cidade (padrão: 2611606)

**Resposta JSON:**
```json
{
  "dados": [
    {
      "top": 1,
      "sinistros": 120,
      "sinistros_acum": 120,
      "km": 2.32,
      "km_acum": 2.32,
      "sinistros_por_km": 51.72,
      "sinistros_por_km_acum": 51.72,
      "percentual": 1.5,
      "percentual_acum": 1.5
    },
    {
      "top": 2,
      "sinistros": 95,
      "sinistros_acum": 215,
      "km": 1.85,
      "km_acum": 4.17,
      "sinistros_por_km": 51.35,
      "sinistros_por_km_acum": 51.56,
      "percentual": 1.19,
      "percentual_acum": 2.69
    }
  ],
  "parametros": {
    "intervalo": 1,
    "periodo": "2020-2023",
    "total_sinistros": 8000,
    "limite": 50
  }
}
```

### 5.6 SAMU Calls Streets Search
**Endpoint:** `GET /samu-calls/streets/search`

**Filtros:**
- `street` (query) - Nome da via (obrigatório)
- `limit` (query) - Limite de resultados (padrão: 100, 'all' para todos)
- `includeGeom` (query) - true/false para incluir geometria
- `desfechos` (query) - 'validos', 'invalidos' ou 'todos'
- `cityId` (query) - ID da cidade (padrão: 2611606)

**Resposta JSON:**
```json
{
  "sinistros": [
    {
      "id": 12345,
      "data": "2023-10-15",
      "hora_minuto": "08:30:00",
      "endereco": "Avenida Boa Viagem, 1000",
      "nome_oficial_logradouro": "Avenida Boa Viagem",
      "nomeBairro": "Boa Viagem",
      "categoria": "Acidente de Moto",
      "subtipo": "Colisão",
      "sexo": "Masculino",
      "idade": 25,
      "motivo_fin_cat": "Atendimento Realizado",
      "motivo_desf_cat": "Atendimento Concluído com Êxito"
    }
  ],
  "total": 120,
  "busca": "Boa Viagem",
  "limite": 100,
  "includeGeom": false,
  "filtro_desfechos": "validos"
}
```

## 6. Traffic Crashes APIs

### 6.1 Traffic Crashes Summary
**Endpoint:** `GET /traffic-crashes/summary`

**Filtros:** Nenhum

**Resposta JSON:**
```json
{
  "totalSinistros": 5000,
  "totalVitimas": 6500,
  "totalVitimasFatais": 450,
  "mediaAnual": 625,
  "crescimentoAno": 5.2
}
```

### 6.2 Traffic Crashes GeoJSON
**Endpoint:** `GET /traffic-crashes/geojson`

**Filtros:** Nenhum

**Resposta JSON:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[-34.8813, -8.0476], [-34.8820, -8.0480]]
      },
      "properties": {
        "id": 1,
        "nome": "Avenida Boa Viagem",
        "colisoes": 25,
        "vitimas": 35
      }
    }
  ]
}
```

### 6.3 Traffic Crashes Streets Summary
**Endpoint:** `GET /traffic-crashes/streets-summary`

**Filtros:**
- `year` (query) - Ano específico
- `cityId` (query) - ID da cidade (padrão: 2611606)

**Resposta JSON:**
```json
{
  "data": [
    {
      "streetId": 1,
      "name": "Avenida Boa Viagem",
      "totalSinistros": 25,
      "totalFatais": 3
    },
    {
      "streetId": 2,
      "name": "Rua da Aurora",
      "totalSinistros": 18,
      "totalFatais": 1
    }
  ],
  "filters": {
    "year": 2023,
    "cityId": 2611606,
    "cityName": "Recife"
  },
  "total": 150
}
```

### 6.4 Traffic Crashes Vehicles
**Endpoint:** `GET /traffic-crashes/vehicles`

**Filtros:** Nenhum

**Resposta JSON:**
```json
{
  "auto": 2500,
  "moto": 1800,
  "ciclom": 150,
  "ciclista": 300,
  "pedestre": 450,
  "onibus": 200,
  "caminhao": 180,
  "viatura": 25,
  "outros": 100
}
```

## Observações Gerais

### Filtros Comuns
- Muitas APIs aceitam filtros tanto em inglês quanto em português para compatibilidade
- Filtros de data geralmente aceitam anos (startYear/endYear ou anoInicio/anoFim)
- Filtros de localização podem ser por cidade específica ou RMR (Região Metropolitana do Recife)
- Filtros booleanos geralmente aceitam 'true'/'false' como strings

### Padrões de Resposta
- Todas as APIs retornam JSON
- Erros retornam status HTTP apropriado com mensagem de erro
- Muitas APIs incluem metadados sobre filtros aplicados
- Dados numéricos são convertidos para Number quando apropriado
- Datas são formatadas em ISO 8601 quando possível

### Códigos de Status HTTP
- 200: Sucesso
- 400: Parâmetros inválidos
- 404: Recurso não encontrado
- 500: Erro interno do servidor