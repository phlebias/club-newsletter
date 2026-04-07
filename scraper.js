import puppeteer from "puppeteer";
import fs from "fs";
import os from "os";

const CLUB_ID = "liverpool";

export class NoResultsError extends Error {
  constructor(message, eventInfo = null) {
    super(message);
    this.name = 'NoResultsError';
    this.eventInfo = eventInfo;
  }
}

/**
 * Find the Chrome executable path for the current platform.
 * Uses Puppeteer's built-in detection first, then falls back to known locations.
 */
function findChromePath() {
  // Let Puppeteer auto-detect first (works when Chrome is installed via npx puppeteer browsers install)
  try {
    const detected = puppeteer.executablePath();
    if (detected && fs.existsSync(detected)) {
      console.log(`Using Chrome at: ${detected}`);
      return detected;
    }
  } catch (e) { /* fall through to manual detection */ }

  const platform = os.platform();
  const candidates = platform === 'darwin'
    ? [
        '/Users/billburrows/.puppeteer-cache/chrome/mac_arm-144.0.7559.96/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ]
    : [
        `${os.homedir()}/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome`,
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`Using Chrome at: ${p}`);
      return p;
    }
  }

  // Last resort: let Puppeteer try without an explicit path
  console.log('No Chrome found at known paths, letting Puppeteer auto-detect...');
  return undefined;
}

/**
 * Scrapes BridgeWebs for session data and returns a structured object for newsletter generation.
 * @param {string} dateOverride - Optional YYYYMMDD string.
 * @param {string} sessionType - Optional 'Afternoon' or 'Evening'.
 */
