#!/bin/bash

# Script to install Chrome for Puppeteer on NAS
# Run this on your NAS server

echo "Installing Chrome for Puppeteer..."
cd /home/bill/automation/club-newsletter || exit 1

# Install Chrome
npx puppeteer browsers install chrome

echo ""
echo "Installation complete!"
echo "Chrome should now be available at: ~/.cache/puppeteer"
echo ""
echo "Verifying installation..."
ls -la ~/.cache/puppeteer

echo ""
echo "You can now test the automation with:"
echo "  cd /home/bill/automation/club-newsletter"
echo "  TEST_MODE=true TEST_DATE=2026-02-16 TEST_TYPE=Evening node automate.js"
