#!/bin/bash
# Quick Fix Script - Run this on your NAS to fix the Chrome issue

echo "========================================="
echo "Bridge Newsletter Cron Job - Quick Fix"
echo "========================================="
echo ""

# Navigate to project directory
cd /home/bill/automation/club-newsletter || {
    echo "❌ Error: Could not find project directory"
    exit 1
}

echo "📍 Current directory: $(pwd)"
echo ""

# Check if Chrome is already installed
if [ -d "$HOME/.cache/puppeteer" ] && [ "$(ls -A $HOME/.cache/puppeteer 2>/dev/null)" ]; then
    echo "✅ Puppeteer Chrome cache found at: $HOME/.cache/puppeteer"
    ls -la $HOME/.cache/puppeteer
    echo ""
else
    echo "⚠️  Puppeteer Chrome not found. Installing..."
    echo ""
    npx puppeteer browsers install chrome
    echo ""
    if [ $? -eq 0 ]; then
        echo "✅ Chrome installed successfully!"
    else
        echo "❌ Chrome installation failed"
        echo "Checking for system Chrome..."
    fi
fi

# Check for system Chrome
echo ""
echo "Checking for system Chrome installations:"
for path in /usr/bin/chromium-browser /usr/bin/chromium /usr/bin/google-chrome /snap/bin/chromium; do
    if [ -f "$path" ]; then
        echo "  ✅ Found: $path"
    fi
done

echo ""
echo "========================================="
echo "Testing the automation..."
echo "========================================="
echo ""

# Run a test
TEST_MODE=true TEST_DATE=2026-02-16 TEST_TYPE=Evening node automate.js 2>&1 | tail -n 20

echo ""
echo "========================================="
echo "Recent automation log:"
echo "========================================="
tail -n 15 automation.log

echo ""
echo "========================================="
echo "✅ Fix complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Review the test output above"
echo "2. If successful, the cron job will work tomorrow at 3:00 AM"
echo "3. Check automation.log after the next run"
echo ""
