const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Student = require('../models/Student');
const AcademicSession = require('../models/AcademicSession');
const FeeTransaction = require('../models/FeeTransaction');
const FeePaymentAccount = require('../models/FeePaymentAccount');
const FeeParticular = require('../models/FeeParticular');
const ExpenseHead = require('../models/ExpenseHead');
const ExpenseTransaction = require('../models/ExpenseTransaction');
const TransactionAuditLog = require('../models/TransactionAuditLog');
const FuelCentre = require('../models/FuelCentre');
const BusVehicle = require('../models/BusVehicle');
const FuelLedgerEntry = require('../models/FuelLedgerEntry');
const Supplier = require('../models/Supplier');
const SupplierLedgerEntry = require('../models/SupplierLedgerEntry');

const DEFAULT_EXPENSE_HEADS = [
    'Salary',
    'Electricity',
    'Stationery',
    'Maintenance',
    'Transport',
    'Fuel',
    'Internet',
    'Books',
    'Uniform',
    'Supplier Payment',
    'Event',
    'Miscellaneous'
];
const DEFAULT_FEE_PARTICULARS = [
    'Admission Fee',
    'Re-Admission Fee',
    'Development Fee',
    'Tuition Fee',
    'Exam Fee',
    'Books Fee',
    'Uniform Fee',
    'Diary Fee',
    'I-card',
    'Library',
    'Computer Lab',
    'AC Fee',
    'Digital Smart class',
    'Exercise Copy',
    'Transport Fee',
    'Late Fee',
    'Others',
    'Due Payment'
];
const AUDIT_IGNORED_FIELDS = new Set(['__v', 'updatedAt']);
const FINANCE_MUTATION_ROLES = new Set(['admin', 'accountant']);
const FINANCE_VIEW_ROLES = new Set(['admin', 'accountant', 'staff']);

function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function calculateClosingBalance(currentDueTotal, paidAmount) {
    const dueTotal = safeNumber(currentDueTotal);
    const paid = safeNumber(paidAmount);
    return dueTotal - paid;
}

function buildReceiptNo() {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0')
    ].join('');

    const random = Math.floor(Math.random() * 900) + 100;
    return `FR-${stamp}-${random}`;
}

function buildVoucherNo() {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0')
    ].join('');

    const random = Math.floor(Math.random() * 900) + 100;
    return `EXP-${stamp}-${random}`;
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactCaseInsensitiveRegex(value) {
    return `^${escapeRegex(String(value || '').trim())}$`;
}

function getSearchKeywords(value = '') {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function appendAndCondition(query, condition) {
    if (!query.$and) {
        query.$and = [];
    }
    query.$and.push(condition);
}

function appendKeywordConditions(query, field, value) {
    getSearchKeywords(value).forEach((keyword) => {
        appendAndCondition(query, {
            [field]: { $regex: escapeRegex(keyword), $options: 'i' }
        });
    });
}

function buildLineItemParticularKeywordFilter(value) {
    const keywords = getSearchKeywords(value);
    if (!keywords.length) return null;

    return {
        $elemMatch: {
            $and: keywords.map((keyword) => ({
                particular: { $regex: escapeRegex(keyword), $options: 'i' }
            }))
        }
    };
}

function normalizeFeeParticularName(value = '') {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function getAuditActor(req) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return {
            userId: '',
            username: 'Unknown',
            role: ''
        };
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return {
            userId: String(decoded.userId || ''),
            username: String(decoded.username || 'Unknown'),
            role: String(decoded.role || '')
        };
    } catch (error) {
        return {
            userId: '',
            username: 'Unknown',
            role: ''
        };
    }
}

function getRequestUser(req) {
    return getAuditActor(req);
}

function requireFinanceView(req, res) {
    const actor = getRequestUser(req);
    if (!FINANCE_VIEW_ROLES.has(actor.role) && !FINANCE_MUTATION_ROLES.has(actor.role)) {
        res.status(403).json({
            success: false,
            message: 'You do not have permission to view finance data'
        });
        return null;
    }

    return actor;
}

function requireFinanceMutation(req, res) {
    const actor = getRequestUser(req);
    if (!FINANCE_MUTATION_ROLES.has(actor.role)) {
        res.status(403).json({
            success: false,
            message: 'Only admin or accountant can change finance records'
        });
        return null;
    }

    return actor;
}

function requireFinanceDelete(req, res) {
    const actor = getRequestUser(req);
    if (actor.role !== 'admin') {
        res.status(403).json({
            success: false,
            message: 'Only admin can delete or recover finance records'
        });
        return null;
    }

    return actor;
}

function activeRecordFilter(extra = {}) {
    return {
        isDeleted: { $ne: true },
        ...extra
    };
}

function includeDeletedFilter(extra = {}) {
    return { ...extra };
}

async function resolveSessionDateRange(session) {
    const sessionName = String(session || '').trim();
    if (!sessionName) return null;

    const sessionRecord = await AcademicSession.findOne({ name: sessionName }).lean();
    const parsedYears = sessionName.match(/(\d{4})\D+(\d{4})/);
    const startDate = sessionRecord?.startDate
        ? new Date(sessionRecord.startDate)
        : parsedYears
            ? new Date(Number(parsedYears[1]), 3, 1)
            : null;
    const endDate = sessionRecord?.endDate
        ? new Date(sessionRecord.endDate)
        : parsedYears
            ? new Date(Number(parsedYears[2]), 2, 31)
            : null;

    if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return null;
    }

    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
}

function resolveCollectionMonthRange(sessionRange, monthName) {
    if (!sessionRange) return null;

    const targetMonthIndex = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ].indexOf(String(monthName || '').trim().toLowerCase());

    if (targetMonthIndex < 0) return null;

    const cursor = new Date(sessionRange.startDate.getFullYear(), sessionRange.startDate.getMonth(), 1);
    const lastMonth = new Date(sessionRange.endDate.getFullYear(), sessionRange.endDate.getMonth(), 1);

    while (cursor <= lastMonth) {
        if (cursor.getMonth() === targetMonthIndex) {
            const startDate = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
            const endDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
            return {
                startDate: startDate < sessionRange.startDate ? sessionRange.startDate : startDate,
                endDate: endDate > sessionRange.endDate ? sessionRange.endDate : endDate
            };
        }

        cursor.setMonth(cursor.getMonth() + 1);
    }

    return null;
}

function normalizeReceiptPaymentBreakdown(receipt = {}) {
    if (Array.isArray(receipt.paymentBreakdown) && receipt.paymentBreakdown.length) {
        return receipt.paymentBreakdown.map((entry) => ({
            baseMode: entry.baseMode === 'Cash' ? 'Cash' : 'Online',
            amount: safeNumber(entry.amount)
        }));
    }

    const fallbackAmount = safeNumber(receipt.paidAmount);
    if (!fallbackAmount) return [];

    return [{
        baseMode: receipt.paymentMode === 'Cash' ? 'Cash' : 'Online',
        amount: fallbackAmount
    }];
}

function isDuePaymentExpense(expense = {}) {
    return (expense.paymentBreakdown || []).some((entry) => String(entry.modeLabel || '').trim().toLowerCase() === 'due payment')
        || String(expense.paidFor || '').trim().toLowerCase() === 'due payment';
}

function normalizeExpensePaymentBreakdown(expense = {}) {
    if (Array.isArray(expense.paymentBreakdown) && expense.paymentBreakdown.length) {
        return expense.paymentBreakdown.map((entry) => ({
            baseMode: entry.baseMode === 'Online' ? 'Online' : 'Cash',
            amount: safeNumber(entry.amount)
        }));
    }

    const fallbackAmount = safeNumber(expense.amount);
    if (!fallbackAmount) return [];

    return [{
        baseMode: expense.paymentMode === 'Online' ? 'Online' : 'Cash',
        amount: fallbackAmount
    }];
}

function addCashbookAmount(totals, entry = {}, sign = 1) {
    const key = entry.baseMode === 'Online' ? 'online' : 'cash';
    totals[key] += safeNumber(entry.amount) * sign;
}

function getEditReason(req) {
    return String(req.body?.editReason || req.body?.reason || '').trim();
}

function normalizeAuditValue(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeAuditValue(item));
    }

    if (value && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((result, key) => {
                if (value[key] === undefined) {
                    return result;
                }

                result[key] = normalizeAuditValue(value[key]);
                return result;
            }, {});
    }

    return value ?? null;
}

function buildAuditFieldChanges(previousSnapshot = {}, updatedSnapshot = {}) {
    const previousValue = normalizeAuditValue(previousSnapshot);
    const updatedValue = normalizeAuditValue(updatedSnapshot);
    const keys = [...new Set([
        ...Object.keys(previousValue || {}),
        ...Object.keys(updatedValue || {})
    ])].filter((key) => !AUDIT_IGNORED_FIELDS.has(key));

    return keys.reduce((changes, key) => {
        const before = previousValue?.[key] ?? null;
        const after = updatedValue?.[key] ?? null;

        if (JSON.stringify(before) === JSON.stringify(after)) {
            return changes;
        }

        changes.push({
            field: key,
            previousValue: before,
            updatedValue: after
        });

        return changes;
    }, []);
}