export async function getSessionData(dateOverride = null, sessionType = null) {
  const chromePath = findChromePath();
  const launchOptions = {
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
  if (chromePath) launchOptions.executablePath = chromePath;
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  // Helper to dump screenshots and HTML for debugging
  let step = 0;
  async function debugDump(label) {
    try {
      step++;
      const debugDir = "debug";
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const safeLabel = label.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const pngPath = `${debugDir}/debug_${step}_${safeLabel}.png`;
      const htmlPath = `${debugDir}/debug_${step}_${safeLabel}.html`;
      await page.screenshot({ path: pngPath, fullPage: true });
      const html = await page.content();
      fs.writeFileSync(htmlPath, html);
      console.log(`[DEBUG] Saved screenshot and HTML: ${pngPath}, ${htmlPath}`);
    } catch (err) {
      console.error('[DEBUG] Failed to write debug files:', err);
    }
  }

  try {
    console.log("Navigating to home page...");

    let navSuccess = false;
    for (let i = 0; i < 3; i++) {
      try {
        await page.goto(
          `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_home`,
          { waitUntil: "domcontentloaded", timeout: 60000 },
        );
        navSuccess = true;
        break;
      } catch (e) {
        console.log(`Navigation attempt ${i + 1} failed: ${e.message}. Retrying...`);
        if (i < 2) await new Promise(r => setTimeout(r, 3000));
        else throw e;
      }
    }
    await debugDump("home_page");
    await new Promise((r) => setTimeout(r, 2000));

    // 1. Identify the event from the home page results table
    console.log("Extracting events from home page...");
    let events = [];
    try {
      events = await page.evaluate(() => {
        const events = [];

        const tables = Array.from(document.querySelectorAll("table"));
        const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const resultsTable = tables.find((t) => {
          const text = (t.innerText || "").toLowerCase();
          return text.includes("results") && monthNames.some(m => text.includes(m));
        });

        if (!resultsTable) return [];

        // Look for rows with date and session information
        const rows = Array.from(resultsTable.querySelectorAll("tr"));
        let lastDate = null;

        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll("td"));
          if (cells.length === 0) return;

          const rowText = row.innerText.trim();

          // Look for date patterns like "29th January 2026" or "2nd February 2026"
          const dateMatch = rowText.match(
            /(\d+)(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
          );

          let dateStr = lastDate;
          let isMonday = false;

          if (dateMatch) {
            const day = dateMatch[1];
            const monthName = dateMatch[2];
            const year = dateMatch[3];

            // Convert month name to number
            const monthNames = [
              "january", "february", "march", "april", "may", "june",
              "july", "august", "september", "october", "november", "december",
            ];
            const monthNum = (monthNames.indexOf(monthName.toLowerCase()) + 1)
              .toString()
              .padStart(2, "0");
            const dayNum = day.padStart(2, "0");
            dateStr = `${year}${monthNum}${dayNum}`;
            lastDate = dateStr;

            const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, parseInt(day));
            isMonday = dateObj.getDay() === 1;
          } else if (lastDate) {
            // Check if this row is a "sticky" continuation row (common on BridgeWebs for multiple sessions)
            // It should be close to the previous date row and contain links
            const hasLinks = row.querySelector('a[href], [onclick]');
            if (!hasLinks) return;

            // Re-calculate isMonday for the sticky date
            const year = lastDate.substring(0, 4);
            const month = lastDate.substring(4, 6);
            const day = lastDate.substring(6, 8);
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            isMonday = dateObj.getDay() === 1;
          }

          if (!dateStr) return;

          // Extract session type (Afternoon/Evening)
          let sessionType = null;
          const lowerText = rowText.toLowerCase();
          if (lowerText.includes("afternoon") || lowerText.includes("aft")) {
            sessionType = "Afternoon";
          } else if (lowerText.includes("evening") || lowerText.includes("eve")) {
            sessionType = "Evening";
          } else {
            // Heuristic labels
            const boldText = (row.querySelector("strong")?.innerText || row.querySelector("b")?.innerText || "").toLowerCase();
            if (boldText.includes("evening") || boldText.includes("eve")) sessionType = "Evening";
            else if (boldText.includes("afternoon") || boldText.includes("aft")) sessionType = "Afternoon";
          }

          // RULE: Monday Afternoon is never analyzed
          // On Monday, if it's not explicitly Evening, we treat it as Afternoon (or ambiguous) 
          // and exclude it if we want to be safe.
          if (isMonday && (sessionType === "Afternoon" || (sessionType === null && !lowerText.includes("evening")))) {
            // console.log(`[Scraper] Ignoring likely Monday Afternoon session on ${dateStr}`);
            return;
          }

          // Look for clickable links in this row
          const links = Array.from(row.querySelectorAll("a[href]"));
          let eventId = null;
          let eventLink = null;

          // First, try to find a link that looks like it goes to results/travellers
          for (const link of links) {
            const href = link.getAttribute("href") || "";
            const linkText = (link.innerText || "").toLowerCase();

            // Look for links to results, rankings, or travellers
            if (
              href.includes("display_rank") ||
              href.includes("display_trav") ||
              href.includes("travellers") ||
              linkText.includes("results") ||
              linkText.includes("traveller")
            ) {
              // Extract event ID from href
              const eventMatch = href.match(/event=([^&]+)/);
              if (eventMatch) {
                eventId = eventMatch[1];
                eventLink = href.startsWith("http")
                  ? href
                  : href.startsWith("/")
                    ? `https://www.bridgewebs.com${href}`
                    : `https://www.bridgewebs.com/cgi-bin/bwor/${href}`;
                break;
              }
            }
          }

          // Also check for onclick handlers that might navigate
          if (!eventId) {
            const clickable = row.querySelector("[onclick]");
            if (clickable) {
              const onclick = clickable.getAttribute("onclick") || "";
              const eventMatch = onclick.match(/eventLink\s*\(\s*'([^']+)'/);
              if (eventMatch) {
                eventId = eventMatch[1];
              }
            }
          }

          // If still no event ID, try clicking the row to see where it goes
          // (We'll do this in a separate step)

          if (eventId || dateStr) {
            events.push({
              eventId: eventId || `${dateStr}_1`, // Fallback if no event ID found
              text: rowText,
              date: dateStr,
              sessionType: sessionType,
              link: eventLink,
            });
          }
        });

        return events;
      });
    } catch (err) {
      console.error("[DEBUG] Failed to extract events:", err);
      await debugDump("extract_events_error");
      throw err;
    }
    if (!events || events.length === 0) {
      await debugDump("no_events_found");
      throw new NoResultsError(
        "No recently completed sessions found on the club home page.",
      );
    }

    console.log(`Found ${events.length} events on home page`);

    if (events.length === 0) {
      throw new NoResultsError("No events found on home page");
    }

    // Select the appropriate event and click on it to get the actual event ID
    let selectedEvent = null;
    if (dateOverride) {
      // Find by date (YYYYMMDD format)
      const matchingEvents = events.filter(
        (e) => e.date === dateOverride || e.eventId.startsWith(dateOverride),
      );
      console.log(
        `Found ${matchingEvents.length} events matching date ${dateOverride}`,
      );

      if (sessionType && matchingEvents.length > 0) {
        selectedEvent = matchingEvents.find(
          (e) => e.sessionType === sessionType,
        );
        console.log(
          `Looking for ${sessionType} session, found: ${selectedEvent ? selectedEvent.text : "none"}`,
        );
      }

      if (!selectedEvent && matchingEvents.length > 0) {
        // Only fallback to first matching event if NO session type was requested
        // If they asked for Evening and we only have Afternoon (for example),
        // we should probably NOT just give them the Afternoon one.
        if (!sessionType) {
          selectedEvent = matchingEvents[0];
          console.log(`Using first matching event: ${selectedEvent.text}`);
        } else {
          console.log(`No ${sessionType} session found for ${dateOverride}.`);
        }
      }
    }

    // Default: latest completed session
    if (!selectedEvent) {
      selectedEvent = events[0];
    }

    if (!selectedEvent) {
      throw new Error("Could not select an event");
    }

    console.log(
      `Selected Event: ${selectedEvent.text} (${selectedEvent.eventId})`,
    );

    // If we're using fallback date and didn't find a real Event ID yet,
    // or if we're in admin mode and the event might be older,
    // we should try display_past if needed.
    // However, the current code tries home page first.
    // Let's add a check here to go to display_past if dateOverride is set but no event found on home page.
    let foundInArchive = false;
    if (dateOverride && !events.some(e => e.date === dateOverride)) {
      console.log(`Date ${dateOverride} not found on home page. Trying Results Archive (display_past)...`);

      const tryExtractFromArchive = async () => {
        return await page.evaluate((clubId) => {
          const events = [];
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const rows = Array.from(document.querySelectorAll("tr"));
          let currentMonth = null;
          let currentYear = null;
          let lastDateStr = null;

          rows.forEach(row => {
            const text = row.innerText.trim();

            // Check for month header like "January 2026"
            const monthHeaderMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
            if (monthHeaderMatch) {
              currentMonth = monthHeaderMatch[1];
              currentYear = monthHeaderMatch[2];
              return;
            }

            // Check for date row like "22 Thu" or "22nd Jan"
            const dateMatch = text.match(/^(\d+)(?:st|nd|rd|th)?\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?/i);

            let dateStr = lastDateStr;
            let day = null;

            if (dateMatch && currentMonth && currentYear) {
              day = dateMatch[1].padStart(2, '0');
              const monthNum = (monthNames.findIndex(m => m.toLowerCase() === currentMonth.toLowerCase()) + 1).toString().padStart(2, '0');
              dateStr = `${currentYear}${monthNum}${day}`;
              lastDateStr = dateStr;
            } else if (lastDateStr) {
              // Continuation row
              dateStr = lastDateStr;
              const year = dateStr.substring(0, 4);
              const month = dateStr.substring(4, 6);
              day = dateStr.substring(6, 8);
            }

            // Check if the row has an onclick with an event ID that contains the date
            // e.g. eventLink('20260128_2',...)
            const clickable = row.querySelector("[onclick]");
            if (clickable) {
              const onclick = clickable.getAttribute("onclick") || "";
              const m = onclick.match(/eventLink\s*\(\s*'(\d{8})_\d+'/);
              if (m) {
                // This is a robust source of date: YYYYMMDD
                dateStr = m[1];
                lastDateStr = dateStr;
              }
            }

            if (dateStr) {
              const clickable = row.querySelector("[onclick]");
              let eventId = null;
              let eventLink = null;

              if (clickable) {
                const onclick = clickable.getAttribute("onclick") || "";
                const m = onclick.match(/eventLink\s*\(\s*'([^']+)'/);
                if (m) {
                  eventId = m[1];
                  eventLink = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${clubId}&pid=display_rank&event=${eventId}`;
                }
              }

              // Fallback to searching all links if no onclick found
              if (!eventId) {
                const links = Array.from(row.querySelectorAll("a[href]"));
                for (const link of links) {
                  const href = link.getAttribute("href");
                  if (href.includes('event=')) {
                    const m = href.match(/event=([^&]+)/);
                    if (m) {
                      eventId = m[1];
                      eventLink = href.startsWith("http") ? href :
                        href.startsWith("/") ? `https://www.bridgewebs.com${href}` :
                          `https://www.bridgewebs.com/cgi-bin/bwor/${href}`;
                      break;
                    }
                  }
                }
              }

              // Calculate day of week for archive filter
              const monthNum = dateStr.substring(4, 6);
              const yearNum = dateStr.substring(0, 4);
              const dayNum = dateStr.substring(6, 8);
              const dateObj = new Date(parseInt(yearNum), parseInt(monthNum) - 1, parseInt(dayNum));
              const isMonday = dateObj.getDay() === 1;
              const lowerText = text.toLowerCase();

              // RULE: Monday Afternoon is banned
              if (isMonday && (lowerText.includes("afternoon") || (!lowerText.includes("evening") && !lowerText.includes("eve")))) {
                // Skip Monday Afternoon or ambiguous Monday sessions
                return;
              }

              if (dateStr || eventId) {
                events.push({
                  date: dateStr,
                  eventId: eventId,
                  text: text,
                  link: eventLink
                });
              }
            }
          });
          return events;
        }, CLUB_ID);
      };

      await page.goto(`https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_past`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 2000));

      let pastEvents = await tryExtractFromArchive();
      let match = pastEvents.find(e => e.date === dateOverride);

      if (!match) {
        console.log("Checking second page of archive...");
        const nextLink = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const next = links.find(l => l.innerText.includes('Next Page') || l.innerText.includes('»'));
          return next ? next.href : null;
        });

        if (nextLink) {
          await page.goto(nextLink, { waitUntil: 'domcontentloaded' });
          await new Promise(r => setTimeout(r, 2000));
          pastEvents = await tryExtractFromArchive();
          match = pastEvents.find(e => e.date === dateOverride);
        }
      }

      if (match) {
        console.log(`Found matching event in archive: ${match.text}`);
        selectedEvent = match;
        foundInArchive = true;
      } else {
        console.log(`Date ${dateOverride} still not found in archive.`);
      }
    }

    // Click on the event row to navigate to it and get the actual event ID
    // Skip this if we already have the event from the archive
    // Navigate to the correct page and ensure we have an event ID
    let actualEventId = null;
    if (foundInArchive && selectedEvent.link) {
      console.log(`Navigating to archive event link: ${selectedEvent.link}`);
      await page.goto(selectedEvent.link, { waitUntil: "domcontentloaded", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2000));
    } else if (!foundInArchive) {
      actualEventId = await page.evaluate(
        (targetDate, targetSessionType) => {
          const tables = Array.from(document.querySelectorAll("table"));
          const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
          const resultsTable = tables.find((t) => {
            const text = (t.innerText || t.textContent || "").toLowerCase();
            return text.includes("results") && monthNames.some(m => text.includes(m));
          });

          if (!resultsTable) return null;

          const rows = Array.from(resultsTable.querySelectorAll("tr"));
          let lastDate = null;

          for (const row of rows) {
            const rowText = (row.innerText || row.textContent || "").trim();
            const dateMatch = rowText.match(
              /(\d+)(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
            );

            let dateStr = lastDate;

            if (dateMatch) {
              const day = dateMatch[1].padStart(2, "0");
              const monthName = dateMatch[2];
              const year = dateMatch[3];
              const monthNames = [
                "january", "february", "march", "april", "may", "june",
                "july", "august", "september", "october", "november", "december"
              ];
              const monthNum = (monthNames.indexOf(monthName.toLowerCase()) + 1)
                .toString()
                .padStart(2, "0");
              dateStr = `${year}${monthNum}${day}`;
              lastDate = dateStr;
            }

            if (dateStr === targetDate) {
              const sessionType = rowText.includes("Afternoon")
                ? "Afternoon"
                : rowText.includes("Evening")
                  ? "Evening"
                  : null;

              if (targetSessionType && sessionType !== targetSessionType)
                continue;

              // Try to click on a link in this row
              const link = row.querySelector("a[href]");
              if (link) {
                const href = link.getAttribute("href");
                const eventMatch = href.match(/event=([^&]+)/);
                if (eventMatch) {
                  return eventMatch[1];
                }
                link.click();
                return "clicked";
              }

              if (row.onclick || row.querySelector("[onclick]")) {
                const clickable = row.querySelector("[onclick]") || row;
                clickable.click();
                return "clicked";
              }
            }
          }
          return null;
        },
        dateOverride || selectedEvent.date,
        sessionType,
      );

      if (actualEventId === "clicked") {
        console.log("Clicked event, waiting for navigation...");
        try {
          await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 });
        } catch (err) {
          console.log(`Navigation wait timed out: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 2000));
      } else if (actualEventId) {
        selectedEvent.eventId = actualEventId;
      }
    }

    // Ensure we are on the rankings page and have an eventId
    if (!selectedEvent.eventId) {
      console.log("Attempting to extract eventId from current URL...");
      selectedEvent.eventId = await page.evaluate(() => {
        const match = window.location.href.match(/event=([^&]+)/);
        return match ? match[1] : null;
      });
    }

    const rankUrl = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_rank&event=${selectedEvent.eventId}`;
    console.log(`Scraping rankings from: ${rankUrl}`);
    await page.goto(rankUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await debugDump("rankings_page");
    await new Promise((r) => setTimeout(r, 1500));

    // (Ranking extraction postponed to Step 3.5 after Classic Switch check)

    // 2.5. ENSURE CLASSIC EDITION & TABS
    console.log("=== Proceeding with detailed data extraction ===");
    console.log(`Current Event Context: ${selectedEvent.text} (${selectedEvent.eventId})`);

    // We are already on the rankings page for the correct event from line 448.
    // However, we'll ensure we haven't drifted.
    if (!page.url().includes(`event=${selectedEvent.eventId}`)) {
      const resultsUrl = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_rank&event=${selectedEvent.eventId}`;
      await page.goto(resultsUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Step 3: Check if we need to switch to classic edition (top right button)
    console.log("Step 3: Checking for classic edition switch...");
    await new Promise(r => setTimeout(r, 2000)); // Wait for stability

    const classicSwitchResult = await page.evaluate(() => {
      // Look for a button in the top right that might switch to classic view
      const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], span, div'));

      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        const text = (btn.innerText || btn.value || "").toLowerCase();

        // Button should be in top right area (top 150px, right 300px)
        // Button should be in top right area (top 150px, right 300px)
        if (rect.top < 150 && rect.right > window.innerWidth - 300) {
          if ((text.includes("classic") && text.includes("switch")) ||
            text === "classic edition" ||
            text === "switch to classic") {
            // Verify it doesn't say "Switch to 2022" (which means we are already in classic)
            if (!text.includes("2022") && !text.includes("modern")) {
              btn.click();
              return { success: true, text: btn.innerText || btn.value };
            }
          }
        }
      }

      // Also check for any element with text "Switch to Classic Edition" anywhere on page
      const allElements = Array.from(document.querySelectorAll("*"));
      for (const el of allElements) {
        const text = (el.innerText || "").trim().toLowerCase();
        if (text === "switch to classic edition" || text === "classic edition") {
          if (el.onclick || el.tagName === "A" || el.tagName === "BUTTON") {
            el.click();
            return { success: true, text: el.innerText };
          }
        }
      }

      return { success: false, reason: "No classic edition switch found" };
    });

    console.log(`Classic switch result: ${JSON.stringify(classicSwitchResult)}`);

    if (classicSwitchResult.success) {
      console.log("Switched to classic edition, waiting for reload...");
      await page
        .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 })
        .catch(() => { });
      await debugDump("after_classic_switch");
      await new Promise((r) => setTimeout(r, 2000));
    }
    // Move ranking extraction here, AFTER ensuring Classic Edition
    console.log("Step 3.5: Extracting rankings (post-Classic check)...");

    let rankings = [];
    try {
      rankings = await page.evaluate(() => {
        const rankings = [];
        // Find all tables that look like result tables
        const tables = Array.from(document.querySelectorAll("table"));

        // Filter tables that are likely main results (not sidebars)
        const potentialTables = tables.filter((t, index) => {
          const text = (t.innerText || t.textContent || "");
          const rows = Array.from(t.rows);

          // CRITICAL: Exclude control/options tables
          if (text.includes("Results Options") || text.includes("Switch to") || text.includes("Print Rows") || text.includes("Show Names in Travellers")) {
            // console.log(`[TABLE DEBUG] Table ${index} REJECTED: Control/Options table`);
            return false;
          }

          if (rows.length < 3) {
            // console.log(`[TABLE DEBUG] Table ${index} REJECTED: Not enough rows (${rows.length})`);
            return false;
          }

          // Check for header row
          const headerRow = rows.slice(0, 3).find(r => {
            const html = r.innerHTML.toLowerCase();
            return (html.includes("pos") || html.includes("rank")) &&
              (html.includes("player") || html.includes("names") || html.includes("pair")) &&
              (html.includes("score") || html.includes("%"));
          });

          if (!headerRow) {
            // console.log(`[TABLE DEBUG] Table ${index} REJECTED: No valid header row found.`);
            return false;
          }

          console.log(`[TABLE DEBUG] Table ${index} ACCEPTED: Rows=${rows.length}`);
          return true;
        });

        // Sort by row count descending
        potentialTables.sort((a, b) => b.rows.length - a.rows.length);

        console.log(`Potential ranking tables found (strict): ${potentialTables.length}`);

        // Allow up to 2 tables to cover Mitchell movements (NS and EW)
        const activeTables = potentialTables.slice(0, 2);

        activeTables.forEach((resultsTable, tIdx) => {
          // Identify section/direction if possible (e.g. "North/South" header above table)
          let direction = "";
          const prevElement = resultsTable.previousElementSibling;
          if (prevElement && (prevElement.innerText.includes("North") || prevElement.innerText.includes("NS"))) direction = "NS";
          else if (prevElement && (prevElement.innerText.includes("East") || prevElement.innerText.includes("EW"))) direction = "EW";

          const rows = Array.from(resultsTable.querySelectorAll("tr"));
          console.log(`[RANKING DEBUG] Table ${tIdx} (${direction}) has ${rows.length} rows`);
          if (rows.length < 2) return;

          // Detect column indices from the first row that has headers
          let noCol = -1;
          let playersCol = -1;
          let posCol = -1;
          let scoreCol = -1;

          let currentDirection = direction || (activeTables.length > 2 ? "Combined" : (activeTables.length === 2 ? (tIdx === 0 ? "NS" : "EW") : "Combined"));

          // Pre-scan for headers to set columns
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll("td, th"));
            const texts = cells.map(c => (c.innerText || "").trim().toLowerCase());

            if (texts.some(t => t.includes("player") || t.includes("names"))) {
              if (noCol === -1) {
                noCol = texts.findIndex(t => t === "no" || t === "pair" || t === "no.");
                playersCol = texts.findIndex(t => t.includes("player") || t.includes("names"));
                posCol = texts.findIndex(t => t.includes("pos") || t === "rank");
                scoreCol = texts.findIndex(t => t.includes("score") || t.includes("%"));
              }
            }
          }

          // Fallback if header not found clearly
          if (playersCol === -1) playersCol = 2;
          if (noCol === -1) noCol = 1;
          if (posCol === -1) posCol = 0;
          if (scoreCol === -1) scoreCol = 4;

          rows.forEach((r, rIdx) => {
            const rowText = (r.innerText || "").trim().toLowerCase();

            // Check for in-table section headers (e.g. "North / South")
            if (rowText.includes("north") && rowText.includes("south")) {
              currentDirection = "NS";
              return; // Skip header row
            }
            if (rowText.includes("east") && rowText.includes("west") && rowText.length < 50) {
              currentDirection = "EW";
              return; // Skip header row
            }

            const cells = Array.from(r.querySelectorAll("td"));
            if (cells.length < 4) return;

            const noText = (cells[noCol]?.innerText || "").trim();
            if (!noText.match(/\d/)) return;
            const pairNo = noText.match(/(\d+)/)?.[1] || noText;
            const players = (cells[playersCol]?.innerText || "").trim();
            if (!players || players.toLowerCase().includes("players")) return;

            rankings.push({
              pos: (cells[posCol]?.innerText || "").trim(),
              no: pairNo,
              fullNo: noText,
              players: players,
              score: (cells[scoreCol]?.innerText || "").trim(),
              matchPoints: cells[3]?.innerText.trim() || "",
              direction: currentDirection,

            });
          });
        });

        return rankings;
      });
    } catch (err) {
      console.error("[DEBUG] Failed to extract rankings:", err);
      await debugDump("extract_rankings_error");
      throw err;
    }
    if (!rankings || rankings.length === 0) {
      // It's possible we are on a page that doesn't show rankings directly?
      // But we will proceed to Travellers which is the main source anyway.
      // However, we need player names map.
      console.log("Warning: No rankings found in Step 3.5.");
    } else {
      console.log(`Found ${rankings.length} pairs in rankings (Step 3.5)`);
    }

    // Step 4: Access the Travellers tab FIRST (MAIN SOURCE FOR COMPREHENSIVE DATA)
    console.log("Step 4: Looking for Travellers tab...");
    let travellerDataExtracted = false;

    const travellersTabResult = await page.evaluate(() => {
      // BridgeWebs uses div elements with specific classes for tabs
      const allDivs = Array.from(document.querySelectorAll('div.button_href_middle, div.button_href_left, div.button_href_right'));

      for (const div of allDivs) {
        const text = (div.innerText || div.textContent || "").trim().toLowerCase();
        if (text === "travellers" || text === "traveller") {
          console.log("Found Travellers tab div, clicking...");
          div.click();
          return { success: true, type: "clicked" };
        }
      }

      // Fallback: look for other clickable elements
      const allElements = Array.from(document.querySelectorAll("a, button, div, span, td, th"));

      for (const el of allElements) {
        const text = (el.innerText || el.textContent || "").trim().toLowerCase();

        // Look for "Travellers" tab
        if (text === "travellers" || text === "traveller") {
          // Check if it's clickable
          if (el.tagName === "A" && el.href) {
            return { success: true, type: "link", href: el.href };
          } else if (el.onclick || el.tagName === "BUTTON") {
            el.click();
            return { success: true, type: "clicked" };
          }
        }
      }

      return { success: false, reason: "No Travellers tab found" };
    });

    console.log(`Travellers tab result: ${JSON.stringify(travellersTabResult)}`);

    if (travellersTabResult.success) {
      if (travellersTabResult.type === "link") {
        console.log(`Navigating to Travellers tab: ${travellersTabResult.href}`);
        await page.goto(travellersTabResult.href, { waitUntil: "domcontentloaded", timeout: 60000 });
        try {
          await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => { });
        } catch (e) { /* ignore */ }

        await debugDump("travellers_tab");
        await new Promise((r) => setTimeout(r, 2000));
      } else if (travellersTabResult.type === "clicked") {
        console.log("Clicked Travellers tab, waiting for content to load...");

        // Wait for traveller content to appear (Ajax load)
        try {
          await page.waitForFunction(() => {
            const bodyText = document.body.innerText;
            return bodyText.includes("Board") || bodyText.includes("Bd") || document.querySelectorAll('table.traveller').length > 0;
          }, { timeout: 10000 });
          console.log("Traveller content detected on page.");
        } catch (e) {
          console.log("Timeout waiting for traveller content, but proceeding anyway...");
        }

        await debugDump("travellers_tab_checked");
      }

      travellerDataExtracted = true;

      // Skip scorecard extraction - we're on Travellers page now which has all the data we need
      console.log("Travellers tab loaded, proceeding directly to traveller data extraction...");

      // Skip to Step 5 - traveller parsing
      // (All the scorecard extraction code below will be skipped)
    } else {
      console.log("Could not find/click Travellers tab");
    }

    // Initialize scorecardsData (will remain empty since we're using Travellers data)
    let scorecardsData = [];

    // Only run scorecard extraction if we didn't click Travellers
    if (!travellerDataExtracted) {

      scorecardsData = await page.evaluate(() => {
        const results = [];
        const tables = Array.from(document.querySelectorAll("table"));
        console.log(`Found ${tables.length} tables on Scorecards page`);

        // Find the table that looks like a scorecard
        for (const [i, t] of tables.entries()) {
          const rows = Array.from(t.querySelectorAll("tr"));
          if (rows.length < 2) continue;

          const headerRow = rows[0];
          const headerCells = Array.from(headerRow.querySelectorAll("td, th"));
          const headerTexts = headerCells.map((c) => (c.innerText || "").trim().toLowerCase());

          console.log(`Table ${i} headers: ${headerTexts.join(", ")}`);

          // Check if this looks like a scorecard table - relaxed checks
          const hasContract = headerTexts.some((h) => h.includes("contr") || h.includes("bid"));
          const hasBy = headerTexts.some((h) => h.includes("by") || h.includes("decl") || h.includes("play"));
          const hasLead = headerTexts.some((h) => h.includes("lead") || h.includes("card") || h.includes("ld")); // Added 'card'
          const hasScore = headerTexts.some((h) => h.includes("score") || h.includes("pts") || h.includes("point"));

          // If we have at least Contract and (Lead OR By OR Score), it's probably the right table
          // Often Lead is missing or named differently, so don't make it strictly mandatory for detection,
          // but try to find it.
          if (hasContract && (hasBy || hasLead || hasScore)) {
            console.log(`[SCORECARD DEBUG] Found potential scorecard table ${i}`);
            console.log(`[SCORECARD DEBUG] Headers: ${headerTexts.join(' | ')}`);
            console.log(`[SCORECARD DEBUG] Row count: ${rows.length}`);

            // This looks like a scorecard table - find column indices
            const boardCol = headerTexts.findIndex((h) => h.includes("board") || h.includes("bd") || h === "no");
            const contractCol = headerTexts.findIndex((h) => h.includes("contract") || h.includes("bid"));
            const declarerCol = headerTexts.findIndex((h) => h.includes("by") || h.includes("declarer") || h.includes("decl"));
            const leadCol = headerTexts.findIndex((h) => h.includes("lead") || h.includes("card") || h.includes("ld"));
            const tricksCol = headerTexts.findIndex((h) => h.includes("trick") || h.includes("made") || h.includes("result"));

            // Score columns: look for specific score headers first, then +/-
            let scoreCol = headerTexts.findIndex((h) => h.match(/^score$/) || h.includes("points") && !h.includes("match"));
            let plusCol = -1;
            let minusCol = -1;

            if (scoreCol === -1) {
              plusCol = headerTexts.findIndex(h => h === '+' || h.includes('plus'));
              minusCol = headerTexts.findIndex(h => h === '-' || h.includes('minus'));
            }

            // MP/Pts column (Avoid using this as bridge score)
            const mpCol = headerTexts.findIndex((h) => h.includes("pts") || h.includes("match") || h === "%");

            const nsCol = headerTexts.findIndex((h) => h.includes("ns") || h === "n/s" || h.includes("pair"));
            const ewCol = headerTexts.findIndex((h) => h.includes("ew") || h === "e/w");

            console.log(`Found scorecard table with columns: board=${boardCol}, contr=${contractCol}, decl=${declarerCol}, +=${plusCol}, -=${minusCol}, score=${scoreCol}`);

            // Extract data rows
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const cells = Array.from(row.querySelectorAll("td"));
              if (cells.length < 3) continue; // Skip separator rows

              // Helper to safely get cleaned text
              const getText = (idx) => {
                if (idx >= 0 && cells[idx]) {
                  return cells[idx].innerText.replace(/\s+/g, ' ').trim().slice(0, 50);
                }
                return "";
              };

              let scoreVal = getText(scoreCol);
              if (!scoreVal && (plusCol !== -1 || minusCol !== -1)) {
                const pVal = getText(plusCol).replace(/[^\d]/g, '');
                const mVal = getText(minusCol).replace(/[^\d]/g, '');
                if (pVal) scoreVal = pVal;
                else if (mVal) scoreVal = `-${mVal}`;
              }

              // Strict Board Number Extraction
              let rawBoard = getText(boardCol);
              let boardNum = "";
              const bMatch = rawBoard.match(/(\d+)/);
              if (bMatch) boardNum = bMatch[1];

              let contract = getText(contractCol);
              // Filter out header repetitions or garbage
              if (contract.toLowerCase().includes("contract") || contract.toLowerCase().includes("bid")) continue;

              // Extract just the contract portion (e.g., "3NT" from longer text)
              // Look for pattern: digit + suit/NT
              const contractMatch = contract.match(/([1-7])([NSHCD]T?|NT)/i);
              if (contractMatch) {
                contract = contractMatch[0]; // e.g., "3NT", "4S"
              } else if (/PASS/i.test(contract)) {
                contract = "PASS";
              }

              const result = {
                board: boardNum,
                contract: contract,
                declarer: getText(declarerCol),
                lead: getText(leadCol),
                tricks: getText(tricksCol),
                score: scoreVal,
                ns: getText(nsCol),
                ew: getText(ewCol),
              };

              // Valid contract check: Must match contract pattern or be PASS
              const validContract = /^([1-7][NSHCD]T?|[1-7]NT|PASS)$/i.test(result.contract);

              if (validContract && result.board) {
                results.push(result);
              }
            }

            // Found scorecard table, don't process more tables
            if (results.length > 0) {
              console.log(`Extracted ${results.length} scorecard entries from table`);
              break;
            }
          }
        }

        return results;
      });

      console.log(`Extracted ${scorecardsData.length} scorecard entries total`);
      if (scorecardsData.length > 0) {
        console.log(`Sample: Board ${scorecardsData[0].board}, Contract ${scorecardsData[0].contract}, By ${scorecardsData[0].declarer}, Lead ${scorecardsData[0].lead}`);
      }


      // Try direct URL patterns for scorecards
      const scorecardUrls = [
        `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_scard&event=${selectedEvent.eventId}`,
        `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=scorecards&event=${selectedEvent.eventId}`,
        `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?pid=display_scard&event=${selectedEvent.eventId}&club=${CLUB_ID}`,
      ];

      for (const url of scorecardUrls) {
        console.log(`Trying scorecard URL: ${url}`);
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await new Promise(r => setTimeout(r, 2000));

          // Check if we got scorecard data
          const hasScorecard = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('contract') && text.includes('lead') && text.includes('board');
          });

          if (hasScorecard) {
            console.log("Found scorecard page via direct URL!");
            // Extract scorecard data (reuse the extraction code)
            scorecardsData = await page.evaluate(() => {
              const results = [];
              const tables = Array.from(document.querySelectorAll("table"));

              for (const [i, t] of tables.entries()) {
                const rows = Array.from(t.querySelectorAll("tr"));
                if (rows.length < 2) continue;

                const headerRow = rows[0];
                const headerCells = Array.from(headerRow.querySelectorAll("td, th"));
                const headerTexts = headerCells.map((c) => (c.innerText || "").trim().toLowerCase());

                const hasContract = headerTexts.some((h) => h.includes("contr") || h.includes("bid"));
                const hasBy = headerTexts.some((h) => h.includes("by") || h.includes("decl"));
                const hasBoard = headerTexts.some((h) => h.includes("board") || h.includes("bd"));

                if (hasContract && hasBy && hasBoard) {
                  console.log(`Found scorecard table at index ${i}`);
                  // Extract data - simplified version
                  const boardCol = headerTexts.findIndex((h) => h.includes("board") || h.includes("bd"));
                  const contractCol = headerTexts.findIndex((h) => h.includes("contract") || h.includes("bid"));
                  const declarerCol = headerTexts.findIndex((h) => h.includes("by") || h.includes("decl"));
                  const leadCol = headerTexts.findIndex((h) => h.includes("lead"));
                  const tricksCol = headerTexts.findIndex((h) => h.includes("trick") || h.includes("made"));

                  let plusCol = headerTexts.findIndex(h => h === '+' || h.includes('plus'));
                  let minusCol = headerTexts.findIndex(h => h === '-' || h.includes('minus'));

                  for (let r = 1; r < rows.length; r++) {
                    const cells = Array.from(rows[r].querySelectorAll("td"));
                    if (cells.length < 3) continue;

                    const getText = (idx) => idx >= 0 && cells[idx] ? cells[idx].innerText.trim().slice(0, 50) : "";

                    let board = getText(boardCol).match(/(\d+)/)?.[1] || "";
                    let contract = getText(contractCol);
                    const contractMatch = contract.match(/([1-7])([NSHCD]T?|NT)/i);
                    if (contractMatch) contract = contractMatch[0];

                    let score = "";
                    if (plusCol !== -1) {
                      const pVal = getText(plusCol).replace(/[^\d]/g, '');
                      if (pVal) score = pVal;
                    }
                    if (!score && minusCol !== -1) {
                      const mVal = getText(minusCol).replace(/[^\d]/g, '');
                      if (mVal) score = `-${mVal}`;
                    }

                    if (contract && board) {
                      results.push({
                        board,
                        contract,
                        declarer: getText(declarerCol),
                        lead: getText(leadCol),
                        tricks: getText(tricksCol),
                        score,
                        ns: "",
                        ew: ""
                      });
                    }
                  }

                  if (results.length > 0) break;
                }
              }

              return results;
            });

            if (scorecardsData.length > 0) {
              console.log(`Extracted ${scorecardsData.length} scorecard entries from direct URL`);
              break;
            }
          }
        } catch (e) {
          console.log(`Failed to load ${url}: ${e.message}`);
        }
      }



    } // End of if (!travellerDataExtracted)

    // Step 5: Also access Travellers and Hands tabs for additional information
    // NOTE: Skip if we already clicked Travellers in Step 4
    if (!travellerDataExtracted) {
      console.log("Step 5: Looking for Travellers and Hands tabs for additional data...");

      // 3. Scrape Travellers - Try to click the \"Travellers\" tab
      console.log("Looking for 'Travellers' tab...");
      const clickedTravellers = await page.evaluate(() => {
        // BridgeWebs uses div elements with specific classes for tabs
        const allDivs = Array.from(document.querySelectorAll('div.button_href_middle, div.button_href_left, div.button_href_right'));

        for (const div of allDivs) {
          const text = (div.innerText || div.textContent || "").trim().toLowerCase();
          if (text === "travellers" || text === "traveller") {
            console.log("Found Travellers tab div, clicking...");
            div.click();
            return true;
          }
        }

        // Fallback: look for any clickable element with "Travellers" text
        const elements = Array.from(document.querySelectorAll('td, span, div, a'));
        const travTab = elements.find(el => {
          const text = (el.innerText || "").trim().toLowerCase();
          const hasOnclick = el.onclick || el.getAttribute("onclick");
          return (text === "travellers" || text === "traveller") && hasOnclick;
        });

        if (travTab) {
          console.log("Found Travellers tab (fallback), clicking...");
          travTab.click();
          return true;
        }
        return false;
      });

      if (clickedTravellers) {
        console.log("Clicked 'Travellers' tab, waiting for load...");
        await new Promise(r => setTimeout(r, 6000));
      } else {
        console.log("Could not find 'Travellers' tab to click. Will check page state...");
      }
    } else {
      console.log("Step 5: Skipping Travellers tab click - already clicked in Step 4");
    }

    // Check if we're already on a traveller page with board data
    const isOnTravellerPage = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      // Look for indicators of board data
      const hasBoard = /Board\s+\d+/i.test(bodyText) || /Bd\s+\d+/i.test(bodyText);
      const hasContract = bodyText.includes("Contract") || bodyText.includes("Bid");
      const hasResults = bodyText.includes("NS") || bodyText.includes("EW") || bodyText.includes("Declarer");
      const hasSpecificContract = /\d+[NSHCD]/.test(bodyText);

      return hasBoard && (hasContract || hasResults || hasSpecificContract);
    });

    // Strategy: If we already clicked "Travellers" successfully in Step 4, 
    // we should trust that we're where we need to be and SKIP the URL fallbacks, 
    // as they often trigger redirects back to the home page.
    if (!isOnTravellerPage && !travellerDataExtracted) {
      console.log("Not on traveller page yet, trying URL fallback...");
      const travUrlOptions = [];
      const eventIdClean = selectedEvent.eventId.split('_')[0];

      // Add standard URLs
      travUrlOptions.push(
        `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_travs&event=${selectedEvent.eventId}`,
        `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?pid=display_travs&event=${selectedEvent.eventId}&club=${CLUB_ID}`,
        `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=travellers&event=${selectedEvent.eventId}&wd=1&full=1`
      );

      // Add clean ID URLs if different (e.g. 20260129 instead of 20260129_1)
      if (eventIdClean && eventIdClean !== selectedEvent.eventId) {
        console.log(`Adding fallback URLs with clean info: ${eventIdClean}`);
        travUrlOptions.push(
          `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_travs&event=${eventIdClean}`,
          `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=travellers&event=${eventIdClean}&wd=1&full=1`
        );
      }

      for (const url of travUrlOptions) {
        console.log(`Trying fallback URL: ${url}`);
        try {
          await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
          await new Promise((r) => setTimeout(r, 2000));

          const hasData = await page.evaluate(() => document.body.innerText.includes('Board'));
          if (hasData) {
            console.log("Fallback URL loaded board data.");
            break;
          }

          // Also check for "Classic" switch again if we landed on a "Modern" view?
          // Usually direct URL goes to correct view.
        } catch (e) {
          console.log(`Failed to load ${url}: ${e.message}`);
        }
      }
    }

    // Verify page state with debug dump
    const debugInfo = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table"));
      const debug = {
        totalTables: tables.length,
        tableInfo: [],
        pageText: document.body.innerText.substring(0, 1000),
        url: window.location.href,
        hasBoardText: document.body.innerText.match(/Board\s+\d+/i) !== null,
      };

      tables.forEach((table, idx) => {
        const rows = Array.from(table.querySelectorAll("tr"));
        const firstRowText = rows[0]?.innerText || "";
        const cellCounts = rows.map((r) => r.querySelectorAll("td").length);
        const hasBoard =
          firstRowText.toLowerCase().includes("board") ||
          firstRowText.toLowerCase().includes("bd ") ||
          table.innerText.match(/Board\s+\d+/i) ||
          table.innerText.match(/Bd\s+\d+/i);
        const hasContract =
          table.innerText.includes("Contract") ||
          table.innerText.match(/\d+[NSHCD]/);
        const hasNS =
          table.innerText.includes("NS") || table.innerText.match(/\d+\s+\d+/);

        debug.tableInfo.push({
          index: idx,
          rows: rows.length,
          firstRowText: firstRowText.substring(0, 150),
          cellCounts: cellCounts.slice(0, 5),
          hasBoardText: !!hasBoard,
          hasContract: !!hasContract,
          hasNS: !!hasNS,
          looksLikeTraveller: Boolean(hasBoard && (hasContract || hasNS)),
        });
      });

      return debug;
    });

    console.log(
      `Debug: Found ${debugInfo.totalTables} tables on traveller page`,
    );
    console.log(`Debug: URL: ${debugInfo.url}`);
    console.log(`Debug: Has board text in page: ${debugInfo.hasBoardText}`);
    console.log(
      `Debug: Page text preview: ${debugInfo.pageText.substring(0, 300)}`,
    );

    const travellerTables = debugInfo.tableInfo.filter(
      (t) => t.looksLikeTraveller,
    );
    console.log(
      `Debug: Found ${travellerTables.length} tables that look like travellers`,
    );

    debugInfo.tableInfo.forEach((info, idx) => {
      if (info.looksLikeTraveller || (info.hasBoardText && info.rows > 2)) {
        console.log(
          `  Table ${idx}: ${info.rows} rows, board: ${info.hasBoardText}, contract: ${info.hasContract}, NS: ${info.hasNS}`,
        );
        console.log(`    First row: "${info.firstRowText.substring(0, 150)}"`);
        console.log(`    Cell counts: ${info.cellCounts.join(", ")}`);
      }
    });

    // Initialize boardResults before using it
    let boardResults = [];
    // Parse board results from the traveller page
    try {
      await debugDump("before_parse_boards");
      const parsedBoardResults = await page.evaluate(() => {
        const boardsMap = {};
        const tables = Array.from(document.querySelectorAll("table"));

        function getCellText(cell) {
          if (!cell) return "";
          const imgs = Array.from(cell.querySelectorAll('img'));
          let text = cell.innerText.trim();

          for (const img of imgs) {
            const alt = (img.alt || img.title || '').toLowerCase();
            let sym = '';
            if (alt.includes('club')) sym = 'C';
            else if (alt.includes('diamond')) sym = 'D';
            else if (alt.includes('heart')) sym = 'H';
            else if (alt.includes('spade')) sym = 'S';
            else if (alt.includes('no trump')) sym = 'NT';

            if (sym && !text.includes(sym)) {
              text += sym;
            }
          }
          return text.replace(/\s+/g, ' ').trim();
        }

        let currentBoardNum = null;

        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll("tr"));
          if (rows.length < 3) continue;

          // BridgeWebs travellers typically have a Title row (colspan=10) and a Header row
          let headerRowIdx = -1;
          // Look for the header row with specific classes and text
          for (let i = 0; i < Math.min(rows.length, 3); i++) {
            const cells = Array.from(rows[i].querySelectorAll("td, th"));
            const cellTexts = cells.map(c => c.innerText.trim().toLowerCase());

            // A traveller table MUST have NS, EW and Bid/Contract
            const hasNS = cellTexts.some(t => t === 'ns' || t === 'n/s');
            const hasEW = cellTexts.some(t => t === 'ew' || t === 'e/w');
            const hasBid = cellTexts.some(t => t === 'bid' || t === 'contract' || t === 'contr');

            if (hasNS && hasEW && hasBid) {
              headerRowIdx = i;
              break;
            }
          }

          if (headerRowIdx === -1) continue;

          // Reset board number for each table
          let boardNumFromTitle = null;

          // Now find the board number. Look at the title row (usually the one before header)
          for (let i = 0; i <= headerRowIdx; i++) {
            const text = rows[i].innerText || "";
            const match = text.match(/Board\s+(?:No\.?)?\s*(\d+)/i) || text.match(/Bd\s+(?:No\.?)?\s*(\d+)/i);
            if (match) {
              boardNumFromTitle = match[1];
              break;
            }
          }

          // Fallback: If not found in table, check the element immediately preceding the table
          if (!boardNumFromTitle) {
            let prev = table.previousElementSibling;
            // Check up to 3 elements back
            for (let j = 0; j < 3 && prev; j++) {
              const text = prev.innerText || "";
              // Be very specific to avoid picking up a global header
              const match = text.match(/Board\s+(?:No\.?)?\s*(\d+)/i) || text.match(/Bd\s+(?:No\.?)?\s*(\d+)/i);
              if (match) {
                boardNumFromTitle = match[1];
                break;
              }
              prev = prev.previousElementSibling;
            }
          }

          if (!boardNumFromTitle) {
              // Final fallback: try to find any text matching Board \d+ inside the table
              const match = table.innerText.match(/Board\s+(?:No\.?)?\s*(\d+)/i);
              if (match) boardNumFromTitle = match[1];
              else continue;
          }

          currentBoardNum = boardNumFromTitle;

          const headerRow = rows[headerRowIdx];
          const cells = Array.from(headerRow.querySelectorAll("td, th"));
          const headers = cells.map(c => c.innerText.trim().toLowerCase());

          // Detect columns
          const locBid = headers.findIndex(h => h === 'bid' || h === 'contract' || h === 'contr');
          const locBy = headers.findIndex(h => h === 'by' || h.includes('decl'));
          const locLead = headers.findIndex(h => h.includes('ld') || h.includes('lead') || h.includes('play'));
          const locTks = headers.findIndex(h => h === 'tks' || h === 'tricks');
          const locNS = headers.findIndex(h => h === 'ns' || h.includes('n/s'));
          const locEW = headers.findIndex(h => h === 'ew' || h.includes('e/w'));
          const locPlusSc = headers.findIndex(h => h === '+sc' || h === '+ sc' || h.includes('ns score') || h === 'score');
          const locMinusSc = headers.findIndex(h => h === '-sc' || h === '- sc' || h.includes('ew score'));

          if (locBid >= 0 && locNS >= 0 && locEW >= 0) {
            if (!boardsMap[currentBoardNum]) boardsMap[currentBoardNum] = [];

            for (let i = headerRowIdx + 1; i < rows.length; i++) {
              const rCells = Array.from(rows[i].querySelectorAll('td'));
              if (rCells.length < Math.max(locNS, locEW, locBid)) continue;

              const nsText = getCellText(rCells[locNS]);
              const ewText = getCellText(rCells[locEW]);

              // A valid result row MUST have numeric pair identifiers
              if (!nsText.match(/^\d+$/) || !ewText.match(/^\d+$/)) continue;

              let contract = getCellText(rCells[locBid]);
              // A valid bridge contract MUST start with 1-7 or P (for pass)
              // We'll normalize it below, but first check if it looks like a contract
              const isContract = contract && (contract.match(/^[1-7]/) || /PASS/i.test(contract));
              if (!isContract) continue;

              // Clean contract string: remove suit symbols and normalize
              // Handle "6S", "6 S", "6S x", "6 spades", etc.
              let normalizedContract = contract.toUpperCase()
                .replace(/♠/g, 'S').replace(/♥/g, 'H').replace(/♦/g, 'D').replace(/♣/g, 'C')
                .replace(/SPADES?/g, 'S').replace(/HEARTS?/g, 'H').replace(/DIAMONDS?/g, 'D').replace(/CLUBS?/g, 'C')
                .replace(/NO TRUMPS?/g, 'NT')
                .replace(/\s+/g, '');

              const contractMatch = normalizedContract.match(/([1-7])(NT|[SHDC])([X*]{0,2})/i);
              if (contractMatch) {
                normalizedContract = contractMatch[1] + contractMatch[2] + contractMatch[3];
              } else if (/PASS/i.test(normalizedContract)) {
                normalizedContract = "PASS";
              }

              const declarer = locBy >= 0 ? getCellText(rCells[locBy]) : '';
              const lead = locLead >= 0 ? getCellText(rCells[locLead]) : '';
              const tricks = locTks >= 0 ? getCellText(rCells[locTks]) : '';

              let plusVal = locPlusSc >= 0 ? getCellText(rCells[locPlusSc]) : '';
              let minusVal = locMinusSc >= 0 ? getCellText(rCells[locMinusSc]) : '';
              let score = plusVal || (minusVal ? `-${minusVal}` : '');

              // Avoid duplicates
              const exists = boardsMap[currentBoardNum].some(eb => eb.ns === nsText && eb.ew === ewText);
              if (!exists) {
                boardsMap[currentBoardNum].push({
                  boardNum: currentBoardNum,
                  board: currentBoardNum,
                  contract: normalizedContract,
                  declarer: declarer,
                  lead: lead,
                  tricks: tricks,
                  score: score,
                  nsScore: plusVal,
                  ewScore: minusVal,
                  ns: nsText,
                  ew: ewText
                });
              }
            }
          }
        }


        return Object.keys(boardsMap).map(bNum => ({
          boardNum: bNum,
          results: boardsMap[bNum]
        }));
      });


      boardResults = parsedBoardResults;
    } catch (err) {
      console.error("[DEBUG] Failed to extract board results:", err);
      await debugDump("extract_boards_error");
      throw err;
    }
    if (boardResults.length === 0) {
      console.log("Warning: No board results found on traveller page. Will attempt fallback to scorecards/PBN.");
      // await debugDump("no_boards_found");
      // throw new Error(
      //   "No board results found on traveller page. See debug screenshots/HTML for details.",
      // );
    }

    console.log(`Found ${boardResults.length} boards with results`);
    if (boardResults.length > 0) {
      console.log(
        `Sample board: Board ${boardResults[0].boardNum} has ${boardResults[0].results.length} results`,
      );
    } else {
      // Fallback: Try alternative parsing if no boards found
      console.log(
        "No boards found with standard parsing, trying alternative methods...",
      );

      const alternativeResults = await page.evaluate(() => {
        const boards = [];
        const pageText = document.body.innerText;

        // Try to find board patterns in the entire page text
        const boardPattern = /Board\s+(\d+)[\s\S]{0,2000}?/gi;
        let match;
        const boardMatches = [];

        while ((match = boardPattern.exec(pageText)) !== null) {
          boardMatches.push({
            boardNum: match[1],
            startIndex: match.index,
            text: match[0].substring(0, 500),
          });
        }

        console.log(`Found ${boardMatches.length} board mentions in page text`);

        // Try to extract data from each board section
        boardMatches.forEach((bm, idx) => {
          const nextStart =
            idx < boardMatches.length - 1
              ? boardMatches[idx + 1].startIndex
              : pageText.length;
          const sectionText = pageText.substring(bm.startIndex, nextStart);

          // Look for contract patterns in this section
          const contractPattern = /(\d+[NSHCD]|PASS|All Pass)/gi;
          const contracts = [];
          let contractMatch;
          while ((contractMatch = contractPattern.exec(sectionText)) !== null) {
            contracts.push(contractMatch[1]);
          }

          // Look for score patterns
          const scorePattern = /(\d+)\s+(\d+)/g;
          const scores = [];
          let scoreMatch;
          while ((scoreMatch = scorePattern.exec(sectionText)) !== null) {
            scores.push({ ns: scoreMatch[1], ew: scoreMatch[2] });
          }

          if (contracts.length > 0) {
            const results = contracts.map((contract, i) => ({
              ns: i < scores.length ? scores[i].ns : "",
              ew: i < scores.length ? scores[i].ew : "",
              contract: contract,
              declarer: "",
              result: "",
              nsScore: i < scores.length ? scores[i].ns : "0",
              ewScore: i < scores.length ? scores[i].ew : "0",
            }));

            if (results.length > 0) {
              boards.push({ boardNum: bm.boardNum, results });
            }
          }
        });

        return boards;
      });

      if (alternativeResults.length > 0) {
        console.log(
          `Alternative parsing found ${alternativeResults.length} boards`,
        );
        boardResults.push(...alternativeResults);
      }

      // If still no results, log the page structure for debugging
      if (boardResults.length === 0) {
        const pageStructure = await page.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            bodyTextLength: document.body.innerText.length,
            tableCount: document.querySelectorAll("table").length,
            hasIframes: document.querySelectorAll("iframe").length > 0,
            sampleText: document.body.innerText.substring(0, 1000),
          };
        });
        console.log(
          "Page structure debug:",
          JSON.stringify(pageStructure, null, 2),
        );
      }
    }

    // FALLBACK: Build boards from scorecard data if traveller parsing failed
    if (boardResults.length === 0 && scorecardsData.length > 0) {
      console.log(`Traveller parsing failed, building ${scorecardsData.length} boards from scorecard data...`);

      // Group scorecard entries by board number
      const boardsMap = {};
      scorecardsData.forEach(sc => {
        const boardNum = sc.board;
        if (!boardsMap[boardNum]) {
          boardsMap[boardNum] = {
            boardNum,
            results: []
          };
        }

        // Add result to this board
        let nScore = '';
        let eScore = '';
        const rawScore = (sc.score || '').replace(/[^\d-]/g, '');

        // If we have a score and a declarer, attribute score to the declarer's side
        if (rawScore && sc.declarer) {
          const decl = sc.declarer.trim().toUpperCase().charAt(0);
          if (['N', 'S'].includes(decl)) {
            nScore = rawScore;
          } else if (['E', 'W'].includes(decl)) {
            eScore = rawScore;
          } else {
            // Fallback: assume NS column if unknown (or just put in NS for abs value check)
            nScore = rawScore;
          }
        }

        boardsMap[boardNum].results.push({
          ns: sc.ns,
          ew: sc.ew,
          contract: sc.contract,
          declarer: sc.declarer,
          lead: sc.lead,
          tricks: sc.tricks,
          nsScore: nScore,
          ewScore: eScore,
        });
      });

      // Convert map to array
      boardResults = Object.values(boardsMap);
      console.log(`Built ${boardResults.length} boards from scorecard data`);
    }


    // 4. Fetch PBN for hand diagrams
    const pbnUrl = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?pid=display_hands&msec=1&event=${selectedEvent.eventId}&wd=1&club=${CLUB_ID}&deal_format=pbn`;
    console.log(`Fetching PBN for hand diagrams...`);

    const pbnContent = await page.evaluate(async (url) => {
      const res = await fetch(url);
      return await res.text();
    }, pbnUrl);

    // Parse PBN for hands and metadata
    const handDiagrams = {};
    const boardBlocks = pbnContent.split(/\[Board "/);

    // Helper to calculate HCP
    function calculateHCP(hand) {
      let hcp = 0;
      for (const card of hand) {
        if (card === "A") hcp += 4;
        if (card === "K") hcp += 3;
        if (card === "Q") hcp += 2;
        if (card === "J") hcp += 1;
      }
      return hcp;
    }

    for (const block of boardBlocks) {
      if (!block.trim()) continue;

      const boardNumMatch = block.match(/^(\d+)"/);
      if (boardNumMatch) {
        const boardNum = boardNumMatch[1];
        const dealMatch = block.match(/\[Deal "([^"]+)"\]/);
        const dealerMatch = block.match(/\[Dealer "([^"]+)"\]/);
        const vulnMatch = block.match(/\[Vulnerable "([^"]+)"\]/);

        const dealString = dealMatch ? dealMatch[1] : "";
        const dealer = dealerMatch ? dealerMatch[1] : "";
        const vuln = vulnMatch ? vulnMatch[1] : "";

        // Extract double-dummy data if available
        const abilityMatch = block.match(/\[Ability "([^"]+)"\]/);
        const optimumScoreMatch = block.match(/\[OptimumScore "([^"]+)"\]/);

        const ddTricks = abilityMatch ? abilityMatch[1] : null;
        const optimumScore = optimumScoreMatch ? optimumScoreMatch[1] : null;

        // Parse deal string to calculate HCP
        const rawHands = dealString.split(" ");
        const handsByPosition = {};
        const positions = ["N", "E", "S", "W"];
        const startPosChar = dealString[0] || "N";
        let startPosIdx = positions.indexOf(startPosChar);
        if (startPosIdx === -1) startPosIdx = 0;

        rawHands.forEach((handStr, i) => {
          let cleanHand = handStr;
          if (i === 0 && handStr.includes(":")) {
            cleanHand = handStr.split(":")[1] || "";
          }
          const pos = positions[(startPosIdx + i) % 4];
          handsByPosition[pos] = cleanHand;
        });

        const nHCP = calculateHCP(handsByPosition["N"] || "");
        const sHCP = calculateHCP(handsByPosition["S"] || "");
        const eHCP = calculateHCP(handsByPosition["E"] || "");
        const wHCP = calculateHCP(handsByPosition["W"] || "");
        const nsHCP = nHCP + sHCP;
        const ewHCP = eHCP + wHCP;

        handDiagrams[boardNum] = {
          deal: dealString,
          dealer: dealer,
          vuln: vuln,
          nHCP: nHCP,
          sHCP: sHCP,
          eHCP: eHCP,
          wHCP: wHCP,
          nsHCP: nsHCP,
          ewHCP: ewHCP,
          ddTricks: ddTricks,
          optimumScore: optimumScore,
        };
      }
    }

    // 5. Extract Double-Dummy data from board detail pages
    console.log("Extracting double-dummy data from board detail pages...");
    const ddData = {};

    // Get list of board numbers from handDiagrams or boardResults
    const boardNumbers = Object.keys(handDiagrams).length > 0
      ? Object.keys(handDiagrams)
      : boardResults.map(b => b.boardNum);

    console.log(`Found ${boardNumbers.length} boards to extract DD data from`);

    // Navigate to Ranking/Results page (DD data requires clicking pair names in classic edition)
    const resultsUrl = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_rank&event=${selectedEvent.eventId}`;
    console.log("Navigating to Results page for DD data...");
    await page.goto(resultsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    // Switch to classic edition (DD table only appears in classic)
    console.log("Switching to classic edition for DD data...");
    const switchedToClassic = await page.evaluate(() => {
      const switches = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      const classicSwitch = switches.find(sw => {
        const label = sw.nextElementSibling?.textContent || sw.previousElementSibling?.textContent || '';
        return label.toLowerCase().includes('classic');
      });

      if (classicSwitch && !classicSwitch.checked) {
        classicSwitch.click();
        return true;
      }
      return false;
    });

    if (switchedToClassic) {
      console.log("Switched to classic edition, waiting for reload...");
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.log("Already in classic edition or switch not found");
    }

    // Click on the first pair name to access board details
    console.log("Clicking on first pair to access board details...");
    const clickedPair = await page.evaluate(() => {
      // Look for pair names in the rankings table
      const pairs = Array.from(document.querySelectorAll('div.r_show'));
      const pairLink = pairs.length > 0 ? pairs[0] : null;

      if (pairLink) {
        pairLink.click();
        return true;
      }
      return false;
    });

    if (!clickedPair) {
      console.log("Could not find pair link to click, skipping DD extraction");
    } else {
      console.log("Clicked pair, waiting for board view...");
      await new Promise(r => setTimeout(r, 3000));
    }

    // Extract DD data for each board (limit to avoid timeout)
    const maxBoards = Math.min(boardNumbers.length, 24);
    for (let i = 0; i < maxBoards; i++) {
      const boardNum = boardNumbers[i];
      try {
        console.log(`Extracting DD data for board ${boardNum}...`);

        // Click on the board number element in the pair view
        const clicked = await page.evaluate((bNum) => {
          // Look for clickable elements with exact board number text
          // Find element with exact text match and onclick attribute (likely TD or DIV)
          const allElements = Array.from(document.querySelectorAll('*'));
          const boardEl = allElements.find(el => {
            const text = el.textContent?.trim();
            const hasOnclick = el.getAttribute('onclick');
            return text === bNum && hasOnclick;
          });

          if (boardEl) {
            boardEl.click();
            return true;
          }
          return false;
        }, boardNum);

        if (!clicked) {
          console.log(`Could not find clickable element for board ${boardNum}`);
          continue;
        }

        await new Promise(r => setTimeout(r, 1500));

        // Extract the DD trick table
        const ddTricks = await page.evaluate(() => {
          // Find the table with class 'hd_details' that contains suit images
          const tables = Array.from(document.querySelectorAll('table.hd_details'));

          for (const table of tables) {
            // Check rows and columns dimensions (usually 5 rows x 6 cols)
            if (table.rows.length !== 5) continue;

            // Check if it contains suit images in the first row
            const firstRow = table.rows[0];
            const images = Array.from(firstRow.querySelectorAll('img'));
            const hasSuits = images.some(img => {
              const alt = img.getAttribute('alt')?.toLowerCase() || '';
              return alt.includes('club') || alt.includes('diamond') || alt.includes('heart') || alt.includes('spade');
            });

            if (!hasSuits) continue;

            // Map column index to suit based on image alt text or position
            // Standard order often: Club, Diamond, Heart, Spade, NT
            // But we should verify from headers
            const colMap = {};
            const cells = Array.from(firstRow.cells);

            cells.forEach((cell, idx) => {
              const img = cell.querySelector('img');
              const text = cell.innerText.trim().toUpperCase();

              let suit = null;
              if (img) {
                const alt = img.getAttribute('alt')?.toLowerCase() || '';
                if (alt.includes('club')) suit = 'C';
                if (alt.includes('diamond')) suit = 'D';
                if (alt.includes('heart')) suit = 'H';
                if (alt.includes('spade')) suit = 'S';
              }
              if (text === 'NT' || text === 'N') suit = 'NT';

              if (suit) colMap[idx] = suit;
            });

            // If we didn't find headers, assume standard order based on images: C, D, H, S, NT
            // Column 0 is empty/label
            if (Object.keys(colMap).length === 0) {
              colMap[1] = 'C';
              colMap[2] = 'D';
              colMap[3] = 'H';
              colMap[4] = 'S';
              colMap[5] = 'NT';
            }

            const ddData = { N: {}, S: {}, E: {}, W: {} };

            // Iterate rows 1-4 (N, S, E, W)
            for (let r = 1; r < 5; r++) {
              const row = table.rows[r];
              const cells = row.cells;
              if (cells.length < 6) continue;

              // First cell is label (N, S, E, W)
              const label = cells[0].innerText.trim().toUpperCase();
              if (!['N', 'S', 'E', 'W'].includes(label)) continue;

              // Extract tricks
              for (let c = 1; c < 6; c++) {
                const suit = colMap[c];
                if (suit) {
                  const val = cells[c].innerText.trim();
                  // BridgeWebs shows Levels (1=7 tricks). '-' means <7 tricks.
                  if (val === '-' || val === '') {
                    ddData[label][suit] = 0;
                  } else {
                    const level = parseInt(val);
                    // Convert Level to Tricks (Level 1 = 7 tricks)
                    ddData[label][suit] = isNaN(level) ? 0 : level + 6;
                  }
                }
              }
            }

            // Convert to 20-character DD string format
            // Order: NT S H D C for each of N, S, E, W
            let ddString = '';
            // Standard PBN order: NT, S, H, D, C
            const suitOrder = ['NT', 'S', 'H', 'D', 'C'];
            const directions = ['N', 'S', 'E', 'W'];

            for (const suit of suitOrder) {
              for (const dir of directions) {
                const tricks = ddData[dir][suit] || 0;
                if (tricks >= 10) {
                  ddString += String.fromCharCode(97 + tricks - 10); // a=10, b=11
                } else {
                  ddString += tricks.toString();
                }
              }
            }

            return ddString.length === 20 ? ddString : null;
          }

          return null;
        });

        if (ddTricks) {
          ddData[boardNum] = ddTricks;
          console.log(`Extracted DD data for board ${boardNum}: ${ddTricks.substring(0, 10)}...`);
        } else {
          console.log(`No DD data found for board ${boardNum}`);
        }

      } catch (err) {
        console.log(`Error extracting DD for board ${boardNum}: ${err.message}`);
        // Try to recover by going back to travellers page
        try {
          await page.goto(travUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          console.log(`Failed to recover: ${e.message}`);
        }
      }
    }

    console.log(`Extracted DD data for ${Object.keys(ddData).length} boards`);

    // Merge DD data into handDiagrams
    Object.keys(ddData).forEach(boardNum => {
      if (handDiagrams[boardNum]) {
        handDiagrams[boardNum].ddTricks = ddData[boardNum];
      }
    });

    // Merge hands with results, or create from PBN if no results found
    let boards = [];
    if (boardResults.length > 0) {
      boards = boardResults.map((b) => ({
        boardNum: b.boardNum,
        hands: handDiagrams[b.boardNum]?.deal || "",
        deal: handDiagrams[b.boardNum]?.deal || "",
        dealer: handDiagrams[b.boardNum]?.dealer || "",
        vuln: handDiagrams[b.boardNum]?.vuln || "",
        nHCP: handDiagrams[b.boardNum]?.nHCP || 0,
        sHCP: handDiagrams[b.boardNum]?.sHCP || 0,
        eHCP: handDiagrams[b.boardNum]?.eHCP || 0,
        wHCP: handDiagrams[b.boardNum]?.wHCP || 0,
        nsHCP: handDiagrams[b.boardNum]?.nsHCP || 0,
        ewHCP: handDiagrams[b.boardNum]?.ewHCP || 0,
        ddTricks: handDiagrams[b.boardNum]?.ddTricks || null,
        optimumScore: handDiagrams[b.boardNum]?.optimumScore || null,
        results: b.results,
      }));
    } else {
      console.log("No traveller/scorecard results found. Creating boards from PBN data only.");
      boards = Object.keys(handDiagrams).map((boardNum) => ({
        boardNum: boardNum,
        hands: handDiagrams[boardNum]?.deal || "",
        deal: handDiagrams[boardNum]?.deal || "",
        dealer: handDiagrams[boardNum]?.dealer || "",
        vuln: handDiagrams[boardNum]?.vuln || "",
        nHCP: handDiagrams[boardNum]?.nHCP || 0,
        sHCP: handDiagrams[boardNum]?.sHCP || 0,
        eHCP: handDiagrams[boardNum]?.eHCP || 0,
        wHCP: handDiagrams[boardNum]?.wHCP || 0,
        nsHCP: handDiagrams[boardNum]?.nsHCP || 0,
        ewHCP: handDiagrams[boardNum]?.ewHCP || 0,
        ddTricks: handDiagrams[boardNum]?.ddTricks || null,
        optimumScore: handDiagrams[boardNum]?.optimumScore || null,
        results: [],
      }));
    }

    return {
      eventInfo: selectedEvent,
      rankings: rankings,
      boards: boards,
      scorecards: scorecardsData, // MAIN SOURCE: Contract, Declarer, Lead, Tricks, Scores
    };
  } catch (err) {
    console.error("Scraping error:", err);
    throw err;
  } finally {
    await browser.close();
  }
}
