const mongoose = require("mongoose");

const lessonPlanSchema = new mongoose.Schema({
    className: { type: String, required: true }, // e.g., "Class 1"
    subjects: [
        {
            subjectName: { type: String, required: true }, // e.g., "Mathematics"
            academicYear: { type: String, required: true }, // e.g., "2024-2025"
            chapters: [
                {
                    chapterNo: { type: Number, required: true },
                    chapterName: { type: String, required: true },
                    lessons: [
                        {
                            day: { type: Number, required: true },
                            topic: { type: String, required: true },
                            method: { 
                                type: String, 
                                //enum: ["Board Work", "Reading", "Q & A Method", "Discussion", "Activity", "Demonstration", "Group Work"], 
                                required: true 
                            },
                            teachingAids: [{ type: String, enum: ["Chart", "Video", "PPT", "Textbook"] }],
                            assessment: [{ type: String, enum: ["Oral", "Written", "Project", "Quiz"] }],
                            remarks: { type: String }
                        }
                    ]
                }
            ]
        }
    ],
    createdAt: { type: Date, default: Date.now }
});

// Export Model
const LessonPlan = mongoose.model("LessonPlan", lessonPlanSchema);
module.exports = LessonPlan;