async function recordTransactionAudit({
    req,
    entityType,
    action,
    documentId,
    title,
    voucherNo = '',
    referenceNo = '',
    admissionNo = '',
    editReason = '',
    before = null,
    after = null
}) {
    const normalizedBefore = normalizeAuditValue(before || {});
    const normalizedAfter = normalizeAuditValue(after || {});
    const changedFields = buildAuditFieldChanges(normalizedBefore, normalizedAfter);

    if (action === 'UPDATE' && !changedFields.length) {
        return;
    }

    await TransactionAuditLog.create({
        entityType,
        action,
        documentId: String(documentId || ''),
        title: String(title || '').trim(),
        voucherNo: String(voucherNo || '').trim(),
        referenceNo: String(referenceNo || '').trim(),
        admissionNo: String(admissionNo || '').trim(),
        actor: getAuditActor(req),
        summary: action === 'DELETE'
            ? `${entityType} deleted`
            : action === 'CREATE'
                ? `${entityType} created`
                : action === 'RECOVER'
                    ? `${entityType} recovered`
                    : `${entityType} updated`,
        editReason: String(editReason || '').trim(),
        changedFields,
        snapshotBefore: action === 'CREATE' ? null : normalizedBefore,
        snapshotAfter: action === 'DELETE' ? null : normalizedAfter
    });
}

async function ensureDefaultExpenseHeads() {
    const existingHeads = await ExpenseHead.find({
        name: { $in: DEFAULT_EXPENSE_HEADS }
    }).select('name').lean();

    const existingNames = new Set(existingHeads.map((head) => head.name));
    const missingHeads = DEFAULT_EXPENSE_HEADS
        .filter((name) => !existingNames.has(name))
        .map((name) => ({ name }));

    if (missingHeads.length) {
        await ExpenseHead.insertMany(missingHeads, { ordered: false });
    }
}

async function ensureDefaultFeePaymentAccounts() {
    const existingAccounts = await FeePaymentAccount.find({
        name: { $regex: /^Online-/i }
    }).select('name').lean();

    if (existingAccounts.length) {
        return;
    }

    await FeePaymentAccount.create({ name: 'Online-1' });
}

async function ensureDefaultFeeParticulars() {
    const existingParticulars = await FeeParticular.find({
        name: { $in: DEFAULT_FEE_PARTICULARS }
    }).select('name').lean();

    const existingNames = new Set(existingParticulars.map((particular) => particular.name));
    const missingParticulars = DEFAULT_FEE_PARTICULARS
        .filter((name) => !existingNames.has(name))
        .map((name) => ({ name }));

    if (missingParticulars.length) {
        await FeeParticular.insertMany(missingParticulars, { ordered: false });
    }
}

async function saveFeeParticularNames(names = []) {
    const normalizedNames = [...new Set(
        names
            .map((name) => normalizeFeeParticularName(name))
            .filter(Boolean)
    )];

    await Promise.all(normalizedNames.map(async (name) => {
        const existingParticular = await FeeParticular.findOne({
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        });

        if (existingParticular) {
            if (!existingParticular.isActive) {
                existingParticular.isActive = true;
                await existingParticular.save();
            }
            return existingParticular;
        }

        return FeeParticular.create({ name });
    }));
}

function normalizeExpensePaymentBreakdown(rawPaymentBreakdown = [], fallbackPaymentMode = 'Cash', fallbackAmount = 0) {
    const normalizedFallbackBaseMode = fallbackPaymentMode === 'Cash' ? 'Cash' : 'Online';
    const normalizedEntries = (Array.isArray(rawPaymentBreakdown) ? rawPaymentBreakdown : [])
        .map((entry) => {
            const modeLabel = String(entry?.modeLabel || entry?.label || entry?.paymentMode || '').trim();
            const inferredBaseMode = String(entry?.baseMode || (modeLabel && !['Cash', 'Due', 'Due Payment'].includes(modeLabel) ? 'Online' : normalizedFallbackBaseMode)).trim();

            return {
                modeLabel: modeLabel || (inferredBaseMode === 'Online' ? 'Online-1' : 'Cash'),
                baseMode: inferredBaseMode === 'Online' ? 'Online' : 'Cash',
                amount: safeNumber(entry?.amount)
            };
        })
        .filter((entry) => entry.amount > 0);

    if (normalizedEntries.length) {
        return normalizedEntries;
    }

    const normalizedAmount = safeNumber(fallbackAmount);
    if (normalizedAmount <= 0) {
        return [];
    }

    return [{
        modeLabel: normalizedFallbackBaseMode === 'Online' ? 'Online-1' : 'Cash',
        baseMode: normalizedFallbackBaseMode,
        amount: normalizedAmount
    }];
}

function getExpensePaymentModeSummary(paymentBreakdown = []) {
    const baseModes = [...new Set(paymentBreakdown.map((entry) => entry.baseMode))];
    if (!baseModes.length) return 'Cash';
    if (baseModes.length === 1) return baseModes[0];
    return 'Mixed';
}

function normalizeSalaryExpenseDetails(rawSalaryDetails = null, expense = {}) {
    if (!rawSalaryDetails || typeof rawSalaryDetails !== 'object') {
        return null;
    }

    const head = String(expense.headOfAccount || '').trim().toLowerCase();
    if (head !== 'salary') {
        return null;
    }

    return {
        employeeName: String(rawSalaryDetails.employeeName || expense.paidTo || '').trim(),
        salaryMonth: String(rawSalaryDetails.salaryMonth || '').trim(),
        grossSalary: Math.max(0, safeNumber(rawSalaryDetails.grossSalary)),
        advanceAdjusted: Math.max(0, safeNumber(rawSalaryDetails.advanceAdjusted))
    };
}

function getExpenseModeTotals(expense = {}) {
    const normalizedBreakdown = normalizeExpensePaymentBreakdown(
        expense.paymentBreakdown,
        expense.paymentMode,
        expense.amount
    );

    return normalizedBreakdown.reduce((totals, entry) => {
        if (entry.baseMode === 'Cash') {
            totals.cash += safeNumber(entry.amount);
        } else {
            totals.online += safeNumber(entry.amount);
        }
        return totals;
    }, { cash: 0, online: 0 });
}

function isFuelExpensePayload(payload = {}) {
    const head = String(payload.headOfAccount || '').toLowerCase();
    const paidFor = String(payload.paidFor || '').toLowerCase();
    return head.includes('fuel') || paidFor.includes('fuel');
}

function hasFuelDetails(rawFuelDetails = null) {
    if (!rawFuelDetails || typeof rawFuelDetails !== 'object') {
        return false;
    }

    return ['fuelCentreName', 'receiptNo', 'vehicleNumber', 'volumeLtr', 'recordedKmMeter']
        .some((field) => String(rawFuelDetails[field] ?? '').trim() !== '');
}

function isSupplierPaymentPayload(payload = {}) {
    const head = String(payload.headOfAccount || '').toLowerCase();
    const paidFor = String(payload.paidFor || '').toLowerCase();
    return head.includes('supplier') || paidFor.includes('supplier') || paidFor.includes('purchase payment');
}

function hasSupplierDetails(rawSupplierDetails = null) {
    if (!rawSupplierDetails || typeof rawSupplierDetails !== 'object') return false;
    return String(rawSupplierDetails.supplierName || '').trim() !== '';
}

async function ensureSupplierRecord(name) {
    const supplierName = String(name || '').trim();
    if (!supplierName) return;
    const supplier = await Supplier.findOne({ name: { $regex: `^${escapeRegex(supplierName)}$`, $options: 'i' } });
    if (!supplier) {
        await Supplier.create({ name: supplierName });
    } else if (!supplier.isActive) {
        supplier.isActive = true;
        await supplier.save();
    }
}

async function ensureFuelOptionRecords(fuelDetails = {}) {
    const fuelCentreName = String(fuelDetails.fuelCentreName || '').trim();
    const vehicleNumber = String(fuelDetails.vehicleNumber || '').trim().toUpperCase();

    if (fuelCentreName) {
        const existingCentre = await FuelCentre.findOne({
            name: { $regex: `^${escapeRegex(fuelCentreName)}$`, $options: 'i' }
        });
        if (!existingCentre) {
            await FuelCentre.create({ name: fuelCentreName });
        } else if (!existingCentre.isActive) {
            existingCentre.isActive = true;
            await existingCentre.save();
        }
    }

    if (vehicleNumber) {
        const existingVehicle = await BusVehicle.findOne({
            vehicleNumber: { $regex: `^${escapeRegex(vehicleNumber)}$`, $options: 'i' }
        });
        if (!existingVehicle) {
            await BusVehicle.create({ vehicleNumber });
        } else if (!existingVehicle.isActive) {
            existingVehicle.isActive = true;
            await existingVehicle.save();
        }
    }
}

function validateAndBuildFuelDetails(rawFuelDetails = {}, expense = {}) {
    const shouldTrackFuel = isFuelExpensePayload(expense) || hasFuelDetails(rawFuelDetails);

    if (!shouldTrackFuel) {
        return { status: null, body: null };
    }

    const fuelDetails = rawFuelDetails || {};
    const fuelDate = fuelDetails.fuelDate || fuelDetails.date || expense.expenseDate || new Date();
    const normalizedFuelDate = new Date(fuelDate);
    const fuelCentreName = String(fuelDetails.fuelCentreName || expense.paidTo || '').trim();
    const receiptNo = String(fuelDetails.receiptNo || expense.voucherNo || '').trim();
    const vehicleNumber = String(fuelDetails.vehicleNumber || '').trim().toUpperCase();
    const volumeLtr = safeNumber(fuelDetails.volumeLtr);
    const amount = safeNumber(fuelDetails.amount || expense.amount);
    const recordedKmMeter = safeNumber(fuelDetails.recordedKmMeter);
    const notes = String(fuelDetails.notes || expense.notes || '').trim();

    if (Number.isNaN(normalizedFuelDate.getTime())) {
        return { status: 400, body: { success: false, message: 'Invalid fuel date' } };
    }

    if (!fuelCentreName) {
        return {
            status: 400,
            body: { success: false, message: 'Fuel centre name is required for fuel expenses' }
        };
    }

    return {
        status: null,
        body: {
            fuelDate: normalizedFuelDate,
            fuelCentreName,
            receiptNo,
            vehicleNumber,
            volumeLtr,
            amount,
            recordedKmMeter,
            notes
        }
    };
}

