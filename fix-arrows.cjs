const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'renderer', 'App.tsx');

// Read file as UTF-8
let content = fs.readFileSync(filePath, 'utf8');

const original = content;
let count = 0;

// The broken arrows appear as: â†' (up), â†" (down), â†• (both)
// They are in single or double quotes

// Replace all occurrences - using a more flexible pattern
// Match: 'â†'' or "â†'"
content = content.split("'â†''").join('ICONS.ARROW_UP');
content = content.split('"â†'"').join('ICONS.ARROW_UP');
content = content.split("'â†"'").join('ICONS.ARROW_DOWN');
content = content.split('"â†""').join('ICONS.ARROW_DOWN');
content = content.split("'â†•'").join('ICONS.ARROW_BOTH');
content = content.split('"â†•"').join('ICONS.ARROW_BOTH');

// Count changes
for (let i = 0; i < original.length && i < content.length; i++) {
    if (original[i] !== content[i]) count++;
}

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log(`Replaced ${count} characters (modified content)`);
