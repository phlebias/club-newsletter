
# Automating the Bridge Newsletter on your NAS

This guide explains how to schedule the newsletter for execution at 3:00 AM on Tue, Wed, Thu, and Fri, as requested.

## 1. Prerequisites (On the Device running the script)

- **Node.js**: The device running this script (your Mac or the NAS itself) must have Node.js installed.
- **Dependencies**: The `node_modules` folder inside the project must be fully installed (`npm install`).

## 2. Using your Mac to Run the Automation (Simplest)

If your Mac is always on or wakes for network access, you can run the script from your Mac targeting the NAS files.

### Step 1: Open Terminal and Type `crontab -e`
This opens the cron editor.

### Step 2: Add the Following Line
```bash
0 3 * * 2-5 /Users/billburrows/club-newsletter/run_newsletter_nas.sh
```

- `0 3`: Runs at 3:00 AM.
- `* *`: Every day of the month/year.
- `2-5`: Tue, Wed, Thu, Fri.
- The path points to the helper script created in your project directory.

## 3. Running Directly ON the NAS (Advanced)

If you want the NAS itself (e.g., Synology/QNAP) to run this independently of your Mac:

1. **SSH into your NAS**.
2. **Locate the Project**: The path will be different than `/Volumes/...`. For example, on Synology it might be `/volume1/personal_folder/ClawAI_bot/club-newsletter`.
3. **Verify Node**: ensure `node -v` works. Puppeteer (Web Scraper) might require additional libraries on some NAS OSs.
4. **Edit Cron**: On the NAS terminal, type `crontab -e` (or use the NAS's "Task Scheduler" UI).
5. **Add the Task**:
   - Schedule: Daily at 3:00 AM.
   - Script: `node /path/to/club-newsletter/automate.js` (Use the full absolute path on the NAS).

## 4. Updates Made

- The newsletter posting logic now uses the text:
  > "A Session report for the previous day is now available (except Monday Afternoon) Click to see the report"
- A **"Back / Close Report"** button has been added to the generated report to easily return to the underlying page.

## 5. Testing

To test right now without waiting for 3 AM:
1. Open Terminal.
2. Run: `./run_newsletter_nas.sh`
3. Check the `automation.log` file created in the same folder for results.