async function syncFuelLedgerForExpense(expense, rawFuelDetails = null) {
    const existingEntry = await FuelLedgerEntry.findOne({ expenseId: expense._id });
    const fuelResult = validateAndBuildFuelDetails(rawFuelDetails, expense);

    if (fuelResult.status) {
        return fuelResult;
    }

    if (!isFuelExpensePayload(expense) && !hasFuelDetails(rawFuelDetails)) {
        if (existingEntry && !existingEntry.isDeleted) {
            existingEntry.isDeleted = true;
            await existingEntry.save();
        }
        return { status: null, body: null };
    }

    await ensureFuelOptionRecords(fuelResult.body);

    const payload = {
        ...fuelResult.body,
        expenseId: expense._id,
        expenseVoucherNo: expense.voucherNo,
        isDeleted: false
    };

    if (existingEntry) {
        Object.assign(existingEntry, payload);
        await existingEntry.save();
        return { status: null, body: existingEntry };
    }

    const entry = await FuelLedgerEntry.create(payload);
    return { status: null, body: entry };
}

function validateAndBuildSupplierPaymentDetails(rawSupplierDetails = {}, expense = {}) {
    const shouldTrackSupplier = isSupplierPaymentPayload(expense) || hasSupplierDetails(rawSupplierDetails);
    if (!shouldTrackSupplier) return { status: null, body: null };

    const supplierDetails = rawSupplierDetails || {};
    const supplierName = String(supplierDetails.supplierName || expense.paidTo || '').trim();
    const entryDate = new Date(supplierDetails.entryDate || supplierDetails.paymentDate || expense.expenseDate || new Date());
    const amount = safeNumber(supplierDetails.amount || expense.amount);
    const notes = String(supplierDetails.notes || expense.notes || expense.paidFor || '').trim();

    if (Number.isNaN(entryDate.getTime())) {
        return { status: 400, body: { success: false, message: 'Invalid supplier payment date' } };
    }
    if (!supplierName) {
        return { status: 400, body: { success: false, message: 'Supplier name is required for supplier payment' } };
    }
    if (amount <= 0) {
        return { status: 400, body: { success: false, message: 'Supplier payment amount must be greater than zero' } };
    }

    return {
        status: null,
        body: {
            entryDate,
            supplierName,
            itemName: 'Payment',
            billNo: expense.voucherNo || '',
            quantity: 0,
            rate: 0,
            amount,
            notes,
            entryType: 'PAYMENT'
        }
    };
}

async function syncSupplierLedgerForExpense(expense, rawSupplierDetails = null) {
    const existingEntry = await SupplierLedgerEntry.findOne({ expenseId: expense._id });
    const supplierResult = validateAndBuildSupplierPaymentDetails(rawSupplierDetails, expense);

    if (supplierResult.status) return supplierResult;

    if (!isSupplierPaymentPayload(expense) && !hasSupplierDetails(rawSupplierDetails)) {
        if (existingEntry && !existingEntry.isDeleted) {
            existingEntry.isDeleted = true;
            await existingEntry.save();
        }
        return { status: null, body: null };
    }

    await ensureSupplierRecord(supplierResult.body.supplierName);
    const payload = {
        ...supplierResult.body,
        expenseId: expense._id,
        expenseVoucherNo: expense.voucherNo,
        isDeleted: false
    };

    if (existingEntry) {
        Object.assign(existingEntry, payload);
        await existingEntry.save();
        return { status: null, body: existingEntry };
    }

    const entry = await SupplierLedgerEntry.create(payload);
    return { status: null, body: entry };
}

async function validateAndBuildExpensePayload({
    voucherNo,
    headOfAccount,
    paidTo,
    paidFor,
    amount,
    paymentMode,
    paymentBreakdown: rawPaymentBreakdown,
    salaryDetails: rawSalaryDetails,
    notes,
    expenseDate,
    excludeExpenseId = null
}) {
    const normalizedVoucherNo = String(voucherNo || '').trim().toUpperCase();
    const normalizedHead = String(headOfAccount || '').trim();
    const normalizedPaidTo = String(paidTo || '').trim();
    const normalizedPaidFor = String(paidFor || '').trim();
    const normalizedNotes = String(notes || '').trim();
    const normalizedExpenseDate = expenseDate ? new Date(expenseDate) : new Date();

    if (!normalizedVoucherNo) {
        return { status: 400, body: { success: false, message: 'Voucher No. is required' } };
    }

    if (!normalizedHead || !normalizedPaidTo || !normalizedPaidFor) {
        return {
            status: 400,
            body: {
                success: false,
                message: 'Head of account, paid to and paid for are required'
            }
        };
    }

    if (Number.isNaN(normalizedExpenseDate.getTime())) {
        return { status: 400, body: { success: false, message: 'Invalid expense date' } };
    }

    const normalizedPaymentBreakdown = normalizeExpensePaymentBreakdown(
        rawPaymentBreakdown,
        paymentMode,
        amount
    );
    const isSalaryAdvanceOnlyAdjustment = normalizedHead.toLowerCase() === 'salary'
        && safeNumber(rawSalaryDetails?.advanceAdjusted) > 0
        && !normalizedPaymentBreakdown.length;

    if (!normalizedPaymentBreakdown.length && !isSalaryAdvanceOnlyAdjustment) {
        return { status: 400, body: { success: false, message: 'Please add at least one payment row with amount' } };
    }

    const duplicatePaymentMode = normalizedPaymentBreakdown.reduce((duplicate, entry, index, entries) => {
        if (duplicate) return duplicate;

        const modeKey = entry.modeLabel.toLowerCase();
        const firstIndex = entries.findIndex((candidate) => candidate.modeLabel.toLowerCase() === modeKey);
        return firstIndex !== index ? entry.modeLabel : null;
    }, null);

    if (duplicatePaymentMode) {
        return {
            status: 400,
            body: {
                success: false,
                message: `Payment type "${duplicatePaymentMode}" is selected more than once`
            }
        };
    }

    const normalizedAmount = normalizedPaymentBreakdown.reduce((sum, entry) => sum + safeNumber(entry.amount), 0);
    if (normalizedAmount <= 0 && !isSalaryAdvanceOnlyAdjustment) {
        return { status: 400, body: { success: false, message: 'Expense amount must be greater than zero' } };
    }

    const existingVoucher = await ExpenseTransaction.findOne({
        isDeleted: { $ne: true },
        voucherNo: { $regex: `^${escapeRegex(normalizedVoucherNo)}$`, $options: 'i' },
        _id: excludeExpenseId ? { $ne: excludeExpenseId } : { $exists: true }
    }).lean();

    if (existingVoucher) {
        return { status: 400, body: { success: false, message: 'Voucher No. already exists' } };
    }

    const existingHead = await ExpenseHead.findOne({
        name: { $regex: `^${escapeRegex(normalizedHead)}$`, $options: 'i' }
    });

    if (!existingHead) {
        await ExpenseHead.create({ name: normalizedHead });
    } else if (!existingHead.isActive) {
        existingHead.isActive = true;
        await existingHead.save();
    }

    const expensePayload = {
        voucherNo: normalizedVoucherNo,
        headOfAccount: normalizedHead,
        paidTo: normalizedPaidTo,
        paidFor: normalizedPaidFor,
        amount: normalizedAmount,
        paymentMode: getExpensePaymentModeSummary(normalizedPaymentBreakdown),
        paymentBreakdown: normalizedPaymentBreakdown,
        notes: normalizedNotes,
        expenseDate: normalizedExpenseDate
    };

    const salaryDetails = normalizeSalaryExpenseDetails(rawSalaryDetails, expensePayload);
    if (salaryDetails) {
        expensePayload.salaryDetails = salaryDetails;
    }

    return {
        status: null,
        body: expensePayload
    };
}

async function getFeeAggregateSummary(admissionNo) {
    const normalizedAdmissionNo = String(admissionNo || '').trim();
    const aggregateTotals = await FeeTransaction.aggregate([
        {
            $match: activeRecordFilter({
                admissionNo: { $regex: exactCaseInsensitiveRegex(normalizedAdmissionNo), $options: 'i' }
            })
        },
        {
            $group: {
                _id: null,
                totalPaid: { $sum: '$paidAmount' },
                totalCharges: { $sum: '$currentChargesTotal' },
                transactionCount: { $sum: 1 },
                lastReceiptDate: { $max: '$receiptDate' }
            }
        }
    ]);

    const totals = aggregateTotals[0] || {
        totalPaid: 0,
        totalCharges: 0,
        transactionCount: 0,
        lastReceiptDate: null
    };

    const netBalance = safeNumber(totals.totalCharges) - safeNumber(totals.totalPaid);
    const totalOutstanding = Math.max(netBalance, 0);

    return {
        previousDueAmount: netBalance,
        totalOutstanding,
        excessPayment: Math.max(-netBalance, 0),
        totalPaid: safeNumber(totals.totalPaid),
        totalCharges: safeNumber(totals.totalCharges),
        transactionCount: safeNumber(totals.transactionCount),
        lastReceiptDate: totals.lastReceiptDate || null
    };
}

