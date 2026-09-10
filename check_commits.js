const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const candidates = [
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe',
  'C:\\Program Files\\Git\\mingw64\\bin\\git.exe',
  'C:\\Program Files (x86)\\Git\\cmd\\git.exe'
];

let validGit = null;
for (const c of candidates) {
  if (fs.existsSync(c)) {
    validGit = c;
    break;
  }
}

let res = `Valid Git Path: ${validGit}\n`;

if (validGit) {
  function run(args) {
    try {
      const out = execFileSync(validGit, args, { cwd: __dirname, encoding: 'utf-8' });
      return `=== git ${args.join(' ')} ===\n${out}\n`;
    } catch (err) {
      const out = (err.stdout || '') + (err.stderr || '');
      return `=== git ${args.join(' ')} (ERROR) ===\n${out}\n`;
    }
  }

  res += run(['log', '-n', '5']);
  res += run(['status']);
  res += run(['branch', '-a']);
  res += run(['remote', '-v']);
}

const targetPath = path.join(__dirname, 'commit_debug.txt');
fs.writeFileSync(targetPath, res);
console.log('Wrote to:', targetPath);
