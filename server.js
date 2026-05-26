const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
}

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'skyview-secret-key-123';
    console.log('Using default JWT_SECRET for local development');
}

const LOCAL_DEV_ORIGINS = new Set([
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:5000',
    'http://localhost:5000'
]);

let mongoConnectionPromise = null;
let indexFixPromise = null;

function createCorsOptions() {
    return {
        origin(origin, callback) {
            if (!origin || LOCAL_DEV_ORIGINS.has(origin)) {
                return callback(null, true);
            }

            try {
                const { hostname } = new URL(origin);
                if (
                    hostname === 'localhost' ||
                    hostname === '127.0.0.1' ||
                    hostname.endsWith('.vercel.app')
                ) {
                    return callback(null, true);
                }
            } catch (error) {
                console.warn('Invalid CORS origin received:', origin);
            }

            return callback(null, true);
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: 204
    };
}

async function connectToMongo() {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (mongoConnectionPromise) {
        return mongoConnectionPromise;
    }

    if (!process.env.MONGODB_URI) {
        console.warn('MONGODB_URI is not configured. Database-backed routes will fail until it is set.');
        return null;
    }

    mongoConnectionPromise = mongoose
        .connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('Connected to MongoDB Atlas');
            return mongoose.connection;
        })
        .catch((error) => {
            mongoConnectionPromise = null;
            console.error('MongoDB connection error:', error);
            throw error;
        });

    return mongoConnectionPromise;
}

async function ensureIndexesAreUpdated() {
    if (indexFixPromise) {
        return indexFixPromise;
    }

    indexFixPromise = (async () => {
        const connection = await connectToMongo();
        const db = connection?.db;
        if (!db) return;

        try {
            const routineIndexes = await db.collection('routines').indexes();
            const hasOldClassIndex = routineIndexes.some((index) => index.name === 'class_1');
            if (hasOldClassIndex) {
                console.log('Dropping legacy index class_1 on routines collection...');
                await db.collection('routines').dropIndex('class_1');
                console.log('Legacy index class_1 dropped.');
            }
        } catch (error) {
            console.error('Error while checking/dropping legacy routines.class_1 index:', error.message);
        }

        try {
            const studentIndexes = await db.collection('students').indexes();
            const oldStudentIdIndex = studentIndexes.find((index) => index.name === 'studentId_1' && index.unique);
            if (oldStudentIdIndex) {
                console.log('Dropping legacy unique index studentId_1 on students collection...');
                await db.collection('students').dropIndex('studentId_1');
                console.log('Legacy unique index studentId_1 dropped.');
            }
        } catch (error) {
            console.error('Error while checking/dropping legacy students.studentId_1 index:', error.message);
        }
    })().catch((error) => {
        indexFixPromise = null;
        throw error;
    });

    return indexFixPromise;
}

function registerRoutes(app) {
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
    const coScholasticConfigRoutes = require('./routes/coScholasticConfig.routes.js');
    const routineRoutes = require('./routes/routine');
    const taskRoutes = require('./routes/taskRoutes');
    const teacherRoutes = require('./routes/teacher.routes');
    const academicSessionRoutes = require('./routes/academicSession.routes');
    const routineClassConfigRoutes = require('./routes/routineClassConfig.routes');
    const routineSubjectConfigRoutes = require('./routes/routineSubjectConfig.routes');
    const feeRoutes = require('./routes/fees');
    const schoolProfileRoutes = require('./routes/schoolProfile.routes');
    const questionPaperRoutes = require('./routes/questionPaper.routes');
    const visitorRoutes = require('./routes/visitor.routes');
    const fuelRoutes = require('./routes/fuel.routes');
    const supplierRoutes = require('./routes/supplier.routes');
    const examRoutineRoutes = require('./routes/examRoutine.routes');
    const examNameRoutes = require('./routes/examName.routes');
    const admitDatesheetRoutes = require('./routes/admitDatesheet.routes');
    const salaryRoutes = require('./routes/salary.routes');

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
    app.use('/api/coscholastic', coScholasticConfigRoutes);
    app.use('/api/routines', routineRoutes);
    app.use('/api/todo', taskRoutes);
    app.use('/api/teachers', teacherRoutes);
    app.use('/api/sessions', academicSessionRoutes);
    app.use('/api/routine-classes', routineClassConfigRoutes);
    app.use('/api/routine-subjects', routineSubjectConfigRoutes);
    app.use('/api/fees', feeRoutes);
    app.use('/api/school-profile', schoolProfileRoutes);
    app.use('/api/question-papers', questionPaperRoutes);
    app.use('/api/visitors', visitorRoutes);
    app.use('/api/fuel', fuelRoutes);
    app.use('/api/suppliers', supplierRoutes);
    app.use('/api/exam-routines', examRoutineRoutes);
    app.use('/api/exam-names', examNameRoutes);
    app.use('/api/admit-datesheets', admitDatesheetRoutes);
    app.use('/api/salary', salaryRoutes);
}

function createApp() {
    const app = express();
    const corsOptions = createCorsOptions();
    const clientDir = path.join(__dirname, '../client');
    const uploadsDir = path.join(__dirname, 'uploads');

    app.use(cors(corsOptions));
    app.options(/.*/, cors(corsOptions));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use('/uploads', express.static(uploadsDir));
    app.use('/assets', express.static(path.join(clientDir, 'assets')));
    app.use(express.static(clientDir));

    app.use(async (req, res, next) => {
        if (req.path.startsWith('/api')) {
            try {
                await connectToMongo();
                await ensureIndexesAreUpdated();
            } catch (error) {
                return next(error);
            }
        }
        return next();
    });

    registerRoutes(app);

    app.get('/api/health', (req, res) => {
        res.json({ success: true, message: 'Skyview API is running' });
    });

    app.get('/', (req, res) => {
        res.json({ message: 'Welcome to Skyview School API Version 1' });
    });

    app.use((req, res) => {
        res.status(404).json({
            success: false,
            message: `Not Found - ${req.originalUrl}`
        });
    });

    app.use((err, req, res, next) => {
        console.error('Error:', err.stack || err);
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Internal Server Error',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    });

    return app;
}

const app = createApp();

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    connectToMongo()
        .then(() => ensureIndexesAreUpdated())
        .catch(() => {})
        .finally(() => {
            app.listen(PORT, () => {
                console.log(`Server is running on port ${PORT}`);
            });
        });
}

module.exports = app;
