const mongoose = require('mongoose');
const CoScholasticConfig = require('./models/CoScholasticConfig');
const Class = require('./models/Class');
require('dotenv').config();

// Empty activities array - fully dynamic system
const emptyActivities = [];

async function seedCoScholasticConfig() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get all classes
        const classes = await Class.find({});
        console.log(`Found ${classes.length} classes`);

        const academicYear = '2024-2025';
        let createdCount = 0;
        let updatedCount = 0;

        for (const classDoc of classes) {
            for (const section of classDoc.sections) {
                console.log(`Processing ${classDoc.name} - Section ${section}`);
                
                // Check if configuration already exists
                const existingConfig = await CoScholasticConfig.findOne({
                    class: classDoc.name,
                    section: section,
                    academicYear: academicYear
                });

                if (existingConfig) {
                    console.log(`Configuration already exists for ${classDoc.name} - Section ${section}`);
                    updatedCount++;
                } else {
                    // Create new empty configuration
                    const newConfig = new CoScholasticConfig({
                        class: classDoc.name,
                        section: section,
                        academicYear: academicYear,
                        activities: emptyActivities
                    });

                    await newConfig.save();
                    console.log(`Created empty configuration for ${classDoc.name} - Section ${section}`);
                    createdCount++;
                }
            }
        }

        console.log(`\nSeeding completed:`);
        console.log(`- Created: ${createdCount} empty configurations`);
        console.log(`- Already existed: ${updatedCount} configurations`);
        console.log(`- Total processed: ${createdCount + updatedCount} configurations`);
        console.log(`\nNote: All configurations are empty. Users will need to add activities manually through the interface.`);

    } catch (error) {
        console.error('Error seeding co-scholastic configurations:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the seed function
seedCoScholasticConfig();
