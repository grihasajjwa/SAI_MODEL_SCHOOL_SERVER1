const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const defaultAdmin = {
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@skyview.com',
    username: 'admin',
    password: 'admin@123',
    role: 'admin',
    isActive: true
};

async function seedDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if admin user exists
        const existingAdmin = await User.findOne({ username: defaultAdmin.username });
        if (!existingAdmin) {
            // Hash the password before creating admin
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(defaultAdmin.password, salt);
            
            // Create admin user with hashed password
            const user = new User({
                ...defaultAdmin,
                password: hashedPassword
            });
            await user.save();
            console.log('Default admin user created');
        } else {
            // Update admin password if it exists
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(defaultAdmin.password, salt);
            existingAdmin.password = hashedPassword;
            await existingAdmin.save();
            console.log('Default admin password updated');
        }

        console.log('Database seeding completed');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
