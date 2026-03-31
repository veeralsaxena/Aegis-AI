const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src/components/screens');

const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.tsx'));

let count = 0;
files.forEach(file => {
  const filePath = path.join(screensDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // replace shiny shadows: shadow-[0_0_20px_rgba(37,192,244,0.4)]
  const shadowRegex = /shadow-\[[^\]]+rgba\([^\]]+\)\]/g;
  
  // Also fix "text-[rgba(...)]" glowing text if there is any, although user mentioned buttons
  if (shadowRegex.test(content)) {
    content = content.replace(shadowRegex, 'shadow-lg');
    fs.writeFileSync(filePath, content);
    console.log(`Replaced shiny shadows in: ${file}`);
    count++;
  }
});

console.log(`Fixed shadows in ${count} files.`);
