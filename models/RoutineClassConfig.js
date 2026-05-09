const mongoose = require('mongoose');

const routineClassConfigSchema = new mongoose.Schema(
  {
    session: { type: String, required: true, trim: true, default: 'Default' },
    className: { type: String, required: true, trim: true },
    periodsCount: { type: Number, required: true, min: 1, max: 10, default: 6 },
  },
  { timestamps: true }
);

// One config per (session, className)
routineClassConfigSchema.index({ session: 1, className: 1 }, { unique: true });

const RoutineClassConfig = mongoose.model(
  'RoutineClassConfig',
  routineClassConfigSchema
);

module.exports = RoutineClassConfig;

