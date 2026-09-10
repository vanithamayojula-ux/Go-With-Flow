const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const git = 'C:\\Program Files\\Git\\cmd\\git.exe';
const dir = 'c:\\Users\\HP\\Downloads\\gowithflow';

const filesToDelete = [
  'check_commits.js',
  'do_push_node.js',
  'force_push.js',
  'push_all.js',
  'ps_out.txt',
  'ps_err.txt',
  'git_push_log_sync.txt'
];

for (const f of filesToDelete) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch (e) {}
  }
}

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
run(['commit', '-m', 'chore: clean up test files']);
run(['push', 'origin', 'main']);
run(['status']);
run(['log', '-n', '3', '--oneline']);