async function getStudentWithFeeSummary(admissionNo, session = '') {
    const normalizedAdmissionNo = String(admissionNo || '').trim();
    const studentQuery = { studentId: { $regex: exactCaseInsensitiveRegex(normalizedAdmissionNo), $options: 'i' } };
    if (session) {
        studentQuery.session = session;
    }

    const student = await Student.findOne(studentQuery).sort({ createdAt: -1 }).lean();
    if (!student) {
        return null;
    }

    const transactions = await FeeTransaction.find(activeRecordFilter({
        admissionNo: { $regex: exactCaseInsensitiveRegex(normalizedAdmissionNo), $options: 'i' }
    }))
        .sort({ createdAt: -1 })
        .limit(25)
        .lean();

    const totals = await getFeeAggregateSummary(normalizedAdmissionNo);

    return {
        student,
        summary: {
            previousDueAmount: totals.previousDueAmount,
            totalOutstanding: totals.totalOutstanding,
            excessPayment: totals.excessPayment,
            totalPaid: totals.totalPaid,
            totalCharges: totals.totalCharges,
            transactionCount: totals.transactionCount,
            lastReceiptDate: totals.lastReceiptDate
        },
        transactions
    };
}

async function validateAndBuildReceiptPayload({
    admissionNo,
    voucherNo, // ✅ added
    session,
    month,
    receiptDate,
    paymentMode,
    paymentBreakdown: rawPaymentBreakdown,
    paidAmount,
    notes,
    lineItems: rawLineItems,
    excludeReceiptId = null
}) {
    if (!admissionNo) {
        return { status: 400, body: { success: false, message: 'Admission number is required' } };
    }

    const normalizedVoucherNo = String(voucherNo || '').trim().toUpperCase();

    if (!normalizedVoucherNo) {
        return {
            status: 400,
            body: { success: false, message: 'Voucher No. is required' }
        };
    }
    
    const requestedSession = String(session || '').trim();
    const normalizedAdmissionNo = String(admissionNo || '').trim();
    const studentQuery = { studentId: { $regex: exactCaseInsensitiveRegex(normalizedAdmissionNo), $options: 'i' } };
    if (requestedSession) {
        studentQuery.session = requestedSession;
    }

    const student = await Student.findOne(studentQuery).sort({ createdAt: -1 }).lean();
    if (!student) {
        return { status: 404, body: { success: false, message: 'Student not found' } };
    }
    const normalizedSession = String(student.session || requestedSession || '').trim();

    const lineItems = (Array.isArray(rawLineItems) ? rawLineItems : [])
        .map((item) => ({
            particular: String(item.particular || '').trim(),
            amount: safeNumber(item.amount)
        }))
        .filter((item) => item.particular && item.amount > 0);

    const feeSummary = await getFeeAggregateSummary(student.studentId);
    let previousDueAmount = feeSummary.previousDueAmount;

    if (excludeReceiptId) {
        const existingReceipt = await FeeTransaction.findById(excludeReceiptId).lean();
        if (!existingReceipt || existingReceipt.isDeleted) {
            return { status: 404, body: { success: false, message: 'Receipt not found' } };
        }

        previousDueAmount = previousDueAmount - safeNumber(existingReceipt.currentChargesTotal) + safeNumber(existingReceipt.paidAmount);
    }

    const hasPositivePayment = safeNumber(paidAmount) > 0
        || (Array.isArray(rawPaymentBreakdown) && rawPaymentBreakdown.some((entry) => safeNumber(entry?.amount) > 0));
    const hasExistingBalance = previousDueAmount !== 0;

    if (!lineItems.length && !hasPositivePayment && !hasExistingBalance) {
        return { status: 400, body: { success: false, message: 'Please add at least one particular row with amount or enter a payment amount' } };
    }

    const requiresMonth = lineItems.some((item) => item.particular === 'Tuition Fee');
    const normalizedMonth = String(month || '').trim();

    if (requiresMonth && !normalizedMonth) {
        return { status: 400, body: { success: false, message: 'Month is mandatory when Tuition Fee is selected' } };
    }

    const currentChargesTotal = lineItems.reduce((sum, item) => sum + safeNumber(item.amount), 0);
    const currentDueTotal = previousDueAmount + currentChargesTotal;
    const normalizedPaymentBreakdown = (Array.isArray(rawPaymentBreakdown) ? rawPaymentBreakdown : [])
        .map((entry) => {
            const modeLabel = String(entry.modeLabel || entry.label || entry.paymentMode || '').trim();
            const inferredBaseMode = String(entry.baseMode || (modeLabel.startsWith('Online') ? 'Online' : modeLabel || paymentMode || 'Cash')).trim();

            return {
                modeLabel: modeLabel || (inferredBaseMode === 'Online' ? 'Online-1' : 'Cash'),
                baseMode: inferredBaseMode === 'Online' ? 'Online' : 'Cash',
                amount: safeNumber(entry.amount)
            };
        })
        .filter((entry) => entry.amount >= 0);
    const duplicatePaymentMode = normalizedPaymentBreakdown.reduce((duplicate, entry, index, entries) => {
        if (duplicate) return duplicate;

        const modeKey = entry.modeLabel.toLowerCase();
        const firstIndex = entries.findIndex((candidate) => candidate.modeLabel.toLowerCase() === modeKey);
        return firstIndex !== index ? entry.modeLabel : null;
    }, null);
    const normalizedPaidAmount = normalizedPaymentBreakdown.length
        ? normalizedPaymentBreakdown.reduce((sum, entry) => sum + safeNumber(entry.amount), 0)
        : safeNumber(paidAmount);
    const normalizedPaymentMode = normalizedPaymentBreakdown.length
        ? [...new Set(normalizedPaymentBreakdown.map((entry) => entry.baseMode))].length > 1
            ? 'Mixed'
            : normalizedPaymentBreakdown[0].baseMode
        : paymentMode === 'Online'
            ? 'Online'
            : 'Cash';
    const normalizedReceiptDate = receiptDate ? new Date(receiptDate) : new Date();

    if (Number.isNaN(normalizedReceiptDate.getTime())) {
        return {
            status: 400,
            body: {
                success: false,
                message: 'Invalid payment date'
            }
        };
    }

    if (duplicatePaymentMode) {
        return {
            status: 400,
            body: {
                success: false,
                message: `Payment type "${duplicatePaymentMode}" is selected more than once`
            }
        };
    }

    if (lineItems.some((item) => item.particular === 'Tuition Fee') && normalizedMonth) {
        const existingMonthCharge = await FeeTransaction.exists({
            isDeleted: { $ne: true },
            admissionNo: { $regex: exactCaseInsensitiveRegex(student.studentId), $options: 'i' },
            session: normalizedSession,
            month: normalizedMonth,
            _id: excludeReceiptId ? { $ne: excludeReceiptId } : { $exists: true },
            lineItems: { $elemMatch: { particular: 'Tuition Fee' } }
        });

        if (existingMonthCharge) {
            return {
                status: 400,
                body: {
                    success: false,
                    message: `Tuition Fee for ${normalizedMonth} is already recorded for this student in session ${normalizedSession || '-'}`
                }
            };
        }
    }
const escapedVoucher = normalizedVoucherNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const existingVoucher = await FeeTransaction.findOne({
    isDeleted: { $ne: true },
    voucherNo: { $regex: `^${escapedVoucher}$`, $options: 'i' },
    _id: excludeReceiptId ? { $ne: excludeReceiptId } : { $exists: true }
});

if (existingVoucher) {
    return {
        status: 400,
        body: {
            success: false,
            message: 'Voucher No. already exists'
        }
    };
}
//  if (normalizedPaidAmount > currentDueTotal) {
//         return {
//             status: 400,
//             body: {
//                 success: false,
//                 message: 'Paid amount cannot be greater than current due total'
//             }
//         };
//     }

    return {
        payload: {
            admissionNo: student.studentId,
            voucherNo: normalizedVoucherNo,
            studentName: student.name,
            fatherName: student.fatherName,
            className: student.class,
            section: student.section || '',
            rollNo: student.rollNo || '',
            session: normalizedSession,
            month: normalizedMonth,
            paymentMode: normalizedPaymentMode,
            paymentBreakdown: normalizedPaymentBreakdown.length
                ? normalizedPaymentBreakdown
                : [{
                    modeLabel: normalizedPaymentMode === 'Online' ? 'Online-1' : 'Cash',
                    baseMode: normalizedPaymentMode === 'Online' ? 'Online' : 'Cash',
                    amount: normalizedPaidAmount
                }],
            lineItems,
            previousDueAmount,
            currentChargesTotal,
            currentDueTotal,
            paidAmount: normalizedPaidAmount,
            dueAmount: calculateClosingBalance(currentDueTotal, normalizedPaidAmount),
            notes: notes || '',
            receiptDate: normalizedReceiptDate
        }
    };
}

