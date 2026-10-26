const fs = require('fs');
const ts = require('./backend/node_modules/typescript');
const pages = ['dashboard.html','discover.html','social-network.html','communities.html','events.html','projects.html','opportunities.html','my-opportunities.html','academics.html','teacher-dashboard.html','college-admin.html','messages.html','notifications.html','profile.html','settings.html'];
let failed = false;
for (const file of fs.readdirSync('.').filter(name => name.endsWith('.js'))) {
  const source = fs.readFileSync(file,'utf8');
  const parsed = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if (parsed.parseDiagnostics.length) { failed = true; console.log('JS_PARSE',file,parsed.parseDiagnostics.map(d => d.messageText)); }
}
for (const file of pages) {
  const source = fs.readFileSync(file,'utf8');
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id,index) => ids.indexOf(id) !== index))];
  if (duplicates.length) { failed = true; console.log('DUPLICATE_IDS',file,duplicates); }
  if (!source.includes('campussphere-ui.css')) { failed = true; console.log('MISSING_UI',file); }
  for (const match of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/, 1)[0];
    if (target && !/^(?:[a-z]+:|#|\/)/i.test(target) && !fs.existsSync(target)) { failed = true; console.log('MISSING_ASSET',file,target); }
  }
}
for (const file of fs.readdirSync('.').filter(name => /\.(html|css|js)$/.test(name))) {
  const source = fs.readFileSync(file,'utf8');
  if (/[\u00c2\u00c3\u00e2\u00ef\u00f0\ufffd]/.test(source)) { failed = true; console.log('MOJIBAKE',file); }
}
if (failed) process.exitCode = 1; else console.log('Frontend structural audit passed.');
