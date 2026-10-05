const TelegramBot = require('node-telegram-bot-api');

// আপনার দেওয়া টেলিগ্রাম বট টোকেন
const token = "8799617913:AAFzmWsuB_z2lZhLotULSboudBvCqOLvZyU";
const WEB_APP_URL = process.env.WEB_APP_URL || "https://your-app.vercel.app";

const bot = new TelegramBot(token, { polling: true });

console.log("Telegram Bot is running with token...");

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || "বন্ধু";

    const welcomeMessage = `স্বাগতম ${userName}! ⚡\n\nআমাদের টাস্ক এবং রিওয়ার্ড মিনি অ্যাপে আপনাকে স্বাগতম। নিচে ক্লিক করে মিনি অ্যাপ ওপেন করুন।`;

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "🚀 মিনি অ্যাপ ওপেন করুন",
                        web_app: { url: WEB_APP_URL }
                    }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, welcomeMessage, opts);
});
