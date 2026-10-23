@echo off
rem Uso: gerar-manifesto.bat "C:\caminho\System_aprovada" ["C:\caminho\pasta_com_o_AkamanahUI.utx"]
rem O 2o parametro e opcional: pasta com os .utx que vao para a SysTextures do jogador.
rem Cria a pasta patch\ ao lado deste .bat. Suba o CONTEUDO de patch\ para https://l2akamanah.com.br/patch/
if "%~1"=="" (echo Uso: gerar-manifesto.bat "pasta System aprovada" ["pasta com .utx"] & exit /b 1)
set TEX=
if not "%~2"=="" set TEX=-systextures "%~2"
"%~dp0gerar-manifesto.exe" -system "%~1" %TEX% -out "%~dp0patch"
pause
