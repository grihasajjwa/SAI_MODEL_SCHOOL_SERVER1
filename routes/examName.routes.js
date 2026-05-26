const express = require('express');
const auth = require('../middleware/auth');
const ExamNameConfig = require('../models/ExamNameConfig');

const router = express.Router();

const DEFAULT_EXAMS = [
    { key: 'pt1', name: 'Periodic Test 1', sortOrder: 1, active: true },
    { key: 'hy', name: 'Half Yearly', sortOrder: 2, active: true },
    { key: 'pt2', name: 'Periodic Test 2', sortOrder: 3, active: true },
    { key: 'final', name: 'Final Exam', sortOrder: 4, active: true }
];

function buildDefaultConfig(session = 'Default') {
    return {
        session,
        examCount: DEFAULT_EXAMS.length,
        exams: DEFAULT_EXAMS
    };
}

function normalizeExamConfig(body = {}) {
    const session = String(body.session || '').trim();
    const requestedCount = Number(body.examCount);
    const exams = Array.isArray(body.exams) ? body.exams : [];
    const examCount = Math.max(1, Math.min(12, Number.isFinite(requestedCount) ? requestedCount : exams.length || 4));

    if (!session) {
        return { error: 'Session is required' };
    }

    const normalizedExams = exams
        .slice(0, examCount)
        .map((exam, index) => {
            const fallback = DEFAULT_EXAMS[index] || {};
            const key = String(exam.key || fallback.key || `exam${index + 1}`).trim();
            const name = String(exam.name || fallback.name || `Exam ${index + 1}`).trim();
            return {
                key,
                name,
                sortOrder: index + 1,
                active: true
            };
        })
        .filter((exam) => exam.key && exam.name);

    while (normalizedExams.length < examCount) {
        const index = normalizedExams.length;
        const fallback = DEFAULT_EXAMS[index] || {};
        normalizedExams.push({
            key: fallback.key || `exam${index + 1}`,
            name: fallback.name || `Exam ${index + 1}`,
            sortOrder: index + 1,
            active: true
        });
    }

    return {
        session,
        examCount,
        exams: normalizedExams
    };
}

router.get('/', auth, async (req, res) => {
    try {
        const configs = await ExamNameConfig.find().sort({ session: -1 }).lean();
        res.json({ success: true, configs });
    } catch (error) {
        console.error('Exam name config list error:', error);
        res.status(500).json({ success: false, message: 'Error fetching exam names' });
    }
});

router.get('/:session', auth, async (req, res) => {
    try {
        const session = String(req.params.session || '').trim();
        const config = await ExamNameConfig.findOne({ session }).lean();
        res.json({ success: true, config: config || buildDefaultConfig(session) });
    } catch (error) {
        console.error('Exam name config fetch error:', error);
        res.status(500).json({ success: false, message: 'Error fetching exam names' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const normalized = normalizeExamConfig(req.body);
        if (normalized.error) {
            return res.status(400).json({ success: false, message: normalized.error });
        }

        const config = await ExamNameConfig.findOneAndUpdate(
            { session: normalized.session },
            { $set: normalized },
            { new: true, upsert: true, runValidators: true }
        );

        res.json({ success: true, config });
    } catch (error) {
        console.error('Exam name config save error:', error);
        res.status(500).json({ success: false, message: 'Error saving exam names' });
    }
});

module.exports = router;
