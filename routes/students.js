const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const auth = require('../middleware/auth');

// Get all students
router.get('/', auth, async (req, res) => {
    try {
        const students = await Student.find().sort({ name: 1 });
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get students by class and section (with optional session filter)
router.get('/class/:className/:section', auth, async (req, res) => {
    try {
        const { className, section } = req.params;
        const { session } = req.query;
        
        const query = {
            class: className,
            section: section
        };
        
        // Add session filter if provided
        if (session) {
            query.session = session;
        }
        
        const students = await Student.find(query).sort({ name: 1 });

        console.log(`Fetched ${students.length} students for class ${className} section ${section}${session ? ` session ${session}` : ''}`);
        res.json(students);
    } catch (error) {
        console.error('Error fetching students by class:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get students by academic year (session)
router.get('/session/:academicYear', auth, async (req, res) => {
    try {
        const { academicYear } = req.params;
        const students = await Student.find({
            session: academicYear
        }).sort({ class: 1, section: 1, name: 1 });

        // Group students by class and section
        const groupedStudents = {};
        students.forEach(student => {
            const classKey = `${student.class}-${student.section || 'A'}`;
            if (!groupedStudents[classKey]) {
                groupedStudents[classKey] = {
                    className: student.class,
                    section: student.section || 'A',
                    students: []
                };
            }
            groupedStudents[classKey].students.push(student);
        });

        res.json(groupedStudents);
    } catch (error) {
        console.error('Error fetching students by academic year:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get single student
router.get('/:id', auth, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(student);
    } catch (error) {
        console.error('Error fetching student:', error);
        res.status(500).json({ message: error.message });
    }
});

// Create new student
router.post('/', auth, async (req, res) => {
    try {
        const student = new Student(req.body);
        const savedStudent = await student.save();
        res.status(201).json(savedStudent);
    } catch (error) {
        console.error('Error creating student:', error);
        res.status(400).json({ 
            message: error.message,
            details: error.errors
        });
    }
});

// Update student
router.put('/:id', auth, async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(student);
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(400).json({ 
            message: error.message,
            details: error.errors
        });
    }
});

// Delete student
router.delete('/:id', auth, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        await student.deleteOne();
        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
