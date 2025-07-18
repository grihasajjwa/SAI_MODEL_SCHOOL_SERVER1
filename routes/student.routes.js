const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const Student = require('../models/Student');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Get all students
router.get('/', async (req, res) => {
    try {
        const students = await Student.find();
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ success: false, message: 'Error fetching students' });
    }
});

// Get student by admission number
router.get('/:admissionNo', async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.admissionNo });
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
        const student = new Student({
            // studentId: req.body.admissionNo,
            studentId: req.body.studentId,
            name: req.body.name,
            fatherName: req.body.fatherName,
            dob: req.body.dob,
            gender: req.body.gender,
            admissionDate: req.body.admissionDate,
            address: req.body.address,
            contactNo: req.body.contactNo,
            class: req.body.class,
            section: req.body.section,
            session: req.body.session,
              rollNo: req.body.rollNo,
            transport: {
                required: req.body.transport?.required || false,
                fees: req.body.transport?.required ? req.body.transport.fees : null,
                startDate: req.body.transport?.required ? req.body.transport.startDate : null,
                busNumber: req.body.transport?.required ? req.body.transport.busNumber : null,
                pickupPoint: req.body.transport?.required ? req.body.transport.pickupPoint : null,
                route: req.body.transport?.required ? req.body.transport.route : null
            }
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
        const student = await Student.findOne({ studentId: req.params.admissionNo });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Update student fields
        student.name = req.body.name;
        student.fatherName = req.body.fatherName;
        student.dob = req.body.dob;
        student.gender = req.body.gender;
        student.admissionDate = req.body.admissionDate;
        student.address = req.body.address;
        student.contactNo = req.body.contactNo;
        student.class = req.body.class;
        student.section = req.body.section || student.section;
        student.session = req.body.session || student.session;
         student.rollNo = req.body.rollNo;
        
        // Update transport information
        if (req.body.transport) {
            student.transport = {
                required: req.body.transport.required,
                fees: req.body.transport.required ? req.body.transport.fees : null,
                startDate: req.body.transport.required ? req.body.transport.startDate : null,
                busNumber: req.body.transport.required ? req.body.transport.busNumber : null,
                pickupPoint: req.body.transport.required ? req.body.transport.pickupPoint : null,
                route: req.body.transport.required ? req.body.transport.route : null
            };
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
        const result = await Student.deleteOne({ studentId: req.params.admissionNo });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        res.json({ success: true, message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ success: false, message: 'Error deleting student' });
    }
});

// Promote student
router.put('/:admissionNo/promote', async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.admissionNo });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        student.class = req.body.newClass;
        student.session = req.body.newSession;
        await student.save();

        res.json({ success: true, message: 'Student promoted successfully' });
    } catch (error) {
        console.error('Promote student error:', error);
        res.status(500).json({ success: false, message: 'Error promoting student' });
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

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        //console.log('Workbook sheets:', workbook.SheetNames);
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

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

        for (const row of data) {
            try {
               // console.log('Processing row:', row);
                
                if (!row['Admission No'] || !row['Student Name'] || !row['Class']) {
                    const error = `Row ${importedCount + 1}: Missing required fields. Found: ${Object.keys(row).join(', ')}`;
                    console.log(error);
                    errors.push(error);
                    continue;
                }

                // Check if student already exists
                const existingStudent = await Student.findOne({ studentId: row['Admission No'] });
                if (existingStudent) {
                    const error = `Row ${importedCount + 1}: Student with Admission No ${row['Admission No']} already exists`;
                    console.log(error);
                    errors.push(error);
                    continue;
                }

                const studentData = {
                    studentId: row['Admission No'],
                    name: row['Student Name'],
                    fatherName: row['Father Name'] || '',
                    dob: row['Date of Birth'] || null,
                    gender: row['Gender'] || 'Male',
                    admissionDate: row['Admission Date'] || new Date(),
                    address: row['Address'] || '',
                    contactNo: row['Contact No'] || '',
                    class: row['Class'],
                    section: row['Section'] || 'A',
                    session: session,
                    transport: {
                        required: row['Transport Required']?.toLowerCase() === 'yes',
                        fees: row['Transport Fees'] || null,
                        startDate: row['Transport Start Date'] || null,
                        busNumber: row['Bus Number'] || null,
                        pickupPoint: row['Pickup Point'] || null,
                        route: row['Route'] || null
                    }
                };

               // console.log('Creating student:', studentData);
                const student = new Student(studentData);
                await student.save();
                //console.log('Student saved successfully');
                importedCount++;
            } catch (error) {
                const errorMsg = `Row ${importedCount + 1}: ${error.message}`;
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
