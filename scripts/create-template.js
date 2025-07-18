const XLSX = require('xlsx');
const path = require('path');

// Create workbook
const wb = XLSX.utils.book_new();

// Sample data
const headers = [
    'Student ID',
    'Name',
    'Father\'s Name',
    'Date of Birth',
    'Gender',
    'Admission Date',
    'Class',
    'Section',
    'Contact No',
    'Address'
];

const sampleData = [
    '2024001',
    'John Doe',
    'Richard Doe',
    '2018-01-01',
    'Male',
    '2024-01-01',
    '1',
    'A',
    '1234567890',
    '123 Main St'
];

// Create worksheet
const ws = XLSX.utils.aoa_to_sheet([headers, sampleData]);

// Set column widths
const colWidths = [
    { wch: 12 }, // Student ID
    { wch: 20 }, // Name
    { wch: 20 }, // Father's Name
    { wch: 12 }, // Date of Birth
    { wch: 10 }, // Gender
    { wch: 12 }, // Admission Date
    { wch: 8 },  // Class
    { wch: 8 },  // Section
    { wch: 15 }, // Contact No
    { wch: 30 }  // Address
];

ws['!cols'] = colWidths;

// Add the worksheet to the workbook
XLSX.utils.book_append_sheet(wb, ws, 'Students');

// Write to file
const templatePath = path.join(__dirname, '..', '..', 'skyview-client', 'assets', 'templates', 'student_import_template.xlsx');
XLSX.writeFile(wb, templatePath);

console.log('Template created successfully at:', templatePath);
