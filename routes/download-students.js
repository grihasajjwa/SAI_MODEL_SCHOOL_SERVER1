const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const ExcelJS = require('exceljs');

router.get('/download', async (req, res) => {
    try {
        const students = await Student.find(); // Fetch all students
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Students');

        // Define columns
        worksheet.columns = [
            { header: 'Student ID', key: 'studentId', width: 15 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Father Name', key: 'fatherName', width: 30 },
            { header: 'Date of Birth', key: 'dob', width: 15 },
            { header: 'Gender', key: 'gender', width: 15 },
            { header: 'Admission Date', key: 'admissionDate', width: 15 },
            { header: 'Class', key: 'class', width: 15 },
            { header: 'Section', key: 'section', width: 15 },
            { header: 'Address', key: 'address', width: 35, wrapText: true, style: { alignment: { wrapText: true } } },
            { header: 'Transport Required', key: 'transportRequired', width: 15 },
            { header: 'Transport Fees', key: 'transportFees', width: 15 },
            { header: 'Transport Start Date', key: 'transportStartDate', width: 15 },
            { header: 'Bus Number', key: 'busNumber', width: 15 },
            { header: 'Pickup Point', key: 'pickupPoint', width: 15 },
            { header: 'Route', key: 'route', width: 15 },
            // Add other headers as needed
        ];

        // Add rows
        students.forEach(student => {
          const row =  worksheet.addRow({
                studentId: student.studentId,
                name: student.name,
                fatherName: student.fatherName,
                dob: student.dob,
                gender: student.gender,
                admissionDate: student.admissionDate,
                class: student.class,
                section: student.section,
                address: student.address,
                transportRequired: student.transportRequired,
                transportFees: student.transportFees,
                transportStartDate: student.transportStartDate,
                busNumber: student.busNumber,
                pickupPoint: student.pickupPoint,
                route: student.route,
                // Add other fields as needed
            });
            // Automatically adjust row height based on content
            row.height = Math.max(30, row.values.reduce((maxHeight, value) => {
                // Calculate height based on content length
                return Math.max(maxHeight, value ? value.toString().length : 0);
            }, 0) * 1.5); // Adjust the multiplier as needed for height
        });

        // Set the response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error downloading students data:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
