const mongoose = require('mongoose');

const coScholasticConfigSchema = new mongoose.Schema({
    class: {
        type: String,
        required: true,
        trim: true
    },
    section: {
        type: String,
        required: true,
        trim: true
    },
    academicYear: {
        type: String,
        required: true,
        trim: true
    },
    activities: [{
        id: {
            type: String,
            required: true,
            trim: true
        },
        label: {
            type: String,
            required: true,
            trim: true
        },
        enabled: {
            type: Boolean,
            required: true,
            default: true
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
coScholasticConfigSchema.index({ class: 1, section: 1, academicYear: 1 }, { unique: true });

// Update the updatedAt timestamp before saving
coScholasticConfigSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('CoScholasticConfig', coScholasticConfigSchema);