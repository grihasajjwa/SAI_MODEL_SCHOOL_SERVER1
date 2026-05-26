const mongoose = require('mongoose');

const salarySheetCustomColumnSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true
        },
        label: {
            type: String,
            required: true,
            trim: true
        },
        calculationType: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        }
    },
    { _id: false }
);

const salarySheetEntrySchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SalaryEmployee'
        },
        employeeType: {
            type: String,
            enum: ['Teacher', 'Staff'],
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        code: {
            type: String,
            trim: true,
            default: ''
        },
        designation: {
            type: String,
            trim: true,
            default: ''
        },
        phone: {
            type: String,
            trim: true,
            default: ''
        },
        bankName: {
            type: String,
            trim: true,
            default: ''
        },
        accountNo: {
            type: String,
            trim: true,
            default: ''
        },
        basicSalary: {
            type: Number,
            min: 0,
            default: 0
        },
        allowances: {
            type: Number,
            min: 0,
            default: 0
        },
        deductions: {
            type: Number,
            min: 0,
            default: 0
        },
        advanceBalance: {
            type: Number,
            min: 0,
            default: 0
        },
        customValues: {
            type: Map,
            of: Number,
            default: {}
        },
        netSalary: {
            type: Number,
            default: 0
        },
        paymentMode: {
            type: String,
            trim: true,
            default: 'Cash'
        },
        remarks: {
            type: String,
            trim: true,
            default: ''
        }
    },
    { _id: true }
);

const salarySheetSchema = new mongoose.Schema(
    {
        month: {
            type: String,
            required: true,
            trim: true
        },
        salaryDate: {
            type: Date,
            default: Date.now
        },
        notes: {
            type: String,
            trim: true,
            default: ''
        },
        entries: {
            type: [salarySheetEntrySchema],
            default: []
        },
        customColumns: {
            type: [salarySheetCustomColumnSchema],
            default: []
        },
        totalBasic: {
            type: Number,
            default: 0
        },
        totalAllowances: {
            type: Number,
            default: 0
        },
        totalDeductions: {
            type: Number,
            default: 0
        },
        totalNet: {
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

salarySheetSchema.index({ month: 1 }, { unique: true });
salarySheetSchema.index({ salaryDate: -1 });

module.exports = mongoose.model('SalarySheet', salarySheetSchema);
