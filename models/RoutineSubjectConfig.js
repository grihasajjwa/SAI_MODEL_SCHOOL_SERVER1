const mongoose = require('mongoose');

const routineSubjectConfigSchema = new mongoose.Schema(
  {
    session: { type: String, required: true, trim: true, default: 'Default' },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

routineSubjectConfigSchema.index({ session: 1, name: 1 }, { unique: true });
routineSubjectConfigSchema.index({ session: 1, active: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.model('RoutineSubjectConfig', routineSubjectConfigSchema);
