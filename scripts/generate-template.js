const xlsx = require('xlsx');
const path = require('path');

// Create a new workbook
const wb = xlsx.utils.book_new();

// Define the headers
const headers = [
    'Admission No',
    'Student Name',
    'Class',
    'Father Name',
    'Date of Birth',
    'Gender',
    'Admission Date',
    'Address',
    'Contact No',
    'Section',
    'Transport Required',
    'Transport Fees',
    'Transport Start Date',
    'Bus Number',
    'Pickup Point',
    'Route'
];

// Create sample data
const sampleData = [
    {
        'Admission No': 'SV2024001',
        'Student Name': 'John Doe',
        'Class': '1',
        'Father Name': 'James Doe',
        'Date of Birth': '2018-01-01',
        'Gender': 'Male',
        'Admission Date': '2024-01-01',
        'Address': '123 Main St',
        'Contact No': '9876543210',
        'Section': 'A',
        'Transport Required': 'Yes',
        'Transport Fees': '1000',
        'Transport Start Date': '2024-01-01',
        'Bus Number': 'B001',
        'Pickup Point': 'Main Gate',
        'Route': 'Route 1'
    }
];

// Create worksheet
const ws = xlsx.utils.json_to_sheet(sampleData, { header: headers });

// Set column widths
const colWidths = headers.map(header => ({ wch: Math.max(header.length, 15) }));
ws['!cols'] = colWidths;

// Add the worksheet to the workbook
xlsx.utils.book_append_sheet(wb, ws, 'Students');

// Write to file
const templatePath = path.join(__dirname, '..', '..', 'skyview-client', 'assets', 'templates', 'student_import_template.xlsx');
xlsx.writeFile(wb, templatePath);

console.log('Template created successfully at:', templatePath);
