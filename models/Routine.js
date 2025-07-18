const mongoose = require('mongoose');

const periodSchema = new mongoose.Schema({
  period: { type: String, required: true },
  time: { type: String, required: true },
  teacher: { type: String, default: "" },
  subject: { type: String, default: "" },
  book: { type: String, default: "" }
}, { _id: false });

const daySchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  },
  periods: [periodSchema]
}, { _id: false });

const routineSchema = new mongoose.Schema({
  class: { type: String, required: true, trim: true },
  schedule: [daySchema]
}, { timestamps: true });

// Index on class name (you can add compound indexes if needed)
routineSchema.index({ class: 1 }, { unique: true });

const Routine = mongoose.model('Routine', routineSchema);
module.exports = Routine;


// // models/Routine.js
// const mongoose = require('mongoose');

// const periodSchema = new mongoose.Schema({
//     period: { type: String, required: true }, // e.g., "1st", "2nd"
//     time: { type: String, required: true },   // e.g., "10.25 - 11.05"
//     teacher: { type: String, default: "" },
//     subject: { type: String, default: "" },
//     book: { type: String, default: "" }
// }, { _id: false }); // _id: false for subdocuments if not needed, but period can be an ID. Let's keep it simple for now.

// const routineSchema = new mongoose.Schema({
//     class: { // e.g., "Nursery-A", "Class 1"
//         type: String,
//         required: [true, "Class name is required"],
//         trim: true
//     },
//     day: { // e.g., "Monday", "Tuesday"
//         type: String,
//         required: [true, "Day of the week is required"],
//         enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], // Adjust as needed
//         periods: [periodSchema] // Array of period objects
//     },
//     timestamps: true // Adds createdAt and updatedAt timestamps
    
// });

// // Create a compound index to ensure that each class has only one routine entry per day
// routineSchema.index({ class: 1, day: 1 }, { unique: true });

// const Routine = mongoose.model('Routine', routineSchema);

// module.exports = Routine;



// // models/Routine.js
// const mongoose = require("mongoose");

// const PeriodSchema = new mongoose.Schema({
//   period: { type: String, required: true },      // e.g., "1"
//   time: { type: String, required: true },        // e.g., "09:00 - 09:40"
//   teacher: { type: String, required: true },
//   subject: { type: String, required: true },
//   book: { type: String, required: true }
// });

// const RoutineSchema = new mongoose.Schema({
//   class: { type: String, required: true, unique: true },
//   routines: {
//     Monday: [PeriodSchema],
//     Tuesday: [PeriodSchema],
//     Wednesday: [PeriodSchema],
//     Thursday: [PeriodSchema],
//     Friday: [PeriodSchema],
//     Saturday: [PeriodSchema]
//   }
// }, {
//   timestamps: true // optional: adds createdAt and updatedAt fields
// });

// module.exports = mongoose.model("Routine", RoutineSchema);
