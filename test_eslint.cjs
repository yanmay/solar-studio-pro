const fs = require('fs');
const d = JSON.parse(fs.readFileSync('lint-results.json', 'utf16le'));
const errors = d.filter(x => x.errorCount > 0);
errors.forEach(f => {
  console.log(f.filePath);
  f.messages.filter(m => m.severity === 2).forEach(m => {
    console.log(`  ${m.line}:${m.column} ${m.message} (${m.ruleId})`);
  });
});
