const express = require('express');
const QuestionPaper = require('../models/QuestionPaper');

const router = express.Router();

function requiredScope(query) {
    const session = String(query.session || '').trim();
    const className = String(query.className || '').trim();
    const subject = String(query.subject || '').trim();
    const examName = String(query.examName || '').trim();

    if (!session || !className || !subject || !examName) {
        return null;
    }

    return { session, className, subject, examName };
}

router.get('/', async (req, res) => {
    try {
        const filter = {};
        ['session', 'className', 'subject', 'examName'].forEach((key) => {
            if (req.query[key]) {
                filter[key] = String(req.query[key]).trim();
            }
        });

        const papers = await QuestionPaper.find(filter)
            .select('session className subject examName title updatedAt createdAt')
            .sort({ updatedAt: -1 })
            .limit(100);

        res.json({ papers });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch question papers', error: error.message });
    }
});

router.get('/single', async (req, res) => {
    try {
        const scope = requiredScope(req.query);
        if (!scope) {
            return res.status(400).json({ message: 'Session, class, subject, and exam name are required' });
        }

        const paper = await QuestionPaper.findOne(scope);
        if (!paper) {
            return res.status(404).json({ message: 'Question paper not found' });
        }

        res.json({ paper });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch question paper', error: error.message });
    }
});

router.put('/', async (req, res) => {
    try {
        const scope = requiredScope(req.body);
        const paperData = req.body.paperData;

        if (!scope) {
            return res.status(400).json({ message: 'Session, class, subject, and exam name are required' });
        }

        if (!paperData || !Array.isArray(paperData.elements)) {
            return res.status(400).json({ message: 'Paper data must include an elements array' });
        }

        const paper = await QuestionPaper.findOneAndUpdate(
            scope,
            {
                ...scope,
                title: req.body.title || '',
                paperData
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        res.json({ message: 'Question paper saved successfully', paper });
    } catch (error) {
        res.status(500).json({ message: 'Failed to save question paper', error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const paper = await QuestionPaper.findByIdAndDelete(req.params.id);
        if (!paper) {
            return res.status(404).json({ message: 'Question paper not found' });
        }

        res.json({ message: 'Question paper deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete question paper', error: error.message });
    }
});

module.exports = router;