router.get('/dashboard', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const [feeTotals, latestDues, expenseTotals, studentCount] = await Promise.all([
            FeeTransaction.aggregate([
                { $match: activeRecordFilter() },
                {
                    $group: {
                        _id: null,
                        totalCollected: { $sum: '$paidAmount' },
                        totalCharges: { $sum: '$currentChargesTotal' },
                        receiptCount: { $sum: 1 }
                    }
                }
            ]),
            FeeTransaction.aggregate([
                { $match: activeRecordFilter() },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$admissionNo',
                        admissionNo: { $first: '$admissionNo' },
                        studentName: { $first: '$studentName' },
                        className: { $first: '$className' },
                        section: { $first: '$section' },
                        dueAmount: { $first: '$dueAmount' }
                    }
                },
                { $match: { dueAmount: { $gt: 0 } } }
            ]),
            ExpenseTransaction.aggregate([
                { $match: activeRecordFilter() },
                {
                    $group: {
                        _id: null,
                        totalExpense: { $sum: '$amount' },
                        expenseCount: { $sum: 1 }
                    }
                }
            ]),
            Student.countDocuments()
        ]);

        const feeSummary = feeTotals[0] || {
            totalCollected: 0,
            totalCharges: 0,
            receiptCount: 0
        };
        const expenseSummary = expenseTotals[0] || {
            totalExpense: 0,
            expenseCount: 0
        };
        const totalOutstanding = latestDues.reduce((sum, item) => sum + safeNumber(item.dueAmount), 0);

        return res.json({
            success: true,
            summary: {
                totalCollected: safeNumber(feeSummary.totalCollected),
                totalCharges: safeNumber(feeSummary.totalCharges),
                receiptCount: safeNumber(feeSummary.receiptCount),
                totalExpense: safeNumber(expenseSummary.totalExpense),
                expenseCount: safeNumber(expenseSummary.expenseCount),
                totalOutstanding,
                dueStudentCount: latestDues.length,
                studentCount: safeNumber(studentCount),
                netBalance: safeNumber(feeSummary.totalCollected) - safeNumber(expenseSummary.totalExpense)
            }
        });
    } catch (error) {
        console.error('Finance dashboard fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching finance dashboard'
        });
    }
});

router.get('/today-transactions', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const requestedDate = String(req.query.date || '').trim();
        let reportDate = new Date();

        if (requestedDate) {
            const [year, month, day] = requestedDate.split('-').map(Number);

            if (!year || !month || !day) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Use YYYY-MM-DD.'
                });
            }

            reportDate = new Date(year, month - 1, day);

            if (
                Number.isNaN(reportDate.getTime())
                || reportDate.getFullYear() !== year
                || reportDate.getMonth() !== month - 1
                || reportDate.getDate() !== day
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Use YYYY-MM-DD.'
                });
            }
        }

        const startOfDay = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 23, 59, 59, 999);
        const previousClosingEnd = new Date(startOfDay);
        previousClosingEnd.setMilliseconds(-1);

        const [receipts, expenses, previousReceipts, previousExpenses] = await Promise.all([
            FeeTransaction.find(activeRecordFilter({
                receiptDate: { $gte: startOfDay, $lte: endOfDay }
            }))
                .sort({ receiptDate: -1, createdAt: -1 })
                .lean(),
            ExpenseTransaction.find(activeRecordFilter({
                expenseDate: { $gte: startOfDay, $lte: endOfDay }
            }))
                .sort({ expenseDate: -1, createdAt: -1 })
                .lean(),
            FeeTransaction.find(activeRecordFilter({
                receiptDate: { $lte: previousClosingEnd }
            }))
                .select('paidAmount paymentMode paymentBreakdown')
                .lean(),
            ExpenseTransaction.find(activeRecordFilter({
                expenseDate: { $lte: previousClosingEnd }
            }))
                .select('amount paymentMode paymentBreakdown paidFor')
                .lean()
        ]);

        const opening = { cash: 0, online: 0 };

        previousReceipts.forEach((receipt) => {
            normalizeReceiptPaymentBreakdown(receipt).forEach((entry) => addCashbookAmount(opening, entry, 1));
        });

        previousExpenses.forEach((expense) => {
            const sign = isDuePaymentExpense(expense) ? 1 : -1;
            normalizeExpensePaymentBreakdown(expense).forEach((entry) => addCashbookAmount(opening, entry, sign));
        });

        const feeCash = receipts.reduce((sum, item) => {
            const breakdownCash = (item.paymentBreakdown || [])
                .filter((entry) => entry.baseMode === 'Cash')
                .reduce((entrySum, entry) => entrySum + safeNumber(entry.amount), 0);

            if (breakdownCash > 0) {
                return sum + breakdownCash;
            }

            return item.paymentMode === 'Cash' ? sum + safeNumber(item.paidAmount) : sum;
        }, 0);
        const feeOnline = receipts.reduce((sum, item) => {
            const breakdownOnline = (item.paymentBreakdown || [])
                .filter((entry) => entry.baseMode === 'Online')
                .reduce((entrySum, entry) => entrySum + safeNumber(entry.amount), 0);

            if (breakdownOnline > 0) {
                return sum + breakdownOnline;
            }

            return item.paymentMode === 'Online' ? sum + safeNumber(item.paidAmount) : sum;
        }, 0);
        const expenseCash = expenses.reduce((sum, item) => sum + getExpenseModeTotals(item).cash, 0);
        const expenseOnline = expenses.reduce((sum, item) => sum + getExpenseModeTotals(item).online, 0);

        const totalIncome = receipts.reduce((sum, item) => sum + safeNumber(item.paidAmount), 0);
        const totalExpense = expenses.reduce((sum, item) => sum + safeNumber(item.amount), 0);
        const netCash = opening.cash + feeCash - expenseCash;
        const netOnline = opening.online + feeOnline - expenseOnline;

        return res.json({
            success: true,
            date: startOfDay,
            receipts,
            expenses,
            summary: {
                feeCash,
                feeOnline,
                openingCash: opening.cash,
                openingOnline: opening.online,
                openingBalance: opening.cash + opening.online,
                expenseCash,
                expenseOnline,
                netCash,
                netOnline,
                totalIncome,
                totalExpense,
                netBalance: netCash + netOnline,
                receiptCount: receipts.length,
                expenseCount: expenses.length
            }
        });
    } catch (error) {
        console.error('Today transactions fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching today transactions'
        });
    }
});

router.get('/due-report', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const { search, className, section, limit } = req.query;
        const match = activeRecordFilter();

        if (className) {
            match.className = className;
        }

        if (section) {
            match.section = section;
        }

        if (search) {
            const pattern = String(search).trim();
            match.$or = [
                { admissionNo: { $regex: pattern, $options: 'i' } },
                { studentName: { $regex: pattern, $options: 'i' } },
                { receiptNo: { $regex: pattern, $options: 'i' } }
            ];
        }

        const maxLimit = Math.min(safeNumber(limit) || 300, 1000);

        const dueRows = await FeeTransaction.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$admissionNo',
                    admissionNo: { $first: '$admissionNo' },
                    studentName: { $first: '$studentName' },
                    fatherName: { $first: '$fatherName' },
                    className: { $first: '$className' },
                    section: { $first: '$section' },
                    rollNo: { $first: '$rollNo' },
                    lastReceiptNo: { $first: '$receiptNo' },
                    lastReceiptDate: { $first: '$receiptDate' },
                    latestBalance: { $first: '$dueAmount' },
                    paidAmount: { $sum: '$paidAmount' },
                    chargesTotal: { $sum: '$currentChargesTotal' },
                    transactionCount: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    dueAmount: {
                        $cond: [{ $gt: ['$latestBalance', 0] }, '$latestBalance', 0]
                    },
                    excessPayment: {
                        $cond: [{ $lt: ['$latestBalance', 0] }, { $abs: '$latestBalance' }, 0]
                    }
                }
            },
            {
                $match: {
                    $or: [
                        { dueAmount: { $gt: 0 } },
                        { excessPayment: { $gt: 0 } }
                    ]
                }
            },
            { $sort: { dueAmount: -1, excessPayment: -1, studentName: 1 } },
            { $limit: maxLimit }
        ]);

        return res.json({
            success: true,
            dues: dueRows,
            totals: {
                totalOutstanding: dueRows.reduce((sum, item) => sum + safeNumber(item.dueAmount), 0),
                totalExcessPayment: dueRows.reduce((sum, item) => sum + safeNumber(item.excessPayment), 0),
                studentCount: dueRows.length
            }
        });
    } catch (error) {
        console.error('Due report fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching due report'
        });
    }
});

router.get('/student/:admissionNo', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const result = await getStudentWithFeeSummary(req.params.admissionNo, req.query.session || '');

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Fee student fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching student fee summary'
        });
    }
});

router.get('/receipt/:id', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const receipt = await FeeTransaction.findById(req.params.id).lean();
        if (!receipt || receipt.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Receipt not found'
            });
        }

        return res.json({
            success: true,
            receipt
        });
    } catch (error) {
        console.error('Fee receipt fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching receipt'
        });
    }
});

