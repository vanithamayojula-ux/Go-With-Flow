@echo off
set PATH=C:\Program Files\Git\mingw64\bin;C:\Program Files\Git\cmd;C:\Windows\System32;%PATH%
"C:\Program Files\Git\mingw64\bin\git.exe" add -A > c:\Users\HP\Downloads\gowithflow\push_log_nomad.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" commit -m "fix: resolve control direction and implement desert nomad sand surfer character model" >> c:\Users\HP\Downloads\gowithflow\push_log_nomad.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" push origin main >> c:\Users\HP\Downloads\gowithflow\push_log_nomad.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" status >> c:\Users\HP\Downloads\gowithflow\push_log_nomad.txt 2>&1
