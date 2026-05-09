const mongoose = require('mongoose');

const auditFieldChangeSchema = new mongoose.Schema({
    field: {
        type: String,
        required: true,
        trim: true
    },
    previousValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    updatedValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, { _id: false });

const transactionAuditLogSchema = new mongoose.Schema({
    entityType: {
        type: String,
        enum: ['FeeReceipt', 'Expense'],
        required: true,
        index: true
    },
    action: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE', 'RECOVER'],
        required: true,
        index: true
    },
    documentId: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        trim: true,
        default: ''
    },
    voucherNo: {
        type: String,
        trim: true,
        default: '',
        index: true
    },
    referenceNo: {
        type: String,
        trim: true,
        default: ''
    },
    admissionNo: {
        type: String,
        trim: true,
        default: ''
    },
    actor: {
        userId: {
            type: String,
            trim: true,
            default: ''
        },
        username: {
            type: String,
            trim: true,
            default: 'Unknown'
        },
        role: {
            type: String,
            trim: true,
            default: ''
        }
    },
    summary: {
        type: String,
        trim: true,
        default: ''
    },
    editReason: {
        type: String,
        trim: true,
        default: ''
    },
    changedFields: {
        type: [auditFieldChangeSchema],
        default: []
    },
    snapshotBefore: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    snapshotAfter: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true
});

transactionAuditLogSchema.index({ createdAt: -1, entityType: 1, action: 1 });
transactionAuditLogSchema.index({ voucherNo: 1, createdAt: -1 });

module.exports = mongoose.model('TransactionAuditLog', transactionAuditLogSchema);
