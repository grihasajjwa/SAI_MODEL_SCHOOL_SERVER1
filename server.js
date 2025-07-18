const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Set default JWT_SECRET if not in env
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'skyview-secret-key-123';
    console.log('Using default JWT_SECRET');
}

// Set default MongoDB URI if not in env
if (!process.env.MONGODB_URI) {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/skyview';
    console.log('Using default MONGODB_URI');
}

// Initialize express
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from skyview-client directory
app.use(express.static(path.join(__dirname, '../skyview-client')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const academicRoutes = require('./routes/academic');
const classRoutes = require('./routes/classes'); 
const studentsRoutes = require('./routes/students');
const marksRoutes = require('./routes/marks');
const sectionRoutes = require('./routes/section.routes');
const downloadRoutes = require('./routes/download-students'); 
const feedbackRoutes = require('./routes/feedback');
const examRoutes = require('./routes/exam');
const userRoutes = require('./routes/user.routes');
const lessonPlanRoutes = require('./routes/lessonPlanRoutes');
const coScholasticRoutes = require('./routes/coScholastic');
const routineRoutes = require('./routes/routine');
const taskRoutes = require('./routes/taskRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/download-students', downloadRoutes);
app.use('/api', feedbackRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/users', userRoutes);
app.use('/api/lesson-plan', lessonPlanRoutes);
app.use('/api/co-scholastic', coScholasticRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/todo', taskRoutes);


// Root endpoint for API health check
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Skyview School API Version 1' });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Not Found - ${req.originalUrl}`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack); 
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {} 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
