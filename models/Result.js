const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    exam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    writtenMarks: {
        type: Number,
        required: true
    },
    oralMarks: {
        type: Number,
        required: true
    },
    practicalMarks: {
        type: Number,
        default: 0
    },
    totalMarks: {
        type: Number,
        required: true
    },
    grade: {
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

module.exports = mongoose.model('Result', resultSchema);
