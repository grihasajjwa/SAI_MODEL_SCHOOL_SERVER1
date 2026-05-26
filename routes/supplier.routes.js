const express = require('express');
const jwt = require('jsonwebtoken');
const Supplier = require('../models/Supplier');
const SupplierLedgerEntry = require('../models/SupplierLedgerEntry');

const router = express.Router();
const FINANCE_MUTATION_ROLES = new Set(['admin', 'accountant']);
const FINANCE_VIEW_ROLES = new Set(['admin', 'accountant', 'staff']);

function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRequestUser(req) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return { role: '' };
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return { role: '' };
    }
}

function requireSupplierView(req, res) {
    const user = getRequestUser(req);
    if (!FINANCE_VIEW_ROLES.has(user.role) && !FINANCE_MUTATION_ROLES.has(user.role)) {
        res.status(403).json({ success: false, message: 'You do not have permission to view supplier records' });
        return null;
    }
    return user;
}

function requireSupplierMutation(req, res) {
    const user = getRequestUser(req);
    if (!FINANCE_MUTATION_ROLES.has(user.role)) {
        res.status(403).json({ success: false, message: 'Only admin or accountant can change supplier records' });
        return null;
    }
    return user;
}

async function ensureSupplier(name, extra = {}) {
    const normalized = String(name || '').trim();
    if (!normalized) return null;
    const supplier = await Supplier.findOne({ name: { $regex: `^${escapeRegex(normalized)}$`, $options: 'i' } });
    if (!supplier) {
        return Supplier.create({ name: normalized, ...extra });
    }
    let changed = false;
    if (!supplier.isActive) {
        supplier.isActive = true;
        changed = true;
    }
    ['phone', 'address'].forEach((field) => {
        if (extra[field] && !supplier[field]) {
            supplier[field] = extra[field];
            changed = true;
        }
    });
    return changed ? supplier.save() : supplier;
}

function buildPurchasePayload(body = {}) {
    const entryDate = body.entryDate || body.purchaseDate || body.date ? new Date(body.entryDate || body.purchaseDate || body.date) : new Date();
    const supplierName = String(body.supplierName || '').trim();
    const itemName = String(body.itemName || '').trim();
    const billNo = String(body.billNo || '').trim();
    const quantity = safeNumber(body.quantity);
    const rate = safeNumber(body.rate);
    const amount = safeNumber(body.amount || (quantity * rate));
    const notes = String(body.notes || '').trim();

    if (Number.isNaN(entryDate.getTime())) {
        return { status: 400, body: { success: false, message: 'Invalid purchase date' } };
    }
    if (!supplierName || !itemName || !billNo) {
        return { status: 400, body: { success: false, message: 'Supplier, item name and bill no. are required' } };
    }
    if (amount <= 0) {
        return { status: 400, body: { success: false, message: 'Purchase amount must be greater than zero' } };
    }

    return {
        status: null,
        body: {
            entryDate,
            supplierName,
            itemName,
            billNo,
            quantity,
            rate,
            amount,
            notes,
            entryType: 'PURCHASE'
        }
    };
}

router.get('/options', async (req, res) => {
    try {
        if (!requireSupplierView(req, res)) return;
        const suppliers = await Supplier.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean();
        return res.json({ success: true, suppliers });
    } catch (error) {
        console.error('Supplier options fetch error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching suppliers' });
    }
});

router.post('/suppliers', async (req, res) => {
    try {
        if (!requireSupplierMutation(req, res)) return;
        const name = String(req.body?.name || '').trim();
        if (!name) return res.status(400).json({ success: false, message: 'Supplier name is required' });
        const supplier = await ensureSupplier(name, {
            phone: String(req.body?.phone || '').trim(),
            address: String(req.body?.address || '').trim()
        });
        return res.status(201).json({ success: true, supplier });
    } catch (error) {
        console.error('Supplier save error:', error);
        return res.status(500).json({ success: false, message: 'Error saving supplier' });
    }
});

router.get('/entries', async (req, res) => {
    try {
        if (!requireSupplierView(req, res)) return;
        const { startDate, endDate, supplierName } = req.query;
        const filter = { isDeleted: { $ne: true } };
        if (supplierName) filter.supplierName = supplierName;
        if (startDate || endDate) {
            filter.entryDate = {};
            if (startDate) filter.entryDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.entryDate.$lte = end;
            }
        }

        const entries = await SupplierLedgerEntry.find(filter).sort({ supplierName: 1, entryDate: 1, createdAt: 1 }).limit(1000).lean();
        const summary = entries.reduce((totals, entry) => {
            if (entry.entryType === 'PAYMENT') totals.totalPayment += safeNumber(entry.amount);
            else totals.totalPurchase += safeNumber(entry.amount);
            totals.entryCount += 1;
            return totals;
        }, { totalPurchase: 0, totalPayment: 0, entryCount: 0 });
        summary.balance = summary.totalPurchase - summary.totalPayment;
        return res.json({ success: true, entries, summary });
    } catch (error) {
        console.error('Supplier ledger fetch error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching supplier ledger' });
    }
});

router.post('/entries', async (req, res) => {
    try {
        if (!requireSupplierMutation(req, res)) return;
        const result = buildPurchasePayload(req.body);
        if (result.status) return res.status(result.status).json(result.body);
        await ensureSupplier(result.body.supplierName);
        const entry = await SupplierLedgerEntry.create(result.body);
        return res.status(201).json({ success: true, message: 'Purchase saved successfully', entry });
    } catch (error) {
        console.error('Supplier purchase save error:', error);
        return res.status(500).json({ success: false, message: 'Error saving purchase' });
    }
});

router.put('/entries/:id', async (req, res) => {
    try {
        if (!requireSupplierMutation(req, res)) return;
        const entry = await SupplierLedgerEntry.findById(req.params.id);
        if (!entry || entry.isDeleted) return res.status(404).json({ success: false, message: 'Purchase not found' });
        if (entry.expenseId) return res.status(400).json({ success: false, message: 'Payment entries must be edited from Expense Receipt' });
        const result = buildPurchasePayload(req.body);
        if (result.status) return res.status(result.status).json(result.body);
        await ensureSupplier(result.body.supplierName);
        Object.assign(entry, result.body);
        await entry.save();
        return res.json({ success: true, message: 'Purchase updated successfully', entry });
    } catch (error) {
        console.error('Supplier purchase update error:', error);
        return res.status(500).json({ success: false, message: 'Error updating purchase' });
    }
});

router.delete('/entries/:id', async (req, res) => {
    try {
        if (!requireSupplierMutation(req, res)) return;
        const entry = await SupplierLedgerEntry.findById(req.params.id);
        if (!entry || entry.isDeleted) return res.status(404).json({ success: false, message: 'Purchase not found' });
        if (entry.expenseId) return res.status(400).json({ success: false, message: 'Payment entries must be deleted from Expense Receipt' });
        entry.isDeleted = true;
        await entry.save();
        return res.json({ success: true, message: 'Purchase deleted successfully' });
    } catch (error) {
        console.error('Supplier purchase delete error:', error);
        return res.status(500).json({ success: false, message: 'Error deleting purchase' });
    }
});

module.exports = router;
