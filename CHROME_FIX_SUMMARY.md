# Chrome Detection Fix - NAS/Linux Focus

## ✅ Important: This Fix Works on Your NAS (Linux)

The Chrome detection code includes **both Mac and Linux paths** for cross-platform compatibility, but **the Linux paths are what matter for your NAS**.

### Linux Paths Checked (Your NAS)

The code will check these paths **in order** on your NAS:

1. `/home/bill/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome` ✅
2. **Dynamic scan** of `/home/bill/.cache/puppeteer/chrome/*/chrome-linux64/chrome` ✅
3. `/usr/bin/chromium-browser` ✅
4. `/usr/bin/chromium` ✅
5. `/usr/bin/google-chrome` ✅
6. `/snap/bin/chromium` ✅
7. `$CHROME_PATH` (if set) ✅

The Mac paths (like `chrome-mac-arm64`) are also in the code but will simply be **skipped** on Linux since those directories don't exist. They don't cause any problems.

---

## 🔍 Problem on Your NAS

From your automation log (`/home/bill/automation/club-newsletter/automation.log`):

```
[Auto] Fatal Error: Could not find Chrome (ver. 144.0.7559.96). This can occur if either
 1. you did not perform an installation before running the script (e.g. `npx puppeteer browsers install chrome`) or
 2. your cache path is incorrectly configured (which is: /home/bill/.cache/puppeteer).
```

This means Chrome is **not installed** in `/home/bill/.cache/puppeteer/chrome/` on your NAS.

---

## ✅ Solution for Your NAS

### Option 1: Install Chrome via Puppeteer (Recommended)

SSH into your NAS and run:

```bash
ssh bill@your-nas-ip
cd /home/bill/automation/club-newsletter
npx puppeteer browsers install chrome
```

This will install Chrome to: `/home/bill/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome`

### Option 2: Use the Install Script

```bash
ssh bill@your-nas-ip
cd /home/bill/automation/club-newsletter
bash install_chrome.sh
```

### Option 3: Install System Chromium

```bash
# On Debian/Ubuntu-based NAS
sudo apt-get update
sudo apt-get install chromium-browser

# On other Linux distributions
sudo yum install chromium  # RHEL/CentOS
```

---

## 🧪 Verify Installation on Your NAS

After installing Chrome, run this verification script:

```bash
ssh bill@your-nas-ip
cd /home/bill/automation/club-newsletter
bash verify_chrome_nas.sh
```

This will:
- ✅ Check if Puppeteer cache exists
- ✅ Look for Chrome executable
- ✅ Verify Chrome is executable
- ✅ Test launching Chrome with Puppeteer

---

## 📝 Code Explanation (Why Mac Paths Don't Matter)

Here's what happens on your Linux NAS:

```javascript
const puppeteerCachePaths = [
  // Mac ARM - SKIPPED on Linux (directory doesn't exist)
  `${homeDir}/.cache/puppeteer/chrome/mac_arm-144.0.7559.96/...`,
  
  // Mac x64 - SKIPPED on Linux (directory doesn't exist)
  `${homeDir}/.cache/puppeteer/chrome/mac-144.0.7559.96/...`,
  
  // Linux - CHECKED on your NAS ✅
  `${homeDir}/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome`,
  
  // Dynamic scan - FINDS any Linux Chrome ✅
  ...(() => {
    const cacheDir = `${homeDir}/.cache/puppeteer/chrome`;
    if (fs.existsSync(cacheDir)) {
      const versions = fs.readdirSync(cacheDir);
      return versions.flatMap(version => [
        // Mac paths - skipped on Linux
        `${cacheDir}/${version}/chrome-mac-arm64/...`,
        `${cacheDir}/${version}/chrome-mac-x64/...`,
        // Linux path - CHECKED ✅
        `${cacheDir}/${version}/chrome-linux64/chrome`,
      ]);
    }
  })(),
];
```

The code uses `fs.existsSync(path)` to check each path. On Linux:
- Mac paths return `false` → skipped (no error)
- Linux paths return `true` → used ✅

---

## 🎯 Next Steps for Your NAS

1. **SSH into your NAS**:
   ```bash
   ssh bill@your-nas-ip
   ```

2. **Install Chrome**:
   ```bash
   cd /home/bill/automation/club-newsletter
   npx puppeteer browsers install chrome
   ```

3. **Verify installation**:
   ```bash
   bash verify_chrome_nas.sh
   ```

4. **Test the automation**:
   ```bash
   TEST_MODE=true TEST_DATE=2026-02-16 TEST_TYPE=Evening node automate.js
   ```

5. **Check the logs**:
   ```bash
   tail -n 50 automation.log
   ```

---

## 📊 Expected Output After Fix

When Chrome is properly installed on your NAS, you should see:

```
Using Chrome at: /home/bill/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome
Navigating to home page...
Extracting events from home page...
Found 24 events on home page
...
✅ Successfully scraped session data
```

---

## ❓ Why Include Mac Paths?

The code includes Mac paths because:
1. **Development**: You might test locally on your Mac before deploying to NAS
2. **Portability**: Same code works on both Mac and Linux
3. **No harm**: Non-existent paths are simply skipped on Linux

The fix is **100% compatible with your Linux NAS** - the Mac paths are just ignored.
