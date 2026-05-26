const mongoose = require('mongoose');

const admitDatesheetRowSchema = new mongoose.Schema({
    subject: { type: String, trim: true, default: '' },
    date: { type: String, trim: true, default: '' },
    day: { type: String, trim: true, default: '' },
    timing: { type: String, trim: true, default: '' },
    teacherSignature: { type: String, trim: true, default: '' }
}, { _id: false });

const admitDatesheetSchema = new mongoose.Schema({
    session: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    examTitle: { type: String, trim: true, default: 'Annual Examination' },
    admitNote: {
        type: String,
        trim: true,
        default: 'Students must carry this admit card every examination day.'
    },
    datesheetRows: [admitDatesheetRowSchema],
    isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });

admitDatesheetSchema.index(
    { session: 1, className: 1, section: 1 },
    { unique: true, partialFilterExpression: { isDeleted: { $eq: false } } }
);

module.exports = mongoose.model('AdmitDatesheet', admitDatesheetSchema);
