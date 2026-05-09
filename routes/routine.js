const express = require('express');
const router = express.Router();
const Routine = require('../models/Routine');

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function normalizeSessionName(session) {
  return String(session || 'Default').trim() || 'Default';
}

function normalizeClassName(className) {
  return String(className || '').trim();
}

function normalizeDayName(day) {
  const value = String(day || '').trim();
  const matched = VALID_DAYS.find((entry) => entry.toLowerCase() === value.toLowerCase());
  return matched || '';
}

function normalizePeriods(periods) {
  if (!Array.isArray(periods)) return [];

  return periods.map((period) => ({
    period: String(period?.period || '').trim(),
    time: String(period?.time || '').trim(),
    teacher: String(period?.teacher || '').trim(),
    subject: String(period?.subject || '').trim(),
    book: String(period?.book || '').trim()
  }));
}

function findDuplicatePeriods(periods) {
  const seen = new Set();
  for (const period of periods) {
    const label = String(period?.period || '').trim();
    if (!label || label === 'Break') continue;
    if (seen.has(label)) return label;
    seen.add(label);
  }
  return '';
}

// POST /api/routine
router.post('/save-routine', async (req, res) => {
  const className = normalizeClassName(req.body.class);
  const dayName = normalizeDayName(req.body.day);
  const periods = normalizePeriods(req.body.periods);
  const sessionName = normalizeSessionName(req.body.session);

  try {
    if (!className) {
      return res.status(400).json({ success: false, message: 'Class name is required.' });
    }

    if (!dayName) {
      return res.status(400).json({ success: false, message: 'A valid day is required.' });
    }

    if (!periods.length) {
      return res.status(400).json({ success: false, message: 'At least one period is required.' });
    }

    const duplicatePeriod = findDuplicatePeriods(periods);
    if (duplicatePeriod) {
      return res.status(400).json({
        success: false,
        message: `Duplicate period "${duplicatePeriod}" found for ${className}. Please remove the duplicate entry and try again.`
      });
    }

    let routine = await Routine.findOne({ class: className, session: sessionName });

    if (!routine) {
      routine = new Routine({
        session: sessionName,
        class: className,
        schedule: [{ day: dayName, periods }]
      });
    } else {
      const dayIndex = routine.schedule.findIndex((scheduleEntry) => scheduleEntry.day === dayName);

      if (dayIndex !== -1) {
        routine.schedule[dayIndex].periods = periods;
      } else {
        routine.schedule.push({ day: dayName, periods });
      }
    }

    await routine.save();
    res.status(200).json({ success: true, message: 'Routine saved/updated', routine });

  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate routine',
        message: `A routine already exists for class "${className}" in session "${sessionName}". Please refresh the page and try again.`
      });
    }

    if (err?.name === 'ValidationError') {
      const firstMessage = Object.values(err.errors || {})[0]?.message || err.message;
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: `Routine data for ${className} is invalid: ${firstMessage}`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error',
      message: `Failed to save routine for ${className}: ${err.message}`
    });
  }
});

// router.get('/:day', async (req, res) => {
//   try {
//     const day = req.params.day;
//     const routine = await Routine.find({ day });
//     if (routine) {
//       res.json(routine);
//     } else {
//       res.status(404).json({ message: "Routine not found" });
//     }
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
// Assuming this is mounted under something like /api/routines
// routes/routineRoutes.js

// GET /api/routines/get-routine?day=Monday
router.get('/get-routine', async (req, res) => {
  try {
    const dayName = normalizeDayName(req.query.day);
    const sessionName = normalizeSessionName(req.query.session);

    if (!dayName) {
      return res.status(400).json({ success: false, message: "A valid 'day' query parameter is required." });
    }

    const allRoutines = await Routine.find({ session: sessionName }).sort({ class: 1 });

    const routinesForDay = allRoutines
      .map((routine) => {
        const daySchedule = routine.schedule.find((scheduleEntry) => scheduleEntry.day === dayName);
        if (daySchedule) {
          return {
            class: routine.class,
            day: daySchedule.day,
            periods: daySchedule.periods
          };
        }
        return null;
      })
      .filter(Boolean);

    res.json({ success: true, session: sessionName, day: dayName, routines: routinesForDay });
  } catch (err) {
    console.error("Error fetching routines:", err);
    res.status(500).json({ success: false, error: err.message, message: 'Error fetching routines' });
  }
});

module.exports = router;
