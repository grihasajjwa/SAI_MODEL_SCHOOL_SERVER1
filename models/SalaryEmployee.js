const mongoose = require('mongoose');

const salaryEmployeeSchema = new mongoose.Schema(
    {
        employeeType: {
            type: String,
            enum: ['Teacher', 'Staff'],
            required: true,
            default: 'Staff'
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
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

salaryEmployeeSchema.index({ employeeType: 1, name: 1 });
salaryEmployeeSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('SalaryEmployee', salaryEmployeeSchema);
