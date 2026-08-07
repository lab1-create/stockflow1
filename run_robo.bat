@echo off
title Robo de Movimentacoes
color 0A

:menu
cls
echo =======================================================
echo          ROBO DE AUTOMACAO - STOCKFLOW
echo =======================================================
echo.
echo Escolha uma opcao:
echo.
echo 1 - Instalar dependencias (Rodar apenas 1 vez)
echo 2 - GRAVAR acoes (Modo de aprendizado)
echo 3 - REPETIR acoes gravadas (Modo de execucao)
echo 4 - Sair
echo.
set /p opcao="Digite o numero da opcao: "

if "%opcao%"=="1" goto instalar
if "%opcao%"=="2" goto gravar
if "%opcao%"=="3" goto repetir
if "%opcao%"=="4" goto sair

echo.
echo Opcao invalida!
pause
goto menu

:instalar
cls
echo Instalando dependencias do Python...
pip install -r requirements-robo.txt
echo.
echo Instalacao concluida!
pause
goto menu

:gravar
cls
python robo_movimentacoes.py --gravar
pause
goto menu

:repetir
cls
python robo_movimentacoes.py --repetir
pause
goto menu

:sair
exit
