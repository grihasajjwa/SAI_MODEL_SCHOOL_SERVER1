const express = require('express');
const auth = require('../middleware/auth');
const ExamRoutine = require('../models/ExamRoutine');

const router = express.Router();
const MUTATION_ROLES = new Set(['admin', 'staff']);

function canMutate(req) {
    return MUTATION_ROLES.has(req.user?.role);
}

function normalizeRoutinePayload(body = {}) {
    const title = String(body.title || 'Skyview Public School').trim();
    const examName = String(body.examName || '').trim();
    const academicYear = String(body.academicYear || '').trim();
    const classes = Array.isArray(body.classes)
        ? body.classes.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    const rows = Array.isArray(body.rows)
        ? body.rows
            .map((row) => ({
                rowId: String(row.rowId || '').trim() || `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                date: row.date ? new Date(row.date) : null,
                subjects: row.subjects && typeof row.subjects === 'object' ? row.subjects : {}
            }))
            .filter((row) => row.date && !Number.isNaN(row.date.getTime()))
        : [];
    const notes = Array.isArray(body.notes)
        ? body.notes.map((item) => String(item || '').trim()).filter(Boolean)
        : [];

    if (!examName || !academicYear) {
        return { status: 400, body: { success: false, message: 'Exam name and academic year are required' } };
    }

    if (!classes.length) {
        return { status: 400, body: { success: false, message: 'At least one class column is required' } };
    }

    if (!rows.length) {
        return { status: 400, body: { success: false, message: 'At least one exam date row is required' } };
    }

    return {
        status: null,
        body: {
            title,
            examName,
            academicYear,
            timeText: String(body.timeText || '').trim() || 'Time 10:30 am to 12:00 pm.',
            schoolOverText: String(body.schoolOverText || '').trim() || 'School will get over at 1.00 pm for all the classes.',
            notes,
            classes,
            rows
        }
    };
}

function normalizeRoutineRow(row = {}) {
    const date = row.date ? new Date(row.date) : null;
    if (!date || Number.isNaN(date.getTime())) {
        return { status: 400, body: { success: false, message: 'Valid exam date is required for this row' } };
    }

    return {
        status: null,
        body: {
            rowId: String(row.rowId || '').trim() || `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            date,
            subjects: row.subjects && typeof row.subjects === 'object' ? row.subjects : {}
        }
    };
}

function applyRoutineMeta(routine, body = {}) {
    if (body.title !== undefined) routine.title = String(body.title || 'Skyview Public School').trim();
    if (body.examName !== undefined) routine.examName = String(body.examName || '').trim();
    if (body.academicYear !== undefined) routine.academicYear = String(body.academicYear || '').trim();
    if (body.timeText !== undefined) routine.timeText = String(body.timeText || '').trim() || 'Time 10:30 am to 12:00 pm.';
    if (body.schoolOverText !== undefined) routine.schoolOverText = String(body.schoolOverText || '').trim() || 'School will get over at 1.00 pm for all the classes.';
    if (Array.isArray(body.notes)) routine.notes = body.notes.map((item) => String(item || '').trim()).filter(Boolean);
    if (Array.isArray(body.classes)) routine.classes = body.classes.map((item) => String(item || '').trim()).filter(Boolean);
}

router.get('/', auth, async (req, res) => {
    try {
        const routines = await ExamRoutine.find({ isDeleted: { $ne: true } })
            .select('title examName academicYear timeText schoolOverText notes classes rows createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .lean();

        res.json({ success: true, routines });
    } catch (error) {
        console.error('Exam routine list error:', error);
        res.status(500).json({ success: false, message: 'Error fetching exam routines' });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const routine = await ExamRoutine.findById(req.params.id).lean();
        if (!routine || routine.isDeleted) {
            return res.status(404).json({ success: false, message: 'Exam routine not found' });
        }

        res.json({ success: true, routine });
    } catch (error) {
        console.error('Exam routine fetch error:', error);
        res.status(500).json({ success: false, message: 'Error fetching exam routine' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        if (!canMutate(req)) {
            return res.status(403).json({ success: false, message: 'Only admin or staff can save exam routines' });
        }

        const result = normalizeRoutinePayload(req.body);
        if (result.status) return res.status(result.status).json(result.body);

        const routine = await ExamRoutine.create(result.body);
        res.status(201).json({ success: true, message: 'Exam routine saved successfully', routine });
    } catch (error) {
        console.error('Exam routine save error:', error);
        res.status(500).json({ success: false, message: 'Error saving exam routine' });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        if (!canMutate(req)) {
            return res.status(403).json({ success: false, message: 'Only admin or staff can update exam routines' });
        }

        const routine = await ExamRoutine.findById(req.params.id);
        if (!routine || routine.isDeleted) {
            return res.status(404).json({ success: false, message: 'Exam routine not found' });
        }

        const result = normalizeRoutinePayload(req.body);
        if (result.status) return res.status(result.status).json(result.body);

        Object.assign(routine, result.body);
        await routine.save();
        res.json({ success: true, message: 'Exam routine updated successfully', routine });
    } catch (error) {
        console.error('Exam routine update error:', error);
        res.status(500).json({ success: false, message: 'Error updating exam routine' });
    }
});

router.put('/:id/rows', auth, async (req, res) => {
    try {
        if (!canMutate(req)) {
            return res.status(403).json({ success: false, message: 'Only admin or staff can update exam routine rows' });
        }

        const routine = await ExamRoutine.findById(req.params.id);
        if (!routine || routine.isDeleted) {
            return res.status(404).json({ success: false, message: 'Exam routine not found' });
        }

        applyRoutineMeta(routine, req.body);
        if (!routine.examName || !routine.academicYear) {
            return res.status(400).json({ success: false, message: 'Exam name and academic year are required' });
        }
        if (!routine.classes.length) {
            return res.status(400).json({ success: false, message: 'At least one class column is required' });
        }

        const result = normalizeRoutineRow(req.body.row);
        if (result.status) return res.status(result.status).json(result.body);

        const row = result.body;
        const existingIndex = routine.rows.findIndex((item) => (
            (row.rowId && item.rowId === row.rowId)
            || (!item.rowId && item.date && item.date.toISOString().slice(0, 10) === row.date.toISOString().slice(0, 10))
        ));

        if (existingIndex >= 0) {
            routine.rows[existingIndex] = row;
        } else {
            routine.rows.push(row);
        }

        await routine.save();
        res.json({ success: true, message: 'Exam routine row saved successfully', routine, row });
    } catch (error) {
        console.error('Exam routine row update error:', error);
        res.status(500).json({ success: false, message: 'Error saving exam routine row' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        if (!canMutate(req)) {
            return res.status(403).json({ success: false, message: 'Only admin or staff can delete exam routines' });
        }

        const routine = await ExamRoutine.findById(req.params.id);
        if (!routine || routine.isDeleted) {
            return res.status(404).json({ success: false, message: 'Exam routine not found' });
        }

        routine.isDeleted = true;
        await routine.save();
        res.json({ success: true, message: 'Exam routine deleted successfully' });
    } catch (error) {
        console.error('Exam routine delete error:', error);
        res.status(500).json({ success: false, message: 'Error deleting exam routine' });
    }
});

module.exports = router;
