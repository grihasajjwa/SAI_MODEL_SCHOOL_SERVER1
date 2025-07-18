const express = require('express');
const router = express.Router();
const ExamConfig = require('../models/ExamConfig');
const auth = require('../middleware/auth');

// Get exam configuration for a class
router.get('/config/:class/:section/:academicYear', auth, async (req, res) => {
    try {
        const config = await ExamConfig.findOne({
            class: req.params.class,
            section: req.params.section,
            academicYear: req.params.academicYear
        });

        if (!config) {
            // Return default configuration if none exists
            const defaultConfig = {
                examConfigs: [
                    { examType: 'pt1', maxMarksWritten: 80, maxMarksOral: 20 },
                    { examType: 'hy', maxMarksWritten: 80, maxMarksOral: 20 },
                    { examType: 'pt2', maxMarksWritten: 80, maxMarksOral: 20 },
                    { examType: 'final', maxMarksWritten: 80, maxMarksOral: 20 }
                ]
            };
            return res.json(defaultConfig);
        }

        res.json(config);
    } catch (error) {
        console.error('Error fetching exam config:', error);
        res.status(500).json({ message: error.message });
    }
});

// Create or update exam configuration
router.post('/config', auth, async (req, res) => {
    try {
        const { class: className, section, academicYear, config } = req.body;

        // Convert config object to array format
        const examConfigs = Object.entries(config).map(([examType, marks]) => ({
            examType,
            maxMarksWritten: marks.maxMarksWritten || 80,
            maxMarksOral: marks.maxMarksOral || 20
        }));

        // Find and update or create new configuration
        const examConfig = await ExamConfig.findOneAndUpdate(
            {
                class: className,
                section: section,
                academicYear: academicYear
            },
            {
                $set: {
                    class: className,
                    section: section,
                    academicYear: academicYear,
                    examConfigs: examConfigs,
                    updatedAt: new Date()
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        res.json(examConfig);
    } catch (error) {
        console.error('Error saving exam config:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get all exam configurations
router.get('/config/all', auth, async (req, res) => {
    try {
        const configs = await ExamConfig.find().sort({ class: 1, section: 1, academicYear: -1 });
        res.json(configs);
    } catch (error) {
        console.error('Error fetching all exam configs:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
