Exportação das bases da Plataforma de Dados da Ameciclo
Leia o arquivo PLATAFORMA_DADOS.md e use-o como fonte de verdade sobre quais páginas, serviços e endpoints devem ser acessados.
Objetivo
Extrair e organizar todos os dados disponíveis nos endpoints listados no documento, para que outro modelo faça posteriormente a análise.
Você não deve analisar, interpretar, cruzar, resumir ou tirar conclusões sobre os dados.
Regras
Use somente os endpoints listados em PLATAFORMA_DADOS.md.
Você pode inspecionar o código das rotas para descobrir:
parâmetros;
filtros;
paginação;
valores válidos;
estrutura das respostas.
Não acesse diretamente o PostgreSQL.
Não use tabelas, views ou consultas SQL como fonte alternativa.
Faça apenas requisições de leitura.
Extraia todas as páginas quando houver paginação.
Extraia todos os anos, cidades, categorias e demais valores finitos aceitos pelos endpoints.
Evite repetir chamadas quando uma resposta geral já contiver todos os registros.
Preserve os dados exatamente como retornados.
Não renomeie campos nem altere valores.
Não calcule indicadores novos.
Não faça joins ou cruzamentos entre bases.
Não produza rankings próprios, tendências, correlações ou recomendações.
Continue a execução mesmo quando algum endpoint falhar.
Registre claramente tudo que não pôde ser extraído.
Formatos de saída
Para cada endpoint, gere:
JSON bruto com a resposta original;
CSV quando os dados forem tabulares;
GeoJSON quando a resposta contiver geometrias;
JSONL para conjuntos muito grandes.
O JSON bruto deve sempre ser preservado, mesmo quando houver CSV.
Organização
Crie a pasta:
exports/ameciclo/
Organize os arquivos assim:
exports/ameciclo/
├── README.md
├── index.csv
├── errors.csv
├── contagens/
├── perfil_ciclista/
├── execucao_cicloviaria/
├── infracoes/
├── chamados_emergencia/
├── vias_inseguras/
├── sinistros_fatais/
├── orcamento_pernambuco/
├── orcamento_recife/
├── bicicletarios/
├── bike_pe/
├── ideciclo/
├── cms/
└── ciclodados/
Endpoints parametrizados
Quando um endpoint exigir filtros:
descubra os parâmetros no código;
descubra os valores válidos;
consulte todos os valores finitos;
registre os parâmetros usados no nome do arquivo ou no index.csv.
Não execute combinações cartesianas desnecessárias.
Exemplo:
infracoes/overview.json
infracoes/overview_ano_2024.json
infracoes/streets_ano_2024.csv
sinistros_fatais/matrix_tipo_vitima_ano.csv
Paginação
Quando houver paginação:
percorra todas as páginas;
preserve as respostas individuais, se necessário;
gere um arquivo consolidado;
compare o total retornado pela API com o total exportado.
Nunca exporte somente a primeira página.
Arquivos geográficos
Para GeoJSON:
preserve todas as geometrias e propriedades;
não simplifique;
não reprojete;
não reduza precisão;
gere também um CSV das propriedades quando possível.
Registro da exportação
Gere index.csv com:
tema;
serviço;
endpoint;
parâmetros;
arquivo;
formato;
número de registros;
status;
observação.
Gere errors.csv com:
serviço;
endpoint;
parâmetros;
status HTTP;
erro;
tentativa realizada.
README
O README.md deve informar:
data da extração;
endpoints acessados;
arquivos gerados;
bases completas;
bases parciais;
endpoints que falharam;
como executar novamente o extrator.
Não inclua análise dos dados.
Código
Crie um script reproduzível para executar novamente toda a exportação.
Use preferencialmente TypeScript, seguindo as ferramentas já utilizadas pelo projeto.
O script deve:
ter timeout;
tratar paginação;
limitar concorrência;
tentar novamente erros temporários;
salvar resultados progressivamente;
não apagar exportações anteriores;
não modificar o banco ou a aplicação.
Entrega
Execute o script e gere os arquivos.
Não entregue apenas um plano ou pseudocódigo.
Ao final, informe:
caminho da pasta;
quantidade de endpoints acessados;
quantidade de arquivos;
quais extrações ficaram incompletas;
comando para repetir a exportação.
A resposta final deve ser curta. Os dados devem estar nos arquivos.
