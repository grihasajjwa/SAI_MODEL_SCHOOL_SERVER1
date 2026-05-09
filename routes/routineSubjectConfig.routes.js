const express = require('express');
const router = express.Router();
const RoutineSubjectConfig = require('../models/RoutineSubjectConfig');

function normalizeSessionName(session) {
  const normalized = String(session || '').trim();
  return normalized || 'Default';
}

function normalizeName(name) {
  return String(name || '').trim();
}

function normalizeSortOrder(sortOrder) {
  const parsed = Number(sortOrder);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

let subjectIndexesChecked = false;

async function ensureSubjectIndexes() {
  if (subjectIndexesChecked || !RoutineSubjectConfig.collection) {
    return;
  }

  try {
    const indexes = await RoutineSubjectConfig.collection.indexes();
    const legacyNameIndex = indexes.find(
      (index) => index.name === 'name_1' && index.unique
    );

    if (legacyNameIndex) {
      await RoutineSubjectConfig.collection.dropIndex('name_1');
    }
  } catch (err) {
    if (err.codeName !== 'IndexNotFound') {
      console.warn('Routine subject index migration warning:', err.message);
    }
  }

  subjectIndexesChecked = true;
}

router.get('/', async (req, res) => {
  try {
    await ensureSubjectIndexes();

    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const session = normalizeSessionName(req.query.session);
    const sessionFilter =
      session === 'Default'
        ? [{ session }, { session: { $exists: false } }]
        : [{ session }];
    const query = includeInactive
      ? { $or: sessionFilter }
      : { active: true, $or: sessionFilter };
    const subjects = await RoutineSubjectConfig.find(query).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, subjects });
  } catch (err) {
    console.error('Error fetching routine subjects:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureSubjectIndexes();

    const name = normalizeName(req.body.name);
    const session = normalizeSessionName(req.body.session);
    if (!name) {
      return res.status(400).json({ success: false, message: 'Subject name is required' });
    }

    const existing = await RoutineSubjectConfig.findOne({ session, name });
    if (existing) {
      existing.active = true;
      existing.sortOrder = normalizeSortOrder(req.body.sortOrder ?? existing.sortOrder);
      await existing.save();
      return res.json({ success: true, updated: true, subject: existing });
    }

    const subject = new RoutineSubjectConfig({
      session,
      name,
      active: req.body.active !== undefined ? !!req.body.active : true,
      sortOrder: normalizeSortOrder(req.body.sortOrder)
    });
    await subject.save();
    res.status(201).json({ success: true, updated: false, subject });
  } catch (err) {
    console.error('Error saving routine subject:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await ensureSubjectIndexes();

    const subject = await RoutineSubjectConfig.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const nextName = normalizeName(req.body.name);
    if (!nextName) {
      return res.status(400).json({ success: false, message: 'Subject name is required' });
    }

    const session = normalizeSessionName(req.body.session || subject.session);
    const conflict = await RoutineSubjectConfig.findOne({
      _id: { $ne: subject._id },
      session,
      name: nextName
    });
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: `Another subject named "${nextName}" already exists for session "${session}"`,
      });
    }

    subject.session = session;
    subject.name = nextName;
    if (req.body.active !== undefined) {
      subject.active = !!req.body.active;
    }
    if (req.body.sortOrder !== undefined) {
      subject.sortOrder = normalizeSortOrder(req.body.sortOrder);
    }

    await subject.save();
    res.json({ success: true, subject });
  } catch (err) {
    console.error('Error updating routine subject:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const subject = await RoutineSubjectConfig.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    await subject.deleteOne();
    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (err) {
    console.error('Error deleting routine subject:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