router.get('/transactions', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const {
            admissionNo,
            studentName,
            month,
            className,
            paymentMode,
            particular,
            collectionMonth,
            startDate,
            endDate,
            session,
            includeDeleted,
            page = 1,
            limit = 50
        } = req.query;

        const query = includeDeleted === 'true'
            ? includeDeletedFilter()
            : activeRecordFilter();

        if (admissionNo) {
            query.admissionNo = { $regex: exactCaseInsensitiveRegex(admissionNo), $options: 'i' };
        }

        if (studentName) {
            appendKeywordConditions(query, 'studentName', studentName);
        }

        if (month) {
            query.month = month;
        }

        if (className) {
            query.className = className;
        }

        if (paymentMode) {
            query.paymentMode = paymentMode;
        }

        if (particular) {
            const particularFilter = buildLineItemParticularKeywordFilter(particular);
            if (particularFilter) {
                query.lineItems = particularFilter;
            }
        }

        let hasCollectionMonthFilter = false;

        if (collectionMonth) {
            if (!session) {
                return res.status(400).json({
                    success: false,
                    message: 'Session is required when filtering by collection month'
                });
            }

            const sessionRange = await resolveSessionDateRange(session);
            const collectionMonthRange = resolveCollectionMonthRange(sessionRange, collectionMonth);

            if (!collectionMonthRange) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected collection month is outside the session date range'
                });
            }

            query.receiptDate = {
                $gte: collectionMonthRange.startDate,
                $lte: collectionMonthRange.endDate
            };
            hasCollectionMonthFilter = true;
        }

        if (session && !hasCollectionMonthFilter) {
            const sessionName = String(session).trim();
            const [startYear, endYear] = sessionName.split('-').map((year) => parseInt(year, 10));
            const sessionConditions = [{ session: sessionName }];

            if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
                sessionConditions.push({
                    session: { $in: ['', null] },
                    receiptDate: {
                        $gte: new Date(startYear, 3, 1),
                        $lte: new Date(endYear, 2, 31, 23, 59, 59, 999)
                    }
                });
            }

            query.$or = sessionConditions;
        } else if (!hasCollectionMonthFilter && (startDate || endDate)) {
            query.receiptDate = {};
            if (startDate) {
                query.receiptDate.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.receiptDate.$lte = end;
            }
        }

        const maxLimit = Math.min(safeNumber(limit) || 200, 500);

        const transactions = await FeeTransaction.find(query)
            .sort({ createdAt: -1 })
            .limit(maxLimit)
            .lean();

        return res.json({
            success: true,
            transactions
        });
    } catch (error) {
        console.error('Fee transaction fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching fee transactions'
        });
    }
});

router.get('/expense-heads', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        await ensureDefaultExpenseHeads();

        const heads = await ExpenseHead.find({ isActive: true })
            .sort({ name: 1 })
            .lean();

        return res.json({
            success: true,
            heads
        });
    } catch (error) {
        console.error('Expense heads fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching expense heads'
        });
    }
});

router.get('/payment-accounts', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        await ensureDefaultFeePaymentAccounts();

        const accounts = await FeePaymentAccount.find({ isActive: true })
            .sort({ name: 1 })
            .lean();

        return res.json({
            success: true,
            accounts
        });
    } catch (error) {
        console.error('Fee payment accounts fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching fee payment accounts'
        });
    }
});

router.get('/particulars', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        await ensureDefaultFeeParticulars();

        const [particulars, receiptParticulars] = await Promise.all([
            FeeParticular.find({ isActive: true })
                .sort({ name: 1 })
                .lean(),
            FeeTransaction.distinct('lineItems.particular', activeRecordFilter())
        ]);

        const names = [...new Set([
            ...particulars.map((particular) => particular.name),
            ...receiptParticulars.map((name) => normalizeFeeParticularName(name)).filter(Boolean)
        ])].sort((a, b) => a.localeCompare(b));

        return res.json({
            success: true,
            particulars: names.map((name) => ({ name }))
        });
    } catch (error) {
        console.error('Fee particulars fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching fee particulars'
        });
    }
});

router.post('/particulars', async (req, res) => {
    try {
        if (!requireFinanceMutation(req, res)) return;
        const name = normalizeFeeParticularName(req.body.name);
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Particular name is required'
            });
        }

        await saveFeeParticularNames([name]);
        const particular = await FeeParticular.findOne({
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        }).lean();

        return res.status(201).json({
            success: true,
            message: 'Fee particular saved successfully',
            particular: particular || { name }
        });
    } catch (error) {
        console.error('Fee particular create error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error saving fee particular'
        });
    }
});

router.post('/payment-accounts', async (req, res) => {
    try {
        if (!requireFinanceMutation(req, res)) return;
        const name = String(req.body.name || '').trim();
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Payment account name is required'
            });
        }

        const existingAccount = await FeePaymentAccount.findOne({
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        });

        if (existingAccount) {
            if (!existingAccount.isActive) {
                existingAccount.isActive = true;
                await existingAccount.save();
            }

            return res.json({
                success: true,
                message: 'Payment account already exists',
                account: existingAccount
            });
        }

        const account = await FeePaymentAccount.create({ name });

        return res.status(201).json({
            success: true,
            message: 'Payment account created successfully',
            account
        });
    } catch (error) {
        console.error('Fee payment account create error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating fee payment account'
        });
    }
});

router.post('/expense-heads', async (req, res) => {
    try {
        if (!requireFinanceMutation(req, res)) return;
        const name = String(req.body.name || '').trim();
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Head of account name is required'
            });
        }

        const existingHead = await ExpenseHead.findOne({
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        });

        if (existingHead) {
            if (!existingHead.isActive) {
                existingHead.isActive = true;
                await existingHead.save();
            }

            return res.json({
                success: true,
                message: 'Head of account already exists',
                head: existingHead
            });
        }

        const head = await ExpenseHead.create({ name });

        return res.status(201).json({
            success: true,
            message: 'Head of account created successfully',
            head
        });
    } catch (error) {
        console.error('Expense head create error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating expense head'
        });
    }
});

router.get('/audit-logs', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const {
            entityType,
            action,
            actor,
            voucherNo,
            admissionNo,
            startDate,
            endDate,
            limit
        } = req.query;

        const query = activeRecordFilter();

        if (entityType) {
            query.entityType = entityType;
        }

        if (action) {
            query.action = action;
        }

        if (actor) {
            query['actor.username'] = { $regex: escapeRegex(actor.trim()), $options: 'i' };
        }

        if (voucherNo) {
            query.voucherNo = { $regex: escapeRegex(voucherNo.trim()), $options: 'i' };
        }

        if (admissionNo) {
            query.admissionNo = { $regex: exactCaseInsensitiveRegex(admissionNo), $options: 'i' };
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const maxLimit = Math.min(safeNumber(limit) || 300, 1000);
        const logs = await TransactionAuditLog.find(query)
            .sort({ createdAt: -1 })
            .limit(maxLimit)
            .lean();

        const stats = logs.reduce((summary, log) => {
            summary.totalLogs += 1;
            summary.byEntity[log.entityType] = (summary.byEntity[log.entityType] || 0) + 1;
            summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
            return summary;
        }, {
            totalLogs: 0,
            byEntity: {},
            byAction: {}
        });

        return res.json({
            success: true,
            logs,
            stats
        });
    } catch (error) {
        console.error('Transaction audit fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching transaction audit logs'
        });
    }
});

router.get('/audit-suspicious', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;

        const since = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
        const until = req.query.endDate ? new Date(req.query.endDate) : new Date();

        const logs = await TransactionAuditLog.find({
            createdAt: { $gte: since, $lte: until }
        }).sort({ createdAt: -1 }).lean();

        const groupedByDocument = logs.reduce((map, log) => {
            const key = `${log.entityType}:${log.documentId}`;
            map.set(key, [...(map.get(key) || []), log]);
            return map;
        }, new Map());

        const repeatedEdits = Array.from(groupedByDocument.values())
            .filter((items) => items.length >= 3)
            .map((items) => {
                const latest = items[0];
                return {
                    entityType: latest.entityType,
                    voucherNo: latest.voucherNo,
                    title: latest.title,
                    editCount: items.length,
                    latestAuditDate: latest.createdAt
                };
            });

        const deletedTransactions = logs
            .filter((log) => log.action === 'DELETE')
            .map((log) => ({
                entityType: log.entityType,
                voucherNo: log.voucherNo,
                title: log.title,
                actor: log.actor?.username || 'Unknown',
                reason: log.editReason || '',
                auditDate: log.createdAt
            }));

        const actorCounts = logs.reduce((summary, log) => {
            const username = log.actor?.username || 'Unknown';
            summary[username] = (summary[username] || 0) + 1;
            return summary;
        }, {});

        const heavyEditors = Object.entries(actorCounts)
            .filter(([, count]) => count >= 5)
            .map(([username, count]) => ({ username, count }))
            .sort((a, b) => b.count - a.count);

        return res.json({
            success: true,
            suspicious: {
                repeatedEdits,
                deletedTransactions,
                heavyEditors
            }
        });
    } catch (error) {
        console.error('Suspicious audit fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching suspicious audit activity'
        });
    }
});

router.get('/expenses', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const {
            headOfAccount,
            paidTo,
            paidFor,
            paymentMode,
            startDate,
            endDate,
            limit,
            includeDeleted
        } = req.query;

        const query = includeDeleted === 'true'
            ? includeDeletedFilter()
            : activeRecordFilter();

        if (headOfAccount) {
            query.headOfAccount = headOfAccount;
        }

        if (paidTo) {
            query.paidTo = { $regex: paidTo.trim(), $options: 'i' };
        }

        if (paidFor) {
            query.paidFor = { $regex: paidFor.trim(), $options: 'i' };
        }

        if (paymentMode) {
            if (paymentMode === 'Cash' || paymentMode === 'Online') {
                query.$or = [
                    { paymentMode },
                    { paymentBreakdown: { $elemMatch: { baseMode: paymentMode } } }
                ];
            } else {
                query.paymentMode = paymentMode;
            }
        }

        if (startDate || endDate) {
            query.expenseDate = {};
            if (startDate) {
                query.expenseDate.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.expenseDate.$lte = end;
            }
        }

        const maxLimit = Math.min(safeNumber(limit) || 300, 1000);

        const expenses = await ExpenseTransaction.find(query)
            .sort({ expenseDate: -1, createdAt: -1 })
            .limit(maxLimit)
            .lean();

        const totalAmount = expenses.reduce((sum, expense) => sum + safeNumber(expense.amount), 0);

        return res.json({
            success: true,
            expenses,
            totals: {
                totalAmount,
                transactionCount: expenses.length
            }
        });
    } catch (error) {
        console.error('Expense transactions fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching expense transactions'
        });
    }
});

