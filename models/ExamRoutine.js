const mongoose = require('mongoose');

const examRoutineRowSchema = new mongoose.Schema({
    rowId: {
        type: String,
        trim: true,
        index: true
    },
    date: {
        type: Date,
        required: true
    },
    subjects: {
        type: Map,
        of: String,
        default: {}
    }
}, { _id: false });

const examRoutineSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    examName: {
        type: String,
        required: true,
        trim: true
    },
    academicYear: {
        type: String,
        required: true,
        trim: true
    },
    timeText: {
        type: String,
        trim: true,
        default: 'Time 10:30 am to 12:00 pm.'
    },
    schoolOverText: {
        type: String,
        trim: true,
        default: 'School will get over at 1.00 pm for all the classes.'
    },
    notes: [{
        type: String,
        trim: true
    }],
    classes: [{
        type: String,
        trim: true,
        required: true
    }],
    rows: [examRoutineRowSchema],
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

examRoutineSchema.index({ academicYear: 1, examName: 1, createdAt: -1 });

module.exports = mongoose.model('ExamRoutine', examRoutineSchema);
