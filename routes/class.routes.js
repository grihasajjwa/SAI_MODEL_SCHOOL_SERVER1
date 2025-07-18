const express = require('express');
const router = express.Router();
const ClassDetails = require('../models/ClassDetails');
const auth = require('../middleware/auth');

// Get all classes
router.get('/', auth, async (req, res) => {
    try {
        const classes = await ClassDetails.find().sort({ createdAt: -1 });
        res.json(classes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single class
router.get('/:id', auth, async (req, res) => {
    try {
        const classData = await ClassDetails.findById(req.params.id);
        if (!classData) {
            return res.status(404).json({ message: 'Class not found' });
        }
        res.json(classData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new class
router.post('/', auth, async (req, res) => {
    const classData = new ClassDetails({
        academicYear: req.body.academicYear,
        className: req.body.className,
        section: req.body.section || 'A',
        classTeacher: req.body.classTeacher,
        subjects: [] // Initialize with empty subjects array
    });

    try {
        const newClass = await classData.save();
        res.status(201).json(newClass);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update class
router.put('/:id', auth, async (req, res) => {
    try {
        const updates = {
            academicYear: req.body.academicYear,
            className: req.body.className,
            section: req.body.section,
            classTeacher: req.body.classTeacher
        };

        const classData = await ClassDetails.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!classData) {
            return res.status(404).json({ message: 'Class not found' });
        }

        res.json(classData);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete class
router.delete('/:id', auth, async (req, res) => {
    try {
        const classData = await ClassDetails.findById(req.params.id);
        if (!classData) {
            return res.status(404).json({ message: 'Class not found' });
        }

        await classData.deleteOne();
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;