router.get('/cashbook/opening', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const { beforeDate } = req.query;

        if (!beforeDate) {
            return res.json({
                success: true,
                opening: { cash: 0, online: 0 }
            });
        }

        const end = new Date(beforeDate);
        if (Number.isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Valid beforeDate is required'
            });
        }
        end.setHours(23, 59, 59, 999);

        const [receipts, expenses] = await Promise.all([
            FeeTransaction.find(activeRecordFilter({ receiptDate: { $lte: end } }))
                .select('paidAmount paymentMode paymentBreakdown')
                .lean(),
            ExpenseTransaction.find(activeRecordFilter({ expenseDate: { $lte: end } }))
                .select('amount paymentMode paymentBreakdown paidFor')
                .lean()
        ]);

        const opening = { cash: 0, online: 0 };

        receipts.forEach((receipt) => {
            normalizeReceiptPaymentBreakdown(receipt).forEach((entry) => addCashbookAmount(opening, entry, 1));
        });

        expenses.forEach((expense) => {
            const sign = isDuePaymentExpense(expense) ? 1 : -1;
            normalizeExpensePaymentBreakdown(expense).forEach((entry) => addCashbookAmount(opening, entry, sign));
        });

        return res.json({
            success: true,
            beforeDate,
            opening
        });
    } catch (error) {
        console.error('Cashbook opening balance error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error calculating opening balance'
        });
    }
});

router.get('/expenses/next-voucher', async (req, res) => {
    try {
        if (!requireFinanceMutation(req, res)) return;
        return res.json({
            success: true,
            voucherNo: buildVoucherNo()
        });
    } catch (error) {
        console.error('Expense voucher generate error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error generating expense voucher number'
        });
    }
});

router.get('/expenses/:id', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const expense = await ExpenseTransaction.findById(req.params.id).lean();

        if (!expense || expense.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        const fuelDetails = await FuelLedgerEntry.findOne({
            expenseId: expense._id,
            isDeleted: { $ne: true }
        }).lean();
        const supplierDetails = await SupplierLedgerEntry.findOne({
            expenseId: expense._id,
            isDeleted: { $ne: true }
        }).lean();

        return res.json({
            success: true,
            expense: {
                ...expense,
                fuelDetails: fuelDetails || null,
                supplierDetails: supplierDetails || null
            }
        });
    } catch (error) {
        console.error('Expense fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching expense'
        });
    }
});

router.post('/expenses', async (req, res) => {
    try {
        if (!requireFinanceMutation(req, res)) return;
        const result = await validateAndBuildExpensePayload({
            voucherNo: req.body.voucherNo,
            headOfAccount: req.body.headOfAccount,
            paidTo: req.body.paidTo,
            paidFor: req.body.paidFor,
            amount: req.body.amount,
            paymentMode: req.body.paymentMode,
            paymentBreakdown: req.body.paymentBreakdown,
            salaryDetails: req.body.salaryDetails,
            notes: req.body.notes,
            expenseDate: req.body.expenseDate
        });

        if (result.status) {
            return res.status(result.status).json(result.body);
        }

        const fuelResult = validateAndBuildFuelDetails(req.body.fuelDetails, result.body);
        if (fuelResult.status) {
            return res.status(fuelResult.status).json(fuelResult.body);
        }
        const supplierResult = validateAndBuildSupplierPaymentDetails(req.body.supplierDetails, result.body);
        if (supplierResult.status) {
            return res.status(supplierResult.status).json(supplierResult.body);
        }

        const expense = await ExpenseTransaction.create(result.body);
        const syncedFuel = await syncFuelLedgerForExpense(expense, req.body.fuelDetails || null);
        if (syncedFuel.status) {
            await ExpenseTransaction.findByIdAndDelete(expense._id);
            return res.status(syncedFuel.status).json(syncedFuel.body);
        }
        const syncedSupplier = await syncSupplierLedgerForExpense(expense, req.body.supplierDetails || null);
        if (syncedSupplier.status) {
            await ExpenseTransaction.findByIdAndDelete(expense._id);
            return res.status(syncedSupplier.status).json(syncedSupplier.body);
        }

        await recordTransactionAudit({
            req,
            entityType: 'Expense',
            action: 'CREATE',
            documentId: expense._id,
            title: `${expense.headOfAccount} - ${expense.paidTo}`,
            voucherNo: expense.voucherNo,
            editReason: '',
            before: null,
            after: expense.toObject()
        });

        return res.status(201).json({
            success: true,
            message: 'Expense saved successfully',
            expense: {
                ...expense.toObject(),
                fuelDetails: syncedFuel.body || null,
                supplierDetails: syncedSupplier.body || null
            }
        });
    } catch (error) {
        console.error('Expense save error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error saving expense'
        });
    }
});

router.put('/expenses/:id', async (req, res) => {
    try {
        if (!requireFinanceMutation(req, res)) return;
        const existingExpense = await ExpenseTransaction.findById(req.params.id);
        if (!existingExpense || existingExpense.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        const editReason = getEditReason(req);
        if (!editReason) {
            return res.status(400).json({
                success: false,
                message: 'Edit reason is required for updating an expense'
            });
        }

        const previousExpenseSnapshot = existingExpense.toObject();
        const result = await validateAndBuildExpensePayload({
            voucherNo: req.body.voucherNo,
            headOfAccount: req.body.headOfAccount,
            paidTo: req.body.paidTo,
            paidFor: req.body.paidFor,
            amount: req.body.amount,
            paymentMode: req.body.paymentMode,
            paymentBreakdown: req.body.paymentBreakdown,
            salaryDetails: req.body.salaryDetails,
            notes: req.body.notes,
            expenseDate: req.body.expenseDate,
            excludeExpenseId: existingExpense._id
        });

        if (result.status) {
            return res.status(result.status).json(result.body);
        }

        const fuelResult = validateAndBuildFuelDetails(req.body.fuelDetails, result.body);
        if (fuelResult.status) {
            return res.status(fuelResult.status).json(fuelResult.body);
        }
        const supplierResult = validateAndBuildSupplierPaymentDetails(req.body.supplierDetails, result.body);
        if (supplierResult.status) {
            return res.status(supplierResult.status).json(supplierResult.body);
        }

        Object.assign(existingExpense, result.body);
        await existingExpense.save();
        const syncedFuel = await syncFuelLedgerForExpense(existingExpense, req.body.fuelDetails || null);
        if (syncedFuel.status) {
            return res.status(syncedFuel.status).json(syncedFuel.body);
        }
        const syncedSupplier = await syncSupplierLedgerForExpense(existingExpense, req.body.supplierDetails || null);
        if (syncedSupplier.status) {
            return res.status(syncedSupplier.status).json(syncedSupplier.body);
        }

        await recordTransactionAudit({
            req,
            entityType: 'Expense',
            action: 'UPDATE',
            documentId: existingExpense._id,
            title: `${existingExpense.headOfAccount} - ${existingExpense.paidTo}`,
            voucherNo: existingExpense.voucherNo,
            editReason,
            before: previousExpenseSnapshot,
            after: existingExpense.toObject()
        });

        return res.json({
            success: true,
            message: 'Expense updated successfully',
            expense: {
                ...existingExpense.toObject(),
                fuelDetails: syncedFuel.body || null,
                supplierDetails: syncedSupplier.body || null
            }
        });
    } catch (error) {
        console.error('Expense update error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating expense'
        });
    }
});

async function handleExpenseDelete(req, res) {
    try {
        const actor = requireFinanceDelete(req, res);
        if (!actor) return;
        const deleteReason = getEditReason(req);
        if (!deleteReason) {
            return res.status(400).json({
                success: false,
                message: 'Delete reason is required for deleting an expense'
            });
        }

        const deletedExpense = await ExpenseTransaction.findById(req.params.id);

        if (!deletedExpense || deletedExpense.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        const previousExpenseSnapshot = deletedExpense.toObject();
        deletedExpense.isDeleted = true;
        deletedExpense.deletedAt = new Date();
        deletedExpense.deletedBy = actor;
        deletedExpense.deleteReason = deleteReason;
        await deletedExpense.save();
        await FuelLedgerEntry.updateMany(
            { expenseId: deletedExpense._id },
            { $set: { isDeleted: true } }
        );
        await SupplierLedgerEntry.updateMany(
            { expenseId: deletedExpense._id },
            { $set: { isDeleted: true } }
        );

        await recordTransactionAudit({
            req,
            entityType: 'Expense',
            action: 'DELETE',
            documentId: deletedExpense._id,
            title: `${deletedExpense.headOfAccount} - ${deletedExpense.paidTo}`,
            voucherNo: deletedExpense.voucherNo,
            editReason: deleteReason,
            before: previousExpenseSnapshot,
            after: null
        });

        return res.json({
            success: true,
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        console.error('Expense delete error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting expense'
        });
    }
}

router.delete('/expenses/:id', handleExpenseDelete);
router.post('/expenses/:id/delete', handleExpenseDelete);

router.put('/expenses/:id/recover', async (req, res) => {
    try {
        if (!requireFinanceDelete(req, res)) return;

        const recoverReason = getEditReason(req);
        if (!recoverReason) {
            return res.status(400).json({
                success: false,
                message: 'Recovery reason is required for recovering an expense'
            });
        }

        const expense = await ExpenseTransaction.findById(req.params.id);
        if (!expense || !expense.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Deleted expense not found'
            });
        }

        const beforeRecovery = expense.toObject();
        expense.isDeleted = false;
        expense.deletedAt = null;
        expense.deletedBy = { userId: '', username: '', role: '' };
        expense.deleteReason = '';
        await expense.save();

        await recordTransactionAudit({
            req,
            entityType: 'Expense',
            action: 'RECOVER',
            documentId: expense._id,
            title: `${expense.headOfAccount} - ${expense.paidTo}`,
            voucherNo: expense.voucherNo,
            editReason: recoverReason,
            before: beforeRecovery,
            after: expense.toObject()
        });

        return res.json({
            success: true,
            message: 'Expense recovered successfully',
            expense
        });
    } catch (error) {
        console.error('Expense recover error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error recovering expense'
        });
    }
});

