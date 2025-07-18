const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    academicYear: {
        type: String,
        required: true
    },
    className: {
        type: String,
        required: true
    },
    classTeacher: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Class', classSchema);
