@echo off
set PATH=C:\Program Files\Git\mingw64\bin;C:\Program Files\Git\cmd;C:\Windows\System32;%PATH%
"C:\Program Files\Git\mingw64\bin\git.exe" add -A > c:\Users\HP\Downloads\gowithflow\push_features_log.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" commit -m "feat: implement dynamic speed scaling, 7 unique world places, 3D portal warps, and upgraded graphics" >> c:\Users\HP\Downloads\gowithflow\push_features_log.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" push origin main >> c:\Users\HP\Downloads\gowithflow\push_features_log.txt 2>&1
"C:\Program Files\Git\mingw64\bin\git.exe" status >> c:\Users\HP\Downloads\gowithflow\push_features_log.txt 2>&1
