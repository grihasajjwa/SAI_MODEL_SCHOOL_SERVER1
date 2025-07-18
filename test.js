const fetch = require('node-fetch');

async function testAPI() {
    try {
        // Create admin user if it doesn't exist
        const signupResponse = await fetch('http://localhost:5000/api/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName: 'Test',
                lastName: 'Admin',
                email: 'testadmin2@skyview.com',
                username: 'testadmin2',
                password: 'admin123',
                role: 'admin'
            })
        });
        
        const signupData = await signupResponse.json();
        console.log('Signup response:', signupData);

        // Login
        const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'testadmin2',
                password: 'admin123'
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('Login response:', loginData);
        
        if (!loginData.token) {
            console.error('Login failed');
            return;
        }

        // Test creating a class
        const createClassResponse = await fetch('http://localhost:5000/api/classes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginData.token}`
            },
            body: JSON.stringify({
                className: 'Test Class 2',
                section: 'B',
                academicYear: '2023-2024',
                subjects: [{
                    name: 'Math',
                    teacher: 'John Doe'
                }]
            })
        });
        
        const createClassData = await createClassResponse.json();
        console.log('Create class response:', createClassData);

        // Test getting the created class
        const getClassResponse = await fetch(`http://localhost:5000/api/classes/${createClassData._id}`, {
            headers: {
                'Authorization': `Bearer ${loginData.token}`
            }
        });
        
        const getClassData = await getClassResponse.json();
        console.log('Get class response:', getClassData);

        // Test getting all classes
        const getClassesResponse = await fetch('http://localhost:5000/api/classes', {
            headers: {
                'Authorization': `Bearer ${loginData.token}`
            }
        });
        
        const getClassesData = await getClassesResponse.json();
        console.log('Get classes response:', getClassesData);
    } catch (error) {
        console.error('Error:', error);
    }
}

testAPI();