router.post('/receipt', async (req, res) => {
    try {
        if (!requireFinanceMutation(req, res)) return;
        const result = await validateAndBuildReceiptPayload(req.body);
        if (result.status) {
            return res.status(result.status).json(result.body);
        }

        await saveFeeParticularNames((result.payload.lineItems || []).map((item) => item.particular));

        const receipt = await FeeTransaction.create({
            receiptNo: buildReceiptNo(),
            ...result.payload
        });
        await recordTransactionAudit({
            req,
            entityType: 'FeeReceipt',
            action: 'CREATE',
            documentId: receipt._id,
            title: `${receipt.studentName} (${receipt.admissionNo})`,
            voucherNo: receipt.voucherNo,
            referenceNo: receipt.receiptNo,
            admissionNo: receipt.admissionNo,
            before: null,
            after: receipt.toObject()
        });

        return res.status(201).json({
            success: true,
            message: 'Fee receipt saved successfully',
            receipt
        });
    } catch (error) {
        console.error('Fee receipt save error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error saving fee receipt'
        });
    }
});

router.put('/receipt/:id', async (req, res) => {
    try {
        if (!requireFinanceMutation(req, res)) return;
        const existingReceipt = await FeeTransaction.findById(req.params.id).lean();
        if (!existingReceipt || existingReceipt.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Receipt not found'
            });
        }

        const editReason = getEditReason(req);
        if (!editReason) {
            return res.status(400).json({
                success: false,
                message: 'Edit reason is required for updating a fee receipt'
            });
        }

        const result = await validateAndBuildReceiptPayload({
            ...req.body,
            excludeReceiptId: req.params.id
        });

        if (result.status) {
            return res.status(result.status).json(result.body);
        }

        await saveFeeParticularNames((result.payload.lineItems || []).map((item) => item.particular));

        const receipt = await FeeTransaction.findByIdAndUpdate(
            req.params.id,
            result.payload,
            { new: true, runValidators: true }
        ).lean();

        await recordTransactionAudit({
            req,
            entityType: 'FeeReceipt',
            action: 'UPDATE',
            documentId: receipt._id,
            title: `${receipt.studentName} (${receipt.admissionNo})`,
            voucherNo: receipt.voucherNo,
            referenceNo: receipt.receiptNo,
            admissionNo: receipt.admissionNo,
            editReason,
            before: existingReceipt,
            after: receipt
        });

        return res.json({
            success: true,
            message: 'Fee receipt updated successfully',
            receipt
        });
    } catch (error) {
        console.error('Fee receipt update error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating fee receipt'
        });
    }
});

router.delete('/receipt/:id', async (req, res) => {
    try {
        const actor = requireFinanceDelete(req, res);
        if (!actor) return;

        const deleteReason = getEditReason(req);
        if (!deleteReason) {
            return res.status(400).json({
                success: false,
                message: 'Delete reason is required for deleting a fee receipt'
            });
        }

        const receipt = await FeeTransaction.findById(req.params.id);
        if (!receipt || receipt.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Receipt not found'
            });
        }

        const previousReceiptSnapshot = receipt.toObject();
        receipt.isDeleted = true;
        receipt.deletedAt = new Date();
        receipt.deletedBy = actor;
        receipt.deleteReason = deleteReason;
        await receipt.save();

        await recordTransactionAudit({
            req,
            entityType: 'FeeReceipt',
            action: 'DELETE',
            documentId: receipt._id,
            title: `${receipt.studentName} (${receipt.admissionNo})`,
            voucherNo: receipt.voucherNo,
            referenceNo: receipt.receiptNo,
            admissionNo: receipt.admissionNo,
            editReason: deleteReason,
            before: previousReceiptSnapshot,
            after: null
        });

        return res.json({
            success: true,
            message: 'Fee receipt deleted successfully'
        });
    } catch (error) {
        console.error('Fee receipt delete error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting fee receipt'
        });
    }
});

router.put('/receipt/:id/recover', async (req, res) => {
    try {
        if (!requireFinanceDelete(req, res)) return;

        const recoverReason = getEditReason(req);
        if (!recoverReason) {
            return res.status(400).json({
                success: false,
                message: 'Recovery reason is required for recovering a fee receipt'
            });
        }

        const receipt = await FeeTransaction.findById(req.params.id);
        if (!receipt || !receipt.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Deleted receipt not found'
            });
        }

        const beforeRecovery = receipt.toObject();
        receipt.isDeleted = false;
        receipt.deletedAt = null;
        receipt.deletedBy = { userId: '', username: '', role: '' };
        receipt.deleteReason = '';
        await receipt.save();

        await recordTransactionAudit({
            req,
            entityType: 'FeeReceipt',
            action: 'RECOVER',
            documentId: receipt._id,
            title: `${receipt.studentName} (${receipt.admissionNo})`,
            voucherNo: receipt.voucherNo,
            referenceNo: receipt.receiptNo,
            admissionNo: receipt.admissionNo,
            editReason: recoverReason,
            before: beforeRecovery,
            after: receipt.toObject()
        });

        return res.json({
            success: true,
            message: 'Fee receipt recovered successfully',
            receipt
        });
    } catch (error) {
        console.error('Fee receipt recover error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error recovering fee receipt'
        });
    }
});

// Get fee collection data by session
router.get('/collection-by-session', async (req, res) => {
    try {
        if (!requireFinanceView(req, res)) return;
        const { session } = req.query;
        
        if (!session) {
            return res.status(400).json({
                success: false,
                message: 'Session parameter is required'
            });
        }

        const sessionRecord = await AcademicSession.findOne({ name: session }).lean();
        const parsedYears = String(session).match(/(\d{4})\D+(\d{4})/);
        const startDate = sessionRecord?.startDate
            ? new Date(sessionRecord.startDate)
            : parsedYears
                ? new Date(Number(parsedYears[1]), 3, 1)
                : null;
        const endDate = sessionRecord?.endDate
            ? new Date(sessionRecord.endDate)
            : parsedYears
                ? new Date(Number(parsedYears[2]), 2, 31)
                : null;

        if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Selected session does not have a valid date range'
            });
        }

        endDate.setHours(23, 59, 59, 999);

        const transactionQuery = activeRecordFilter({
            receiptDate: { $gte: startDate, $lte: endDate }
        });

        const [transactions, savedParticulars] = await Promise.all([
            FeeTransaction.find(transactionQuery).lean(),
            FeeParticular.find({ isActive: true }).sort({ name: 1 }).lean()
        ]);

        const monthWiseData = {};
        const months = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        const particularNames = new Set(savedParticulars.map((particular) => particular.name).filter(Boolean));

        transactions.forEach((transaction) => {
            (transaction.lineItems || []).forEach((item) => {
                if (item.particular) {
                    particularNames.add(item.particular);
                }
            });
        });

        const particulars = Array.from(particularNames).sort((a, b) => a.localeCompare(b));

        months.forEach(month => {
            monthWiseData[month] = {
                month,
                particulars: particulars.reduce((totals, particular) => {
                    totals[particular] = 0;
                    return totals;
                }, {})
            };
        });

        transactions.forEach(transaction => {
            const month = new Date(transaction.receiptDate || transaction.createdAt).toLocaleString('en-US', { month: 'long' });
            
            if (monthWiseData[month]) {
                (transaction.lineItems || []).forEach(item => {
                    const particular = String(item.particular || '').trim();
                    const amount = safeNumber(item.amount);
                    if (particular) {
                        monthWiseData[month].particulars[particular] = safeNumber(monthWiseData[month].particulars[particular]) + amount;
                    }
                });
            }
        });

        const feeCollectionData = Object.values(monthWiseData);
        const totals = particulars.reduce((summary, particular) => {
            summary[particular] = feeCollectionData.reduce((sum, row) => sum + safeNumber(row.particulars?.[particular]), 0);
            return summary;
        }, {});

        return res.json({
            success: true,
            message: 'Fee collection data retrieved successfully',
            session,
            dateRange: { startDate, endDate },
            particulars,
            totals,
            feeCollectionData
        });

    } catch (error) {
        console.error('Fee collection by session error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving fee collection data'
        });
    }
});

module.exports = router;
