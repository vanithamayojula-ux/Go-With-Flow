const { execFileSync } = require('child_process');
const fs = require('fs');

const git = 'C:\\Program Files\\Git\\cmd\\git.exe';
const dir = 'c:\\Users\\HP\\Downloads\\gowithflow';

function run(args) {
  try {
    const out = execFileSync(git, args, { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`=== git ${args.join(' ')} ===\n${out}\n`);
  } catch (err) {
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : '';
    console.log(`=== git ${args.join(' ')} (EXIT ${err.status}) ===\nSTDOUT: ${stdout}\nSTDERR: ${stderr}\n`);
  }
}

run(['add', '-A']);
run(['commit', '-m', 'fix: implement Ground vs Sky Recognition System and Edge Fall Gravity System']);
run(['push', 'origin', 'main']);
run(['status']);
run(['log', '-n', '3', '--oneline']);
