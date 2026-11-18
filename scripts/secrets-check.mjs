// Fails if a credential-looking string is committed: API keys, OAuth secrets, tokens or private keys.
// Monto keeps none in the code: the user's own OAuth client and the database key live in the Windows Credential Manager.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/GOCSPX-[0-9A-Za-z_-]{20,}/, 'Google OAuth client secret'],
  [/gh[pousr]_[0-9A-Za-z]{30,}/, 'GitHub token'],
  [/sk-[A-Za-z0-9]{32,}/, 'API secret key'],
  [/xox[abpr]-[0-9A-Za-z-]{10,}/, 'Slack token'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/(?:client_secret|api_key|apikey|access_token)\s*[:=]\s*["'][0-9A-Za-z_\-./+]{16,}["']/i, 'hard-coded secret'],
];
const SKIP = /(^|\/)(package-lock\.json|Cargo\.lock|.*\.(png|jpg|jpeg|ico|icns|webp|pdf|woff2?|wasm|monto|db))$/;

const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter((f) => f && !SKIP.test(f));
const hits = [];
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => { for (const [re, what] of PATTERNS) if (re.test(line)) hits.push(`${f}:${i + 1}  ${what}`); });
}
if (hits.length) { console.error('Posibles credenciales en el repositorio:\n' + hits.join('\n')); process.exit(1); }
console.log(`Sin credenciales en ${files.length} archivos.`);
