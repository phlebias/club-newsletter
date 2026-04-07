#!/bin/bash

# Deploy Automation to NAS
# Run this script to deploy relevant code and assets.

echo "=========================================="
echo "Deploying Automation to NAS"
echo "=========================================="
echo ""

# Configuration
NAS_USER="bill"
NAS_HOST="100.106.237.73"  # User's NAS IP address
NAS_PATH="automation/club-newsletter"

echo "Target: $NAS_USER@$NAS_HOST:$NAS_PATH"
echo ""

# Check if scp is available
if ! command -v scp &> /dev/null; then
    echo "❌ scp not found. Please install openssh-client."
    exit 1
fi

echo "Files to deploy:"
echo "  - package.json & lockfile"
echo "  - scraper.js, automate.js" 
echo "  - server.js"
echo "  - src/ directory"
echo "  - public/ directory"
echo "  - Helper scripts & Docs"
echo ""

read -p "Deploy these files to NAS? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "Deploying files via TAR over SSH..."

# Deploy updated files using tar pipe (most robust method)
tar czf - \
    package.json \
    package-lock.json \
    scraper.js \
    automate.js \
    server.js \
    src \
    public \
    test-simulated.js \
    verify_chrome_nas.sh \
    install_chrome.sh \
    CHROME_FIX_SUMMARY.md \
    TROUBLESHOOTING.md \
    QUICK_START.md \
    | ssh "$NAS_USER@$NAS_HOST" "mkdir -p ~/$NAS_PATH && cd ~/$NAS_PATH && tar xzf -"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Files deployed successfully!"
    echo ""
    echo "Next steps on your NAS:"
    echo ""
    echo "1. Verify installation (optional):"
    echo "   ssh $NAS_USER@$NAS_HOST"
    echo "   cd /home/bill/$NAS_PATH"
    echo "   ls -l public/audio/shuffle.mp3"
    echo ""
    echo "The automation script (automate.js) will now use the audio file."
else
    echo ""
    echo "❌ Deployment failed. Please check your NAS connection."
    exit 1
fi
