const mongoose = require('mongoose');

// Define class details schema
const ClassDetailsSchema = new mongoose.Schema({
    className: {
        type: String,
        required: true,
        trim: true
    },
    section: {
        type: String,
        required: true,
        trim: true
    },
    academicYear: {
        type: String,
        required: true,
        trim: true
    },
    classTeacher: {
        type: String,
        required: true,
        default: 'Not Assigned',
        trim: true
    },
    subjects: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        teacher: {
            type: String,
            required: true,
            trim: true
        }
    }]
}, {
    timestamps: true,
    strict: true,
    minimize: false // Prevent empty objects from being removed
});

// Compound index for unique class-section-year combination
ClassDetailsSchema.index({ className: 1, section: 1, academicYear: 1 }, { unique: true });

// Pre-save middleware to ensure classTeacher exists and validate subjects
ClassDetailsSchema.pre('save', async function(next) {
    try {
        console.log('\n=== Pre-save middleware running ===');
        console.log('Document before validation:', JSON.stringify(this.toObject(), null, 2));
        
        // Set default classTeacher if not provided
        if (!this.classTeacher) {
            this.classTeacher = 'Not Assigned';
        }

        // Initialize subjects array if it doesn't exist
        if (!this.subjects) {
            console.log('Initializing empty subjects array');
            this.subjects = [];
        }

        // Ensure subjects is an array
        if (!Array.isArray(this.subjects)) {
            console.log('Converting subjects to array');
            this.subjects = Array.isArray(this.subjects) ? this.subjects : [];
        }

        // Validate each subject
        for (const subject of this.subjects) {
            if (!subject.name || !subject.teacher) {
                console.log('Invalid subject found:', subject);
                throw new Error('Each subject must have a name and teacher');
            }
            // Trim subject fields
            subject.name = subject.name.trim();
            subject.teacher = subject.teacher.trim();
        }

        console.log('Document after validation:', JSON.stringify(this.toObject(), null, 2));
        console.log('=== Pre-save middleware complete ===\n');
        next();
    } catch (error) {
        console.error('Error in pre-save middleware:', error);
        next(error);
    }
});

// Add logging middleware
ClassDetailsSchema.pre('save', function(next) {
    console.log('\n=== ClassDetails pre-save middleware ===');
    console.log('Saving class:', this._id);
    console.log('Class data:', JSON.stringify(this.toObject(), null, 2));
    next();
});

ClassDetailsSchema.post('save', function(doc) {
    console.log('\n=== ClassDetails post-save middleware ===');
    console.log('Saved class:', doc._id);
    console.log('Saved data:', JSON.stringify(doc.toObject(), null, 2));
});

// Create model
const ClassDetails = mongoose.model('ClassDetails', ClassDetailsSchema);

// Function to update existing documents
async function updateExistingDocuments() {
    try {
        console.log('\n=== Running update for existing documents ===');
        const result = await ClassDetails.updateMany(
            { 
                $or: [
                    { classTeacher: { $exists: false } },
                    { subjects: { $exists: false } }
                ]
            },
            { 
                $set: { 
                    classTeacher: 'Not Assigned',
                    subjects: []
                } 
            }
        );
        console.log('Update result:', result);
        console.log('=== Update complete ===\n');
    } catch (error) {
        console.error('Error updating existing documents:', error);
    }
}

// Call update function
updateExistingDocuments();

module.exports = ClassDetails;
