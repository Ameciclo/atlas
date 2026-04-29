#!/bin/bash

echo "🚀 Testando API Ciclodados..."
echo "================================"

BASE_URL="http://localhost:3050"

# Função para testar endpoint
test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    
    echo ""
    echo "📍 $description"
    echo "   $method $url"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$url")
    fi
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" = "200" ]; then
        echo "   ✅ Status: $http_code"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        echo "   ❌ Status: $http_code"
        echo "$body"
    fi
}

# 1. Health Check
test_endpoint "GET" "$BASE_URL/health" "" "Health Check"

# 2. Busca de ruas
test_endpoint "GET" "$BASE_URL/v1/streets/search?q=rua&limit=3" "" "Busca de Ruas"

# 3. Busca específica
test_endpoint "GET" "$BASE_URL/v1/streets/search?q=boa+viagem&limit=5" "" "Busca 'Boa Viagem'"

# 4. Detalhes de rua (se existir ID 1)
test_endpoint "GET" "$BASE_URL/v1/streets/1" "" "Detalhes da Rua ID 1"

# 5. Análise de ponto
test_endpoint "POST" "$BASE_URL/v1/analyze/point" \
    '{"lat": -8.0476, "lng": -34.8770, "buffer": 100}' \
    "Análise de Ponto (Recife)"

echo ""
echo "🏁 Testes concluídos!"