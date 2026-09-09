@echo off
set PATH=C:\Program Files\Git\mingw64\bin;C:\Program Files\Git\cmd;C:\Windows\System32;%PATH%
del c:\Users\HP\Downloads\gowithflow\git_final_check.txt 2>nul
"C:\Program Files\Git\mingw64\bin\git.exe" add -A > c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" commit -m "chore: clean up temporary test files" >> c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" push origin main >> c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" status >> c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
