import puppeteer from "puppeteer";

const CLUB_ID = "liverpool";
const EVENT_ID = "20260129_1";

async function analyzeTravellersData() {
    console.log("=== Analyzing Travellers Data Structure ===\n");

    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        page.on('console', msg => console.log('BROWSER:', msg.text()));
        await page.setViewport({ width: 1400, height: 900 });

        const url = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?pid=display_rank&event=${EVENT_ID}&club=${CLUB_ID}`;
        console.log(`Loading: ${url}\n`);

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        // Click Travellers tab
        console.log("Clicking Travellers tab...");
        await page.evaluate(() => {
            const allDivs = Array.from(document.querySelectorAll('div.button_href_middle, div.button_href_left, div.button_href_right'));
            for (const div of allDivs) {
                const text = (div.innerText || div.textContent || "").trim().toLowerCase();
                if (text === "travellers" || text === "traveller") {
                    div.click();
                    return;
                }
            }
        });

        await new Promise(r => setTimeout(r, 3000));
        console.log("Travellers page loaded.\n");

        // Analyze the table structure
        const tableAnalysis = await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll("table"));
            console.log(`Found ${tables.length} tables total`);

            const results = [];

            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                const rows = Array.from(table.querySelectorAll("tr"));

                if (rows.length < 2) continue;

                // Get headers
                const headerRow = rows[0];
                const headerCells = Array.from(headerRow.querySelectorAll("td, th"));
                const headers = headerCells.map(c => (c.innerText || "").trim());

                // Get first few data rows
                const sampleRows = [];
                for (let j = 1; j < Math.min(5, rows.length); j++) {
                    const cells = Array.from(rows[j].querySelectorAll("td, th"));
                    const rowData = cells.map(c => (c.innerText || "").trim());
                    sampleRows.push(rowData);
                }

                // Check if this looks like a traveller table
                const hasContract = headers.some(h => h.toLowerCase().includes("contract") || h.toLowerCase().includes("bid"));
                const hasNS = headers.some(h => h.toLowerCase().includes("ns") || h === "N/S");
                const hasEW = headers.some(h => h.toLowerCase().includes("ew") || h === "E/W");
                const hasBoard = headers.some(h => h.toLowerCase().includes("board") || h === "Bd");

                if (hasContract || hasNS || hasBoard) {
                    results.push({
                        tableIndex: i,
                        rowCount: rows.length,
                        headers: headers,
                        sampleRows: sampleRows,
                        looksLikeTraveller: hasContract && (hasNS || hasEW)
                    });
                }
            }

            return results;
        });

        console.log(`Found ${tableAnalysis.length} potential data tables:\n`);

        tableAnalysis.forEach((table, i) => {
            console.log(`Table ${table.tableIndex} (${table.rowCount} rows):`);
            console.log(`  Headers: ${table.headers.join(" | ")}`);
            console.log(`  Looks like traveller: ${table.looksLikeTraveller}`);
            console.log(`  Sample rows:`);
            table.sampleRows.forEach((row, j) => {
                console.log(`    Row ${j + 1}: ${row.join(" | ")}`);
            });
            console.log("");
        });

        // Look for slam contracts
        console.log("\nSearching for slam contracts...\n");

        const slams = await page.evaluate(() => {
            const results = [];
            const tables = Array.from(document.querySelectorAll("table"));

            for (const table of tables) {
                const rows = Array.from(table.querySelectorAll("tr"));

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const text = row.innerText || "";

                    // Look for slam contracts: 6C, 6D, 6H, 6S, 6NT, 7C, 7D, 7H, 7S, 7NT
                    const slamPattern = /[67][CDHSN][TX]?/gi;
                    const matches = text.match(slamPattern);

                    if (matches) {
                        const cells = Array.from(row.querySelectorAll("td, th"));
                        const rowData = cells.map(c => (c.innerText || "").trim());

                        results.push({
                            rowIndex: i,
                            matches: matches,
                            rowData: rowData
                        });
                    }
                }
            }

            return results;
        });

        console.log(`Found ${slams.length} rows with potential slam contracts:\n`);
        slams.forEach((slam, i) => {
            console.log(`${i + 1}. Contracts: ${slam.matches.join(", ")}`);
            console.log(`   Row data: ${slam.rowData.join(" | ")}`);
            console.log("");
        });

        console.log("\n=== Browser staying open for 60 seconds ===\n");
        await new Promise(r => setTimeout(r, 60000));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

analyzeTravellersData().catch(console.error);
