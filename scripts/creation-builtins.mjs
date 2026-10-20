// Emits validated-looking local proposals for every built-in machine and figure.
// Used to seed the shared asset library so the first player already sees common objects.
import { analyzeLocal, catalogSnapshot } from '../src/creation-rules.js';

const catalog = catalogSnapshot();
const items = [
  ...catalog.objectTemplates.map((t) => ({ title: t.name, keywords: t.keywords, kind: 'assembly' })),
  ...catalog.figureTemplates.map((t) => ({ title: t.name, keywords: t.keywords, kind: 'figure' })),
];
const out = items.map((item) => ({
  title: item.title,
  keywords: item.keywords,
  kind: item.kind,
  proposal: analyzeLocal({ title: item.title, idea: item.title, stamps: [] }),
}));
process.stdout.write(JSON.stringify(out));
