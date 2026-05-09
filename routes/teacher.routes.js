const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');

function normalizeSessionName(session) {
  const normalized = String(session || '').trim();
  return normalized || 'Default';
}

let teacherIndexesChecked = false;

async function ensureTeacherIndexes() {
  if (teacherIndexesChecked || !Teacher.collection) {
    return;
  }

  try {
    const indexes = await Teacher.collection.indexes();
    const legacyNameIndex = indexes.find(
      (index) => index.name === 'name_1' && index.unique
    );

    if (legacyNameIndex) {
      await Teacher.collection.dropIndex('name_1');
    }
  } catch (err) {
    if (err.codeName !== 'IndexNotFound') {
      console.warn('Teacher index migration warning:', err.message);
    }
  }

  teacherIndexesChecked = true;
}

function buildTeacherSessionFilter(session) {
  if (session === 'Default') {
    return [{ session }, { session: { $exists: false } }];
  }

  return [{ session }];
}

// POST /api/teachers
router.post('/', async (req, res) => {
  try {
    await ensureTeacherIndexes();

    const { name, code, active } = req.body;
    const session = normalizeSessionName(req.body.session);

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Teacher name is required' });
    }

    const existing = await Teacher.findOne({ session, name: name.trim() });
    if (existing) {
      return res
        .status(409)
        .json({
          success: false,
          message: `Teacher "${name.trim()}" already exists for session "${session}"`,
        });
    }

    const teacher = new Teacher({
      session,
      name: name.trim(),
      code: code ? code.trim() : undefined,
      active: active !== undefined ? !!active : true,
    });

    await teacher.save();

    res.status(201).json({ success: true, teacher });
  } catch (err) {
    console.error('Error creating teacher:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/teachers
router.get('/', async (req, res) => {
  try {
    await ensureTeacherIndexes();

    const session = normalizeSessionName(req.query.session);
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const sessionFilter = buildTeacherSessionFilter(session);
    const query = includeInactive
      ? { $or: sessionFilter }
      : {
          active: true,
          $or: sessionFilter,
        };

    const teachers = await Teacher.find(query).sort({ name: 1 });
    res.json({ success: true, teachers });
  } catch (err) {
    console.error('Error fetching teachers:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// PUT /api/teachers/:id
router.put('/:id', async (req, res) => {
  try {
    await ensureTeacherIndexes();

    const { id } = req.params;
    const { name, code, active } = req.body;

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: 'Teacher not found' });
    }

    const newName = name && name.trim();
    const session = normalizeSessionName(req.body.session || teacher.session);
    if (newName) {
      const existing = await Teacher.findOne({
        _id: { $ne: id },
        session,
        name: newName,
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Another teacher named "${newName}" already exists for session "${session}"`,
        });
      }
      teacher.name = newName;
    }

    teacher.session = session;

    if (code !== undefined) {
      teacher.code = code.trim();
    }
    if (active !== undefined) {
      teacher.active = !!active;
    }

    await teacher.save();
    res.json({ success: true, teacher });
  } catch (err) {
    console.error('Error updating teacher:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error', error: err.message });
  }
});

// DELETE /api/teachers/:id
router.delete('/:id', async (req, res) => {
  try {
    await ensureTeacherIndexes();

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    await teacher.deleteOne();
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (err) {
    console.error('Error deleting teacher:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
