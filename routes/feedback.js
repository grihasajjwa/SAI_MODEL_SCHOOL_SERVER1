const express = require('express');
const router = express.Router();
const Feedback = require('../models/feedback');
 const auth = require('../middleware/auth');

// Submit new feedback (public access)
router.post('/new-feedback', async (req, res) => {
    try {
        const feedback = new Feedback(req.body);
        await feedback.save();
        res.status(201).send({ message: 'Feedback submitted successfully', feedback });
    } catch (error) {
        res.status(400).send({ message: 'Error submitting feedback', error: error.message });
    }
});

// Get all feedback (admin only)
// router.get('/all-feedback', auth, async (req, res) => {
router.get('/all-feedback',  async (req, res) => {
    try {
        // Ensure user is admin
        // if (!req.user.isAdmin) {
        //     return res.status(403).send({ message: 'Access denied. Admin only.' });
        // }

        const query = {};
        
        // Filter by category if provided
        if (req.query.category) {
            query.category = req.query.category;
        }

        // Date range filter
        if (req.query.startDate && req.query.endDate) {
            query.submittedAt = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate)
            };
        }

        // Rating filter
        if (req.query.minRating) {
            query.rating = { $gte: parseInt(req.query.minRating) };
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const feedback = await Feedback.find(query)
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Feedback.countDocuments(query);

        res.send({
            feedback,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).send({ message: 'Error retrieving feedback', error: error.message });
    }
});

// Get feedback statistics (admin only)
router.get('/feedback-stats', auth, async (req, res) => {
    try {
        // Ensure user is admin
        if (!req.user.isAdmin) {
            return res.status(403).send({ message: 'Access denied. Admin only.' });
        }

        const stats = await Feedback.aggregate([
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalFeedback: { $sum: 1 },
                    categoryBreakdown: {
                        $push: '$category'
                    }
                }
            }
        ]);

        // Calculate category distribution
        const categoryDistribution = stats[0].categoryBreakdown.reduce((acc, category) => {
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});

        res.send({
            averageRating: stats[0].averageRating.toFixed(2),
            totalFeedback: stats[0].totalFeedback,
            categoryDistribution
        });
    } catch (error) {
        res.status(500).send({ message: 'Error retrieving feedback statistics', error: error.message });
    }
});

module.exports = router;
