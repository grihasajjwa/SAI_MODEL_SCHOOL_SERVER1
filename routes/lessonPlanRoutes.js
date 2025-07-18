const express = require("express");
const LessonPlan = require("../models/LessonPlan");
const ClassDetails = require("../models/ClassDetails");
const router = express.Router();



router.put("/:className/:subjectName/add-chapter", async (req, res) => {
    try {
        const { chapterNo, chapterName, lessons } = req.body;
        // console.log('\n--- Adding/Updating Chapter ---');
        // console.log('Class:', req.params.className);
        // console.log('Subject:', req.params.subjectName);
        // console.log('Chapter:', { chapterNo, chapterName });
        // console.log('Lessons:', JSON.stringify(lessons, null, 2));

        // Basic validation
        if (!chapterNo || !chapterName || !lessons) {
            console.log('❌ Missing required fields:', { chapterNo, chapterName, lessons });
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Validate lessons data
        if (!Array.isArray(lessons)) {
            console.log('❌ Lessons must be an array:', lessons);
            return res.status(400).json({ message: "Lessons must be an array" });
        }

        if (lessons.length === 0) {
            console.log('❌ No lessons provided');
            return res.status(400).json({ message: "At least one lesson is required" });
        }

        // Validate each lesson
        const validMethods = ["Board Work", "Reading" ,"Q & A Method", "Discussion", "Activity", "Demonstration", "Group Work"];
        const validTeachingAids = ["Chart", "Video", "PPT", "Textbook"];
        const validAssessments = ["Oral", "Written", "Project", "Quiz"];

        for (const lesson of lessons) {
            console.log('\nValidating lesson:', lesson.topic);
            if (!lesson.topic || !lesson.method) {
                console.log('❌ Missing topic or method in lesson:', lesson);
                return res.status(400).json({ message: "Each lesson must have a topic and method" });
            }
            if (!validMethods.includes(lesson.method)) {
                console.log('❌ Invalid method:', lesson.method);
                return res.status(400).json({ message: `Invalid method: ${lesson.method}. Must be one of: ${validMethods.join(', ')}` });
            }
            if (lesson.teachingAids && !lesson.teachingAids.every(aid => validTeachingAids.includes(aid))) {
                console.log('❌ Invalid teaching aids:', lesson.teachingAids);
                return res.status(400).json({ message: `Invalid teaching aid. Must be one of: ${validTeachingAids.join(', ')}` });
            }
            if (lesson.assessment && !lesson.assessment.every(a => validAssessments.includes(a))) {
                console.log('❌ Invalid assessment:', lesson.assessment);
                return res.status(400).json({ message: `Invalid assessment. Must be one of: ${validAssessments.join(', ')}` });
            }
            console.log('✅ Lesson validation passed');
        }

        // Find or create the lesson plan
        let lessonPlan = await LessonPlan.findOne({ className: req.params.className });
        if (!lessonPlan) {
            console.log('📝 Creating new lesson plan for:', req.params.className);
            lessonPlan = new LessonPlan({
                className: req.params.className,
                subjects: []
            });
        }

        // Find or create the subject
        let subject = lessonPlan.subjects.find(sub => sub.subjectName === req.params.subjectName);
        if (!subject) {
            console.log('📚 Adding new subject:', req.params.subjectName);
            lessonPlan.subjects.push({
                subjectName: req.params.subjectName,
                academicYear: "2025-2026",
                chapters: []
            });
            subject = lessonPlan.subjects[lessonPlan.subjects.length - 1];
        }

        // Find existing chapter
        const existingChapterIndex = subject.chapters.findIndex(chap => chap.chapterNo === chapterNo);
        
        if (existingChapterIndex !== -1) {
            // Update existing chapter
            console.log('📖 Updating existing chapter:', chapterNo);
            subject.chapters[existingChapterIndex] = { chapterNo, chapterName, lessons };
        } else {
            // Add new chapter
            console.log('📖 Adding new chapter:', chapterNo);
            subject.chapters.push({ chapterNo, chapterName, lessons });
        }

        // Save the lesson plan
        try {
            await lessonPlan.save();
            console.log('✅ Saved lesson plan successfully');
            console.log('Final lesson plan:', JSON.stringify(lessonPlan, null, 2));
            res.status(200).json({ message: existingChapterIndex !== -1 ? "Chapter updated successfully!" : "Chapter added successfully!", lessonPlan });
        } catch (error) {
            console.error('❌ Error saving lesson plan:', error);
            res.status(400).json({ message: "Error saving lesson plan", error: error.message });
        }
    } catch (error) {
        console.error('❌ Error in add-chapter:', error);
        res.status(500).json({ 
            message: "Failed to add chapter",
            error: error.message,
            details: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            })) : null
        });
    }
});

