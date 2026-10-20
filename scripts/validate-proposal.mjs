// Validates an engine proposal with the same rules the game uses.
// Usage: node scripts/validate-proposal.mjs <proposal.json> [customTypes.json]
// Prints {ok, errors, proposal}; exit code 0 when ok, 1 when rejected, 2 on bad input.
import { readFileSync } from 'node:fs';
import { validateProposal } from '../src/creation-rules.js';

const [file, typesFile] = process.argv.slice(2);
if (!file) { console.error('usage: validate-proposal.mjs <proposal.json> [customTypes.json]'); process.exit(2); }
let raw, customTypes = [];
try {
  raw = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (typesFile) customTypes = JSON.parse(readFileSync(typesFile, 'utf8'));
} catch (error) {
  console.log(JSON.stringify({ ok: false, errors: [`JSON 读不出来：${error.message}`], proposal: null }));
  process.exit(2);
}
const result = validateProposal(raw, { customTypes });
console.log(JSON.stringify(result));
process.exit(result.ok ? 0 : 1);
