const mongoose = require('mongoose');
const ClassDetails = require('./models/ClassDetails');
require('dotenv').config();

const defaultClasses = [
    {
        className: 'Nursery',
        section: 'A',
        academicYear: '2024-2025',
        subjects: [
            { name: 'English', teacher: 'John Smith' },
            { name: 'Math', teacher: 'Mary Johnson' },
            { name: 'Bengali', teacher: 'Amit Roy' },
            { name: 'Drawing', teacher: 'Sarah Wilson' }
        ],
        classTeacher: 'John Doe'
    },
    {
        className: 'Nursery',
        section: 'B',
        academicYear: '2024-2025',
        subjects: [
            { name: 'English', teacher: 'Jane Doe' },
            { name: 'Math', teacher: 'Peter Parker' },
            { name: 'Bengali', teacher: 'Priya Sen' },
            { name: 'Drawing', teacher: 'David Miller' }
        ],
        classTeacher: 'Jane Smith'
    },
    {
        className: 'LKG',
        section: 'A',
        academicYear: '2024-2025',
        subjects: [
            { name: 'English', teacher: 'Alice Brown' },
            { name: 'Math', teacher: 'Bob White' },
            { name: 'Bengali', teacher: 'Rahul Das' },
            { name: 'Drawing', teacher: 'Emma Davis' }
        ],
        classTeacher: 'Alice Johnson'
    },
    {
        className: 'LKG',
        section: 'B',
        academicYear: '2024-2025',
        subjects: [
            { name: 'English', teacher: 'Michael Lee' },
            { name: 'Math', teacher: 'Susan Clark' },
            { name: 'Bengali', teacher: 'Ravi Kumar' },
            { name: 'Drawing', teacher: 'Lisa Anderson' }
        ],
        classTeacher: 'Bob Wilson'
    }
];

async function seedClasses() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Add classes
        for (const classData of defaultClasses) {
            const existingClass = await ClassDetails.findOne({
                className: classData.className,
                section: classData.section,
                academicYear: classData.academicYear
            });

            if (!existingClass) {
                const newClass = new ClassDetails(classData);
                await newClass.save();
                console.log(`Created class: ${classData.className}-${classData.section}`);
            } else {
                // Update existing class
                existingClass.subjects = classData.subjects;
                existingClass.classTeacher = classData.classTeacher;
                await existingClass.save();
                console.log(`Updated class: ${classData.className}-${classData.section}`);
            }
        }

        console.log('Class seeding completed');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding classes:', error);
        process.exit(1);
    }
}

seedClasses();
