const express = require('express');
const router = express.Router();
const CoScholasticConfig = require('../models/CoScholasticConfig');
const auth = require('../middleware/auth');

// Logging middleware for debugging
const logRequest = (req, res, next) => {
    console.log(`[Co-Scholastic Config] ${req.method} ${req.path}`);
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    next();
};

// Get Co-Scholastic configuration for a class
router.get('/config/:className/:section/:academicYear', [auth, logRequest], async (req, res) => {
    try {
        const { className, section, academicYear } = req.params;
        console.log(`Fetching Co-Scholastic Config for Class: ${className}, Section: ${section}, Year: ${academicYear}`);

        const config = await CoScholasticConfig.findOne({ 
            class: className, 
            section: section, 
            academicYear: academicYear 
        });

        if (!config) {
            console.log(`No Co-Scholastic Config found for Class: ${className}, Section: ${section}, Year: ${academicYear}. Returning empty configuration.`);
            // Return empty configuration if none exists - fully dynamic system
            const emptyConfig = {
                activities: []
            };
            return res.json(emptyConfig);
        }

        console.log('Co-Scholastic Config found:', config);
        res.json(config);
    } catch (error) {
        console.error('Error fetching Co-Scholastic Config:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error while fetching Co-Scholastic Config',
            error: error.message 
        });
    }
});

// Create or update Co-Scholastic configuration for a class
router.post('/config', [auth, logRequest], async (req, res) => {
    try {
        const { class: className, section, academicYear, activities } = req.body;
        
        console.log(`Creating/Updating Co-Scholastic Config for Class: ${className}, Section: ${section}, Year: ${academicYear}`);
        console.log('Activities:', activities);

        // Validate required fields
        if (!className || !section || !academicYear) {
            return res.status(400).json({
                success: false,
                message: 'Class, section, and academic year are required'
            });
        }

        if (!activities || !Array.isArray(activities)) {
            return res.status(400).json({
                success: false,
                message: 'Activities array is required'
            });
        }

        // Validate activities structure
        for (const activity of activities) {
            if (!activity.id || !activity.label || typeof activity.enabled !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'Each activity must have id, label, and enabled boolean'
                });
            }
        }

        // Find and update or create new configuration
        const coScholasticConfig = await CoScholasticConfig.findOneAndUpdate(
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
                    activities: activities,
                    updatedAt: new Date()
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );
        
        console.log('Co-Scholastic Config saved:', coScholasticConfig);
        res.json(coScholasticConfig);
    } catch (error) {
        console.error('Error saving Co-Scholastic Config:', error);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Co-Scholastic configuration already exists for this class, section, and academic year'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error saving Co-Scholastic configuration',
            error: error.message 
        });
    }
});

// Get all Co-Scholastic configurations
router.get('/config/all', [auth, logRequest], async (req, res) => {
    try {
        console.log('Fetching all Co-Scholastic configurations');
        const configs = await CoScholasticConfig.find().sort({ className: 1, section: 1, academicYear: -1 });
        console.log(`Found ${configs.length} configurations`);
        res.json(configs);
    } catch (error) {
        console.error('Error fetching all Co-Scholastic configurations:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error while fetching all Co-Scholastic configurations',
            error: error.message 
        });
    }
});

module.exports = router;