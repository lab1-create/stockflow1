@echo off
REM ====================================
REM StockFlow - Setup Local Script
REM Para Windows
REM ====================================

echo.
echo ========================================
echo    STOCKFLOW - SETUP LOCAL
echo ========================================
echo.

REM Verifica se Docker está instalado
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker nao detectado!
    echo.
    echo Baixe e instale em: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

echo ✅ Docker detectado
echo.

REM Verifica se .env existe
if not exist ".env" (
    echo ⚙️  Criando .env a partir de .env.example...
    copy .env.example .env >nul
    echo ✅ .env criado com sucesso
    echo.
    echo 📝 Nota: Abra .env para ajustar as configuracoes se necessario
    echo.
)

REM Verifica se Docker Compose está disponível
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker Compose nao encontrado!
        pause
        exit /b 1
    )
    set COMPOSE_CMD=docker compose
) else (
    set COMPOSE_CMD=docker-compose
)

echo 🚀 Iniciando StockFlow com Docker...
echo.

REM Para containers antigos se existirem
%COMPOSE_CMD% down --remove-orphans 2>nul

REM Inicia os containers
%COMPOSE_CMD% up

pause
