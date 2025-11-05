-- Query SQL para análise de perfil de ciclistas por ano, cor e gênero
-- Quantidade de respostas por ano, cor e gênero das pessoas

SELECT 
    EXTRACT(YEAR FROM (metadata->>'date')::timestamp) AS ano,
    data->>'color_race' AS cor,
    data->>'gender' AS genero,
    COUNT(*) AS quantidade_respostas
FROM cyclist_profiles
WHERE 
    data->>'color_race' IS NOT NULL 
    AND data->>'gender' IS NOT NULL
    AND metadata->>'date' IS NOT NULL
GROUP BY 
    EXTRACT(YEAR FROM (metadata->>'date')::timestamp),
    data->>'color_race',
    data->>'gender'
ORDER BY 
    ano DESC,
    cor,
    genero;

-- Query alternativa com mais detalhes estatísticos
SELECT 
    EXTRACT(YEAR FROM (metadata->>'date')::timestamp) AS ano,
    data->>'color_race' AS cor,
    data->>'gender' AS genero,
    COUNT(*) AS quantidade_respostas,
    ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY EXTRACT(YEAR FROM (metadata->>'date')::timestamp)), 
        2
    ) AS percentual_do_ano
FROM cyclist_profiles
WHERE 
    data->>'color_race' IS NOT NULL 
    AND data->>'gender' IS NOT NULL
    AND metadata->>'date' IS NOT NULL
GROUP BY 
    EXTRACT(YEAR FROM (metadata->>'date')::timestamp),
    data->>'color_race',
    data->>'gender'
ORDER BY 
    ano DESC,
    quantidade_respostas DESC;

-- Query para ver distribuição geral por cor
SELECT 
    data->>'color_race' AS cor,
    COUNT(*) AS total_respostas,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM cyclist_profiles WHERE data->>'color_race' IS NOT NULL), 2) AS percentual
FROM cyclist_profiles
WHERE data->>'color_race' IS NOT NULL
GROUP BY data->>'color_race'
ORDER BY total_respostas DESC;

-- Query para ver distribuição geral por gênero
SELECT 
    data->>'gender' AS genero,
    COUNT(*) AS total_respostas,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM cyclist_profiles WHERE data->>'gender' IS NOT NULL), 2) AS percentual
FROM cyclist_profiles
WHERE data->>'gender' IS NOT NULL
GROUP BY data->>'gender'
ORDER BY total_respostas DESC;

-- Query cruzada: cor x gênero (independente do ano)
SELECT 
    data->>'color_race' AS cor,
    data->>'gender' AS genero,
    COUNT(*) AS quantidade_respostas,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM cyclist_profiles WHERE data->>'color_race' IS NOT NULL AND data->>'gender' IS NOT NULL), 2) AS percentual_total
FROM cyclist_profiles
WHERE 
    data->>'color_race' IS NOT NULL 
    AND data->>'gender' IS NOT NULL
GROUP BY 
    data->>'color_race',
    data->>'gender'
ORDER BY 
    quantidade_respostas DESC;