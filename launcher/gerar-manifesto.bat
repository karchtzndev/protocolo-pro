@echo off
rem Uso: gerar-manifesto.bat "C:\caminho\System_aprovada"
rem Cria a pasta patch\ ao lado deste .bat. Suba o CONTEUDO de patch\ para https://l2akamanah.com.br/patch/
if "%~1"=="" (echo Uso: gerar-manifesto.bat "pasta System aprovada" & exit /b 1)
"%~dp0gerar-manifesto.exe" -system "%~1" -out "%~dp0patch"
pause