// ✅ 1. Create a new lesson plan
router.post("/add", async (req, res) => {
    try {
        const newPlan = new LessonPlan(req.body);
        await newPlan.save();
        res.status(201).json({ message: "Lesson Plan added successfully!", newPlan });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ 2. Get all lesson plans
router.get("/", async (req, res) => {
    try {
        const plans = await LessonPlan.find();
        res.status(200).json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ 3. Get lesson plans by class
router.get("/:className", async (req, res) => {
    try {
        const plan = await LessonPlan.findOne({ className: req.params.className });
        if (!plan) {
            console.log('No lesson plan found for class:', req.params.className);
            return res.status(404).json({ message: "Lesson Plan not found" });
        }
        console.log('Found lesson plan:', JSON.stringify(plan, null, 2));
        res.status(200).json(plan);
    } catch (error) {
        console.error('Error getting lesson plan:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ 4. Add a new subject to a class
router.put("/:className/add-subject", async (req, res) => {
    try {
        const { subjectName, academicYear, chapters } = req.body;

        const updatedPlan = await LessonPlan.findOneAndUpdate(
            { className: req.params.className },
            { $push: { subjects: { subjectName, academicYear, chapters } } },
            { new: true }
        );

        if (!updatedPlan) return res.status(404).json({ message: "Lesson Plan not found" });

        res.status(200).json({ message: "Subject added successfully!", updatedPlan });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ 5. Update a specific lesson
router.put("/:className/:subjectName/:chapterNo/:day/update-lesson", async (req, res) => {
    try {
        const { topic, method, teachingAids, assessment, remarks } = req.body;

        const updatedPlan = await LessonPlan.findOneAndUpdate(
            {
                className: req.params.className,
                "subjects.subjectName": req.params.subjectName,
                "subjects.chapters.chapterNo": req.params.chapterNo,
                "subjects.chapters.lessons.day": req.params.day
            },
            {
                $set: {
                    "subjects.$[s].chapters.$[c].lessons.$[l].topic": topic,
                    "subjects.$[s].chapters.$[c].lessons.$[l].method": method,
                    "subjects.$[s].chapters.$[c].lessons.$[l].teachingAids": teachingAids,
                    "subjects.$[s].chapters.$[c].lessons.$[l].assessment": assessment,
                    "subjects.$[s].chapters.$[c].lessons.$[l].remarks": remarks
                }
            },
            {
                arrayFilters: [
                    { "s.subjectName": req.params.subjectName },
                    { "c.chapterNo": parseInt(req.params.chapterNo) },
                    { "l.day": parseInt(req.params.day) }
                ],
                new: true
            }
        );

        if (!updatedPlan) return res.status(404).json({ message: "Lesson not found" });

        res.status(200).json({ message: "Lesson updated successfully!", updatedPlan });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ 6. Delete a specific lesson
router.delete("/:className/:subjectName/:chapterNo/:day/delete-lesson", async (req, res) => {
    try {
        const updatedPlan = await LessonPlan.findOneAndUpdate(
            {
                className: req.params.className,
                "subjects.subjectName": req.params.subjectName,
                "subjects.chapters.chapterNo": req.params.chapterNo
            },
            {
                $pull: {
                    "subjects.$[].chapters.$[].lessons": { day: parseInt(req.params.day) }
                }
            },
            { new: true }
        );

        if (!updatedPlan) return res.status(404).json({ message: "Lesson not found" });

        res.status(200).json({ message: "Lesson deleted successfully!", updatedPlan });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ 7. Delete an entire lesson plan
router.delete("/:id", async (req, res) => {
    try {
        const deletedPlan = await LessonPlan.findByIdAndDelete(req.params.id);
        if (!deletedPlan) return res.status(404).json({ message: "Lesson Plan not found" });
        res.status(200).json({ message: "Lesson Plan deleted successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add more lessons to an existing chapter
router.put("/:className/:subjectName/:chapterNo/add-lessons", async (req, res) => {
    try {
        const { lessons } = req.body;
        console.log('\n--- Adding More Lessons ---');
        console.log('Class:', req.params.className);
        console.log('Subject:', req.params.subjectName);
        console.log('Chapter:', req.params.chapterNo);
        console.log('New Lessons:', JSON.stringify(lessons, null, 2));

        // Basic validation
        if (!lessons || !Array.isArray(lessons)) {
            return res.status(400).json({ message: "Lessons must be an array" });
        }

        if (lessons.length === 0) {
            return res.status(400).json({ message: "At least one lesson is required" });
        }

        // Validate each lesson
        const validMethods = ["Lecture", "Discussion", "Activity", "Demonstration", "Group Work"];
        const validTeachingAids = ["Chart", "Video", "PPT", "Textbook"];
        const validAssessments = ["Oral", "Written", "Project", "Quiz"];

        for (const lesson of lessons) {
            if (!lesson.topic || !lesson.method || !lesson.day) {
                return res.status(400).json({ message: "Each lesson must have a topic, method, and day" });
            }
            if (!validMethods.includes(lesson.method)) {
                return res.status(400).json({ message: `Invalid method: ${lesson.method}. Must be one of: ${validMethods.join(', ')}` });
            }
            if (lesson.teachingAids && !lesson.teachingAids.every(aid => validTeachingAids.includes(aid))) {
                return res.status(400).json({ message: `Invalid teaching aid. Must be one of: ${validTeachingAids.join(', ')}` });
            }
            if (lesson.assessment && !lesson.assessment.every(a => validAssessments.includes(a))) {
                return res.status(400).json({ message: `Invalid assessment. Must be one of: ${validAssessments.join(', ')}` });
            }
        }

        // Find the lesson plan
        const lessonPlan = await LessonPlan.findOne({
            className: req.params.className,
            "subjects.subjectName": req.params.subjectName
        });

        if (!lessonPlan) {
            return res.status(404).json({ message: "Lesson plan not found" });
        }

        // Find the subject
        const subject = lessonPlan.subjects.find(sub => sub.subjectName === req.params.subjectName);
        if (!subject) {
            return res.status(404).json({ message: "Subject not found" });
        }

        // Find the chapter
        const chapter = subject.chapters.find(chap => chap.chapterNo === parseInt(req.params.chapterNo));
        if (!chapter) {
            return res.status(404).json({ message: "Chapter not found" });
        }

        // Get existing lesson days to avoid duplicates
        const existingDays = new Set(chapter.lessons.map(lesson => lesson.day));

        // Add new lessons
        for (const lesson of lessons) {
            if (!existingDays.has(lesson.day)) {
                chapter.lessons.push(lesson);
                existingDays.add(lesson.day);
            }
        }

        // Sort lessons by day
        chapter.lessons.sort((a, b) => a.day - b.day);

        // Save the updated lesson plan
        await lessonPlan.save();
        console.log('✅ Successfully added new lessons');

        res.status(200).json({
            message: "Lessons added successfully",
            chapter: chapter
        });
    } catch (error) {
        console.error('Error adding lessons:', error);
        res.status(500).json({ 
            message: "Failed to add lessons",
            error: error.message
        });
    }
});

// Get subjects for a class
router.get("/subjects/:className", async (req, res) => {
    try {
        // First try to get subjects from ClassDetails
        const classDetails = await ClassDetails.findOne({ 
            className: req.params.className
        });

        if (classDetails && classDetails.subjects && classDetails.subjects.length > 0) {
            // Map the subjects to match the expected format
            const subjects = classDetails.subjects.map(subject => ({
                name: subject.name,
                academicYear: classDetails.academicYear
            }));
            return res.status(200).json(subjects);
        }

        // If no subjects found in ClassDetails, try LessonPlan
        const lessonPlan = await LessonPlan.findOne({ 
            className: req.params.className
        });

        if (!lessonPlan || !lessonPlan.subjects || lessonPlan.subjects.length === 0) {
            return res.status(404).json({ message: "No subjects found for this class" });
        }

        // Map the subjects from LessonPlan
        const subjects = lessonPlan.subjects.map(subject => ({
            name: subject.subjectName,
            academicYear: subject.academicYear
        }));

        res.status(200).json(subjects);
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get lesson plan for a specific class and subject
router.get("/:className/:subjectName", async (req, res) => {
    try {
        const plan = await LessonPlan.findOne({ 
            className: req.params.className,
            "subjects.subjectName": req.params.subjectName
        });
        
        if (!plan) {
            return res.status(404).json({ message: "Lesson plan not found" });
        }

        const subject = plan.subjects.find(s => s.subjectName === req.params.subjectName);
        if (!subject) {
            return res.status(404).json({ message: "Subject not found in lesson plan" });
        }

        // Format the lesson plan data for DataTables
        const formattedLessons = [];
        subject.chapters.forEach(chapter => {
            chapter.lessons.forEach(lesson => {
                formattedLessons.push({
                    chapterNo: chapter.chapterNo,
                    chapterName: chapter.chapterName,
                    day: lesson.day,
                    topic: lesson.topic,
                    method: lesson.method,
                    teachingAids: Array.isArray(lesson.teachingAids) ? lesson.teachingAids.join(", ") : lesson.teachingAids,
                    assessment: Array.isArray(lesson.assessment) ? lesson.assessment.join(", ") : lesson.assessment,
                    remarks: lesson.remarks || ""
                });
            });
        });

        res.status(200).json(formattedLessons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all classes that have lesson plans
router.get("/classes", async (req, res) => {
    try {
        const plans = await LessonPlan.find({}, 'className');
        const classes = plans.map(plan => ({ name: plan.className }));
        res.status(200).json(classes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
