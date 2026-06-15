import { readFileSync, writeFileSync } from 'fs';
const xml = readFileSync('prd_raw.xml', 'utf8');
const text = xml
  .replace(/<w:p[ >]/g, '\n')
  .replace(/<\/w:p>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0)
  .join('\n');
writeFileSync('prd_text.txt', text);
console.log('Done, lines:', text.split('\n').length);
console.log(text);
