const fs = require('fs');
const path = require('path');
const HTMLtoJSX = require('htmltojsx');
const converter = new HTMLtoJSX({ createClass: false });

const inputDir = path.join(__dirname, 'stitch-screens');
const appDir = path.join(__dirname, 'src', 'app');

const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.html'));

const routeMapping = {
  // We matched these up via the text inside the HTML during our planning phase.
  'raw_healthhub_premium_login_3d83fe26e8d3494f935cd3dc9f2835f4.html': 'auth/login', // Profile overview ? Let's parse all dynamically
  // To avoid manual mapping, let's just create components per file and we can use them in pages.
};

const componentsDir = path.join(__dirname, 'src', 'components', 'screens');
if(!fs.existsSync(componentsDir)) fs.mkdirSync(componentsDir, {recursive: true});

files.forEach(file => {
  const content = fs.readFileSync(path.join(inputDir, file), 'utf-8');
  
  // Extract the contents of <body>
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return;
  
  let bodyContent = bodyMatch[1];
  
  // Convert basic HTML to JSX
  let jsxContent = converter.convert(bodyContent);
  
  // Minor fixups for SVG etc if needed. htmltojsx handles most class -> className
  
  const compName = 'Screen_' + file.replace('raw_', '').replace('.html', '');
  
  const componentCode = `
import React from 'react';

export default function ${compName}() {
  return (
    <>
      ${jsxContent}
    </>
  );
}
`;

  fs.writeFileSync(path.join(componentsDir, `${compName}.tsx`), componentCode);
  console.log(`Created component ${compName}`);
});
