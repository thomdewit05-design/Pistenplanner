@echo off
rem Start de Pistenplanner op deze computer en open hem in de browser.
cd /d "%~dp0"
start "" http://localhost:8766/
python -m http.server 8766
