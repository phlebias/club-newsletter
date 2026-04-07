# NAS Deployment Guide - Chrome Fix

## 🎯 Your Concern Addressed

**Your Question**: "I am concerned with the comment that a mac path is required for puppeteer. This program runs exclusively on my NAS"

**Answer**: ✅ **The fix fully supports your Linux NAS.** The Mac paths in the code are harmless - they're simply checked and skipped on Linux. The code includes **both** Mac and Linux paths for cross-platform compatibility, but only the Linux paths will be used on your NAS.

---

## 🐧 Linux/NAS Paths (What Actually Matters)

On your NAS, the code will check these paths **in order**:

1. ✅ `/home/bill/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome`
2. ✅ `/home/bill/.cache/puppeteer/chrome/*/chrome-linux64/chrome` (dynamic scan)
3. ✅ `/usr/bin/chromium-browser`
4. ✅ `/usr/bin/chromium`
5. ✅ `/usr/bin/google-chrome`
6. ✅ `/snap/bin/chromium`

Mac paths like `chrome-mac-arm64` are also in the code but will be **skipped** on Linux (no error, no problem).

---

## 📋 Deployment Steps

### Step 1: Deploy Files to NAS

**Option A: Use the deployment script**
```bash
# Edit deploy_to_nas.sh and set your NAS IP address
nano deploy_to_nas.sh  # Change "your-nas-ip" to actual IP

# Run deployment
bash deploy_to_nas.sh
```

**Option B: Manual rsync**
```bash
rsync -avz scraper.js src/poster.js test-simulated.js verify_chrome_nas.sh \
  bill@your-nas-ip:/home/bill/automation/club-newsletter/
```

**Option C: Manual copy via SSH**
```bash
scp scraper.js src/poster.js test-simulated.js verify_chrome_nas.sh \
  bill@your-nas-ip:/home/bill/automation/club-newsletter/
```

### Step 2: SSH into Your NAS

```bash
ssh bill@your-nas-ip
cd /home/bill/automation/club-newsletter
```

### Step 3: Install Chrome on NAS

```bash
# Install Chrome for Puppeteer (recommended)
npx puppeteer browsers install chrome

# This will install to:
# /home/bill/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome
```

### Step 4: Verify Installation

```bash
# Run verification script
bash verify_chrome_nas.sh

# Expected output:
# ✅ Puppeteer cache exists
# ✅ Chrome directory exists
# ✅ Chrome executable found
# ✅ Chrome is executable
# ✅ Chrome launched successfully!
```

### Step 5: Test the Fix

```bash
# Simulated test (no posting)
TEST_MODE=true TEST_DATE=2026-02-16 TEST_TYPE=Evening node test-simulated.js

# Expected output:
# Using Chrome at: /home/bill/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome
# ✅ Successfully scraped session data
# ✅ Newsletter generated
# ✅ SIMULATION COMPLETE
```

### Step 6: Monitor Next Cron Run

```bash
# Check logs after next 3:00 AM run
tail -f automation.log
```

---

## 🔍 Why Mac Paths Don't Affect Your NAS

The code uses `fs.existsSync(path)` to check each path:

```javascript
for (const path of possiblePaths) {
  try {
    if (fs.existsSync(path)) {  // Returns false for Mac paths on Linux
      executablePath = path;
      console.log(`Using Chrome at: ${path}`);
      break;
    }
  } catch (e) { /* ignore */ }
}
```

On your Linux NAS:
- Mac paths: `fs.existsSync()` returns `false` → skipped silently ✅
- Linux paths: `fs.existsSync()` returns `true` → used ✅

**No errors, no problems, just cross-platform compatibility.**

---

## 📊 What You'll See on Your NAS

### Before Fix (Current State)
```
[Auto] Fatal Error: Could not find Chrome (ver. 144.0.7559.96)
```

### After Fix (Expected)
```
Using Chrome at: /home/bill/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome
Navigating to home page...
✅ Successfully scraped session data
✅ Newsletter generated
✅ Posted to website successfully
```

---

## 🚨 Troubleshooting on NAS

### Chrome Not Found After Installation

```bash
# Check if Chrome was installed
ls -la ~/.cache/puppeteer/chrome/

# If empty, reinstall
npx puppeteer browsers install chrome
```

### Permission Issues

```bash
# Make Chrome executable
chmod +x ~/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome
```

### Still Not Working

```bash
# Check Node.js version (needs 18+)
node --version

# Check npm version
npm --version

# Reinstall dependencies
cd /home/bill/automation/club-newsletter
npm install
```

---

## ✅ Summary

1. **The fix works on Linux/NAS** - Mac paths are harmless
2. **Deploy the updated files** to your NAS
3. **Install Chrome** with `npx puppeteer browsers install chrome`
4. **Test with** `test-simulated.js`
5. **Monitor** the next cron run

The code is **NAS-ready** and **Linux-compatible**. The Mac paths are just for development convenience and don't interfere with your NAS operation.
