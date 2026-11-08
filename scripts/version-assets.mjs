import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,12);
let main = readFileSync('main.js','utf8');
for (const file of ['controls.js','multiplayer.js','config.js']) {
  const pattern = new RegExp(`'\\./${file.replace('.', '\\.')}([^']*)?'`, 'g');
  main = main.replace(pattern, `'./${file}?v=${hash(file)}'`);
}
writeFileSync('main.js', main);
let html = readFileSync('index.html','utf8');
for (const file of ['main.js','styles.css']) {
  const pattern = new RegExp(`\\./${file.replace('.', '\\.')}[^" ]*`, 'g');
  html = html.replace(pattern, `./${file}?v=${hash(file)}`);
}
writeFileSync('index.html', html);
console.log('Versioned all local browser assets.');
