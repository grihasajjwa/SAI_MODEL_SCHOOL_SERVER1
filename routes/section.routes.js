const express = require('express');
const router = express.Router();
const ClassDetails = require('../models/ClassDetails');
const auth = require('../middleware/auth');

// Get sections for a specific class
router.get('/:className', auth, async (req, res) => {
    try {
        const className = req.params.className;
        const academicYear = req.query.academicYear || '2024-2025'; // Default to current academic year

        // Find all sections for the given class and academic year
        const classSections = await ClassDetails.find({
            className: className,
            academicYear: academicYear
        }).select('section -_id').sort('section');

        if (!classSections || classSections.length === 0) {
            return res.json(['A', 'B']); // Return default sections if none found
        }

        // Extract unique sections
        const sections = [...new Set(classSections.map(c => c.section))];
        res.json(sections);
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
