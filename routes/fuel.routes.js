const express = require('express');
const jwt = require('jsonwebtoken');
const FuelCentre = require('../models/FuelCentre');
const BusVehicle = require('../models/BusVehicle');
const FuelLedgerEntry = require('../models/FuelLedgerEntry');

const router = express.Router();
const FINANCE_MUTATION_ROLES = new Set(['admin', 'accountant']);
const FINANCE_VIEW_ROLES = new Set(['admin', 'accountant', 'staff']);
const DEFAULT_FUEL_CENTRES = ['Tufanganj Fuel Centre Kalibri', 'Others'];

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

function requireFuelView(req, res) {
    const user = getRequestUser(req);
    if (!FINANCE_VIEW_ROLES.has(user.role) && !FINANCE_MUTATION_ROLES.has(user.role)) {
        res.status(403).json({ success: false, message: 'You do not have permission to view fuel records' });
        return null;
    }
    return user;
}

function requireFuelMutation(req, res) {
    const user = getRequestUser(req);
    if (!FINANCE_MUTATION_ROLES.has(user.role)) {
        res.status(403).json({ success: false, message: 'Only admin or accountant can change fuel records' });
        return null;
    }
    return user;
}

async function ensureDefaultFuelCentres() {
    const existing = await FuelCentre.find({
        name: { $in: DEFAULT_FUEL_CENTRES }
    }).select('name').lean();
    const existingNames = new Set(existing.map((centre) => centre.name));
    const missing = DEFAULT_FUEL_CENTRES
        .filter((name) => !existingNames.has(name))
        .map((name) => ({ name }));

    if (missing.length) {
        await FuelCentre.insertMany(missing, { ordered: false });
    }
}

async function ensureFuelCentre(name) {
    const normalized = String(name || '').trim();
    if (!normalized) return;

    const centre = await FuelCentre.findOne({
        name: { $regex: `^${escapeRegex(normalized)}$`, $options: 'i' }
    });

    if (!centre) {
        await FuelCentre.create({ name: normalized });
    } else if (!centre.isActive) {
        centre.isActive = true;
        await centre.save();
    }
}

async function ensureBusVehicle(vehicleNumber) {
    const normalized = String(vehicleNumber || '').trim().toUpperCase();
    if (!normalized) return;

    const vehicle = await BusVehicle.findOne({
        vehicleNumber: { $regex: `^${escapeRegex(normalized)}$`, $options: 'i' }
    });

    if (!vehicle) {
        await BusVehicle.create({ vehicleNumber: normalized });
    } else if (!vehicle.isActive) {
        vehicle.isActive = true;
        await vehicle.save();
    }
}

function buildFuelPayload(body = {}) {
    const fuelDate = body.fuelDate || body.date ? new Date(body.fuelDate || body.date) : new Date();
    const fuelCentreName = String(body.fuelCentreName || '').trim();
    const receiptNo = String(body.receiptNo || '').trim();
    const vehicleNumber = String(body.vehicleNumber || '').trim().toUpperCase();
    const volumeLtr = safeNumber(body.volumeLtr);
    const amount = safeNumber(body.amount);
    const recordedKmMeter = safeNumber(body.recordedKmMeter);
    const notes = String(body.notes || '').trim();

    if (Number.isNaN(fuelDate.getTime())) {
        return { status: 400, body: { success: false, message: 'Invalid fuel date' } };
    }

    if (!fuelCentreName || !receiptNo || !vehicleNumber) {
        return { status: 400, body: { success: false, message: 'Fuel centre, receipt no. and vehicle number are required' } };
    }

    if (volumeLtr <= 0 || amount <= 0) {
        return { status: 400, body: { success: false, message: 'Fuel volume and amount must be greater than zero' } };
    }

    return {
        status: null,
        body: {
            fuelDate,
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

router.get('/options', async (req, res) => {
    try {
        if (!requireFuelView(req, res)) return;
        await ensureDefaultFuelCentres();

        const [centres, vehicles] = await Promise.all([
            FuelCentre.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean(),
            BusVehicle.find({ isActive: { $ne: false } }).sort({ vehicleNumber: 1 }).lean()
        ]);

        return res.json({ success: true, centres, vehicles });
    } catch (error) {
        console.error('Fuel options fetch error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching fuel options' });
    }
});

router.post('/centres', async (req, res) => {
    try {
        if (!requireFuelMutation(req, res)) return;
        const name = String(req.body?.name || '').trim();
        if (!name) return res.status(400).json({ success: false, message: 'Fuel centre name is required' });

        await ensureFuelCentre(name);
        const centre = await FuelCentre.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } }).lean();
        return res.status(201).json({ success: true, centre });
    } catch (error) {
        console.error('Fuel centre save error:', error);
        return res.status(500).json({ success: false, message: 'Error saving fuel centre' });
    }
});

