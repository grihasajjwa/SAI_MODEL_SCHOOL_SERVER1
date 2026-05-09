const express = require('express');
const router = express.Router();
const Marks = require('../models/Marks');
const Student = require('../models/Student');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');


// Get all students
router.get('/', async (req, res) => {
    try {
        const studentsMarks = await Marks.find();
        res.json({ success: true, studentsMarks });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ success: false, message: 'Error fetching students' });
    }
});

// Get marks by student ID
router.get('/:studentId', auth, async (req, res) => {
    try {
        let studentId = req.params.studentId;
        const academicYear = req.query.academicYear;
        
        // Check if studentId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(404).json({ message: 'Invalid student ID format' });
        }

        const query = { studentId: studentId };
        if (academicYear) {
            query.academicYear = academicYear;
        }

        let marks = await Marks.findOne(query).sort({ createdAt: -1 });

        // Legacy fallback:
        // some older data was saved under the wrong academicYear, but still linked
        // to the correct student record. If there is exactly one marks document for
        // this student, return it instead of a 404 so old data remains accessible.
        if (!marks && academicYear) {
            const fallbackMarks = await Marks.find({ studentId: studentId }).sort({ createdAt: -1 });
            if (fallbackMarks.length === 1) {
                marks = fallbackMarks[0];
            }
        }

        if (!marks) {
            return res.status(404).json({ message: 'Marks not found' });
        }
        res.json(marks);
    } catch (error) {
        console.error('Error fetching marks:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get marks by class and section
router.get('/class/:className/:section', auth, async (req, res) => {
    try {
        const query = {
            className: req.params.className,
            section: req.params.section
        };
        if (req.query.academicYear) {
            query.academicYear = req.query.academicYear;
        }

        let marks = await Marks.find(query).populate({
            path: 'studentId',
            model: 'Student',
            select: 'name studentId fatherName'
        });

        // Legacy fallback for class/session views:
        // if no marks exist for the requested academicYear, try returning marks linked
        // to the students currently in that class/section/session even if those marks
        // were saved under the wrong academicYear.
        if ((!marks || marks.length === 0) && req.query.academicYear) {
            const sessionStudents = await Student.find({
                class: req.params.className,
                section: req.params.section,
                session: req.query.academicYear
            }).select('_id');

            const studentIds = sessionStudents.map((student) => student._id);
            if (studentIds.length > 0) {
                marks = await Marks.find({
                    studentId: { $in: studentIds }
                }).populate({
                    path: 'studentId',
                    model: 'Student',
                    select: 'name studentId fatherName'
                });
            }
        }
        
        //console.log(`Found ${marks.length} marks records for Class ${req.params.className} Section ${req.params.section}`);
        res.json(marks);
    } catch (error) {
        console.error('Error fetching marks:', error);
        res.status(500).json({ message: error.message });
    }
});

// Create new marks
router.post('/', auth, async (req, res) => {
    try {
        const { studentId, className, section, academicYear, marks, studentName, admissionNo, fatherName, rollNo,  coScholastic, attendance, teacherRemarks  } = req.body;

        const existing = await Marks.findOne({ studentId, academicYear });
        if (existing) {
            return res.status(409).json({ message: 'Marks already exist for this student in this academic year' });
        }
        
        // Create new marks document
        const marksDoc = new Marks({
            studentId,
            className,
            section,
            academicYear,
            marks,
            studentName,
            admissionNo,
            fatherName,
            rollNo,
            coScholastic,
            attendance,
            teacherRemarks
        });

        const savedMarks = await marksDoc.save();
       // console.log('Created new marks:', savedMarks);
        res.status(201).json(savedMarks);
    } catch (error) {
        console.error('Error creating marks:', error);
        res.status(400).json({ message: error.message });
    }
});

// Update marks by student ID
router.put('/:studentId', auth, async (req, res) => {
    try {
        let studentId = req.params.studentId;
        
        // Check if studentId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(404).json({ message: 'Invalid student ID format' });
        }

        const { marks, rank, className, section, academicYear, studentName, admissionNo, fatherName, rollNo, coScholastic, attendance, teacherRemarks } = req.body;
        
        // Create a new marks document to validate the data
        const marksDoc = new Marks({
            studentId,
            className,
            section,
            academicYear,
            marks,
            studentName,
            admissionNo,
            fatherName,
            rollNo,
            coScholastic,
            attendance,
            teacherRemarks,
            rank
        });

        // Validate the document
        await marksDoc.validate();
        
        // If validation passes, update the marks
        const updatedMarks = await Marks.findOneAndUpdate(
            { studentId: studentId, academicYear },
            { 
                $set: { 
                    marks,
                    rank,
                    className,
                    section,
                    academicYear,
                    studentName,
                    admissionNo,
                    fatherName,
                    rollNo,
                    coScholastic,
                    attendance,
                    teacherRemarks
                } 
            },
            { 
                new: true,
                runValidators: true
            }
        );

        if (!updatedMarks) {
            return res.status(404).json({ message: 'Marks not found' });
        }

        res.json(updatedMarks);
    } catch (error) {
        console.error('Error updating marks:', error);
        res.status(400).json({ message: error.message });
    }
});

// Update rank for a student
router.put('/rank/:studentId', auth, async (req, res) => {
    try {
        let studentId = req.params.studentId;
        
        // Check if studentId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(404).json({ message: 'Invalid student ID format' });
        }

        const { rank } = req.body;
        
        // Find and update marks using MongoDB _id
        const updatedMarks = await Marks.findByIdAndUpdate(
            studentId,
            { $set: { rank } },
            { new: true }
        );

        if (!updatedMarks) {
            return res.status(404).json({ message: 'Marks not found' });
        }

        //console.log('Updated ranks for student:', updatedMarks.studentName);
        res.json(updatedMarks);
    } catch (error) {
        console.error('Error updating marks:', error);
        res.status(400).json({ message: error.message });
    }
});

// Update rank for a student
router.patch('/:id/rank',  async (req, res) => {
    try {
        let id = req.params.id;
        
        // Check if id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ message: 'Invalid ID format' });
        }

        const { rank } = req.body;
        
        // Find and update only the rank field
        const updatedMarks = await Marks.findByIdAndUpdate(
            id,
            { $set: { rank } },
            { new: true }
        );

        if (!updatedMarks) {
            return res.status(404).json({ message: 'Marks not found' });
        }

       // console.log('Updated rank for student:', updatedMarks.studentName, 'New rank:', rank);
        res.json(updatedMarks);
    } catch (error) {
        console.error('Error updating rank:', error);
        res.status(400).json({ message: error.message });
    }
});

// Delete marks by ID
router.delete('/:id', auth, async (req, res) => {
    try {
        let id = req.params.id;
        
        // Check if id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ message: 'Invalid ID format' });
        }

        const result = await Marks.findByIdAndDelete(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Marks not found' });
        }

        res.json({ success: true, message: 'Marks deleted successfully' });
    } catch (error) {
        console.error('Error deleting marks:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
