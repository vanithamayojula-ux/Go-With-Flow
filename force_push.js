const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const git = 'C:\\Program Files\\Git\\cmd\\git.exe';
let log = '';

function run(args) {
  try {
    const out = execFileSync(git, args, { encoding: 'utf-8' });
    log += `=== git ${args.join(' ')} ===\n${out}\n`;
  } catch (err) {
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : '';
    log += `=== git ${args.join(' ')} (EXIT ${err.status}) ===\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\nERR:\n${err.message}\n`;
  }
}

run(['add', '-A']);
run(['commit', '-m', 'fix: resolve terrain clipping, portal warping ground height separation, and upgrade to Subway Surfers hoverboard model']);
run(['push', 'origin', 'main']);
run(['log', '-n', '3', '--oneline']);

fs.writeFileSync(path.join(__dirname, 'final_push_log.txt'), log, 'utf-8');
