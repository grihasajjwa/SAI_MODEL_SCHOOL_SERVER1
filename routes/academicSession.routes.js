const express = require('express');
const router = express.Router();
const AcademicSession = require('../models/AcademicSession');

// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await AcademicSession.find().sort({ createdAt: -1 });

    // If DB has no sessions yet, return a default option
    if (!sessions || sessions.length === 0) {
      return res.json({
        success: true,
        sessions: [{ name: 'Default', active: true, isCurrent: true }],
      });
    }

    res.json({ success: true, sessions });
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/sessions
router.post('/', async (req, res) => {
  try {
    const { name, active, isCurrent, startDate, endDate } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Session name is required' });
    }

    const existing = await AcademicSession.findOne({ name: name.trim() });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: 'Session with this name already exists' });
    }

    const session = new AcademicSession({
      name: name.trim(),
      active: active !== undefined ? !!active : true,
      isCurrent: !!isCurrent,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    if (session.isCurrent) {
      await AcademicSession.updateMany({}, { $set: { isCurrent: false } });
    }

    await session.save();
    res.status(201).json({ success: true, session });
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/sessions/current
router.get('/current', async (req, res) => {
  try {
    let current = await AcademicSession.findOne({ isCurrent: true, active: true }).sort({
      createdAt: -1,
    });

    if (!current) {
      current = await AcademicSession.findOne({ active: true }).sort({ createdAt: -1 });
    }

    if (!current) {
      return res.json({ success: true, session: { name: 'Default', active: true, isCurrent: true } });
    }

    return res.json({ success: true, session: current });
  } catch (err) {
    console.error('Error fetching current session:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// PUT /api/sessions/current
router.put('/current', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Session name is required' });
    }

    const target = await AcademicSession.findOne({ name: name.trim() });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await AcademicSession.updateMany({}, { $set: { isCurrent: false } });
    target.isCurrent = true;
    target.active = true;
    await target.save();

    return res.json({ success: true, session: target });
  } catch (err) {
    console.error('Error setting current session:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// PUT /api/sessions/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, active, isCurrent, startDate, endDate } = req.body;
    const session = await AcademicSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (name && name.trim() !== session.name) {
      const duplicate = await AcademicSession.findOne({ name: name.trim(), _id: { $ne: session._id } });
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Session with this name already exists' });
      }
      session.name = name.trim();
    }

    if (active !== undefined) session.active = !!active;
    if (isCurrent !== undefined) {
      if (isCurrent) {
        await AcademicSession.updateMany({}, { $set: { isCurrent: false } });
      }
      session.isCurrent = !!isCurrent;
    }
    if (startDate !== undefined) session.startDate = startDate || null;
    if (endDate !== undefined) session.endDate = endDate || null;

    await session.save();
    return res.json({ success: true, session });
  } catch (err) {
    console.error('Error updating session:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res) => {
  try {
    const session = await AcademicSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await session.deleteOne();
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (err) {
    console.error('Error deleting session:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
