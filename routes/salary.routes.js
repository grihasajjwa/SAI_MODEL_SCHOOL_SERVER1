const express = require('express');
const jwt = require('jsonwebtoken');
const ExpenseTransaction = require('../models/ExpenseTransaction');
const SalaryColumn = require('../models/SalaryColumn');
const SalaryEmployee = require('../models/SalaryEmployee');
const SalarySheet = require('../models/SalarySheet');

const router = express.Router();
const SALARY_VIEW_ROLES = new Set(['admin']);
const SALARY_MUTATION_ROLES = new Set(['admin']);

function getRequestUser(req) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return { role: '' };
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return { role: '' };
    }
}

function requireSalaryView(req, res) {
    const user = getRequestUser(req);
    if (!SALARY_VIEW_ROLES.has(user.role) && !SALARY_MUTATION_ROLES.has(user.role)) {
        res.status(403).json({ success: false, message: 'Only admin can view salary records' });
        return null;
    }
    return user;
}

function requireSalaryMutation(req, res) {
    const user = getRequestUser(req);
    if (!SALARY_MUTATION_ROLES.has(user.role)) {
        res.status(403).json({ success: false, message: 'Only admin can change salary records' });
        return null;
    }
    return user;
}

function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeEmployeeType(value) {
    return String(value || '').toLowerCase() === 'teacher' ? 'Teacher' : 'Staff';
}

