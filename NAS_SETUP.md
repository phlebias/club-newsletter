# NAS Automation Setup Plan

This guide outlines how to set up the Bridge Newsletter automation on your NAS (Synology, QNAP, or generic Linux server).

## 1. Prerequisites
- **Node.js**: Ensure Node.js (v18+) is installed on your NAS.
- **Puppeteer Dependencies**: On many NAS systems, you'll need to install dependencies for Chromium (libnss3, libatk, etc.). If your NAS supports Docker, running this in a container is often easier.

## 2. Directory Setup
Choose a directory for the application and another for the generated reports.
- **App Directory**: `/volume1/docker/bridge-bot`
- **Report Directory**: `/volume1/web/bridge-reports` (adjust based on where your web server looks)

## 3. Configuration
The `automate.js` script looks for the following environment variables:
- `REPORT_DIR`: Where to save the generated `.html` files and `latest.html`.

## 4. Scheduling with Cron
The user wants to run this at **3:00 AM daily**.

Access your NAS via SSH or use the "Task Scheduler" (Synology) to add a user-defined script:

### Synology Task Scheduler
1. **Control Panel** -> **Task Scheduler**.
2. **Create** -> **Scheduled Task** -> **User-defined script**.
3. **General**: Task Name: "Bridge Newsletter", User: "root" or your admin user.
4. **Schedule**: Run on the following days: Daily, First run time: 03:00.
5. **Task Settings**: Use the following script:
   ```bash
   cd /volume1/docker/bridge-bot
   REPORT_DIR=/volume1/web/bridge-reports npm run automate >> /volume1/docker/bridge-bot/automation.log 2>&1
   ```

### Generic Linux (Crontab)
Run `crontab -e` and add:
```cron
0 3 * * * cd /path/to/bridge-bot && REPORT_DIR=/path/to/reports /usr/local/bin/npm run automate >> /path/to/automation.log 2>&1
```

## 5. Automatic Session Logic
The script handles the scheduling logic internally to avoid Monday afternoons:
- **Tuesday 3:00 AM**: Pulls Monday Evening results.
- **Wednesday 3:00 AM**: Pulls Tuesday Afternoon results.
- **Thursday 3:00 AM**: Pulls Wednesday Evening results.
- **Friday 3:00 AM**: Pulls Thursday Afternoon results.
- **Saturday/Sunday/Monday**: Skips automatically.

## 6. Website Deployment
To deploy to a club website:
- **Option A (Static Upload)**: Point your NAS web server to the `REPORT_DIR`. Link to `latest.html` from your main site.
- **Option B (Proxy)**: If you have an external site, use an FTP/SCP script in the cron task to upload `latest.html` after generation.

## 7. Troubleshooting
Check `automation.log` for any errors. Common issues:
- **DNS/Connection**: Ensure the NAS has internet access to reach BridgeWebs.
- **Puppeteer**: If Chromium fails to launch, try setting `PUPPETEER_EXECUTABLE_PATH` to your system's chromium.
