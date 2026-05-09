const mongoose = require('mongoose');

const questionPaperSchema = new mongoose.Schema({
    session: {
        type: String,
        required: true,
        trim: true
    },
    className: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    examName: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        default: ''
    },
    paperData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    }
}, {
    timestamps: true
});

questionPaperSchema.index(
    { session: 1, className: 1, subject: 1, examName: 1 },
    { unique: true }
);

module.exports = mongoose.model('QuestionPaper', questionPaperSchema);
