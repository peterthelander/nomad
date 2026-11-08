import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const hashes = new Map();
const visiting = new Set();
function versionModule(file) {
  if (hashes.has(file)) return hashes.get(file);
  if (visiting.has(file)) throw new Error(`Circular browser import: ${file}`);
  visiting.add(file);
  const path = resolve(root, file);
  const original = readFileSync(path, 'utf8');
  // Version dependencies before their importer so a nested change reaches index.html.
  const updated = original.replace(
    /(from\s+['"])(\.\/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])/g,
    (_, prefix, dependency, quote) => {
      const dependencyFile = relative(root, resolve(dirname(path), dependency));
      return `${prefix}${dependency}?v=${versionModule(dependencyFile)}${quote}`;
    },
  );
  if (updated !== original) writeFileSync(path, updated);
  const hash = createHash('sha256').update(updated).digest('hex').slice(0, 12);
  hashes.set(file, hash);
  visiting.delete(file);
  return hash;
}

let html = readFileSync(resolve(root, 'index.html'), 'utf8');
for (const file of ['main.js', 'styles.css']) {
  const hash = versionModule(file);
  html = html.replace(
    new RegExp(`\\./${file.replace('.', '\\.')}[^" ]*`, 'g'),
    `./${file}?v=${hash}`,
  );
}
writeFileSync(resolve(root, 'index.html'), html);
console.log('Versioned browser assets and their dependencies.');
