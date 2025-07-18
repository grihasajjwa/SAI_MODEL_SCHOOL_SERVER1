const mongoose = require('mongoose');

const CoScholasticAreaSchema = new mongoose.Schema({
    className: {
        type: String,
        required: true,
        trim: true
    },
    areas: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        }
    }],
    academicYear: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true
});

// Compound index for unique class-year combination
CoScholasticAreaSchema.index({ className: 1, academicYear: 1 }, { unique: true });

const CoScholasticArea = mongoose.model('CoScholasticArea', CoScholasticAreaSchema);
module.exports = CoScholasticArea;
