#!/bin/bash

# Verification script for Chrome installation on NAS (Linux)
# Run this on your NAS to verify Chrome is properly installed

echo "=========================================="
echo "Chrome Installation Verification (NAS)"
echo "=========================================="
echo ""

# Check home directory
echo "1. Home Directory: $HOME"
echo ""

# Check if Puppeteer cache exists
echo "2. Checking Puppeteer cache directory..."
if [ -d "$HOME/.cache/puppeteer" ]; then
    echo "   ✅ Puppeteer cache exists"
    ls -la "$HOME/.cache/puppeteer/"
else
    echo "   ❌ Puppeteer cache NOT found at $HOME/.cache/puppeteer"
    echo "   Run: npx puppeteer browsers install chrome"
fi
echo ""

# Check for Chrome in cache
echo "3. Checking for Chrome in Puppeteer cache..."
if [ -d "$HOME/.cache/puppeteer/chrome" ]; then
    echo "   ✅ Chrome directory exists"
    echo "   Versions found:"
    ls -la "$HOME/.cache/puppeteer/chrome/"
    echo ""
    
    # Look for the chrome executable
    CHROME_EXEC=$(find "$HOME/.cache/puppeteer/chrome" -name "chrome" -type f 2>/dev/null | head -1)
    if [ -n "$CHROME_EXEC" ]; then
        echo "   ✅ Chrome executable found at: $CHROME_EXEC"
        echo "   Checking if executable..."
        if [ -x "$CHROME_EXEC" ]; then
            echo "   ✅ Chrome is executable"
        else
            echo "   ⚠️  Chrome exists but is not executable"
            echo "   Fix: chmod +x $CHROME_EXEC"
        fi
    else
        echo "   ❌ Chrome executable NOT found"
    fi
else
    echo "   ❌ Chrome NOT installed in Puppeteer cache"
fi
echo ""

# Check for system Chrome
echo "4. Checking for system Chrome installations..."
for path in /usr/bin/chromium-browser /usr/bin/chromium /usr/bin/google-chrome /snap/bin/chromium; do
    if [ -f "$path" ]; then
        echo "   ✅ Found: $path"
    fi
done
echo ""

# Check environment variable
echo "5. Checking CHROME_PATH environment variable..."
if [ -n "$CHROME_PATH" ]; then
    echo "   CHROME_PATH is set to: $CHROME_PATH"
    if [ -f "$CHROME_PATH" ]; then
        echo "   ✅ File exists"
    else
        echo "   ❌ File does NOT exist"
    fi
else
    echo "   (not set - this is OK)"
fi
echo ""

# Test with Node.js
echo "6. Testing Chrome launch with Puppeteer..."
cd /home/bill/automation/club-newsletter 2>/dev/null || cd "$(dirname "$0")"
node -e "
import('puppeteer').then(async (p) => {
  try {
    const browser = await p.default.launch({ headless: 'new' });
    console.log('   ✅ Chrome launched successfully!');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.log('   ❌ Failed to launch Chrome:', err.message);
    process.exit(1);
  }
});
" 2>&1
echo ""

echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "If Chrome is not installed, run:"
echo "  cd /home/bill/automation/club-newsletter"
echo "  npx puppeteer browsers install chrome"
