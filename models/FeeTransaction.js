const mongoose = require('mongoose');

const feeLineItemSchema = new mongoose.Schema({
    particular: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const paymentBreakdownSchema = new mongoose.Schema({
    modeLabel: {
        type: String,
        required: true,
        trim: true
    },
    baseMode: {
        type: String,
        enum: ['Cash', 'Online'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const feeTransactionSchema = new mongoose.Schema({
    receiptNo: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    voucherNo: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    admissionNo: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    studentName: {
        type: String,
        required: true,
        trim: true
    },
    fatherName: {
        type: String,
        required: true,
        trim: true
    },
    className: {
        type: String,
        required: true,
        trim: true
    },
    section: {
        type: String,
        trim: true,
        default: ''
    },
    rollNo: {
        type: String,
        trim: true,
        default: ''
    },
    month: {
        type: String,
        trim: true,
        default: ''
    },
    paymentMode: {
        type: String,
        enum: ['Cash', 'Online', 'Mixed'],
        default: 'Cash'
    },
    paymentBreakdown: {
        type: [paymentBreakdownSchema],
        default: []
    },
    lineItems: {
        type: [feeLineItemSchema]
    },
    previousDueAmount: {
        type: Number,
        required: true,
        default: 0
    },
    currentChargesTotal: {
        type: Number,
        required: true,
        default: 0
    },
    currentDueTotal: {
        type: Number,
        required: true,
        default: 0
    },
    paidAmount: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    dueAmount: {
        type: Number,
        required: true,
        default: 0
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    receiptDate: {
        type: Date,
        default: Date.now
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        userId: {
            type: String,
            trim: true,
            default: ''
        },
        username: {
            type: String,
            trim: true,
            default: ''
        },
        role: {
            type: String,
            trim: true,
            default: ''
        }
    },
    deleteReason: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

feeTransactionSchema.index({ admissionNo: 1, createdAt: -1 });
feeTransactionSchema.index({ month: 1, className: 1 });

module.exports = mongoose.model('FeeTransaction', feeTransactionSchema);
