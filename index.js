require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Telegraf } = require('telegraf');

// 1. Setup
const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const PORT = process.env.PORT || 3000;
const OWNER_ID = process.env.OWNER_TELEGRAM_ID;
const SECRET = process.env.QUIZ_SECRET;

// 2. Middleware
app.use(cors()); // Allow requests from your frontend
app.use(bodyParser.json());

// 3. Health Check
app.get('/health', (req, res) => res.status(200).send('LoveQuiz Bot is alive! 💗'));

// 4. Webhook Endpoint
app.post('/webhook/quiz-answer', async (req, res) => {
    const { headers, body } = req;

    // Security: Validate Shared Secret
    if (headers['x-quiz-secret'] !== SECRET) {
        console.warn('⚠️ Unauthorized access attempt');
        return res.status(403).json({ error: 'Forbidden: Invalid Secret' });
    }

    // Rate limiting (basic implementation)
    // In production, use express-rate-limit

    try {
        const { 
            question_text, 
            answer, 
            answer_type, 
            timestamp, 
            sensitivity, 
            user_info, 
            allow_send 
        } = body;

        const partnerName = user_info?.partnerName || 'Partner';
        
        // Logic: If intimate and allow_send is false, do NOT forward
        let finalAnswer = answer;
        if (sensitivity === 'intimate' && allow_send !== true) {
            finalAnswer = '🔒 (Private — User chose not to send)';
        } else if (!answer) {
            finalAnswer = '⏭️ (Skipped)';
        }

        // 5. Construct Telegram Message
        // Using HTML for safe formatting
        const message = `
<b>💌 New answer from ${partnerName}</b>
-----------------------------
<b>Q:</b> ${question_text}
<b>A:</b> ${finalAnswer}
-----------------------------
<i>Time: ${timestamp}</i>
<i>Sensitivity: ${sensitivity}</i>
        `;

        // 6. Send to Telegram
        await bot.telegram.sendMessage(OWNER_ID, message, { parse_mode: 'HTML' });
        
        console.log(`✅ Forwarded Q: "${question_text}"`);
        return res.json({ ok: true, forwarded: true });

    } catch (error) {
        console.error('❌ Error forwarding message:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 7. Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🤖 Bot acts for owner: ${OWNER_ID}`);
});

// Start Bot (long-polling not strictly needed for push-only, but good for debug)
bot.launch().catch(err => console.error(err));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