function makeCustomColumnKey(label, index = 0) {
    const base = String(label || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    return `${base || 'custom'}_${index + 1}`;
}

function makeColumnLabelKey(label) {
    return String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildColumnPayload(body = {}, user = {}) {
    const label = String(body.label || '').trim();
    if (!label) {
        return { status: 400, body: { success: false, message: 'Column name is required' } };
    }

    const calculationType = String(body.calculationType || '').toLowerCase() === 'debit' ? 'debit' : 'credit';
    const key = String(body.key || makeCustomColumnKey(label, Date.now()))
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 50);

    return {
        status: null,
        body: {
            key: key || makeCustomColumnKey(label, Date.now()),
            label,
            labelKey: makeColumnLabelKey(label),
            calculationType,
            sortOrder: Math.max(0, safeNumber(body.sortOrder)),
            createdBy: user.username || user.name || user.id || ''
        }
    };
}

function normalizeCustomColumns(columns = []) {
    const usedKeys = new Set();
    return (Array.isArray(columns) ? columns : [])
        .map((column, index) => {
            const label = String(column.label || '').trim();
            if (!label) return null;
            const calculationType = String(column.calculationType || '').toLowerCase() === 'debit' ? 'debit' : 'credit';
            let key = String(column.key || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
            if (!key) key = makeCustomColumnKey(label, index);
            while (usedKeys.has(key)) key = `${key}_${index + 1}`;
            usedKeys.add(key);
            return { key, label, calculationType };
        })
        .filter(Boolean);
}

function normalizeCustomValues(values = {}, columns = []) {
    const source = values && typeof values === 'object' ? values : {};
    return columns.reduce((normalized, column) => {
        normalized[column.key] = Math.max(0, safeNumber(source[column.key]));
        return normalized;
    }, {});
}

function calculateEntryNet(entry = {}, columns = []) {
    const customValues = entry.customValues || {};
    return columns.reduce((net, column) => {
        const amount = safeNumber(customValues[column.key]);
        return column.calculationType === 'debit' ? net - amount : net + amount;
    }, safeNumber(entry.basicSalary) + safeNumber(entry.allowances) - safeNumber(entry.deductions));
}

function buildEmployeePayload(body = {}) {
    const name = String(body.name || '').trim();
    if (!name) {
        return { status: 400, body: { success: false, message: 'Name is required' } };
    }

    return {
        status: null,
        body: {
            employeeType: normalizeEmployeeType(body.employeeType),
            name,
            code: String(body.code || '').trim(),
            designation: String(body.designation || '').trim(),
            phone: String(body.phone || '').trim(),
            bankName: String(body.bankName || '').trim(),
            accountNo: String(body.accountNo || '').trim(),
            basicSalary: Math.max(0, safeNumber(body.basicSalary)),
            allowances: Math.max(0, safeNumber(body.allowances)),
            deductions: Math.max(0, safeNumber(body.deductions)),
            isActive: body.isActive === undefined ? true : !!body.isActive
        }
    };
}

function normalizeMonth(value) {
    const month = String(value || '').trim();
    return /^\d{4}-\d{2}$/.test(month) ? month : '';
}

function getMonthDateRange(month = '') {
    const normalizedMonth = normalizeMonth(month);
    if (!normalizedMonth) return null;

    const [year, monthIndex] = normalizedMonth.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    return { start, end };
}

function normalizePersonName(value = '') {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function expenseHasPaymentLabel(expense = {}, label = '') {
    const expected = String(label || '').trim().toLowerCase();
    return (expense.paymentBreakdown || []).some((entry) => String(entry.modeLabel || '').trim().toLowerCase() === expected);
}

function isSalaryAdvanceExpense(expense = {}) {
    return expenseHasPaymentLabel(expense, 'Due')
        || (
            String(expense.headOfAccount || '').trim().toLowerCase() === 'due'
            && !expenseHasPaymentLabel(expense, 'Due Payment')
        );
}

function isSalaryAdvanceSettlement(expense = {}) {
    return expenseHasPaymentLabel(expense, 'Due Payment')
        || safeNumber(expense.salaryDetails?.advanceAdjusted) > 0;
}

async function getSalaryAdvanceBalanceMap(month = '') {
    const range = getMonthDateRange(month);
    if (!range) return new Map();

    const transactions = await ExpenseTransaction.find({
        isDeleted: { $ne: true },
        expenseDate: { $lt: range.end },
        $or: [
            { headOfAccount: { $regex: /^Due$/i } },
            { paymentBreakdown: { $elemMatch: { modeLabel: { $regex: /^(Due|Due Payment)$/i } } } },
            { 'salaryDetails.advanceAdjusted': { $gt: 0 } }
        ]
    })
        .select('paidTo amount headOfAccount paymentBreakdown salaryDetails')
        .lean();

    return transactions.reduce((map, expense) => {
        const personName = expense.salaryDetails?.employeeName || expense.paidTo;
        const key = normalizePersonName(personName);
        if (!key) return map;

        const current = map.get(key) || 0;
        if (isSalaryAdvanceExpense(expense)) {
            map.set(key, current + safeNumber(expense.amount));
            return map;
        }

        if (isSalaryAdvanceSettlement(expense)) {
            const settledAmount = safeNumber(expense.salaryDetails?.advanceAdjusted) || safeNumber(expense.amount);
            map.set(key, current - settledAmount);
        }

        return map;
    }, new Map());
}

async function applySalaryAdvanceBalances(entries = [], month = '', customColumns = []) {
    const advanceBalanceByPerson = await getSalaryAdvanceBalanceMap(month);
    if (!advanceBalanceByPerson.size) return entries;

    return entries.map((entry) => {
        if (entry.salaryPayment?.isPaid) return entry;
        const personKey = normalizePersonName(entry.name);
        const advanceBalance = Math.max(0, safeNumber(advanceBalanceByPerson.get(personKey)));
        if (!advanceBalance) return entry;

        const updatedEntry = {
            ...entry,
            deductions: advanceBalance,
            advanceBalance
        };
        return {
            ...updatedEntry,
            netSalary: calculateEntryNet(updatedEntry, customColumns)
        };
    });
}

async function applySalaryPaymentStatus(entries = [], month = '') {
    const normalizedMonth = normalizeMonth(month);
    if (!normalizedMonth || !entries.length) return entries;

    const salaryExpenses = await ExpenseTransaction.find({
        isDeleted: { $ne: true },
        headOfAccount: { $regex: /^Salary$/i },
        'salaryDetails.salaryMonth': normalizedMonth
    })
        .select('_id voucherNo paidTo amount expenseDate salaryDetails')
        .sort({ expenseDate: -1, createdAt: -1 })
        .lean();

    if (!salaryExpenses.length) return entries;

    const paymentByPerson = salaryExpenses.reduce((map, expense) => {
        const key = normalizePersonName(expense.salaryDetails?.employeeName || expense.paidTo);
        if (!key || map.has(key)) return map;
        map.set(key, {
            isPaid: true,
            expenseId: String(expense._id),
            voucherNo: expense.voucherNo || '',
            paidDate: expense.expenseDate || null,
            paidAmount: safeNumber(expense.amount),
            advanceAdjusted: safeNumber(expense.salaryDetails?.advanceAdjusted)
        });
        return map;
    }, new Map());

    return entries.map((entry) => {
        const payment = paymentByPerson.get(normalizePersonName(entry.name));
        return payment ? { ...entry, salaryPayment: payment } : entry;
    });
}

function buildSheetEntry(entry = {}, customColumns = []) {
    const basicSalary = Math.max(0, safeNumber(entry.basicSalary));
    const allowances = Math.max(0, safeNumber(entry.allowances));
    const deductions = Math.max(0, safeNumber(entry.deductions));
    const advanceBalance = Math.max(0, safeNumber(entry.advanceBalance));
    const customValues = normalizeCustomValues(entry.customValues, customColumns);
    const salaryEntry = {
        basicSalary,
        allowances,
        deductions,
        customValues
    };
    return {
        employeeId: entry.employeeId || undefined,
        employeeType: normalizeEmployeeType(entry.employeeType),
        name: String(entry.name || '').trim(),
        code: String(entry.code || '').trim(),
        designation: String(entry.designation || '').trim(),
        phone: String(entry.phone || '').trim(),
        bankName: String(entry.bankName || '').trim(),
        accountNo: String(entry.accountNo || '').trim(),
        basicSalary,
        allowances,
        deductions,
        advanceBalance,
        customValues,
        netSalary: calculateEntryNet(salaryEntry, customColumns),
        paymentMode: String(entry.paymentMode || 'Cash').trim() || 'Cash',
        remarks: String(entry.remarks || '').trim(),
        salaryPayment: entry.salaryPayment || null
    };
}

function calculateSheetTotals(entries = []) {
    return entries.reduce(
        (totals, entry) => {
            totals.totalBasic += safeNumber(entry.basicSalary);
            totals.totalAllowances += safeNumber(entry.allowances);
            totals.totalDeductions += safeNumber(entry.deductions);
            totals.totalNet += safeNumber(entry.netSalary);
            return totals;
        },
        { totalBasic: 0, totalAllowances: 0, totalDeductions: 0, totalNet: 0 }
    );
}

router.get('/columns', async (req, res) => {
    try {
        if (!requireSalaryView(req, res)) return;
        const columns = await SalaryColumn.find({})
            .sort({ calculationType: 1, sortOrder: 1, label: 1 })
            .lean();
        return res.json({ success: true, columns });
    } catch (error) {
        console.error('Salary column fetch error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching salary columns' });
    }
});

router.post('/columns', async (req, res) => {
    try {
        const user = requireSalaryMutation(req, res);
        if (!user) return;

        const payload = buildColumnPayload(req.body, user);
        if (payload.status) return res.status(payload.status).json(payload.body);

        const duplicate = await SalaryColumn.findOne({ labelKey: payload.body.labelKey });
        if (duplicate) {
            return res.status(409).json({ success: false, message: 'Salary column already exists with this name' });
        }

        const column = await SalaryColumn.create(payload.body);
        return res.status(201).json({ success: true, message: 'Salary column saved successfully', column });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: 'Salary column already exists' });
        }
        console.error('Salary column save error:', error);
        return res.status(500).json({ success: false, message: 'Error saving salary column' });
    }
});

