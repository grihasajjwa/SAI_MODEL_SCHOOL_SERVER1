const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const Student = require('../models/Student');
const cloudinary = require('../config/cloudinary');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const photoDir = path.join(__dirname, '..', 'uploads', 'students');
const isServerless = !!process.env.VERCEL;
const hasCloudinaryConfig = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

const uploadPhoto = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Only image files are allowed (jpg, jpeg, png, webp)'));
        }
        cb(null, true);
    }
});

function buildStudentPhotoName(req, file) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const base = (req.params.admissionNo || req.body.studentId || req.body.admissionNo || 'student').toString()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${base}-${Date.now()}${ext}`;
}

function uploadBufferToCloudinary(file, admissionNo) {
    return new Promise((resolve, reject) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
        const safeId = (admissionNo || 'student').toString().replace(/[^a-zA-Z0-9_-]/g, '_');

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'skyview/students',
                public_id: `${safeId}-${Date.now()}`,
                resource_type: 'image',
                format: ext.replace(/^\./, '') || undefined
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        stream.end(file.buffer);
    });
}

async function persistStudentPhoto(req, file) {
    if (hasCloudinaryConfig) {
        const result = await uploadBufferToCloudinary(file, req.params.admissionNo || req.body.studentId || req.body.admissionNo);
        return result.secure_url;
    }

    if (isServerless) {
        throw new Error('Student photo upload requires Cloudinary configuration on Vercel.');
    }

    await fs.promises.mkdir(photoDir, { recursive: true });
    const fileName = buildStudentPhotoName(req, file);
    const targetPath = path.join(photoDir, fileName);
    await fs.promises.writeFile(targetPath, file.buffer);
    return `/uploads/students/${fileName}`;
}

async function findStudentByAdmissionAndSession(admissionNo, session) {
    const query = { studentId: admissionNo };
    if (session) {
        query.session = session;
        return Student.findOne(query);
    }

    // Backward compatible fallback: latest record for this admission number.
    return Student.findOne(query).sort({ createdAt: -1 });
}

function buildTransportPayload(transportInput = {}) {
    const required = !!transportInput.required;
    const normalizedOrder = Number.isFinite(Number(transportInput.pickupOrder))
        ? Number(transportInput.pickupOrder)
        : null;

    return {
        required,
        fees: required ? Number(transportInput.fees || 0) || 0 : null,
        startDate: required ? (transportInput.startDate || null) : null,
        busNumber: required ? (transportInput.busNumber || null) : null,
        pickupPoint: required ? (transportInput.pickupPoint || null) : null,
        route: required ? (transportInput.route || null) : null,
        pickupOrder: required ? normalizedOrder : null
    };
}

function normalizeCellValue(value) {
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value.trim() : value;
}

function normalizeStringValue(value, fallback = '') {
    const normalized = normalizeCellValue(value);
    if (normalized === '') return fallback;
    return String(normalized).trim();
}

function normalizeNumericValue(value, fallback = 0) {
    const normalized = normalizeCellValue(value);
    if (normalized === '') return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBooleanFromYesNo(value) {
    const normalized = normalizeStringValue(value).toLowerCase();
    return ['yes', 'y', 'true', '1'].includes(normalized);
}

function normalizeExcelDate(value, fallback = null) {
    const normalized = normalizeCellValue(value);
    if (normalized === '') return fallback;

    if (normalized instanceof Date) {
        return Number.isNaN(normalized.getTime()) ? fallback : normalized;
    }

    if (typeof normalized === 'number') {
        const parsed = xlsx.SSF.parse_date_code(normalized);
        if (!parsed) return fallback;
        return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }

    const text = String(normalized).trim();
    if (!text) return fallback;

    const directDate = new Date(text);
    if (!Number.isNaN(directDate.getTime())) {
        return directDate;
    }

    const simpleMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (simpleMatch) {
        let [, first, second, year] = simpleMatch;
        let day = Number(first);
        let month = Number(second);
        const fullYear = year.length === 2 ? Number(`20${year}`) : Number(year);

        if (day <= 12 && month > 12) {
            day = Number(second);
            month = Number(first);
        }

        const parsedDate = new Date(fullYear, month - 1, day);
        return Number.isNaN(parsedDate.getTime()) ? fallback : parsedDate;
    }

    return fallback;
}

function buildTransportQuery(session) {
    const query = { 'transport.required': true };
    if (session) {
        query.session = session;
    }
    return query;
}

router.get('/transport/summary', async (req, res) => {
    try {
        const students = await Student.find(buildTransportQuery(req.query.session))
            .sort({ 'transport.busNumber': 1, 'transport.route': 1, 'transport.pickupOrder': 1, rollNo: 1, name: 1 })
            .lean();

        const groupedMap = new Map();

        students.forEach((student) => {
            const busNumber = student.transport?.busNumber || 'Unassigned Bus';
            const route = student.transport?.route || 'Unassigned Route';
            const key = `${busNumber}__${route}`;

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    busNumber,
                    route,
                    studentCount: 0,
                    totalTransportFees: 0,
                    students: []
                });
            }

            const group = groupedMap.get(key);
            group.studentCount += 1;
            group.totalTransportFees += Number(student.transport?.fees || 0) || 0;
            group.students.push(student);
        });

        const transportGroups = Array.from(groupedMap.values()).map((group) => ({
            ...group,
            students: group.students.sort((a, b) => {
                const orderA = Number.isFinite(Number(a.transport?.pickupOrder)) ? Number(a.transport.pickupOrder) : Number.MAX_SAFE_INTEGER;
                const orderB = Number.isFinite(Number(b.transport?.pickupOrder)) ? Number(b.transport.pickupOrder) : Number.MAX_SAFE_INTEGER;
                if (orderA !== orderB) return orderA - orderB;
                return String(a.rollNo || a.name || '').localeCompare(String(b.rollNo || b.name || ''), undefined, { numeric: true });
            })
        })).sort((a, b) => {
            const busCompare = String(a.busNumber).localeCompare(String(b.busNumber), undefined, { numeric: true });
            if (busCompare !== 0) return busCompare;
            return String(a.route).localeCompare(String(b.route), undefined, { numeric: true });
        });

        return res.json({
            success: true,
            session: req.query.session || '',
            transportGroups
        });
    } catch (error) {
        console.error('Transport summary error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching transport summary' });
    }
});

router.patch('/transport/order/:admissionNo', async (req, res) => {
    try {
        const { session, pickupOrder } = req.body;
        const student = await findStudentByAdmissionAndSession(req.params.admissionNo, session);

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        if (!student.transport?.required) {
            return res.status(400).json({ success: false, message: 'Transport is not enabled for this student' });
        }

        const normalizedOrder = Number(pickupOrder);
        if (!Number.isInteger(normalizedOrder) || normalizedOrder < 1) {
            return res.status(400).json({ success: false, message: 'pickupOrder must be a positive integer' });
        }

        student.transport = {
            ...student.transport.toObject(),
            pickupOrder: normalizedOrder
        };

        await student.save();

        return res.json({
            success: true,
            message: 'Transport order updated successfully',
            student
        });
    } catch (error) {
        console.error('Transport order update error:', error);
        return res.status(500).json({ success: false, message: 'Error updating transport order' });
    }
});

// Get all students
router.get('/', async (req, res) => {
    try {
        const query = {};
        if (req.query.session) {
            query.session = req.query.session;
        }
        const students = await Student.find(query);
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ success: false, message: 'Error fetching students' });
    }
});

// Get student by admission number
router.get('/:admissionNo', async (req, res) => {
    try {
        const session = req.query.session;
        const student = await findStudentByAdmissionAndSession(req.params.admissionNo, session);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        res.json({ success: true, student });
    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({ success: false, message: 'Error fetching student' });
    }
});

// Add new student
router.post('/', async (req, res) => {
    try {
        const admissionNo = req.body.studentId || req.body.admissionNo;
        if (!admissionNo || !req.body.session) {
            return res.status(400).json({ success: false, message: 'studentId/admissionNo and session are required' });
        }

        const existingStudent = await Student.findOne({
            studentId: admissionNo,
            session: req.body.session
        });

        if (existingStudent) {
            return res.status(409).json({
                success: false,
                message: 'Student already exists in this session'
            });
        }

        const student = new Student({
            // studentId: req.body.admissionNo,
            studentId: admissionNo,
            name: req.body.name,
            fatherName: req.body.fatherName,
            motherName: req.body.motherName || '',
            dob: req.body.dob,
            gender: req.body.gender,
            admissionDate: req.body.admissionDate,
            address: req.body.address,
            contactNo: req.body.contactNo,
            class: req.body.class,
            section: req.body.section,
            session: req.body.session,
            rollNo: req.body.rollNo,
            tuitionFee: Number(req.body.tuitionFee || 0) || 0,
            transport: buildTransportPayload(req.body.transport)
        });

        await student.save();
        res.status(201).json({ success: true, message: 'Student added successfully' });
    } catch (error) {
        console.error('Add student error:', error);
        res.status(500).json({ success: false, message: 'Error adding student: ' + error.message });
    }
});

// Update student
router.put('/:admissionNo', async (req, res) => {
    try {
        const requestedSession = req.query.session || req.body.session;
        const student = await findStudentByAdmissionAndSession(req.params.admissionNo, requestedSession);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Update student fields
        student.name = req.body.name;
        student.fatherName = req.body.fatherName;
        student.motherName = req.body.motherName || '';
        student.dob = req.body.dob;
        student.gender = req.body.gender;
        student.admissionDate = req.body.admissionDate;
        student.address = req.body.address;
        student.contactNo = req.body.contactNo;
        student.class = req.body.class;
        student.section = req.body.section || student.section;
        student.session = req.body.session || student.session;
        student.rollNo = req.body.rollNo;
        student.tuitionFee = Number(req.body.tuitionFee || 0) || 0;
        
        // Update transport information
        if (req.body.transport) {
            student.transport = buildTransportPayload(req.body.transport);
        }

        await student.save();
        res.json({ success: true, message: 'Student updated successfully' });
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ success: false, message: 'Error updating student: ' + error.message });
    }
});

// Delete student
router.delete('/:admissionNo', async (req, res) => {
    try {
        const session = req.query.session;
        const student = await findStudentByAdmissionAndSession(req.params.admissionNo, session);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        await student.deleteOne();
        res.json({ success: true, message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ success: false, message: 'Error deleting student' });
    }
});

// Promote student
router.put('/:admissionNo/promote', async (req, res) => {
    try {
        const { newClass, newSession, currentSession } = req.body;

        if (!newClass || !newSession) {
            return res.status(400).json({
                success: false,
                message: 'newClass and newSession are required'
            });
        }

        const sourceStudent = await findStudentByAdmissionAndSession(
            req.params.admissionNo,
            currentSession
        );

        if (!sourceStudent) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // If same session is provided, treat it as a class correction.
        if (sourceStudent.session === newSession) {
            sourceStudent.class = newClass;
            await sourceStudent.save();
            return res.json({
                success: true,
                message: 'Student class updated in the same session'
            });
        }

        const targetSessionStudent = await Student.findOne({
            studentId: sourceStudent.studentId,
            session: newSession
        });

        if (targetSessionStudent) {
            targetSessionStudent.class = newClass;
            targetSessionStudent.section = sourceStudent.section;
            targetSessionStudent.transport = sourceStudent.transport;
            targetSessionStudent.rank = null;
            await targetSessionStudent.save();

            return res.json({
                success: true,
                message: 'Student already existed in target session and has been updated'
            });
        }

        const clonedData = sourceStudent.toObject();
        delete clonedData._id;
        delete clonedData.__v;
        delete clonedData.createdAt;
        delete clonedData.updatedAt;

        clonedData.class = newClass;
        clonedData.session = newSession;
        clonedData.rank = null;
        clonedData.exams = {};

        const promotedStudent = new Student(clonedData);
        await promotedStudent.save();

        res.json({
            success: true,
            message: 'Student promoted successfully. Previous session record preserved.'
        });
    } catch (error) {
        console.error('Promote student error:', error);
        res.status(500).json({ success: false, message: 'Error promoting student' });
    }
});

// Bulk promote students session-wise
router.post('/promote-bulk', async (req, res) => {
    try {
        const { currentSession, newSession, fromClass, fromSection, toClass, toSection } = req.body;
        if (!currentSession || !newSession || !fromClass || !toClass) {
            return res.status(400).json({
                success: false,
                message: 'currentSession, newSession, fromClass and toClass are required'
            });
        }

        const sourceQuery = { session: currentSession, class: fromClass };
        if (fromSection) sourceQuery.section = fromSection;
        const sourceStudents = await Student.find(sourceQuery);

        if (!sourceStudents.length) {
            return res.status(404).json({ success: false, message: 'No students found for selected source class/session' });
        }

        let created = 0;
        let updated = 0;

        for (const sourceStudent of sourceStudents) {
            const existingTarget = await Student.findOne({
                studentId: sourceStudent.studentId,
                session: newSession
            });

            if (existingTarget) {
                existingTarget.class = toClass;
                existingTarget.section = toSection || sourceStudent.section;
                existingTarget.transport = sourceStudent.transport;
                existingTarget.rank = null;
                await existingTarget.save();
                updated += 1;
                continue;
            }

            const clonedData = sourceStudent.toObject();
            delete clonedData._id;
            delete clonedData.__v;
            delete clonedData.createdAt;
            delete clonedData.updatedAt;
            clonedData.class = toClass;
            clonedData.section = toSection || sourceStudent.section;
            clonedData.session = newSession;
            clonedData.rank = null;
            clonedData.exams = {};

            const promoted = new Student(clonedData);
            await promoted.save();
            created += 1;
        }

        return res.json({
            success: true,
            message: 'Bulk promotion completed',
            summary: {
                totalSource: sourceStudents.length,
                created,
                updated
            }
        });
    } catch (error) {
        console.error('Bulk promote student error:', error);
        res.status(500).json({ success: false, message: 'Error in bulk promotion' });
    }
});

// Upload/update student photo for a session record
router.put('/:admissionNo/photo', uploadPhoto.single('photo'), async (req, res) => {
    try {
        const session = req.query.session || req.body.session;
        const student = await findStudentByAdmissionAndSession(req.params.admissionNo, session);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Photo file is required' });
        }

        student.photo = await persistStudentPhoto(req, req.file);
        await student.save();

        return res.json({
            success: true,
            message: 'Student photo uploaded successfully',
            photo: student.photo
        });
    } catch (error) {
        console.error('Upload student photo error:', error);
        res.status(500).json({ success: false, message: 'Error uploading photo' });
    }
});

// Update student rank
router.patch('/:id', async (req, res) => {
    try {
        const { rank } = req.body;
        const student = await Student.findByIdAndUpdate(
            req.params.id,
            { $set: { rank } },
            { new: true }
        );
        
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        
        res.json(student);
    } catch (error) {
        console.error('Error updating student rank:', error);
        res.status(500).json({ message: 'Error updating student rank' });
    }
});

// Import students from Excel
router.post('/import', upload.single('file'), async (req, res) => {
    try {
       // console.log('Starting import process...');
        
        if (!req.file) {
            console.log('No file uploaded');
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // console.log('File received:', {
        //     originalname: req.file.originalname,
        //     mimetype: req.file.mimetype,
        //     size: req.file.size
        // });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        //console.log('Workbook sheets:', workbook.SheetNames);
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet, {
            raw: true,
            defval: ''
        });

        // console.log('Parsed Excel data:', {
        //     rowCount: data.length,
        //     sampleRow: data[0]
        // });

        if (!data || data.length === 0) {
            console.log('Excel file is empty');
            return res.status(400).json({ success: false, message: 'Excel file is empty' });
        }

        const session = req.body.session;
       // console.log('Session:', session);
        
        if (!session) {
            console.log('Session is missing');
            return res.status(400).json({ success: false, message: 'Session is required' });
        }

        let importedCount = 0;
        const errors = [];

        for (const [index, row] of data.entries()) {
            try {
                const excelRowNumber = index + 2;
                
                const admissionNo = normalizeStringValue(row['Admission No']);
                const studentName = normalizeStringValue(row['Student Name']);
                const className = normalizeStringValue(row['Class']);
                const fatherName = normalizeStringValue(row['Father Name']);
                const motherName = normalizeStringValue(row['Mother Name']);
                const dob = normalizeExcelDate(row['Date of Birth']);
                const admissionDate = normalizeExcelDate(row['Admission Date'], new Date());
                const transportRequired = normalizeBooleanFromYesNo(row['Transport Required']);

                if (!admissionNo || !studentName || !className || !fatherName || !dob) {
                    const error = `Row ${excelRowNumber}: Admission No, Student Name, Father Name, Class, and a valid Date of Birth are required.`;
                    console.log(error);
                    errors.push(error);
                    continue;
                }

                // Check if student already exists
                const existingStudent = await Student.findOne({
                    studentId: admissionNo,
                    session: session
                });
                if (existingStudent) {
                    const error = `Row ${excelRowNumber}: Student with Admission No ${admissionNo} already exists in session ${session}`;
                    console.log(error);
                    errors.push(error);
                    continue;
                }

                const studentData = {
                    studentId: admissionNo,
                    name: studentName,
                    fatherName,
                    motherName,
                    dob,
                    gender: normalizeStringValue(row['Gender'], 'Male'),
                    admissionDate,
                    address: normalizeStringValue(row['Address']),
                    contactNo: normalizeStringValue(row['Contact No']),
                    class: className,
                    section: normalizeStringValue(row['Section'], 'A'),
                    session: session,
                    rollNo: normalizeStringValue(row['Roll No']),
                    tuitionFee: normalizeNumericValue(row['Tuition Fee'], 0),
                    transport: buildTransportPayload({
                        required: transportRequired,
                        fees: normalizeNumericValue(row['Transport Fees'], 0),
                        startDate: normalizeExcelDate(row['Transport Start Date']),
                        busNumber: normalizeStringValue(row['Bus Number']),
                        pickupPoint: normalizeStringValue(row['Pickup Point']),
                        route: normalizeStringValue(row['Route']),
                        pickupOrder: normalizeNumericValue(row['Pickup Order'], null)
                    })
                };

               // console.log('Creating student:', studentData);
                const student = new Student(studentData);
                await student.save();
                //console.log('Student saved successfully');
                importedCount++;
            } catch (error) {
                const errorMsg = `Row ${index + 2}: ${error.message}`;
                console.error(errorMsg);
                errors.push(errorMsg);
            }
        }

        // console.log('Import completed:', {
        //     importedCount,
        //     errorCount: errors.length
        // });

        res.json({
            success: true,
            importedCount,
            errors: errors.length > 0 ? errors : undefined,
            message: `Successfully imported ${importedCount} students${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, message: 'Error importing students: ' + error.message });
    }
});

module.exports = router;
