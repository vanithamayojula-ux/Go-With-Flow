@echo off
set PATH=C:\Program Files\Git\mingw64\bin;C:\Program Files\Git\cmd;C:\Windows\System32;%PATH%
"C:\Program Files\Git\mingw64\bin\git.exe" log -n 5 > c:\Users\HP\Downloads\gowithflow\log_output.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" status >> c:\Users\HP\Downloads\gowithflow\log_output.txt 2>&1