router.delete('/columns/:key', async (req, res) => {
    try {
        if (!requireSalaryMutation(req, res)) return;
        const column = await SalaryColumn.findOne({ key: req.params.key });
        if (!column) return res.status(404).json({ success: false, message: 'Salary column not found' });
        await column.deleteOne();
        return res.json({ success: true, message: 'Salary column deleted successfully' });
    } catch (error) {
        console.error('Salary column delete error:', error);
        return res.status(500).json({ success: false, message: 'Error deleting salary column' });
    }
});

router.get('/employees', async (req, res) => {
    try {
        if (!requireSalaryView(req, res)) return;
        const filter = {};
        if (req.query.employeeType) {
            filter.employeeType = normalizeEmployeeType(req.query.employeeType);
        }
        if (String(req.query.includeInactive || '').toLowerCase() !== 'true') {
            filter.isActive = { $ne: false };
        }

        const employees = await SalaryEmployee.find(filter).sort({ employeeType: 1, name: 1 }).lean();
        return res.json({ success: true, employees });
    } catch (error) {
        console.error('Salary employee fetch error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching salary employees' });
    }
});

router.post('/employees', async (req, res) => {
    try {
        if (!requireSalaryMutation(req, res)) return;
        const payload = buildEmployeePayload(req.body);
        if (payload.status) return res.status(payload.status).json(payload.body);

        const duplicate = await SalaryEmployee.findOne({
            employeeType: payload.body.employeeType,
            name: { $regex: `^${payload.body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        });
        if (duplicate) {
            return res.status(409).json({ success: false, message: `${payload.body.employeeType} already exists with this name` });
        }

        const employee = await SalaryEmployee.create(payload.body);
        return res.status(201).json({ success: true, employee });
    } catch (error) {
        console.error('Salary employee save error:', error);
        return res.status(500).json({ success: false, message: 'Error saving salary employee' });
    }
});

router.put('/employees/:id', async (req, res) => {
    try {
        if (!requireSalaryMutation(req, res)) return;
        const employee = await SalaryEmployee.findById(req.params.id);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const payload = buildEmployeePayload(req.body);
        if (payload.status) return res.status(payload.status).json(payload.body);

        Object.assign(employee, payload.body);
        await employee.save();
        return res.json({ success: true, employee });
    } catch (error) {
        console.error('Salary employee update error:', error);
        return res.status(500).json({ success: false, message: 'Error updating salary employee' });
    }
});

router.delete('/employees/:id', async (req, res) => {
    try {
        if (!requireSalaryMutation(req, res)) return;
        const employee = await SalaryEmployee.findById(req.params.id);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
        employee.isActive = false;
        await employee.save();
        return res.json({ success: true, message: 'Employee marked inactive' });
    } catch (error) {
        console.error('Salary employee delete error:', error);
        return res.status(500).json({ success: false, message: 'Error deleting salary employee' });
    }
});

router.post('/sheets/preview', async (req, res) => {
    try {
        if (!requireSalaryView(req, res)) return;
        const employees = await SalaryEmployee.find({ isActive: { $ne: false } }).sort({ employeeType: 1, name: 1 }).lean();
        let entries = employees.map((employee) => buildSheetEntry({
            employeeId: employee._id,
            employeeType: employee.employeeType,
            name: employee.name,
            code: employee.code,
            designation: employee.designation,
            phone: employee.phone,
            bankName: employee.bankName,
            accountNo: employee.accountNo,
            basicSalary: employee.basicSalary,
            allowances: employee.allowances,
            deductions: employee.deductions,
            paymentMode: employee.accountNo ? 'Bank' : 'Cash'
        }));
        entries = await applySalaryPaymentStatus(entries, req.body.month);
        entries = await applySalaryAdvanceBalances(entries, req.body.month);
        return res.json({ success: true, entries, summary: calculateSheetTotals(entries) });
    } catch (error) {
        console.error('Salary sheet preview error:', error);
        return res.status(500).json({ success: false, message: 'Error preparing salary sheet preview' });
    }
});

router.get('/sheets', async (req, res) => {
    try {
        if (!requireSalaryView(req, res)) return;
        const filter = {};
        const month = normalizeMonth(req.query.month);
        if (month) filter.month = month;
        const sheets = await SalarySheet.find(filter).sort({ month: -1, createdAt: -1 }).limit(50).lean();
        await Promise.all(sheets.map(async (sheet) => {
            sheet.entries = await applySalaryPaymentStatus(sheet.entries || [], sheet.month);
        }));
        return res.json({ success: true, sheets });
    } catch (error) {
        console.error('Salary sheet fetch error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching salary sheets' });
    }
});

router.get('/sheets/:id', async (req, res) => {
    try {
        if (!requireSalaryView(req, res)) return;
        const sheet = await SalarySheet.findById(req.params.id).lean();
        if (!sheet) return res.status(404).json({ success: false, message: 'Salary sheet not found' });
        sheet.entries = await applySalaryPaymentStatus(sheet.entries || [], sheet.month);
        sheet.entries = await applySalaryAdvanceBalances(sheet.entries, sheet.month, sheet.customColumns || []);
        Object.assign(sheet, calculateSheetTotals(sheet.entries));
        return res.json({ success: true, sheet });
    } catch (error) {
        console.error('Salary sheet get error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching salary sheet' });
    }
});

router.post('/sheets', async (req, res) => {
    try {
        const user = requireSalaryMutation(req, res);
        if (!user) return;

        const month = normalizeMonth(req.body.month);
        if (!month) return res.status(400).json({ success: false, message: 'Salary month is required in YYYY-MM format' });

        const customColumns = normalizeCustomColumns(req.body.customColumns);
        const entries = (Array.isArray(req.body.entries) ? req.body.entries : [])
            .map((entry) => buildSheetEntry(entry, customColumns))
            .filter((entry) => entry.name && safeNumber(entry.netSalary) !== 0);
        if (!entries.length) return res.status(400).json({ success: false, message: 'Please add at least one salary row' });

        const totals = calculateSheetTotals(entries);
        const sheetPayload = {
            month,
            salaryDate: req.body.salaryDate ? new Date(req.body.salaryDate) : new Date(),
            notes: String(req.body.notes || '').trim(),
            entries,
            customColumns,
            ...totals,
            createdBy: user.username || user.name || user.id || ''
        };

        const existing = await SalarySheet.findOne({ month });
        if (existing) {
            if (!req.body.replaceExisting) {
                return res.status(409).json({ success: false, message: 'Salary sheet already exists for this month' });
            }
            Object.assign(existing, sheetPayload);
            await existing.save();
            return res.json({ success: true, message: 'Salary sheet updated successfully', sheet: existing });
        }

        const sheet = await SalarySheet.create(sheetPayload);
        return res.status(201).json({ success: true, message: 'Salary sheet saved successfully', sheet });
    } catch (error) {
        console.error('Salary sheet save error:', error);
        return res.status(500).json({ success: false, message: 'Error saving salary sheet' });
    }
});

router.delete('/sheets/:id', async (req, res) => {
    try {
        if (!requireSalaryMutation(req, res)) return;
        const sheet = await SalarySheet.findById(req.params.id);
        if (!sheet) return res.status(404).json({ success: false, message: 'Salary sheet not found' });
        await sheet.deleteOne();
        return res.json({ success: true, message: 'Salary sheet deleted successfully' });
    } catch (error) {
        console.error('Salary sheet delete error:', error);
        return res.status(500).json({ success: false, message: 'Error deleting salary sheet' });
    }
});

module.exports = router;
