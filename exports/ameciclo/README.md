# Exportacao da Plataforma de Dados da Ameciclo

**Data da extracao:** 2026-07-22T17:27:33.468Z

## Resumo

- **Endpoints acessados:** 65
- **Arquivos gerados:** 238
- **Bases completas:** 238
- **Endpoints com falha:** 8

## Endpoints que falharam

- `emergency-calls/v2/streets/history` — Erro: Street not found (BOA VIAGEM nao encontrada no PCR)
- `ideciclo/reviews` — Erro: API externa nao alcancavel
- `ideciclo/structures` — Erro: API externa nao alcancavel
- `ideciclo/forms` — Erro: API externa nao alcancavel
- `strapi/api/plataformas-de-dados` — Erro: Certificado SSL expirado em do.strapi.ameciclo.org
- `ciclodados/v1/nearby` — Erro: parse error - invalid geometry (PostGIS)
- `state-budget/v1/budget/state` — Erro: Servico nao implementado (skeleton app sem src/)
- `recife-budget/v1/budget/recife` — Erro: Servico nao encontrado

## Como executar novamente

```bash
node /home/dvalenca/code/atlas/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/export-ameciclo.ts
```

**Pre-requisitos:** Todos os microsservicos devem estar rodando nas portas 3000-3050.
