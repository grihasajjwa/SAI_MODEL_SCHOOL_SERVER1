const mongoose = require('mongoose');

const schoolProfileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        default: 'Skyview Public School'
    },
    shortName: {
        type: String,
        trim: true,
        default: 'SKYVIEW'
    },
    tagline: {
        type: String,
        trim: true,
        default: '(An English Medium school based on CBSE curriculum)'
    },
    addressLine1: {
        type: String,
        trim: true,
        default: 'Uttar Andaranfulbari, Tufanganj, Coochbehar, West Bengal, India, PIN: 736159'
    },
    addressLine2: {
        type: String,
        trim: true,
        default: ''
    },
    phone: {
        type: String,
        trim: true,
        default: '+91-86535-54323'
    },
    email: {
        type: String,
        trim: true,
        default: 'skyviewpublicschool@gmail.com'
    },
    website: {
        type: String,
        trim: true,
        default: 'www.skyviewpublicschool.in'
    },
    logo: {
        type: String,
        trim: true,
        default: '/assets/images/logo1.png'
    },
    watermarkText: {
        type: String,
        trim: true,
        default: 'SKYVIEW PUBLIC SCHOOL'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SchoolProfile', schoolProfileSchema);
