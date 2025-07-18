const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    class: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    examConfig: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExamConfig',
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    session: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Compound index for unique exam configuration
examSchema.index({ class: 1, section: 1, subject: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Exam', examSchema);
