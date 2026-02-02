
import express from 'express';
import cors from 'cors';
import { getSessionData } from './scraper.js';
import { generateNewsletter } from './src/generator.js';

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

// Function removed - now imported from src/generator.js

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
                success: true, // Still success from a user perspective (server worked, results just pending)
                html,
                data: placeholderData,
                isPending: true
            });
        }
        console.error("Server error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
