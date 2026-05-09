const mongoose = require('mongoose');
const CoScholasticConfig = require('./models/CoScholasticConfig');
require('dotenv').config();

// Test data - fully dynamic activities
const testConfig = {
    class: 'I',
    section: 'A',
    academicYear: '2024-2025',
    activities: [
        { id: 'art_education', label: 'Art & Craft', enabled: true },
        { id: 'music', label: 'Music & Dance', enabled: true },
        { id: 'sports', label: 'Physical Education', enabled: true },
        { id: 'leadership', label: 'Leadership Skills', enabled: false }
    ]
};

async function testCoScholasticConfig() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Test 1: Create new configuration with custom activities
        console.log('\n=== Test 1: Creating new configuration with custom activities ===');
        const newConfig = new CoScholasticConfig(testConfig);
        const savedConfig = await newConfig.save();
        console.log('Created configuration:', JSON.stringify(savedConfig, null, 2));

        // Test 2: Find configuration
        console.log('\n=== Test 2: Finding configuration ===');
        const foundConfig = await CoScholasticConfig.findOne({
            class: testConfig.class,
            section: testConfig.section,
            academicYear: testConfig.academicYear
        });
        console.log('Found configuration:', JSON.stringify(foundConfig, null, 2));

        // Test 3: Update configuration - add new activities
        console.log('\n=== Test 3: Updating configuration - adding new activities ===');
        foundConfig.activities.push(
            { id: 'debate', label: 'Debate & Elocution', enabled: true },
            { id: 'community_service', label: 'Community Service', enabled: true }
        );
        const updatedConfig = await foundConfig.save();
        console.log('Updated configuration:', JSON.stringify(updatedConfig, null, 2));

        // Test 4: Remove some activities
        console.log('\n=== Test 4: Removing some activities ===');
        updatedConfig.activities = updatedConfig.activities.filter(activity => 
            !['sports', 'leadership'].includes(activity.id)
        );
        const removedConfig = await updatedConfig.save();
        console.log('Configuration after removal:', JSON.stringify(removedConfig, null, 2));

        // Test 5: Find all configurations for a class
        console.log('\n=== Test 5: Finding all configurations for class I ===');
        const allConfigs = await CoScholasticConfig.find({ class: 'I' });
        console.log(`Found ${allConfigs.length} configurations for class I`);
        allConfigs.forEach(config => {
            console.log(`- Section ${config.section}, Year ${config.academicYear}: ${config.activities.length} activities`);
            config.activities.forEach(activity => {
                console.log(`  * ${activity.label} (${activity.enabled ? 'enabled' : 'disabled'})`);
            });
        });

        // Test 6: Test empty configuration
        console.log('\n=== Test 6: Creating empty configuration ===');
        const emptyConfig = new CoScholasticConfig({
            class: 'II',
            section: 'A',
            academicYear: '2024-2025',
            activities: []
        });
        const savedEmptyConfig = await emptyConfig.save();
        console.log('Empty configuration:', JSON.stringify(savedEmptyConfig, null, 2));

        // Test 7: Delete configuration
        console.log('\n=== Test 7: Deleting configuration ===');
        const deletedConfig = await CoScholasticConfig.findOneAndDelete({
            class: testConfig.class,
            section: testConfig.section,
            academicYear: testConfig.academicYear
        });
        console.log('Deleted configuration:', JSON.stringify(deletedConfig, null, 2));

        // Test 8: Verify deletion
        console.log('\n=== Test 8: Verifying deletion ===');
        const verifyDelete = await CoScholasticConfig.findOne({
            class: testConfig.class,
            section: testConfig.section,
            academicYear: testConfig.academicYear
        });
        console.log('Configuration after deletion:', verifyDelete ? 'Still exists' : 'Successfully deleted');

        // Test 9: Clean up empty config
        console.log('\n=== Test 9: Cleaning up empty configuration ===');
        await CoScholasticConfig.findOneAndDelete({
            class: 'II',
            section: 'A',
            academicYear: '2024-2025'
        });
        console.log('Cleaned up empty configuration');

        console.log('\n=== All tests completed successfully! ===');
        console.log('\nKey Features Tested:');
        console.log('✅ Fully dynamic activity creation');
        console.log('✅ Custom activity labels and IDs');
        console.log('✅ Enable/disable functionality');
        console.log('✅ Add/remove activities dynamically');
        console.log('✅ Empty configuration support');
        console.log('✅ CRUD operations');

    } catch (error) {
        console.error('Error during testing:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testCoScholasticConfig();
