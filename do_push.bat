@echo off
cd /d c:\Users\HP\Downloads\gowithflow
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "feat: complete production upgrade across character rig, PBR materials, postprocessing, 18 biomes, hazards & UI polish" > c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main >> c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" log -n 5 --oneline >> c:\Users\HP\Downloads\gowithflow\push_report.txt 2>&1
