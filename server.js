console.log("1. Starting server.js...");

async function start() {
    try {
        console.log("2. Importing express...");
        const express = (await import('express')).default;
        console.log("3. Importing cors...");
        const cors = (await import('cors')).default;
        console.log("4. Importing scraper...");
        const { getSessionData } = await import('./scraper.js');
        console.log("5. Importing generator...");
        const { generateNewsletter } = await import('./src/generator.js');

        const app = express();
        app.use(cors());
        app.use(express.json());

        const PORT = 3010;

        app.get('/', (req, res) => {
            res.send(`
                <html>
                    <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                        <h1>Bridge Bot API is Running 🤖</h1>
                        <p>You are on the backend server port.</p>
                        <p>Please visit the frontend application here:</p>
                        <a href="http://localhost:3000" style="font-size: 1.2em; color: #0056b3;">http://localhost:3000</a>
                    </body>
                </html>
            `);
        });

        app.post('/api/generate', async (req, res) => {
            const { date, type, override } = req.body;
            try {
                console.log("Starting session scrape...");
                const sessionDate = override && date ? date.replace(/-/g, '') : null;
                const data = await getSessionData(sessionDate, type);

                console.log("Generating newsletter...");
                const html = generateNewsletter(data);

                res.json({
                    success: true,
                    html,
                    data,
                    eventId: data.eventInfo.eventId
                });
            } catch (err) {
                if (err.name === 'NoResultsError') {
                    const placeholderData = {
                        eventInfo: err.eventInfo || { text: `${type} Session` },
                        rankings: [],
                        boards: [],
                        scorecards: []
                    };
                    const html = generateNewsletter(placeholderData);
                    return res.json({
                        success: true,
                        html,
                        data: placeholderData,
                        isPending: true
                    });
                }
                console.error("Server error:", err);
                res.status(500).json({ success: false, error: err.message });
            }
        });

        app.listen(PORT, '127.0.0.1', () => console.log(`6. Server running on http://127.0.0.1:${PORT}`));
    } catch (err) {
        console.error("CRITICAL STARTUP ERROR:", err);
    }
}

start();
