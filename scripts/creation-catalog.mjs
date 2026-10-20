// Prints the creation catalog (parts, templates, palette, limits) the engine must build from.
import { catalogSnapshot } from '../src/creation-rules.js';

console.log(JSON.stringify(catalogSnapshot(), null, process.argv.includes('--pretty') ? 2 : 0));
