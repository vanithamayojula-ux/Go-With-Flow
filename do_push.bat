@echo off
cd /d c:\Users\HP\Downloads\gowithflow
"C:\Program Files\Git\cmd\git.exe" add -A
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: resolve portal warp terrain height separation math and Subway Surfers hoverboard physics" > c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main >> c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" log -n 5 --oneline >> c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
