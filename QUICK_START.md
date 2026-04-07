# Newsletter Automation - Quick Reference

## 🎯 Quick Commands

### Simulated Test (No Posting)
```bash
# Test everything WITHOUT posting to website
TEST_MODE=true TEST_DATE=2026-02-16 TEST_TYPE=Evening node test-simulated.js
```

### Full Test (With Posting)
```bash
# Test everything INCLUDING posting to website
TEST_MODE=true TEST_DATE=2026-02-16 TEST_TYPE=Evening node automate.js
```

### Check Chrome Installation
```bash
# Verify Chrome is detected
ls -la ~/.cache/puppeteer/chrome/

# Test Chrome launch
node -e "import('puppeteer').then(p => p.default.launch().then(b => { console.log('✅ OK'); b.close(); }))"
```

---

## 📋 What Was Fixed (Feb 17, 2026)

**Problem**: Chrome detection only checked Linux paths, not Puppeteer cache  
**Solution**: Enhanced detection to check Puppeteer cache first, then system paths  
**Result**: ✅ Successfully tested with simulated run

---

## 🔍 Chrome Detection Order

1. `~/.cache/puppeteer/chrome/mac_arm-*/...` (Mac ARM)
2. `~/.cache/puppeteer/chrome/mac-*/...` (Mac x64)
3. `~/.cache/puppeteer/chrome/linux-*/...` (Linux)
4. Dynamic scan of all versions in cache
5. System Chrome paths (`/usr/bin/chromium`, etc.)
6. `$CHROME_PATH` environment variable

---

## 📅 Cron Schedule

Runs at **3:00 AM**:
- **Tuesday** → Monday Evening results
- **Wednesday** → Tuesday Afternoon results
- **Thursday** → Wednesday Evening results
- **Friday** → Thursday Afternoon results

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `automate.js` | Main automation script (scrapes + posts) |
| `test-simulated.js` | Test script (scrapes only, no posting) |
| `scraper.js` | BridgeWebs scraping logic |
| `src/poster.js` | Website posting logic |
| `src/generator.js` | Newsletter HTML generation |
| `reports/latest_simulated.html` | Last simulated test output |
| `automation.log` | Cron job logs |

---

## 🚨 Troubleshooting

### Chrome Not Found
```bash
# Install Chrome for Puppeteer
npx puppeteer browsers install chrome
```

### Check Logs
```bash
# View recent automation logs
tail -n 50 automation.log

# View debug screenshots
ls -la debug_*.png
```

### Test Date Format
```bash
# Date must be YYYY-MM-DD format
TEST_DATE=2026-02-16  # ✅ Correct
TEST_DATE=2/16/2026   # ❌ Wrong
```

---

## 📊 Test Output Example

```
============================================================
STEP 1: SCRAPING SESSION DATA
============================================================
Using Chrome at: ~/.cache/puppeteer/chrome/mac_arm-144.0.7559.96/...
✅ Successfully scraped session data
   Event: 16th February 2026 Monday Evening
   Rankings: 16 pairs
   Boards: 24 boards

============================================================
STEP 2: GENERATING NEWSLETTER HTML
============================================================
✅ Newsletter generated (10958 characters)

============================================================
STEP 3: SAVING TO FILE
============================================================
✅ Saved to: reports/newsletter_20260215_evening_SIMULATED.html

============================================================
STEP 4: SIMULATED POSTING (NOT ACTUALLY POSTING)
============================================================
🚫 SKIPPING ACTUAL POST TO WEBSITE (Simulated Mode)

✅ SIMULATION COMPLETE - ALL STEPS SUCCESSFUL
```

---

## 🔗 Related Documentation

- `CHROME_FIX_SUMMARY.md` - Detailed fix documentation
- `TROUBLESHOOTING.md` - Full troubleshooting guide
- `README.md` - Project overview
- `NAS_SETUP.md` - NAS deployment instructions
