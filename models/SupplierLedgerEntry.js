const mongoose = require('mongoose');

const supplierLedgerEntrySchema = new mongoose.Schema({
    entryDate: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    supplierName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    itemName: {
        type: String,
        trim: true,
        default: ''
    },
    billNo: {
        type: String,
        trim: true,
        default: ''
    },
    quantity: {
        type: Number,
        min: 0,
        default: 0
    },
    rate: {
        type: Number,
        min: 0,
        default: 0
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    entryType: {
        type: String,
        enum: ['PURCHASE', 'PAYMENT'],
        required: true,
        default: 'PURCHASE',
        index: true
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

supplierLedgerEntrySchema.index({ supplierName: 1, entryDate: -1 });
supplierLedgerEntrySchema.index({ billNo: 1, supplierName: 1 });

module.exports = mongoose.model('SupplierLedgerEntry', supplierLedgerEntrySchema);
