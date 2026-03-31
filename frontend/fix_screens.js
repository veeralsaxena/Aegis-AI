const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src/components/screens');

if (!fs.existsSync(screensDir)) {
  console.log('Screens directory not found');
  process.exit(1);
}

const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.tsx'));

let count = 0;
files.forEach(file => {
  const filePath = path.join(screensDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // The background block is typically like:
  // <div className="fixed inset-0 z-0">
  //   ... (some inner divs)
  // </div>
  // Let's use a regex to match this exactly. Usually it's 4 lines long.
  // We can match everything from <div className="fixed inset-0 z-0... to the closing </div>
  
  const bgRegex = /<div className="fixed inset-0 z-0(?: [^"]*)?">[\s\S]*?<\/div>\s*<header/g;
  
  if (bgRegex.test(content)) {
    content = content.replace(bgRegex, '<header');
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${file}`);
    count++;
  } else {
    // Sometimes it might not be followed immediately by <header, let's be safe.
    const bgRegex2 = /<div className="fixed inset-0 z-0(?: [^"]*)?">[\s\S]*?<\/div>/g;
    const match = content.match(bgRegex2);
    if (match) {
        // Find if this is the background div (has mix-blend-screen etc)
        let replaced = false;
        content = content.replace(bgRegex2, (m) => {
            if (m.includes('mix-blend-screen') || m.includes('bg-cover bg-center') || m.includes('via-background-dark')) {
                replaced = true;
                return '';
            }
            return m; // keep if it's not the background one
        });
        
        if (replaced) {
            fs.writeFileSync(filePath, content);
            console.log(`Fixed via general regex: ${file}`);
            count++;
        }
    }
  }
});

console.log(`Fixed ${count} files.`);
