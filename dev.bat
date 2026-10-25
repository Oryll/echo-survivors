@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "NODE=C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE%" set "NODE=node"

echo 启动开发服务器 http://127.0.0.1:5200 ...
start "" "http://127.0.0.1:5200"
"%NODE%" node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5200 --strictPort
pause
