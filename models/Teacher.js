const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema(
  {
    session: {
      type: String,
      required: true,
      trim: true,
      default: 'Default',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      unique: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

teacherSchema.index({ session: 1, name: 1 }, { unique: true });
teacherSchema.index({ session: 1, active: 1, name: 1 });

const Teacher = mongoose.model('Teacher', teacherSchema);

module.exports = Teacher;
