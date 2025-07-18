const express = require('express');
const router = express.Router();
const ClassDetails = require('../models/ClassDetails');
const Marks = require('../models/Marks');
const Student = require('../models/Student');
const auth = require('../middleware/auth');

// Save class details
router.post('/class-details', auth, async (req, res) => {
    try {
        const { className, section, academicYear, subjects } = req.body;
        
        // Check if class details already exist
        const existingClass = await ClassDetails.findOne({
            className,
            section,
            academicYear
        });

        if (existingClass) {
            // Update existing class details
            existingClass.subjects = subjects;
            await existingClass.save();
            res.json(existingClass);
        } else {
            // Create new class details
            const classDetails = new ClassDetails({
                className,
                section,
                academicYear,
                subjects
            });
            await classDetails.save();
            res.status(201).json(classDetails);
        }
    } catch (error) {
        console.error('Error saving class details:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get students for a class
router.get('/students', auth, async (req, res) => {
    try {
        const { className, section, academicYear } = req.query;
        const query = {};
        
        if (className) query.class = className;
        if (section) query.section = section;
        
        const students = await Student.find(query)
            .select('studentId name class section admissionDate')
            .sort('name');
        
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: error.message });
    }
});

// Save student marks
router.post('/marks', auth, async (req, res) => {
    try {
        const { studentId, examType, academicYear, subjectMarks } = req.body;

        // Find or create marks document
        let marks = await Marks.findOne({
            studentId,
            examType,
            academicYear
        });

        if (marks) {
            // Update existing marks
            marks.subjectMarks = subjectMarks;
            await marks.save();
        } else {
            // Create new marks entry
            marks = new Marks({
                studentId,
                examType,
                academicYear,
                subjectMarks
            });
            await marks.save();
        }

        res.json(marks);
    } catch (error) {
        console.error('Error saving marks:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get student marks for marksheet
router.get('/student-marks/:studentId', auth, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { academicYear } = req.query;

        // Get student details
        const student = await Student.findById(studentId)
            .select('studentId name class section dob admissionDate');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get all marks for the student
        const marks = await Marks.find({
            studentId,
            academicYear
        }).sort('examType');

        // Get class details
        const classDetails = await ClassDetails.findOne({
            className: student.class,
            section: student.section,
            academicYear
        });

        res.json({
            student,
            classDetails,
            marks
        });
    } catch (error) {
        console.error('Error fetching student marks:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get class statistics
router.get('/class-statistics', auth, async (req, res) => {
    try {
        const { className, section, academicYear, examType } = req.query;

        const marks = await Marks.find({
            academicYear,
            examType
        }).populate('studentId', 'name class section');

        // Filter marks for the specific class and section
        const classMarks = marks.filter(mark => 
            mark.studentId.class === className && 
            mark.studentId.section === section
        );

        // Calculate statistics
        const statistics = {
            totalStudents: classMarks.length,
            averagePercentage: 0,
            highestPercentage: 0,
            lowestPercentage: 100,
            gradeDistribution: {
                A1: 0, A2: 0, B1: 0, B2: 0,
                C1: 0, C2: 0, D: 0, E: 0
            }
        };

        classMarks.forEach(mark => {
            statistics.averagePercentage += mark.percentage;
            statistics.highestPercentage = Math.max(statistics.highestPercentage, mark.percentage);
            statistics.lowestPercentage = Math.min(statistics.lowestPercentage, mark.percentage);
            statistics.gradeDistribution[mark.grade]++;
        });

        if (classMarks.length > 0) {
            statistics.averagePercentage /= classMarks.length;
        }

        res.json(statistics);
    } catch (error) {
        console.error('Error fetching class statistics:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
