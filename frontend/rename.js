const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.json') || file.endsWith('.md')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walkDir(path.join(__dirname, 'src'));

let count = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/OmniCare AI/g, 'Aegis AI').replace(/Omnicare AI/g, 'Aegis AI');
  
  // also handle standard lowercase for internal references if needed
  newContent = newContent.replace(/omnicare-frontend/g, 'aegis-frontend');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log(`Updated names in: ${file}`);
    count++;
  }
});

console.log(`Renamed project in ${count} files.`);
