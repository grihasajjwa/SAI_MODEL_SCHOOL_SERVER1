const mongoose = require('mongoose');

const fuelLedgerEntrySchema = new mongoose.Schema({
    fuelDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    fuelCentreName: {
        type: String,
        required: true,
        trim: true
    },
    receiptNo: {
        type: String,
        trim: true,
        default: ''
    },
    vehicleNumber: {
        type: String,
        trim: true,
        default: ''
    },
    volumeLtr: {
        type: Number,
        min: 0,
        default: 0
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    recordedKmMeter: {
        type: Number,
        min: 0,
        default: 0
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    expenseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExpenseTransaction',
        default: null,
        index: true
    },
    expenseVoucherNo: {
        type: String,
        trim: true,
        default: ''
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

fuelLedgerEntrySchema.index({ fuelDate: -1, createdAt: -1 });
fuelLedgerEntrySchema.index({ vehicleNumber: 1, fuelDate: -1 });
fuelLedgerEntrySchema.index({ receiptNo: 1, fuelCentreName: 1 });

module.exports = mongoose.model('FuelLedgerEntry', fuelLedgerEntrySchema);
