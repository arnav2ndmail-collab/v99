@echo off
cd /d %~dp0

git add -A
git commit -m "Update to TestZyro v7"
git push

pause