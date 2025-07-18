const express = require('express');
const router = express.Router();
const CoScholasticArea = require('../models/CoScholasticArea');
const auth = require('../middleware/auth');

// Logging middleware for debugging
const logRequest = (req, res, next) => {
    console.log(`[Co-Scholastic] ${req.method} ${req.path}`);
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    next();
};

// Get Co-Scholastic areas for a specific class and academic year
router.get('/:className/:academicYear', [auth, logRequest], async (req, res) => {
    try {
        const { className, academicYear } = req.params;
        console.log(`Fetching Co-Scholastic Areas for Class: ${className}, Year: ${academicYear}`);

        const areas = await CoScholasticArea.findOne({ 
            className, 
            academicYear 
        });

        if (!areas) {
            console.log(`No Co-Scholastic Areas found for Class: ${className}, Year: ${academicYear}`);
            return res.status(404).json({ 
                success: false, 
                message: `No Co-Scholastic Areas found for Class: ${className}, Year: ${academicYear}` 
            });
        }

        console.log('Co-Scholastic Areas found:', areas);
        res.json(areas);
    } catch (error) {
        console.error('Error fetching Co-Scholastic Areas:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error while fetching Co-Scholastic Areas',
            error: error.message 
        });
    }
});

// Create or update Co-Scholastic areas for a class
router.post('/', [auth, logRequest], async (req, res) => {
    try {
        const { className, academicYear, areas } = req.body;
        
        console.log(`Creating/Updating Co-Scholastic Areas for Class: ${className}, Year: ${academicYear}`);
        console.log('Areas:', areas);

        const coScholasticArea = await CoScholasticArea.findOneAndUpdate(
            { className, academicYear },
            { className, academicYear, areas },
            { new: true, upsert: true }
        );
        
        console.log('Co-Scholastic Area saved:', coScholasticArea);
        res.status(201).json({
            success: true,
            message: 'Co-Scholastic Areas saved successfully',
            data: coScholasticArea
        });
    } catch (error) {
        console.error('Error saving Co-Scholastic Areas:', error);
        res.status(400).json({ 
            success: false, 
            message: 'Error saving Co-Scholastic Areas',
            error: error.message 
        });
    }
});

module.exports = router;
