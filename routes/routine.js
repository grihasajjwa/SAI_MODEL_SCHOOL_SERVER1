const express = require('express');
const router = express.Router();
const Routine = require('../models/Routine');

// POST /api/routine
router.post('/save-routine', async (req, res) => {
  const { class: className, day, periods } = req.body;

  try {
    // Find routine for the class
    let routine = await Routine.findOne({ class: className });

    if (!routine) {
      // No routine for class: create new
      routine = new Routine({
        class: className,
        schedule: [{ day, periods }]
      });
    } else {
      // Class exists: check if day exists
      const dayIndex = routine.schedule.findIndex(s => s.day === day);

      if (dayIndex !== -1) {
        // Day exists: update periods
        routine.schedule[dayIndex].periods = periods;
      } else {
        // Day doesn't exist: push new day
        routine.schedule.push({ day, periods });
      }
    }

    await routine.save();
    res.status(200).json({ message: 'Routine saved/updated', routine });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
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
    const { day: dayName } = req.query;

    if (!dayName) {
      return res.status(400).json({ message: "'day' query parameter is required." });
    }

    // Fetch all routine documents (each one is per class)
    const allRoutines = await Routine.find({});

    // Filter to get only the schedule for the requested day
    const routinesForDay = allRoutines
      .map(routine => {
        const daySchedule = routine.schedule.find(s => s.day === dayName);
        if (daySchedule) {
          return {
            class: routine.class,
            day: daySchedule.day,
            periods: daySchedule.periods
          };
        }
        return null;
      })
      .filter(Boolean); // Remove nulls (i.e., classes with no schedule for that day)

    res.json({ day: dayName, routines: routinesForDay });
  } catch (err) {
    console.error("Error fetching routines:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
