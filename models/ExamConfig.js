const mongoose = require('mongoose');

const examConfigSchema = new mongoose.Schema({
    class: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    examConfigs: [{
        examType: {
            type: String,
            required: true,
            enum: ['pt1', 'hy', 'pt2', 'final']
        },
        maxMarksWritten: {
            type: Number,
            required: true,
            default: 80
        },
        maxMarksOral: {
            type: Number,
            required: true,
            default: 20
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Create a compound index for unique configuration per class, section, and academic year
examConfigSchema.index({ class: 1, section: 1, academicYear: 1 }, { unique: true });

// Update the updatedAt timestamp before saving
examConfigSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('ExamConfig', examConfigSchema);
