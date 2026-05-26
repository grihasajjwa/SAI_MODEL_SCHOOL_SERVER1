const mongoose = require('mongoose');

const visitorCounterSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        default: 'login-page'
    },
    count: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    lastVisitedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('VisitorCounter', visitorCounterSchema);
