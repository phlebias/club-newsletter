#!/bin/bash

# Alternative fix: Update scraper.js to use system Chrome if Puppeteer Chrome is not available
# This script modifies the scraper to auto-detect Chrome

SCRAPER_FILE="/home/bill/automation/club-newsletter/scraper.js"

echo "Creating backup of scraper.js..."
cp "$SCRAPER_FILE" "${SCRAPER_FILE}.backup"

echo "Updating scraper.js to auto-detect Chrome..."

# Create a temporary Node script to find Chrome
cat > /tmp/update_scraper.js << 'EOF'
import fs from 'fs';

const scraperPath = '/home/bill/automation/club-newsletter/scraper.js';
let content = fs.readFileSync(scraperPath, 'utf8');

// Find the puppeteer.launch section and replace it
const oldLaunch = `const browser = await puppeteer.launch({
    headless: "new", // Set to false for visual debugging
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });`;

const newLaunch = `// Auto-detect Chrome executable
  let executablePath;
  const possiblePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
    process.env.CHROME_PATH
  ].filter(Boolean);

  for (const path of possiblePaths) {
    try {
      if (fs.existsSync(path)) {
        executablePath = path;
        console.log(\`Using Chrome at: \${path}\`);
        break;
      }
    } catch (e) { /* ignore */ }
  }

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath, // Will use Puppeteer's bundled Chrome if undefined
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });`;

content = content.replace(oldLaunch, newLaunch);

fs.writeFileSync(scraperPath, content);
console.log('Updated scraper.js successfully!');
EOF

node /tmp/update_scraper.js

echo "Done! The scraper will now try to use system Chrome if Puppeteer Chrome is not available."
echo "Backup saved to: ${SCRAPER_FILE}.backup"