router.post('/vehicles', async (req, res) => {
    try {
        if (!requireFuelMutation(req, res)) return;
        const vehicleNumber = String(req.body?.vehicleNumber || '').trim().toUpperCase();
        if (!vehicleNumber) return res.status(400).json({ success: false, message: 'Vehicle number is required' });

        await ensureBusVehicle(vehicleNumber);
        const vehicle = await BusVehicle.findOne({ vehicleNumber: { $regex: `^${escapeRegex(vehicleNumber)}$`, $options: 'i' } }).lean();
        return res.status(201).json({ success: true, vehicle });
    } catch (error) {
        console.error('Bus vehicle save error:', error);
        return res.status(500).json({ success: false, message: 'Error saving vehicle number' });
    }
});

router.get('/entries', async (req, res) => {
    try {
        if (!requireFuelView(req, res)) return;
        const { startDate, endDate, vehicleNumber, fuelCentreName } = req.query;
        const filter = { isDeleted: { $ne: true } };

        if (startDate || endDate) {
            filter.fuelDate = {};
            if (startDate) filter.fuelDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.fuelDate.$lte = end;
            }
        }
        if (vehicleNumber) filter.vehicleNumber = vehicleNumber;
        if (fuelCentreName) filter.fuelCentreName = fuelCentreName;

        const entries = await FuelLedgerEntry.find(filter).sort({ fuelDate: -1, createdAt: -1 }).limit(500).lean();
        const summary = entries.reduce((totals, entry) => {
            totals.totalAmount += safeNumber(entry.amount);
            totals.totalVolume += safeNumber(entry.volumeLtr);
            totals.entryCount += 1;
            return totals;
        }, { totalAmount: 0, totalVolume: 0, entryCount: 0 });

        return res.json({ success: true, entries, summary });
    } catch (error) {
        console.error('Fuel ledger fetch error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching fuel ledger' });
    }
});

router.post('/entries', async (req, res) => {
    try {
        if (!requireFuelMutation(req, res)) return;
        const result = buildFuelPayload(req.body);
        if (result.status) return res.status(result.status).json(result.body);

        await Promise.all([
            ensureFuelCentre(result.body.fuelCentreName),
            ensureBusVehicle(result.body.vehicleNumber)
        ]);

        const entry = await FuelLedgerEntry.create(result.body);
        return res.status(201).json({ success: true, message: 'Fuel bill saved successfully', entry });
    } catch (error) {
        console.error('Fuel ledger save error:', error);
        return res.status(500).json({ success: false, message: 'Error saving fuel bill' });
    }
});

router.put('/entries/:id', async (req, res) => {
    try {
        if (!requireFuelMutation(req, res)) return;
        const entry = await FuelLedgerEntry.findById(req.params.id);

        if (!entry || entry.isDeleted) {
            return res.status(404).json({ success: false, message: 'Fuel bill not found' });
        }

        if (entry.expenseId) {
            return res.status(400).json({ success: false, message: 'Expense-linked fuel payments must be edited from Expense Receipt' });
        }

        const result = buildFuelPayload(req.body);
        if (result.status) return res.status(result.status).json(result.body);

        await Promise.all([
            ensureFuelCentre(result.body.fuelCentreName),
            ensureBusVehicle(result.body.vehicleNumber)
        ]);

        Object.assign(entry, result.body);
        await entry.save();

        return res.json({ success: true, message: 'Fuel bill updated successfully', entry });
    } catch (error) {
        console.error('Fuel ledger update error:', error);
        return res.status(500).json({ success: false, message: 'Error updating fuel bill' });
    }
});

router.delete('/entries/:id', async (req, res) => {
    try {
        if (!requireFuelMutation(req, res)) return;
        const entry = await FuelLedgerEntry.findById(req.params.id);

        if (!entry || entry.isDeleted) {
            return res.status(404).json({ success: false, message: 'Fuel bill not found' });
        }

        if (entry.expenseId) {
            return res.status(400).json({ success: false, message: 'Expense-linked fuel payments must be deleted from Expense Receipt' });
        }

        entry.isDeleted = true;
        await entry.save();

        return res.json({ success: true, message: 'Fuel bill deleted successfully' });
    } catch (error) {
        console.error('Fuel ledger delete error:', error);
        return res.status(500).json({ success: false, message: 'Error deleting fuel bill' });
    }
});

module.exports = router;
