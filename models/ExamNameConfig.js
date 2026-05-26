const mongoose = require('mongoose');

const examNameSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    active: {
        type: Boolean,
        default: true
    }
}, { _id: false });

const examNameConfigSchema = new mongoose.Schema({
    session: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true
    },
    examCount: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
        default: 4
    },
    exams: [examNameSchema]
}, { timestamps: true });

module.exports = mongoose.model('ExamNameConfig', examNameConfigSchema);
