const express = require('express');
const auth = require('../middleware/auth');
const AdmitDatesheet = require('../models/AdmitDatesheet');

const router = express.Router();
const MUTATION_ROLES = new Set(['admin', 'staff']);

function canMutate(req) {
    return MUTATION_ROLES.has(req.user?.role);
}

function normalizeDatesheet(body = {}) {
    const session = String(body.session || '').trim();
    const className = String(body.className || '').trim();
    const section = String(body.section || '').trim();
    const examTitle = String(body.examTitle || 'Annual Examination').trim();
    const admitNote = String(body.admitNote || 'Students must carry this admit card every examination day.').trim();
    const datesheetRows = Array.isArray(body.datesheetRows)
        ? body.datesheetRows.map((row) => ({
            subject: String(row.subject || '').trim(),
            date: String(row.date || '').trim(),
            day: String(row.day || '').trim(),
            timing: String(row.timing || '').trim(),
            teacherSignature: String(row.teacherSignature || '').trim()
        }))
        : [];

    if (!session || !className || !section) {
        return { error: 'Session, class, and section are required' };
    }

    return { session, className, section, examTitle, admitNote, datesheetRows };
}

router.get('/', auth, async (req, res) => {
    try {
        const query = {
            session: String(req.query.session || '').trim(),
            className: String(req.query.className || '').trim(),
            section: String(req.query.section || '').trim(),
            isDeleted: { $ne: true }
        };

        if (!query.session || !query.className || !query.section) {
            return res.status(400).json({ success: false, message: 'Session, class, and section are required' });
        }

        const datesheet = await AdmitDatesheet.findOne(query).lean();
        res.json({ success: true, datesheet });
    } catch (error) {
        console.error('Admit datesheet fetch error:', error);
        res.status(500).json({ success: false, message: 'Error fetching admit datesheet' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        if (!canMutate(req)) {
            return res.status(403).json({ success: false, message: 'Only admin or staff can save admit datesheets' });
        }

        const payload = normalizeDatesheet(req.body);
        if (payload.error) {
            return res.status(400).json({ success: false, message: payload.error });
        }

        const datesheet = await AdmitDatesheet.findOneAndUpdate(
            {
                session: payload.session,
                className: payload.className,
                section: payload.section,
                isDeleted: { $ne: true }
            },
            { $set: payload },
            { new: true, upsert: true, runValidators: true }
        );

        res.json({ success: true, message: 'Admit datesheet saved successfully', datesheet });
    } catch (error) {
        console.error('Admit datesheet save error:', error);
        res.status(500).json({ success: false, message: 'Error saving admit datesheet' });
    }
});

router.delete('/', auth, async (req, res) => {
    try {
        if (!canMutate(req)) {
            return res.status(403).json({ success: false, message: 'Only admin or staff can reset admit datesheets' });
        }

        const query = {
            session: String(req.query.session || '').trim(),
            className: String(req.query.className || '').trim(),
            section: String(req.query.section || '').trim(),
            isDeleted: { $ne: true }
        };

        if (!query.session || !query.className || !query.section) {
            return res.status(400).json({ success: false, message: 'Session, class, and section are required' });
        }

        const datesheet = await AdmitDatesheet.findOne(query);
        if (datesheet) {
            datesheet.isDeleted = true;
            await datesheet.save();
        }

        res.json({ success: true, message: 'Admit datesheet reset successfully' });
    } catch (error) {
        console.error('Admit datesheet reset error:', error);
        res.status(500).json({ success: false, message: 'Error resetting admit datesheet' });
    }
});

module.exports = router;
