const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Static folder for frontend
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/telegram_mini_app";
mongoose.connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection error:", err));

// --- Schemas ---
const userSchema = new mongoose.Schema({
    telegramId: { type: String, unique: true, required: true },
    name: String,
    balance: { type: Number, default: 0 },
    isActivated: { type: Boolean, default: false },
    referrerId: { type: String, default: null }
});

const gmailSchema = new mongoose.Schema({
    email: String,
    password: { type: String, default: "5362412." },
    isAssigned: { type: Boolean, default: false },
    assignedTo: { type: String, default: null }
});

const taskSchema = new mongoose.Schema({
    telegramId: String,
    email: String,
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

const withdrawSchema = new mongoose.Schema({
    telegramId: String,
    amount: Number,
    method: String,
    accountNo: String,
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Gmail = mongoose.model('Gmail', gmailSchema);
const Task = mongoose.model('Task', taskSchema);
const Withdraw = mongoose.model('Withdraw', withdrawSchema);

// --- API Routes ---

app.post('/api/user/login', async (req, res) => {
    try {
        const { telegramId, name, referrerId } = req.body;
        let user = await User.findOne({ telegramId });

        if (!user) {
            user = new User({ telegramId, name, referrerId: referrerId || null });
            await user.save();

            if (referrerId) {
                const referrer = await User.findOne({ telegramId: referrerId });
                if (referrer) {
                    referrer.balance += 5;
                    await referrer.save();
                }
            }
        }
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/user/:telegramId', async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.params.telegramId });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/user/activate', async (req, res) => {
    try {
        const { telegramId } = req.body;
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (user.balance < 100) {
            return res.status(400).json({ success: false, message: "পর্যাপ্ত ব্যালেন্স নেই! অ্যাক্টিভেশনের জন্য ১০০ টাকা প্রয়োজন।" });
        }

        user.balance -= 100;
        user.isActivated = true;
        await user.save();

        res.json({ success: true, message: "আইডি সফলভাবে অ্যাক্টিভ হয়েছে!", user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/task/get', async (req, res) => {
    try {
        const { telegramId } = req.body;
        const user = await User.findOne({ telegramId });
        if (!user || !user.isActivated) {
            return res.status(400).json({ success: false, message: "আগে আইডি অ্যাক্টিভ করুন!" });
        }

        let existingTask = await Task.findOne({ telegramId, status: 'Pending' });
        if (existingTask) {
            const gmail = await Gmail.findOne({ email: existingTask.email });
            return res.json({ success: true, gmail });
        }

        const gmail = await Gmail.findOne({ isAssigned: false });
        if (!gmail) {
            return res.status(400).json({ success: false, message: "বর্তমানে কোনো জিমেইল উপলব্ধ নেই।" });
        }

        gmail.isAssigned = true;
        gmail.assignedTo = telegramId;
        await gmail.save();

        const newTask = new Task({ telegramId, email: gmail.email });
        await newTask.save();

        res.json({ success: true, gmail });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/task/submit', async (req, res) => {
    try {
        const { telegramId, email } = req.body;
        const task = await Task.findOne({ telegramId, email, status: 'Pending' });
        if (!task) return res.status(400).json({ success: false, message: "টাস্ক পাওয়া যায়নি।" });

        task.status = 'Approved';
        await task.save();

        const user = await User.findOne({ telegramId });
        user.balance += 10;
        await user.save();

        res.json({ success: true, message: "টাস্ক সফলভাবে সম্পন্ন হয়েছে! ১০ টাকা যোগ হয়েছে।", user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/withdraw', async (req, res) => {
    try {
        const { telegramId, amount, method, accountNo } = req.body;
        const user = await User.findOne({ telegramId });

        if (!user || !user.isActivated) {
            return res.status(400).json({ success: false, message: "আইডি অ্যাক্টিভ ছাড়া উইথড্র করা যাবে না।" });
        }
        if (amount < 100) {
            return res.status(400).json({ success: false, message: "সর্বনিম্ন ১০০ টাকা উইথড্র করতে হবে।" });
        }
        if (user.balance < amount) {
            return res.status(400).json({ success: false, message: "অপর্যাপ্ত ব্যালেন্স।" });
        }

        user.balance -= amount;
        await user.save();

        const withdraw = new Withdraw({ telegramId, amount, method, accountNo });
        await withdraw.save();

        res.json({ success: true, message: "উইথড্র রিকোয়েস্ট সফলভাবে জমা হয়েছে!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Admin APIs ---
app.post('/api/admin/upload-gmails', async (req, res) => {
    try {
        const { emails } = req.body;
        const emailList = emails.split('\n').map(e => e.trim()).filter(e => e);
        
        const docs = emailList.map(email => ({ email, password: "5362412." }));
        await Gmail.insertMany(docs, { ordered: false }).catch(() => {});

        res.json({ success: true, message: `${emailList.length} টি জিমেইল আপলোড করা হয়েছে।` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/admin/withdraws', async (req, res) => {
    try {
        const list = await Withdraw.find().sort({ createdAt: -1 });
        res.json({ success: true, list });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start Telegram Bot
require('./bot');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
