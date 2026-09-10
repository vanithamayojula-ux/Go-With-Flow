const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const git = 'C:\\Program Files\\Git\\cmd\\git.exe';
const dir = 'c:\\Users\\HP\\Downloads\\gowithflow';
const logFile = path.join(dir, 'git_push_log_sync.txt');

fs.writeFileSync(logFile, 'STARTING GIT PUSH...\n', 'utf-8');

function run(args) {
  try {
    const out = execFileSync(git, args, { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const msg = `=== git ${args.join(' ')} ===\n${out}\n`;
    fs.appendFileSync(logFile, msg, 'utf-8');
  } catch (err) {
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : '';
    const msg = `=== git ${args.join(' ')} (EXIT ${err.status}) ===\nSTDOUT: ${stdout}\nSTDERR: ${stderr}\nERR: ${err.message}\n`;
    fs.appendFileSync(logFile, msg, 'utf-8');
  }
}

run(['add', '-A']);
run(['commit', '-m', 'fix: resolve portal warp terrain height separation math and Subway Surfers hoverboard physics']);
run(['push', 'origin', 'main']);
run(['status']);
run(['log', '-n', '3', '--oneline']);

fs.appendFileSync(logFile, 'COMPLETED GIT PUSH SCRIPT.\n', 'utf-8');
