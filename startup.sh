#!/bin/bash
# ====================================
# StockFlow - Setup Local Script
# Para Linux/Mac
# ====================================

echo ""
echo "========================================"
echo "   STOCKFLOW - SETUP LOCAL"
echo "========================================"
echo ""

# Verifica se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não detectado!"
    echo ""
    echo "Baixe e instale em: https://www.docker.com/products/docker-desktop"
    echo ""
    exit 1
fi

echo "✅ Docker detectado"
echo ""

# Verifica se .env existe
if [ ! -f ".env" ]; then
    echo "⚙️  Criando .env a partir de .env.example..."
    cp .env.example .env
    echo "✅ .env criado com sucesso"
    echo ""
    echo "📝 Nota: Edite .env para ajustar as configurações se necessário"
    echo ""
fi

# Verifica se Docker Compose está disponível
if ! command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo "🚀 Iniciando StockFlow com Docker..."
echo ""

# Para containers antigos se existirem
$COMPOSE_CMD down --remove-orphans 2>/dev/null

# Inicia os containers
$COMPOSE_CMD up
