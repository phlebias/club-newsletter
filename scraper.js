import puppeteer from "puppeteer";

const CLUB_ID = process.env.CLUB_ID || "liverpool";

/**
 * Scrapes BridgeWebs for session data and returns a structured object for newsletter generation.
 * @param {string} dateOverride - Optional YYYYMMDD string.
 * @param {string} sessionType - Optional 'Afternoon' or 'Evening'.
 */
export async function getSessionData(dateOverride = null, sessionType = null) {
  const browser = await puppeteer.launch({
    headless: false, // Set to false for visual debugging
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  // Helper to dump screenshots and HTML for debugging
  let step = 0;
  const fs = require('fs');
  async function debugDump(label) {
    try {
      step++;
      const safeLabel = label.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const pngPath = `debug_${step}_${safeLabel}.png`;
      const htmlPath = `debug_${step}_${safeLabel}.html`;
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

    await page.goto(
      `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_home`,
      { waitUntil: "networkidle2" },
    );
    await debugDump("home_page");
    await new Promise((r) => setTimeout(r, 2000));

    // 1. Identify the event from the home page results table
    console.log("Extracting events from home page...");
    let events = [];
    try {
      events = await page.evaluate(() => {
        const events = [];

        // Find the Results table
        const tables = Array.from(document.querySelectorAll("table"));
        const resultsTable = tables.find((t) => {
          const text = t.innerText || "";
          return (
            (text.includes("Results") && text.includes("January")) ||
            text.includes("February")
          );
        });

        if (!resultsTable) return [];

        // Look for rows with date and session information
        const rows = Array.from(resultsTable.querySelectorAll("tr"));

        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll("td"));
          if (cells.length === 0) return;

          const rowText = row.innerText.trim();

          // Look for date patterns like "29th January 2026" or "2nd February 2026"
          const dateMatch = rowText.match(
            /(\d+)(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
          );
          if (!dateMatch) return;

          const day = dateMatch[1];
          const monthName = dateMatch[2];
          const year = dateMatch[3];

          // Convert month name to number
          const monthNames = [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
          ];
          const monthNum = (monthNames.indexOf(monthName.toLowerCase()) + 1)
            .toString()
            .padStart(2, "0");
          const dayNum = day.padStart(2, "0");
          const dateStr = `${year}${monthNum}${dayNum}`;

          // Extract session type (Afternoon/Evening) - check for bold or strong text
          let sessionType = null;
          const boldText =
            row.querySelector("strong")?.innerText ||
            row.querySelector("b")?.innerText ||
            "";
          if (boldText.includes("Afternoon") || rowText.includes("Afternoon")) {
            sessionType = "Afternoon";
          } else if (
            boldText.includes("Evening") ||
            rowText.includes("Evening")
          ) {
            sessionType = "Evening";
          }

          // Look for clickable links in this row - try clicking to get the actual event ID
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
              const eventMatch = onclick.match(/eventLink\('([^']+)'/);
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
      throw new Error(
        "No events found on home page. See debug screenshots/HTML for details.",
      );
    }

    console.log(`Found ${events.length} events on home page`);

    if (events.length === 0) {
      throw new Error("No events found on home page");
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
        selectedEvent = matchingEvents[0];
        console.log(`Using first matching event: ${selectedEvent.text}`);
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

    // Click on the event row to navigate to it and get the actual event ID
    const actualEventId = await page.evaluate(
      (targetDate, targetSessionType) => {
        // Find the table row that matches our selected event
        const tables = Array.from(document.querySelectorAll("table"));
        const resultsTable = tables.find((t) => {
          const text = t.innerText || "";
          return (
            text.includes("Results") &&
            (text.includes("January") || text.includes("February"))
          );
        });

        if (!resultsTable) return null;

        const rows = Array.from(resultsTable.querySelectorAll("tr"));
        for (const row of rows) {
          const rowText = row.innerText.trim();
          const dateMatch = rowText.match(
            /(\d+)(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
          );
          if (!dateMatch) continue;

          const day = dateMatch[1].padStart(2, "0");
          const monthName = dateMatch[2];
          const year = dateMatch[3];
          const monthNames = [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
          ];
          const monthNum = (monthNames.indexOf(monthName.toLowerCase()) + 1)
            .toString()
            .padStart(2, "0");
          const dateStr = `${year}${monthNum}${day}`;

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
              // If no event in href, try clicking and see where we go
              link.click();
              return "clicked";
            }

            // Try clicking the row itself if it has onclick
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
      // Wait for navigation - use Promise.race to handle timeout
      try {
        await Promise.race([
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch (err) {
        console.log(
          `Navigation wait completed (may have timed out): ${err.message}`,
        );
      }
      await new Promise((r) => setTimeout(r, 2000));

      // Extract event ID from the new URL
      const urlEventId = await page.evaluate(() => {
        const url = window.location.href;
        const match = url.match(/event=([^&]+)/);
        return match ? match[1] : null;
      });

      if (urlEventId) {
        selectedEvent.eventId = urlEventId;
        console.log(`Got event ID from navigation: ${urlEventId}`);
      }
    } else if (actualEventId) {
      selectedEvent.eventId = actualEventId;
      console.log(`Got event ID from link: ${actualEventId}`);
    } else if (selectedEvent.link) {
      console.log(`Navigating to event link: ${selectedEvent.link}`);
      await page.goto(selectedEvent.link, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1500));

      const urlEventId = await page.evaluate(() => {
        const url = window.location.href;
        const match = url.match(/event=([^&]+)/);
        return match ? match[1] : null;
      });

      if (urlEventId) {
        selectedEvent.eventId = urlEventId;
        console.log(`Updated event ID to: ${urlEventId}`);
      }
    }

    // 2. Scrape Rankings - use the actual table, not navigation
    const rankUrl = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_rank&event=${selectedEvent.eventId}`;
    console.log(`Scraping rankings from: ${rankUrl}`);
    await page.goto(rankUrl, { waitUntil: "networkidle2" });
    await debugDump("rankings_page");
    await new Promise((r) => setTimeout(r, 1500));

    let rankings = [];
    try {
      rankings = await page.evaluate(() => {
        // Find the actual results table, not the navigation
        const tables = Array.from(document.querySelectorAll("table"));
        const resultsTable = tables.find(
          (t) =>
            t.innerText.includes("Players") && t.innerText.includes("Match"),
        );

        if (!resultsTable) return [];

        const rows = Array.from(resultsTable.querySelectorAll("tr"));
        const dataRows = rows.filter((r) => {
          const cells = r.querySelectorAll("td");
          return cells.length >= 4 && cells[1].innerText.match(/^\d+$/);
        });

        return dataRows.map((r) => {
          const cells = Array.from(r.querySelectorAll("td"));
          return {
            pos: cells[0]?.innerText.trim() || "",
            no: cells[1]?.innerText.trim() || "",
            players: cells[2]?.innerText.trim() || "",
            matchPoints: cells[3]?.innerText.trim() || "",
            score: cells[4]?.innerText.trim() || "",
          };
        });
      });
    } catch (err) {
      console.error("[DEBUG] Failed to extract rankings:", err);
      await debugDump("extract_rankings_error");
      throw err;
    }
    if (!rankings || rankings.length === 0) {
      await debugDump("no_rankings_found");
      throw new Error(
        "No rankings found on rankings page. See debug screenshots/HTML for details.",
      );
    }

    console.log(`Found ${rankings.length} pairs in rankings`);

    // 2.5. IMPROVED NAVIGATION: Home page → click date result → switch to classic edition → Scorecards tab
    console.log("=== Starting improved navigation flow ===");

    // Go back to home page first
    console.log("Step 1: Navigating to home page...");
    await page.goto(
      `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_home`,
      { waitUntil: "networkidle2" },
    );
    await debugDump("back_to_home");
    await new Promise((r) => setTimeout(r, 2000));

    // Step 2: Click on the date result from home page (top-left results table)
    console.log("Step 2: Clicking on date result from home page...");
    const dateClickResult = await page.evaluate(
      (targetDate, sessionType) => {
        // Find the Results table on home page
        const tables = Array.from(document.querySelectorAll("table"));
        const resultsTable = tables.find((t) => {
          const text = t.innerText || "";
          return text.includes("Results") && (text.includes("January") || text.includes("February") || text.includes("March"));
        });

        if (!resultsTable) return { success: false, reason: "No results table found" };

        // Format date for matching
        const dateMatch = targetDate.match(/^(\d{4})(\d{2})(\d{2})/);
        if (!dateMatch) return { success: false, reason: "Invalid date format" };

        const year = dateMatch[1];
        const month = dateMatch[2];
        const day = dateMatch[3];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[parseInt(month) - 1];
        const dayInt = parseInt(day);
        const datePattern1 = `${dayInt}th ${monthName} ${year}`;
        const datePattern2 = `${dayInt}st ${monthName} ${year}`;
        const datePattern3 = `${dayInt}nd ${monthName} ${year}`;
        const datePattern4 = `${dayInt}rd ${monthName} ${year}`;
        const datePattern5 = `${dayInt} ${monthName} ${year}`;

        const rows = Array.from(resultsTable.querySelectorAll("tr"));
        for (const row of rows) {
          const rowText = row.innerText.trim();

          if (
            (rowText.includes(datePattern1) || rowText.includes(datePattern2) ||
              rowText.includes(datePattern3) || rowText.includes(datePattern4) ||
              rowText.includes(datePattern5)) &&
            (!sessionType || rowText.includes(sessionType))
          ) {
            // Try to find a clickable link in this row
            const link = row.querySelector("a[href]");
            if (link) {
              const href = link.getAttribute("href");
              link.click();
              return { success: true, type: "link", href: href };
            }
            // Try clicking the row itself if it has onclick
            if (row.onclick || row.querySelector("[onclick]")) {
              const clickable = row.querySelector("[onclick]") || row;
              clickable.click();
              return { success: true, type: "onclick" };
            }
          }
        }
        return { success: false, reason: "No matching date row found" };
      },
      dateOverride || selectedEvent.date,
      sessionType,
    );

    console.log(`Date click result: ${JSON.stringify(dateClickResult)}`);

    if (dateClickResult.success) {
      console.log("Successfully clicked date link, waiting for navigation...");
      await page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
        .catch(() => { });
      await debugDump("after_date_click");
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      console.log(`Could not click date (${dateClickResult.reason}), trying direct navigation...`);
      // Fallback to direct URL navigation
      const resultsUrl = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_rank&event=${selectedEvent.eventId}`;
      await page.goto(resultsUrl, { waitUntil: "networkidle2" });
      await debugDump("direct_navigation_fallback");
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Step 3: Check if we need to switch to classic edition (top right button)
    console.log("Step 3: Checking for classic edition switch...");
    const classicSwitchResult = await page.evaluate(() => {
      // Look for a button in the top right that might switch to classic view
      const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], span, div'));

      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        const text = (btn.innerText || btn.value || "").toLowerCase();

        // Button should be in top right area (top 150px, right 300px)
        if (rect.top < 150 && rect.right > window.innerWidth - 300) {
          if (text.includes("classic") || text.includes("switch") ||
            text.includes("edition") || text === "switch to classic") {
            btn.click();
            return { success: true, text: btn.innerText || btn.value };
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
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
        .catch(() => { });
      await debugDump("after_classic_switch");
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      console.log("No classic edition switch found (may already be in classic mode)");
    }

    // Step 4: Access the Scorecards tab (MAIN SOURCE FOR ANALYSIS)
    console.log("Step 4: Looking for Scorecards tab...");
    let scorecardsData = [];

    const scorecardsTabResult = await page.evaluate(() => {
      // Look for tabs - they might be links, buttons, or elements with onclick
      const allElements = Array.from(document.querySelectorAll("a, button, div, span, td, th"));

      for (const el of allElements) {
        const text = (el.innerText || el.textContent || "").trim().toLowerCase();

        // Look for "Scorecards" or "Score Cards" tab
        if (text === "scorecards" || text === "scorecard" || text === "score cards") {
          // Check if it's clickable
          if (el.tagName === "A" && el.href) {
            return { success: true, type: "link", href: el.href };
          } else if (el.onclick || el.tagName === "BUTTON") {
            el.click();
            return { success: true, type: "clicked" };
          }
        }
      }

      return { success: false, reason: "No Scorecards tab found" };
    });

    console.log(`Scorecards tab result: ${JSON.stringify(scorecardsTabResult)}`);

    if (scorecardsTabResult.success) {
      if (scorecardsTabResult.type === "link") {
        console.log(`Navigating to Scorecards tab: ${scorecardsTabResult.href}`);
        await page.goto(scorecardsTabResult.href, { waitUntil: "networkidle2" });
        await debugDump("scorecards_tab");
        await new Promise((r) => setTimeout(r, 2000));
      } else if (scorecardsTabResult.type === "clicked") {
        console.log("Clicked Scorecards tab, waiting for page update...");
        await new Promise((r) => setTimeout(r, 3000));
        await debugDump("scorecards_tab_clicked");
      }

      // Extract data from Scorecards tab
      // Shows: Board, Contract, By (declarer), Lead, Tricks made, Scores
      console.log("Extracting scorecard data...");
      scorecardsData = await page.evaluate(() => {
        const results = [];
        const tables = Array.from(document.querySelectorAll("table"));

        // Find the table that looks like a scorecard
        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll("tr"));
          if (rows.length < 2) continue;

          const headerRow = rows[0];
          const headerCells = Array.from(headerRow.querySelectorAll("td, th"));
          const headerTexts = headerCells.map((c) => (c.innerText || "").toLowerCase());

          // Check if this looks like a scorecard table
          const hasContract = headerTexts.some((h) => h.includes("contract"));
          const hasBy = headerTexts.some((h) => h.includes("by") || h.includes("declarer"));
          const hasLead = headerTexts.some((h) => h.includes("lead"));
          const hasTricks = headerTexts.some((h) => h.includes("trick") || h.includes("made"));
          const hasScore = headerTexts.some((h) => h.includes("score"));

          if (hasContract && (hasBy || hasLead || hasTricks || hasScore)) {
            // This looks like a scorecard table - find column indices
            const boardCol = headerTexts.findIndex((h) => h.includes("board") || h.includes("bd") || h === "no");
            const contractCol = headerTexts.findIndex((h) => h.includes("contract"));
            const declarerCol = headerTexts.findIndex((h) => h.includes("by") || h.includes("declarer") || h.includes("decl"));
            const leadCol = headerTexts.findIndex((h) => h.includes("lead"));
            const tricksCol = headerTexts.findIndex((h) => h.includes("trick") || h.includes("made") || h.includes("result"));
            const scoreCol = headerTexts.findIndex((h) => h.includes("score") || h.includes("pts") || h.includes("points"));
            const nsCol = headerTexts.findIndex((h) => h.includes("ns") || h === "n/s");
            const ewCol = headerTexts.findIndex((h) => h.includes("ew") || h === "e/w");

            console.log(`Found scorecard table with columns: board=${boardCol}, contract=${contractCol}, declarer=${declarerCol}, lead=${leadCol}, tricks=${tricksCol}, score=${scoreCol}`);

            // Extract data rows
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const cells = Array.from(row.querySelectorAll("td"));
              if (cells.length < 3) continue;

              const result = {
                board: boardCol >= 0 && cells[boardCol] ? cells[boardCol].innerText.trim() : "",
                contract: contractCol >= 0 && cells[contractCol] ? cells[contractCol].innerText.trim() : "",
                declarer: declarerCol >= 0 && cells[declarerCol] ? cells[declarerCol].innerText.trim() : "",
                lead: leadCol >= 0 && cells[leadCol] ? cells[leadCol].innerText.trim() : "",
                tricks: tricksCol >= 0 && cells[tricksCol] ? cells[tricksCol].innerText.trim() : "",
                score: scoreCol >= 0 && cells[scoreCol] ? cells[scoreCol].innerText.trim() : "",
                ns: nsCol >= 0 && cells[nsCol] ? cells[nsCol].innerText.trim() : "",
                ew: ewCol >= 0 && cells[ewCol] ? cells[ewCol].innerText.trim() : "",
              };

              // Only add if we have at least a contract
              if (result.contract && result.contract !== "PASS") {
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
    } else {
      console.log("Could not find Scorecards tab, will extract from available data");
    }

    // Step 5: Also access Travellers and Hands tabs for additional information
    // NOTE: Scorecards tab (above) is the MAIN source, Travellers/Hands provide extra context
    console.log("Step 5: Looking for Travellers and Hands tabs for additional data...");

    const travellerLinkFromRankings = await page.evaluate((eventId) => {
      // Look for links to travellers on the rankings page
      const allLinks = Array.from(document.querySelectorAll("a[href]"));

      // First, look for explicit traveller links
      const travLinks = allLinks.filter((link) => {
        const href = (link.getAttribute("href") || "").toLowerCase();
        const text = (link.innerText || "").toLowerCase();
        return href.includes("trav") || text.includes("traveller");
      });

      if (travLinks.length > 0) {
        // Prefer links that include the event ID
        const withEvent = travLinks.find((link) =>
          link.getAttribute("href").includes(eventId),
        );
        if (withEvent) return withEvent.getAttribute("href");
        return travLinks[0].getAttribute("href");
      }

      // Look for navigation table or menu with links
      const tables = Array.from(document.querySelectorAll("table"));
      for (const table of tables) {
        const links = Array.from(table.querySelectorAll("a[href]"));
        for (const link of links) {
          const href = link.getAttribute("href") || "";
          const text = link.innerText || "";
          // Look for "Travellers", "Traveller", or similar
          if (
            (text.toLowerCase().includes("trav") || href.includes("trav")) &&
            (href.includes(eventId) ||
              href.includes("display_trav") ||
              href.includes("travellers"))
          ) {
            return href;
          }
        }
      }

      // Last resort: look for any link with display_trav or travellers
      const displayLink = allLinks.find((link) => {
        const href = (link.getAttribute("href") || "").toLowerCase();
        return (
          (href.includes("display_trav") || href.includes("travellers")) &&
          href.includes(eventId)
        );
      });

      return displayLink ? displayLink.getAttribute("href") : null;
    }, selectedEvent.eventId);

    if (travellerLinkFromRankings) {
      console.log(
        `Found traveller link from rankings page: ${travellerLinkFromRankings}`,
      );
    } else {
      console.log("No traveller link found on rankings page");
    }

    // 3. Scrape Travellers - we should already be on the traveller page from navigation above
    // But check if we need to navigate further or if we're already there
    const currentUrl = page.url();
    console.log(`Current URL after navigation: ${currentUrl}`);
    await debugDump("traveller_page");

    // Check if we're already on a traveller page with board data
    const isOnTravellerPage = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      // Check if we're on the home page (shouldn't be)
      if (
        bodyText.includes("Welcome to Liverpool Bridge Club") &&
        bodyText.includes("Want to play Bridge")
      ) {
        return false;
      }
      // Look for indicators of board data
      return (
        /Board\s+\d+/i.test(bodyText) &&
        (bodyText.includes("Contract") ||
          bodyText.includes("NS") ||
          bodyText.includes("EW") ||
          bodyText.includes("Declarer") ||
          bodyText.match(/\d+[NSHCD]/))
      );
    });

    if (!isOnTravellerPage) {
      console.log("Not on traveller page yet, trying to navigate...");

      // Try to find traveller link from current page
      const travellerLinkFromRankings = await page.evaluate((eventId) => {
        const allLinks = Array.from(document.querySelectorAll("a[href]"));

        // First, look for explicit traveller links
        const travLinks = allLinks.filter((link) => {
          const href = (link.getAttribute("href") || "").toLowerCase();
          const text = (link.innerText || "").toLowerCase();
          return href.includes("trav") || text.includes("traveller");
        });

        if (travLinks.length > 0) {
          const withEvent = travLinks.find((link) =>
            link.getAttribute("href").includes(eventId),
          );
          if (withEvent) return withEvent.getAttribute("href");
          return travLinks[0].getAttribute("href");
        }
        return null;
      }, selectedEvent.eventId);

      // Try standard URL formats as fallback
      const travUrlOptions = [];

      if (travellerLinkFromRankings) {
        let fullLink = travellerLinkFromRankings;
        if (!fullLink.startsWith("http")) {
          if (fullLink.startsWith("/")) {
            fullLink = `https://www.bridgewebs.com${fullLink}`;
          } else if (
            fullLink.startsWith("bw.cgi") ||
            fullLink.includes("pid=")
          ) {
            fullLink = `https://www.bridgewebs.com/cgi-bin/bwor/${fullLink}`;
          } else {
            fullLink = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?${fullLink}`;
          }
        }
        travUrlOptions.push(fullLink);
        console.log(`Found traveller link: ${fullLink}`);
      }

      travUrlOptions.push(
        `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=display_travs&event=${selectedEvent.eventId}`,
        `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?pid=display_travs&event=${selectedEvent.eventId}&club=${CLUB_ID}`,
        `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=travellers&event=${selectedEvent.eventId}&wd=1&full=1`,
      );

      // Try each URL format
      for (const url of travUrlOptions) {
        console.log(`Trying traveller URL: ${url}`);
        try {
          await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
          await new Promise((r) => setTimeout(r, 2000));

          const hasBoardData = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            if (
              bodyText.includes("Welcome to Liverpool Bridge Club") &&
              bodyText.includes("Want to play Bridge")
            ) {
              return false;
            }
            return (
              /Board\s+\d+/i.test(bodyText) &&
              (bodyText.includes("Contract") ||
                bodyText.includes("NS") ||
                bodyText.includes("EW") ||
                bodyText.includes("Declarer") ||
                bodyText.match(/\d+[NSHCD]/))
            );
          });

          if (hasBoardData) {
            console.log(`Found board data on URL: ${url}`);
            break;
          }
        } catch (err) {
          console.log(`Error loading ${url}: ${err.message}`);
          continue;
        }
      }
    } else {
      console.log("Already on traveller page with board data");
    }

    // Check if we're on a listing page and need to navigate
    const isListingPage = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return (
        bodyText.includes("Results Options") ||
        bodyText.includes("Show Names in Travellers") ||
        (bodyText.match(/\d+th\s+\w+\s+\d{4}/g) &&
          bodyText.match(/\d+th\s+\w+\s+\d{4}/g).length > 1)
      );
    });

    if (isListingPage) {
      console.log(
        "Detected listing page, trying to find and click session link...",
      );

      // Try to find the specific session link by matching date and session type
      const sessionLink = await page.evaluate(
        (eventId, sessionType) => {
          // Look for table rows or links that match the event date
          const dateMatch = eventId.match(/^(\d{4})(\d{2})(\d{2})/);
          if (!dateMatch) return null;

          const year = dateMatch[1];
          const month = dateMatch[2];
          const day = dateMatch[3];

          // Format: "29th January 2026" or "29 January 2026"
          const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];
          const monthName = monthNames[parseInt(month) - 1];
          const datePattern1 = `${day}th ${monthName} ${year}`;
          const datePattern2 = `${parseInt(day)} ${monthName} ${year}`;

          // Find all links
          const links = Array.from(document.querySelectorAll("a[href]"));

          // Look for links near the matching date text
          for (const link of links) {
            const parentText = link.parentElement?.innerText || "";
            const linkText = link.innerText || "";
            const href = link.getAttribute("href") || "";

            // Check if this link is near our target date
            if (
              (parentText.includes(datePattern1) ||
                parentText.includes(datePattern2) ||
                linkText.includes(datePattern1) ||
                linkText.includes(datePattern2)) &&
              (href.includes("trav") ||
                href.includes("display") ||
                href.includes(eventId))
            ) {
              return href;
            }
          }

          // Fallback: look for any link with the event ID
          const eventLink = links.find((link) => {
            const href = link.getAttribute("href") || "";
            return href.includes(eventId);
          });

          return eventLink ? eventLink.getAttribute("href") : null;
        },
        selectedEvent.eventId,
        sessionType,
      );

      if (sessionLink) {
        console.log(`Found session link: ${sessionLink}`);
        const fullUrl = sessionLink.startsWith("http")
          ? sessionLink
          : sessionLink.startsWith("/")
            ? `https://www.bridgewebs.com${sessionLink}`
            : `https://www.bridgewebs.com/cgi-bin/bwor/${sessionLink}`;
        console.log(`Navigating to: ${fullUrl}`);
        try {
          // Navigate and wait properly
          const response = await page.goto(fullUrl, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });
          if (response && response.status() >= 400) {
            console.log(`Warning: Page returned status ${response.status()}`);
          }
          await new Promise((r) => setTimeout(r, 3000));

          // Verify we're on the right page - wrap in try/catch in case page navigated away
          try {
            const pageCheck = await page.evaluate(() => {
              const bodyText = document.body.innerText;
              return {
                isHomePage: bodyText.includes(
                  "Welcome to Liverpool Bridge Club",
                ),
                hasBoardData:
                  /Board\s+\d+/i.test(bodyText) &&
                  bodyText.includes("Contract"),
                url: window.location.href,
              };
            });

            if (pageCheck.isHomePage) {
              console.log(
                "Warning: Still on home page after navigation, traveller link may be incorrect",
              );
            } else if (pageCheck.hasBoardData) {
              console.log(
                "Successfully navigated to traveller page with board data",
              );
            }
          } catch (evalErr) {
            console.log(
              `Could not evaluate page (may have navigated): ${evalErr.message}`,
            );
          }
        } catch (err) {
          console.log(`Error navigating to session link: ${err.message}`);
        }
      } else {
        // Try clicking on the date text directly
        console.log("Trying to click on date text...");
        const clicked = await page.evaluate((eventId) => {
          const dateMatch = eventId.match(/^(\d{4})(\d{2})(\d{2})/);
          if (!dateMatch) return false;

          const year = dateMatch[1];
          const month = dateMatch[2];
          const day = dateMatch[3];
          const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];
          const monthName = monthNames[parseInt(month) - 1];
          const dateText = `${day}th ${monthName} ${year}`;

          // Find element containing this date text
          const elements = Array.from(document.querySelectorAll("*"));
          const dateElement = elements.find((el) => {
            const text = el.innerText || "";
            return (
              text.includes(dateText) &&
              (el.tagName === "TD" || el.tagName === "A" || el.onclick)
            );
          });

          if (dateElement && dateElement.onclick) {
            dateElement.click();
            return true;
          }

          return false;
        }, selectedEvent.eventId);

        if (clicked) {
          await new Promise((r) => setTimeout(r, 3000));
        } else {
          console.log("Could not find or click session link");
        }
      }
    }

    // First, let's debug what we're seeing on the page
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
          table.innerText.match(/Board\s+\d+/i);
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
          looksLikeTraveller: hasBoard && (hasContract || hasNS),
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
        const boards = [];

        // Try multiple approaches to find board data
        // Approach 1: Look for tables
        const tables = Array.from(document.querySelectorAll("table"));

        // Approach 2: Look for divs or other containers with board data
        const allElements = Array.from(document.querySelectorAll("*"));
        const boardHeaders = allElements.filter((el) => {
          const text = el.innerText || "";
          return (
            /Board\s+\d+/i.test(text) &&
            (el.tagName === "H1" ||
              el.tagName === "H2" ||
              el.tagName === "H3" ||
              el.tagName === "TH" ||
              el.classList.contains("board"))
          );
        });

        console.log(
          `Found ${tables.length} tables and ${boardHeaders.length} board headers`,
        );

        // Process tables
        tables.forEach((table, tableIdx) => {
          const rows = Array.from(table.querySelectorAll("tr"));
          if (rows.length < 2) return; // Skip tables with no data rows

          // Try to find board number in various ways
          let boardNum = null;

          // Method 1: Look for "Board X" in the first row or table header
          const firstRowText = rows[0]?.innerText || "";
          const boardMatch1 = firstRowText.match(/Board\s+(\d+)/i);
          if (boardMatch1) {
            boardNum = boardMatch1[1];
          }

          // Method 2: Look in table caption or preceding elements
          if (!boardNum) {
            const caption = table.querySelector("caption");
            if (caption) {
              const boardMatch2 = caption.innerText.match(/Board\s+(\d+)/i);
              if (boardMatch2) boardNum = boardMatch2[1];
            }
          }

          // Method 3: Look in previous sibling elements (check up to 5 levels up)
          if (!boardNum) {
            let element = table;
            let attempts = 0;
            while (element && attempts < 5) {
              // Check previous siblings
              let prev = element.previousElementSibling;
              let siblingAttempts = 0;
              while (prev && siblingAttempts < 3) {
                const text = prev.innerText || "";
                const boardMatch3 = text.match(/Board\s+(\d+)/i);
                if (boardMatch3) {
                  boardNum = boardMatch3[1];
                  break;
                }
                prev = prev.previousElementSibling;
                siblingAttempts++;
              }
              if (boardNum) break;

              // Check parent's text content
              if (element.parentElement) {
                const parentText = element.parentElement.innerText || "";
                const boardMatch4 = parentText.match(/Board\s+(\d+)/i);
                if (boardMatch4) {
                  boardNum = boardMatch4[1];
                  break;
                }
              }

              element = element.parentElement;
              attempts++;
            }
          }

          // Method 4: Try to extract from table structure - sometimes board number is in a specific cell
          if (!boardNum && rows.length > 0) {
            const firstRowCells = Array.from(
              rows[0].querySelectorAll("td, th"),
            );
            for (const cell of firstRowCells) {
              const text = cell.innerText.trim();
              const boardMatch4 = text.match(/Board\s*(\d+)/i);
              if (boardMatch4) {
                boardNum = boardMatch4[1];
                break;
              }
            }
          }

          // Method 5: Look for board number in nearby board headers
          if (!boardNum && boardHeaders.length > 0) {
            // Find the closest board header to this table
            let closestHeader = null;
            let minDistance = Infinity;
            const tableRect = table.getBoundingClientRect();

            boardHeaders.forEach((header) => {
              const headerRect = header.getBoundingClientRect();
              const distance = Math.abs(tableRect.top - headerRect.bottom);
              if (distance < minDistance && distance < 200) {
                // Within 200px
                minDistance = distance;
                closestHeader = header;
              }
            });

            if (closestHeader) {
              const headerText = closestHeader.innerText || "";
              const boardMatch5 = headerText.match(/Board\s+(\d+)/i);
              if (boardMatch5) {
                boardNum = boardMatch5[1];
              }
            }
          }

          if (!boardNum) {
            // Skip this table if we can't find a board number
            return;
          }

          const results = [];

          // Process data rows (skip header row if it exists)
          // First, identify the header row to understand column structure
          let headerRow = rows[0];
          const headerCells = Array.from(headerRow.querySelectorAll("td, th"));
          const headerTexts = headerCells.map((c) =>
            (c.innerText || "").toLowerCase(),
          );

          // Find column indices for key fields
          const nsCol = headerTexts.findIndex(
            (h) => h.includes("ns") || h === "n/s" || h.match(/^n$/),
          );
          const ewCol = headerTexts.findIndex(
            (h) => h.includes("ew") || h === "e/w" || h.match(/^e$/),
          );
          const contractCol = headerTexts.findIndex((h) =>
            h.includes("contract"),
          );
          const declarerCol = headerTexts.findIndex((h) =>
            h.includes("declarer"),
          );
          const resultCol = headerTexts.findIndex(
            (h) => h.includes("result") || h.includes("tricks"),
          );
          const scoreCol = headerTexts.findIndex(
            (h) => h.includes("score") || h.includes("match"),
          );

          // If we can't find headers, try positional parsing
          const usePositional = nsCol === -1 && contractCol === -1;

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = Array.from(row.querySelectorAll("td"));

            if (cells.length < 3) continue; // Skip rows with too few cells

            let nsText = "";
            let ewText = "";
            let contract = "";
            let declarer = "";
            let result = "";
            let nsScore = "";
            let ewScore = "";

            if (!usePositional && (nsCol >= 0 || contractCol >= 0)) {
              // Use header-based column mapping
              if (nsCol >= 0 && nsCol < cells.length)
                nsText = cells[nsCol]?.innerText.trim() || "";
              if (ewCol >= 0 && ewCol < cells.length)
                ewText = cells[ewCol]?.innerText.trim() || "";
              if (contractCol >= 0 && contractCol < cells.length)
                contract = cells[contractCol]?.innerText.trim() || "";
              if (declarerCol >= 0 && declarerCol < cells.length)
                declarer = cells[declarerCol]?.innerText.trim() || "";
              if (resultCol >= 0 && resultCol < cells.length)
                result = cells[resultCol]?.innerText.trim() || "";
              if (scoreCol >= 0 && scoreCol < cells.length) {
                const scoreText = cells[scoreCol]?.innerText.trim() || "";
                // Score might be "NS/EW" format
                const scoreMatch = scoreText.match(/(\d+)\s*[\/\-]\s*(\d+)/);
                if (scoreMatch) {
                  nsScore = scoreMatch[1];
                  ewScore = scoreMatch[2];
                } else {
                  nsScore = scoreText;
                }
              }
            } else {
              // Positional parsing - try common structures
              if (cells.length >= 6) {
                // Standard: NS, EW, Contract, Declarer, Result, NS Score, EW Score
                nsText = cells[0]?.innerText.trim() || "";
                ewText = cells[1]?.innerText.trim() || "";
                contract = cells[2]?.innerText.trim() || "";
                declarer = cells[3]?.innerText.trim() || "";
                result = cells[4]?.innerText.trim() || "";
                nsScore = cells[5]?.innerText.trim() || "";
                ewScore = cells[6]?.innerText.trim() || "";
              } else if (cells.length >= 5) {
                // Alternative: NS, EW, Contract, Result, Score
                nsText = cells[0]?.innerText.trim() || "";
                ewText = cells[1]?.innerText.trim() || "";
                contract = cells[2]?.innerText.trim() || "";
                result = cells[3]?.innerText.trim() || "";
                const scoreText = cells[4]?.innerText.trim() || "";
                const scoreMatch = scoreText.match(/(\d+)\s*[\/\-]\s*(\d+)/);
                if (scoreMatch) {
                  nsScore = scoreMatch[1];
                  ewScore = scoreMatch[2];
                } else {
                  nsScore = scoreText;
                }
              } else if (cells.length >= 4) {
                // Minimal: Pair, Contract, Result, Score
                const pairText = cells[0]?.innerText.trim() || "";
                contract = cells[1]?.innerText.trim() || "";
                result = cells[2]?.innerText.trim() || "";
                nsScore = cells[3]?.innerText.trim() || "";

                // Try to extract NS/EW from pair text
                const pairMatch = pairText.match(/(\d+)[\s\-/]+(\d+)/);
                if (pairMatch) {
                  nsText = pairMatch[1];
                  ewText = pairMatch[2];
                } else if (pairText.match(/^\d+$/)) {
                  nsText = pairText;
                }
              }
            }

            // Validate we have essential data - contract is required
            if (
              !contract ||
              contract === "" ||
              contract.toLowerCase() === "pass" ||
              contract.toLowerCase() === "all pass"
            ) {
              continue;
            }

            // Check if nsText/ewText look like pair numbers (digits only)
            if (nsText && !nsText.match(/^\d+$/)) {
              // Might be a name, try to extract number
              const numMatch = nsText.match(/(\d+)/);
              if (numMatch) nsText = numMatch[1];
              else continue; // Skip if we can't find a number
            }
            if (ewText && !ewText.match(/^\d+$/)) {
              const numMatch = ewText.match(/(\d+)/);
              if (numMatch) ewText = numMatch[1];
            }

            // Only add if we have at least contract and one identifier
            if (contract && (nsText || ewText || nsScore)) {
              results.push({
                ns: nsText || "",
                ew: ewText || "",
                contract: contract,
                declarer: declarer,
                result: result,
                nsScore: nsScore || "0",
                ewScore: ewScore || "0",
              });
            }
          }

          if (results.length > 0) {
            boards.push({ boardNum, results });
          }
        });

        return boards;
      });

      boardResults = parsedBoardResults;
    } catch (err) {
      console.error("[DEBUG] Failed to extract board results:", err);
      await debugDump("extract_boards_error");
      throw err;
    }
    if (!boardResults || boardResults.length === 0) {
      await debugDump("no_boards_found");
      throw new Error(
        "No board results found on traveller page. See debug screenshots/HTML for details.",
      );
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
        boardsMap[boardNum].results.push({
          ns: sc.ns,
          ew: sc.ew,
          contract: sc.contract,
          declarer: sc.declarer,
          lead: sc.lead,
          tricks: sc.tricks,
          nsScore: '', // Will be populated from scorecard if available
          ewScore: '', // Will be populated from scorecard if available
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

    for (let i = 1; i < boardBlocks.length; i++) {
      const block = '[Board "' + boardBlocks[i];
      const boardMatch = block.match(/\[Board "(\d+)"\]/);
      if (!boardMatch) continue;

      const boardNum = boardMatch[1];
      const dealMatch = block.match(/\[Deal "([^"]+)"\]/);
      const dealerMatch = block.match(/\[Dealer "([^"]+)"\]/);
      const vulnMatch = block.match(/\[Vulnerable "([^"]+)"\]/);

      if (dealMatch) {
        const dealString = dealMatch[1];
        const dealer = dealerMatch ? dealerMatch[1] : "N";
        const vuln = vulnMatch ? vulnMatch[1] : "None";

        // Parse deal string: "N:AKQT.AQ9.AT53.92 75.8765.K8762.A6 ..."
        // Format is "FirstHand:Hand1 Hand2 Hand3 Hand4"
        const parts = dealString.split(":");
        const firstSeat = parts[0];
        const hands = parts[1].split(" ");

        // Calculate HCP for each hand
        const calculateHCP = (hand) => {
          let hcp = 0;
          for (let card of hand) {
            if (card === "A") hcp += 4;
            else if (card === "K") hcp += 3;
            else if (card === "Q") hcp += 2;
            else if (card === "J") hcp += 1;
          }
          return hcp;
        };

        // Map hands to positions based on first seat
        const seatOrder = { N: 0, E: 1, S: 2, W: 3 };
        const firstIndex = seatOrder[firstSeat];
        const positions = ["N", "E", "S", "W"];

        const handsByPosition = {};
        hands.forEach((hand, idx) => {
          const position = positions[(firstIndex + idx) % 4];
          handsByPosition[position] = hand;
        });

        const nsHCP =
          calculateHCP(handsByPosition["N"] || "") +
          calculateHCP(handsByPosition["S"] || "");
        const ewHCP =
          calculateHCP(handsByPosition["E"] || "") +
          calculateHCP(handsByPosition["W"] || "");

        handDiagrams[boardNum] = {
          deal: dealString,
          dealer: dealer,
          vuln: vuln,
          nsHCP: nsHCP,
          ewHCP: ewHCP,
        };
      }
    }

    // Merge hands with results
    const boards = boardResults.map((b) => ({
      boardNum: b.boardNum,
      hands: handDiagrams[b.boardNum]?.deal || "",
      dealer: handDiagrams[b.boardNum]?.dealer || "",
      vuln: handDiagrams[b.boardNum]?.vuln || "",
      nsHCP: handDiagrams[b.boardNum]?.nsHCP || 0,
      ewHCP: handDiagrams[b.boardNum]?.ewHCP || 0,
      results: b.results,
    }));

    return {
      eventInfo: selectedEvent,
      rankings: rankings.slice(0, 10),
      boards: boards.slice(0, 30),
      scorecards: scorecardsData, // MAIN SOURCE: Contract, Declarer, Lead, Tricks, Scores
    };
  } catch (err) {
    console.error("Scraping error:", err);
    throw err;
  } finally {
    await browser.close();
  }
}
