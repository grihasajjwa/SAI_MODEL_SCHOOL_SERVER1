const express = require('express');
const router = express.Router();
const ClassDetails = require('../models/ClassDetails');
const Student = require('../models/Student');
const auth = require('../middleware/auth');

// Get all classes with student count
router.get('/', auth, async (req, res) => {
    try {
        const classes = await ClassDetails.find()
            .select('className section academicYear classTeacher subjects createdAt updatedAt')
            .sort({ createdAt: -1 });

        // Get student count for each class
        const classesWithCount = await Promise.all(classes.map(async (classData) => {
            const studentCount = await Student.countDocuments({
                class: classData.className,
                section: classData.section
            });

            return {
                ...classData.toObject(),
                studentCount
            };
        }));

       // console.log('Fetched classes with student count:', classesWithCount);
        res.json(classesWithCount);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get single class with student count
router.get('/:id', auth, async (req, res) => {
    try {
        const classData = await ClassDetails.findById(req.params.id)
            .select('className section academicYear classTeacher subjects');
        
        if (!classData) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const studentCount = await Student.countDocuments({
            class: classData.className,
            section: classData.section
        });

        const classWithCount = {
            ...classData.toObject(),
            studentCount
        };

       // console.log('Fetched single class:', classWithCount);
        res.json(classWithCount);
    } catch (error) {
        console.error('Error fetching class:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get class details by class name and section
router.get('/details/:className/:section', auth, async (req, res) => {
    try {
        const { className, section } = req.params;
       // console.log('Fetching class details for:', { className, section });

        const classDetails = await ClassDetails.findOne({ 
            className: className,
            section: section 
        });

        if (!classDetails) {
            console.log('No class found for:', { className, section });
            return res.status(404).json({ message: 'Class not found' });
        }

        // console.log('Found class details:', {
        //     id: classDetails._id,
        //     className: classDetails.className,
        //     section: classDetails.section,
        //     subjectsCount: classDetails.subjects.length,
        //     subjects: classDetails.subjects
        // });

        res.json(classDetails);
    } catch (error) {
        console.error('Error in /details/:className/:section:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new class
router.post('/', auth, async (req, res) => {
    try {
      //  console.log('Creating class with data:', req.body);

        const classData = new ClassDetails({
            academicYear: req.body.academicYear,
            className: req.body.className,
            section: req.body.section || 'A',
            classTeacher: req.body.classTeacher || 'Not Assigned',
            subjects: []
        });

        const savedClass = await classData.save();
        
        // Get initial student count (should be 0 for new class)
        const studentCount = await Student.countDocuments({
            class: savedClass.className,
            section: savedClass.section
        });

        const classWithCount = {
            ...savedClass.toObject(),
            studentCount
        };

       // console.log('Created class:', classWithCount);
        res.status(201).json(classWithCount);
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(400).json({ 
            message: error.message,
            details: error.errors
        });
    }
});

// Test add subject
router.post('/test-add-subject/:id', auth, async (req, res) => {
    try {
        console.log('\n=== Starting test subject add ===');
        const classId = req.params.id;
       // console.log('Class ID:', classId);

        // Find the class
        const existingClass = await ClassDetails.findById(classId);
        if (!existingClass) {
            console.log('Class not found');
            return res.status(404).json({ message: 'Class not found' });
        }
      //  console.log('Found class:', JSON.stringify(existingClass, null, 2));

        // Add test subject
        const testSubject = {
            name: 'Mathematics',
            teacher: 'John Smith'
        };

        // Initialize subjects array if it doesn't exist
        if (!existingClass.subjects) {
            existingClass.subjects = [];
        }

        // Add the test subject
        existingClass.subjects.push(testSubject);
       // console.log('Updated subjects:', existingClass.subjects);

        // Save the changes
        const savedClass = await existingClass.save();
//console.log('Class saved:', JSON.stringify(savedClass, null, 2));

        // Get fresh data to verify
        const updatedClass = await ClassDetails.findById(classId);
        console.log('Fresh class data:', JSON.stringify(updatedClass, null, 2));

        // Get student count
        const studentCount = await Student.countDocuments({
            class: updatedClass.className,
            section: updatedClass.section
        });

        const classWithCount = {
            ...updatedClass.toObject(),
            studentCount
        };

       // console.log('Final response:', JSON.stringify(classWithCount, null, 2));
      //  console.log('=== Test subject add complete ===\n');
        res.json(classWithCount);
    } catch (error) {
        console.error('Error in test route:', error);
        res.status(400).json({ 
            message: error.message,
            details: error.errors
        });
    }
});

// Test update subjects
router.post('/test-update/:id', auth, async (req, res) => {
    try {
       // console.log('\n=== Starting test subject update ===');
        const classId = req.params.id;
       // console.log('Class ID:', classId);

        // Get current class data
        const existingClass = await ClassDetails.findById(classId);
        if (!existingClass) {
            console.log('Class not found');
            return res.status(404).json({ message: 'Class not found' });
        }
       // console.log('Found class:', JSON.stringify(existingClass, null, 2));

        // Test subjects
        const testSubjects = [
            {
                name: 'Mathematics',
                teacher: 'John Smith'
            },
            {
                name: 'English',
                teacher: 'Jane Doe'
            },
            {
                name: 'Science',
                teacher: 'Bob Wilson'
            }
        ];

        // Update data
        const updateData = {
            className: existingClass.className,
            section: existingClass.section,
            academicYear: existingClass.academicYear,
            classTeacher: existingClass.classTeacher,
            subjects: testSubjects
        };

        console.log('Update data:', JSON.stringify(updateData, null, 2));

        // Update using findByIdAndUpdate
        const updatedClass = await ClassDetails.findByIdAndUpdate(
            classId,
            updateData,
            { 
                new: true,
                runValidators: true
            }
        );

        if (!updatedClass) {
            console.log('Update failed');
            throw new Error('Failed to update class');
        }

       // console.log('Updated class:', JSON.stringify(updatedClass, null, 2));

        // Get student count
        const studentCount = await Student.countDocuments({
            class: updatedClass.className,
            section: updatedClass.section
        });

        const classWithCount = {
            ...updatedClass.toObject(),
            studentCount
        };

       // console.log('Final response:', JSON.stringify(classWithCount, null, 2));
      //  console.log('=== Test subject update complete ===\n');
        res.json(classWithCount);
    } catch (error) {
        console.error('Error in test update:', error);
        res.status(400).json({ 
            message: error.message,
            details: error.errors
        });
    }
});

// Update class
router.put('/:id', auth, async (req, res) => {
    try {
//console.log('\n=== Starting class update ===');
       // console.log('Request body:', JSON.stringify(req.body, null, 2));

        // Validate subjects array
        if (!req.body.subjects || !Array.isArray(req.body.subjects)) {
            console.log('Invalid subjects data:', req.body.subjects);
            return res.status(400).json({ message: 'Subjects must be an array' });
        }

        if (req.body.subjects.length === 0) {
            console.log('Empty subjects array');
            return res.status(400).json({ message: 'At least one subject is required' });
        }

        // Validate each subject
        for (const subject of req.body.subjects) {
            if (!subject.name || !subject.teacher) {
                console.log('Invalid subject:', subject);
                return res.status(400).json({ message: 'Each subject must have a name and teacher' });
            }
        }

        // Find and update the class
      //  console.log('Finding class with ID:', req.params.id);
        const existingClass = await ClassDetails.findById(req.params.id);
        if (!existingClass) {
            console.log('Class not found');
            return res.status(404).json({ message: 'Class not found' });
        }
       // console.log('Found existing class:', JSON.stringify(existingClass, null, 2));

        // Update class fields
        const updateData = {
            academicYear: req.body.academicYear,
            className: req.body.className,
            section: req.body.section,
            classTeacher: req.body.classTeacher || 'Not Assigned',
            subjects: req.body.subjects.map(subject => ({
                name: subject.name.trim(),
                teacher: subject.teacher.trim()
            }))
        };

      //  console.log('Update data:', JSON.stringify(updateData, null, 2));

        // Update using findByIdAndUpdate to ensure atomic update
        const updatedClass = await ClassDetails.findByIdAndUpdate(
            req.params.id,
            updateData,
            { 
                new: true, // Return the updated document
                runValidators: true // Run schema validators
            }
        );

        if (!updatedClass) {
            console.log('Update failed');
            throw new Error('Failed to update class');
        }

       // console.log('Updated class:', JSON.stringify(updatedClass, null, 2));

        // Get student count
        const studentCount = await Student.countDocuments({
            class: updatedClass.className,
            section: updatedClass.section
        });

        const classWithCount = {
            ...updatedClass.toObject(),
            studentCount
        };

       // console.log('Final response:', JSON.stringify(classWithCount, null, 2));
       // console.log('=== Class update complete ===\n');
        res.json(classWithCount);
    } catch (error) {
        console.error('Error updating class:', error);
        res.status(400).json({ 
            message: error.message || 'Failed to update class',
            details: error.errors
        });
    }
});

// Update class subjects
router.put('/:id/subjects', auth, async (req, res) => {
    try {
       // console.log('Updating subjects for class:', req.params.id, req.body.subjects);

        if (!req.body.subjects || !Array.isArray(req.body.subjects)) {
            return res.status(400).json({ message: 'Subjects array is required' });
        }

        // Validate each subject
        for (const subject of req.body.subjects) {
            if (!subject.name || !subject.teacher) {
                return res.status(400).json({ 
                    message: 'Each subject must have a name and teacher' 
                });
            }
        }

        const classData = await ClassDetails.findByIdAndUpdate(
            req.params.id,
            { subjects: req.body.subjects },
            { 
                new: true, // Return the updated document
                runValidators: true // Run schema validators
            }
        );

        if (!classData) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const studentCount = await Student.countDocuments({
            class: classData.className,
            section: classData.section
        });

        const classWithCount = {
            ...classData.toObject(),
            studentCount
        };

      //  console.log('Updated class subjects:', classWithCount);
        res.json(classWithCount);
    } catch (error) {
        console.error('Error updating class subjects:', error);
        res.status(400).json({ 
            message: error.message,
            details: error.errors
        });
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
        console.error('Error deleting class:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
