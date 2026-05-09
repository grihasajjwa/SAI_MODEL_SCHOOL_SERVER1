const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    fatherName: {
        type: String,
        required: true
    },
    motherName: {
        type: String,
        default: ''
    },
    dob: {
        type: Date,
        required: true
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true
    },
    admissionDate: {
        type: Date,
        required: true
    },
    class: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
     rollNo: {
        type: String,
        required: false
    },
    address: String,
    contactNo: String,
    tuitionFee: {
        type: Number,
        default: 0,
        min: 0
    },
    transport: {
        required: {
            type: Boolean,
            default: false
        },
        fees: {
            type: Number,
            required: function() {
                return this.transport.required;
            }
        },
        startDate: {
            type: Date,
            required: function() {
                return this.transport.required;
            }
        },
        pickupPoint: {
            type: String,
            required: function() {
                return this.transport.required;
            }
        },
        route: {
            type: String,
            required: function() {
                return this.transport.required;
            }
        },
        busNumber: {
            type: String,
            required: function() {
                return this.transport.required;
            }
        },
        pickupOrder: {
            type: Number,
            default: null,
            min: 1
        }
    },
    session: {
        type: String,
        required: true
    },
    rank: {
        type: Number,
        default: null
    },
    photo: {
        type: String,
        default: ''
    },
    exams: {
        pt1: {
            percentage: {
                type: Number,
                default: null
            },
            subjects: [{
                name: String,
                marks: Number,
                maxMarks: Number
            }]
        },
        halfYearly: {
            percentage: {
                type: Number,
                default: null
            },
            subjects: [{
                name: String,
                marks: Number,
                maxMarks: Number
            }]
        },
        pt2: {
            percentage: {
                type: Number,
                default: null
            },
            subjects: [{
                name: String,
                marks: Number,
                maxMarks: Number
            }]
        },
        final: {
            percentage: {
                type: Number,
                default: null
            },
            subjects: [{
                name: String,
                marks: Number,
                maxMarks: Number
            }]
        }
    }
}, {
    timestamps: true
});

// Same admission number can exist across sessions; keep each session unique.
studentSchema.index({ studentId: 1, session: 1 }, { unique: true });
studentSchema.index({ studentId: 1 });
studentSchema.index({ class: 1, section: 1 });

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
