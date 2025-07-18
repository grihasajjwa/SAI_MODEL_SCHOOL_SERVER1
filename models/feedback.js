const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    parentName: {
        type: String,
        required: true,
        trim: true
    },
    studentName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    class: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['academics', 'infrastructure', 'teaching', 'administration', 'other']
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    feedback: {
        type: String,
        required: true,
        trim: true
    },
    suggestions: {
        type: String,
        trim: true
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
});

// Create indexes for efficient querying
feedbackSchema.index({ category: 1, submittedAt: -1 });
feedbackSchema.index({ email: 1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
