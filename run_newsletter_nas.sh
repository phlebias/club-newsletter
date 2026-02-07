#!/bin/bash

# Define the project directory as the directory where this script resides
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navigate to the project directory
cd "$PROJECT_DIR" || exit 1

# Try to find node if not in PATH (common issue in cron)
if ! command -v node &> /dev/null; then
    # Try common locations
    if [ -f "/usr/local/bin/node" ]; then
        PATH=$PATH:/usr/local/bin
    elif [ -f "/usr/bin/node" ]; then
        PATH=$PATH:/usr/bin
    elif [ -f "/opt/homebrew/bin/node" ]; then
        PATH=$PATH:/opt/homebrew/bin
    fi
    # If still not found, try sourcing profile
    if [ -f ~/.bash_profile ]; then
        source ~/.bash_profile
    elif [ -f ~/.zshrc ]; then
        source ~/.zshrc
    elif [ -f ~/.profile ]; then
        source ~/.profile
    fi
fi

# Check if node is found now
if ! command -v node &> /dev/null; then
    echo "Error: 'node' command not found. Please ensure Node.js is installed and in the PATH." >> automation.log
    exit 1
fi

echo "Starting automation run at $(date) in $PROJECT_DIR" >> automation.log

# Ensure dependencies are installed (optional check)
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..." >> automation.log
    npm install >> automation.log 2>&1
fi

# Run the node script
export HEADLESS=true
node automate.js >> automation.log 2>&1

echo "Finished automation run at $(date)" >> automation.log
