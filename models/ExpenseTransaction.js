const mongoose = require('mongoose');

const expenseTransactionSchema = new mongoose.Schema({
    voucherNo: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    headOfAccount: {
        type: String,
        required: true,
        trim: true
    },
    paidTo: {
        type: String,
        required: true,
        trim: true
    },
    paidFor: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentBreakdown: [{
        modeLabel: {
            type: String,
            trim: true,
            required: true
        },
        baseMode: {
            type: String,
            enum: ['Cash', 'Online'],
            required: true
        },
        amount: {
            type: Number,
            min: 0,
            required: true
        }
    }],
    paymentMode: {
        type: String,
        enum: ['Cash', 'Online', 'Mixed'],
        default: 'Cash'
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    salaryDetails: {
        employeeName: {
            type: String,
            trim: true,
            default: ''
        },
        salaryMonth: {
            type: String,
            trim: true,
            default: ''
        },
        grossSalary: {
            type: Number,
            min: 0,
            default: 0
        },
        advanceAdjusted: {
            type: Number,
            min: 0,
            default: 0
        }
    },
    expenseDate: {
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

expenseTransactionSchema.index({ expenseDate: -1, createdAt: -1 });
expenseTransactionSchema.index({ headOfAccount: 1, expenseDate: -1 });

module.exports = mongoose.model('ExpenseTransaction', expenseTransactionSchema);
