const xlsx = require('xlsx');
const path = require('path');

const headers = [
    'Admission No',
    'Student Name',
    'Father Name',
    'Date of Birth',
    'Gender',
    'Admission Date',
    'Class',
    'Section',
    'Roll No',
    'Contact No',
    'Address',
    'Tuition Fee',
    'Transport Required',
    'Transport Fees',
    'Transport Start Date',
    'Bus Number',
    'Pickup Point',
    'Route',
    'Pickup Order'
];

const sampleRows = [
    {
        'Admission No': 'SV2024001',
        'Student Name': 'John Doe',
        'Father Name': 'James Doe',
        'Date of Birth': new Date('2018-01-15'),
        'Gender': 'Male',
        'Admission Date': new Date('2024-04-10'),
        'Class': 'I',
        'Section': 'A',
        'Roll No': '1',
        'Contact No': '9876543210',
        'Address': '123 Main St',
        'Tuition Fee': 1200,
        'Transport Required': 'Yes',
        'Transport Fees': 900,
        'Transport Start Date': new Date('2024-04-15'),
        'Bus Number': 'B001',
        'Pickup Point': 'Main Gate',
        'Route': 'Route 1',
        'Pickup Order': 1
    },
    {
        'Admission No': 'SV2024002',
        'Student Name': 'Jane Smith',
        'Father Name': 'Robert Smith',
        'Date of Birth': new Date('2017-08-20'),
        'Gender': 'Female',
        'Admission Date': new Date('2024-04-10'),
        'Class': 'I',
        'Section': 'A',
        'Roll No': '2',
        'Contact No': '9123456780',
        'Address': '45 Lake View',
        'Tuition Fee': 1500,
        'Transport Required': 'No',
        'Transport Fees': '',
        'Transport Start Date': '',
        'Bus Number': '',
        'Pickup Point': '',
        'Route': '',
        'Pickup Order': ''
    }
];

const workbook = xlsx.utils.book_new();
const worksheet = xlsx.utils.json_to_sheet(sampleRows, {
    header: headers,
    dateNF: 'yyyy-mm-dd'
});

worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 2, 16) }));

for (let rowIndex = 2; rowIndex <= sampleRows.length + 1; rowIndex += 1) {
    ['D', 'F', 'O'].forEach((column) => {
        const cellRef = `${column}${rowIndex}`;
        if (worksheet[cellRef]) {
            worksheet[cellRef].z = 'yyyy-mm-dd';
        }
    });
}

xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');

const templatePath = path.join(__dirname, '..', '..', 'client', 'assets', 'templates', 'student_import_template.xlsx');
xlsx.writeFile(workbook, templatePath);

console.log('Template created successfully at:', templatePath);
