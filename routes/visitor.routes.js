const express = require('express');
const VisitorCounter = require('../models/VisitorCounter');

const router = express.Router();
const LOGIN_PAGE_KEY = 'login-page';

async function getLoginVisitorCounter() {
    return VisitorCounter.findOneAndUpdate(
        { key: LOGIN_PAGE_KEY },
        { $setOnInsert: { key: LOGIN_PAGE_KEY, count: 0 } },
        { new: true, upsert: true }
    );
}

router.get('/login', async (req, res) => {
    try {
        const counter = await getLoginVisitorCounter();
        res.json({ success: true, count: counter.count });
    } catch (error) {
        console.error('Visitor counter fetch error:', error);
        res.status(500).json({ success: false, message: 'Error fetching visitor count' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const counter = await VisitorCounter.findOneAndUpdate(
            { key: LOGIN_PAGE_KEY },
            {
                $inc: { count: 1 },
                $set: { lastVisitedAt: new Date() },
                $setOnInsert: { key: LOGIN_PAGE_KEY }
            },
            { new: true, upsert: true }
        );

        res.json({ success: true, count: counter.count });
    } catch (error) {
        console.error('Visitor counter update error:', error);
        res.status(500).json({ success: false, message: 'Error updating visitor count' });
    }
});

module.exports = router;
