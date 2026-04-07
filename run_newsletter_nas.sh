#!/bin/bash

# Define the project directory as the directory where this script resides
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATUS_DIR="$PROJECT_DIR/status"
STATUS_FILE="$STATUS_DIR/cron_status.txt"
LAST_SUCCESS_FILE="$STATUS_DIR/last_success.txt"
LAST_FAILURE_FILE="$STATUS_DIR/last_failure.txt"
HEARTBEAT_FILE="$STATUS_DIR/last_heartbeat.txt"

# Navigate to the project directory
cd "$PROJECT_DIR" || exit 1

mkdir -p "$STATUS_DIR"

timestamp() {
    date "+%Y-%m-%d %H:%M:%S %Z"
}

write_status() {
    local status="$1"
    local detail="$2"
    {
        echo "status=$status"
        echo "timestamp=$(timestamp)"
        echo "project_dir=$PROJECT_DIR"
        echo "detail=$detail"
    } > "$STATUS_FILE"
}

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
    write_status "FAILED" "node command not found"
    cp "$STATUS_FILE" "$LAST_FAILURE_FILE"
    exit 1
fi

echo "heartbeat=$(timestamp)" > "$HEARTBEAT_FILE"
write_status "RUNNING" "cron wrapper started"
echo "Starting automation run at $(date) in $PROJECT_DIR" >> automation.log

# Ensure dependencies are installed (optional check)
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..." >> automation.log
    npm install >> automation.log 2>&1
fi

# Pre-load Puppeteer to avoid hang on slow file systems
echo "Pre-loading Puppeteer module..." >> automation.log
if ! node -e "import('puppeteer').then(() => console.log('Puppeteer loaded'))" >> automation.log 2>&1; then
    write_status "FAILED" "puppeteer preload failed"
    cp "$STATUS_FILE" "$LAST_FAILURE_FILE"
    echo "Finished automation run at $(date)" >> automation.log
    exit 1
fi

# Run the node script
if node automate.js >> automation.log 2>&1; then
    write_status "SUCCESS" "automation completed successfully"
    cp "$STATUS_FILE" "$LAST_SUCCESS_FILE"
else
    exit_code=$?
    write_status "FAILED" "automation exited with code $exit_code"
    cp "$STATUS_FILE" "$LAST_FAILURE_FILE"
    echo "Finished automation run at $(date)" >> automation.log
    exit "$exit_code"
fi

echo "Finished automation run at $(date)" >> automation.log
