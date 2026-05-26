const mongoose = require('mongoose');

const salaryColumnSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        label: {
            type: String,
            required: true,
            trim: true
        },
        labelKey: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        calculationType: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        sortOrder: {
            type: Number,
            default: 0
        },
        createdBy: {
            type: String,
            trim: true,
            default: ''
        }
    },
    { timestamps: true }
);

salaryColumnSchema.index({ calculationType: 1, sortOrder: 1, label: 1 });

module.exports = mongoose.model('SalaryColumn', salaryColumnSchema);
