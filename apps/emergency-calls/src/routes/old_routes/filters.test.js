const request = require('supertest');
const express = require('express');

// Mock do banco de dados
const mockDb = {
  select: () => ({
    from: () => ({
      leftJoin: () => ({
        where: () => ({
          groupBy: () => ({
            orderBy: () => ({
              execute: async () => [
                {
                  total: 100,
                  ano: 2023,
                  mes: 1,
                  hora: 10,
                  sexo: 'M',
                  idade: 30,
                  municipio: 'Recife',
                  categoria: 'ATROPELAMENTO',
                  subtipo: 'ATROPELCARRO',
                  motivoFinalizacao: 'TRANSPORTE REALIZADO',
                  motivoDesfecho: 'ALTA HOSPITALAR'
                }
              ]
            })
          })
        })
      })
    })
  })
};

// Mock das dependências
jest.mock('../../db', () => ({ db: mockDb }));
jest.mock('../../db/modules/casualties/table_samu_calls', () => ({
  samu_calls: {
    data: 'data',
    city_id: 'city_id',
    sexo: 'sexo',
    idade: 'idade',
    categoria: 'categoria',
    subtipo: 'subtipo',
    hora_minuto: 'hora_minuto',
    motivo_fin_cat: 'motivo_fin_cat',
    motivo_desf_cat: 'motivo_desf_cat'
  }
}));
jest.mock('../../db/modules/global/table_cities', () => ({
  cities: {
    id: 'id',
    name: 'name',
    rmr: 'rmr'
  }
}));

const filtersRouter = require('./filters').default;

const app = express();
app.use(express.json());
app.use('/samu-calls/filters', filtersRouter);

describe('SAMU Calls Filters', () => {
  test('should return 200 for basic request', async () => {
    const response = await request(app)
      .get('/samu-calls/filters')
      .expect(200);

    expect(response.body).toHaveProperty('filtrosAplicados');
    expect(response.body).toHaveProperty('totalGeral');
    expect(response.body).toHaveProperty('resumo');
    expect(response.body).toHaveProperty('dados');
  });

  test('should parse cityId parameter', async () => {
    const response = await request(app)
      .get('/samu-calls/filters?cityId=2611606')
      .expect(200);

    expect(response.body.filtrosAplicados.cityId).toBe(2611606);
  });

  test('should parse year range parameters', async () => {
    const response = await request(app)
      .get('/samu-calls/filters?startYear=2020&endYear=2023')
      .expect(200);

    expect(response.body.filtrosAplicados.startYear).toBe(2020);
    expect(response.body.filtrosAplicados.endYear).toBe(2023);
  });

  test('should parse gender parameter', async () => {
    const response = await request(app)
      .get('/samu-calls/filters?gender=M')
      .expect(200);

    expect(response.body.filtrosAplicados.gender).toEqual(['M']);
  });

  test('should parse age range parameters', async () => {
    const response = await request(app)
      .get('/samu-calls/filters?ageMin=18&ageMax=65')
      .expect(200);

    expect(response.body.filtrosAplicados.ageMin).toBe(18);
    expect(response.body.filtrosAplicados.ageMax).toBe(65);
  });

  test('should parse includeInvalid parameter', async () => {
    const response = await request(app)
      .get('/samu-calls/filters?includeInvalid=true')
      .expect(200);

    expect(response.body.filtrosAplicados.includeInvalid).toBe(true);
  });

  test('should support legacy parameter names', async () => {
    const response = await request(app)
      .get('/samu-calls/filters?municipio=2611606&sexo=F&incluirInvalidos=true')
      .expect(200);

    expect(response.body.filtrosAplicados.cityId).toBe(2611606);
    expect(response.body.filtrosAplicados.gender).toEqual(['F']);
    expect(response.body.filtrosAplicados.includeInvalid).toBe(true);
  });

  test('should return proper resumo structure', async () => {
    const response = await request(app)
      .get('/samu-calls/filters')
      .expect(200);

    expect(response.body.resumo).toHaveProperty('porAno');
    expect(response.body.resumo).toHaveProperty('porSexo');
    expect(response.body.resumo).toHaveProperty('porFaixaEtaria');
    expect(response.body.resumo).toHaveProperty('porMunicipio');
    expect(response.body.resumo).toHaveProperty('porCategoria');
    expect(response.body.resumo).toHaveProperty('porSubtipo');
    expect(response.body.resumo).toHaveProperty('porHora');
  });

  test('should handle multiple categories', async () => {
    const response = await request(app)
      .get('/samu-calls/filters?category=ATROPELAMENTO&category=COLISAO')
      .expect(200);

    expect(response.body.filtrosAplicados.category).toEqual(['ATROPELAMENTO', 'COLISAO']);
  });

  test('should handle hour range filter', async () => {
    const response = await request(app)
      .get('/samu-calls/filters?startHour=6&endHour=18')
      .expect(200);

    expect(response.body.filtrosAplicados.startHour).toBe(6);
    expect(response.body.filtrosAplicados.endHour).toBe(18);
  });
});

console.log('Testes do filters.js criados com sucesso!');