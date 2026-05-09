const express = require('express');
const router = express.Router();
const RoutineClassConfig = require('../models/RoutineClassConfig');
const Routine = require('../models/Routine');

function normalizeSessionName(session) {
  return String(session || 'Default').trim() || 'Default';
}

function normalizeClassName(className) {
  return String(className || '').trim();
}

function normalizePeriodsCount(periodsCount) {
  const periods = Number(periodsCount);
  if (!Number.isFinite(periods)) return 6;
  return Math.min(10, Math.max(1, Math.round(periods)));
}

// GET /api/routine-classes?session=...
router.get('/', async (req, res) => {
  try {
    const sessionName = normalizeSessionName(req.query.session);
    const configs = await RoutineClassConfig.find({ session: sessionName }).sort({
      className: 1,
    });

    res.json({
      success: true,
      session: sessionName,
      classes: configs.map((c) => ({
        className: c.className,
        periodsCount: c.periodsCount,
      })),
    });
  } catch (err) {
    console.error('Error fetching routine class configs:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/routine-classes
router.post('/', async (req, res) => {
  try {
    const sessionName = normalizeSessionName(req.body.session);
    const className = normalizeClassName(req.body.className);

    if (!className) {
      return res
        .status(400)
        .json({ success: false, message: 'Class name is required' });
    }

    const periods = normalizePeriodsCount(req.body.periodsCount);

    const existing = await RoutineClassConfig.findOne({
      session: sessionName,
      className,
    });

    if (existing) {
      existing.periodsCount = periods;
      await existing.save();
      return res.json({ success: true, updated: true, config: existing });
    }

    const cfg = new RoutineClassConfig({
      session: sessionName,
      className,
      periodsCount: periods,
    });
    await cfg.save();

    res.status(201).json({ success: true, updated: false, config: cfg });
  } catch (err) {
    console.error('Error saving routine class config:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// PUT /api/routine-classes/rename
router.put('/rename', async (req, res) => {
  try {
    const sessionName = normalizeSessionName(req.body.session);
    const oldClassName = normalizeClassName(req.body.oldClassName);
    const newClassName = normalizeClassName(req.body.newClassName);

    if (!oldClassName || !newClassName) {
      return res
        .status(400)
        .json({ success: false, message: 'Both old and new class names are required' });
    }

    const periods = normalizePeriodsCount(req.body.periodsCount);

    const cfg = await RoutineClassConfig.findOne({
      session: sessionName,
      className: oldClassName,
    });

    if (!cfg) {
      return res
        .status(404)
        .json({ success: false, message: 'Class configuration not found' });
    }

    // Check for name conflict
    const conflict = await RoutineClassConfig.findOne({
      session: sessionName,
      className: newClassName,
      _id: { $ne: cfg._id },
    });
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Another class with this name already exists for this session',
      });
    }

    cfg.className = newClassName;
    cfg.periodsCount = periods;
    await cfg.save();

    await Routine.updateMany(
      { session: sessionName, class: oldClassName },
      { $set: { class: newClassName } }
    );

    res.json({ success: true, config: cfg });
  } catch (err) {
    console.error('Error renaming routine class config:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error', error: err.message });
  }
});

router.delete('/:className', async (req, res) => {
  try {
    const sessionName = normalizeSessionName(req.query.session);
    const className = normalizeClassName(req.params.className);

    if (!className) {
      return res.status(400).json({ success: false, message: 'Class name is required' });
    }

    const [config, routineCount] = await Promise.all([
      RoutineClassConfig.findOne({ session: sessionName, className }),
      Routine.countDocuments({ session: sessionName, class: className }),
    ]);

    if (!config && routineCount === 0) {
      return res.status(404).json({ success: false, message: 'Class configuration not found' });
    }

    if (config) {
      await config.deleteOne();
    }

    if (routineCount > 0) {
      await Routine.deleteMany({ session: sessionName, class: className });
    }

    res.json({
      success: true,
      message: 'Class deleted successfully',
      removedConfig: !!config,
      removedRoutines: routineCount,
    });
  } catch (err) {
    console.error('Error deleting routine class config:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
