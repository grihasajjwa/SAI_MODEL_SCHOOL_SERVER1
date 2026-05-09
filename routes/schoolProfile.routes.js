const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const auth = require('../middleware/auth');
const SchoolProfile = require('../models/SchoolProfile');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'school-profile');
const isServerless = !!process.env.VERCEL;
const hasCloudinaryConfig = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/svg+xml'];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Only image files are allowed (jpg, jpeg, png, webp, svg)'));
        }
        cb(null, true);
    }
});

function buildLocalFileName(file, prefix) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    return `${prefix}-${Date.now()}${ext}`;
}

function uploadBufferToCloudinary(file, folder, publicIdPrefix) {
    return new Promise((resolve, reject) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
        const publicId = `${publicIdPrefix}-${Date.now()}`;
        const resourceType = file.mimetype === 'image/svg+xml' ? 'raw' : 'image';

        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: publicId,
                resource_type: resourceType,
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

async function persistSchoolLogo(file) {
    if (hasCloudinaryConfig) {
        const result = await uploadBufferToCloudinary(file, 'skyview/school-profile', 'school-logo');
        return { path: result.secure_url, storage: 'cloudinary' };
    }

    if (isServerless) {
        throw new Error('Logo upload requires Cloudinary configuration on Vercel.');
    }

    await fs.promises.mkdir(uploadDir, { recursive: true });
    const fileName = buildLocalFileName(file, 'school-logo');
    const targetPath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(targetPath, file.buffer);
    return { path: `/uploads/school-profile/${fileName}`, storage: 'local' };
}

const DEFAULT_PROFILE = {
    name: 'Skyview Public School',
    shortName: 'SKYVIEW',
    tagline: '(An English Medium school based on CBSE curriculum)',
    addressLine1: 'Uttar Andaranfulbari, Tufanganj, Coochbehar, West Bengal, India, PIN: 736159',
    addressLine2: '',
    phone: '+91-86535-54323',
    email: 'skyviewpublicschool@gmail.com',
    website: 'www.skyviewpublicschool.in',
    logo: '/assets/images/logo1.png',
    watermarkText: 'SKYVIEW PUBLIC SCHOOL'
};

async function getOrCreateSchoolProfile() {
    let profile = await SchoolProfile.findOne();
    if (!profile) {
        profile = await SchoolProfile.create(DEFAULT_PROFILE);
    }
    return profile;
}

router.get('/', async (req, res) => {
    try {
        const profile = await getOrCreateSchoolProfile();
        res.json({ success: true, profile });
    } catch (error) {
        console.error('School profile fetch error:', error);
        res.status(500).json({ success: false, message: 'Error fetching school profile' });
    }
});

router.put('/', auth, upload.single('logoFile'), async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const profile = await getOrCreateSchoolProfile();
        const fields = ['name', 'shortName', 'tagline', 'addressLine1', 'addressLine2', 'phone', 'email', 'website', 'watermarkText'];

        fields.forEach((field) => {
            if (req.body[field] !== undefined) {
                profile[field] = String(req.body[field] || '').trim();
            }
        });

        if (req.file) {
            if (isServerless && !hasCloudinaryConfig) {
                return res.status(400).json({
                    success: false,
                    message: 'Logo upload requires Cloudinary configuration on Vercel.'
                });
            }

            if (hasCloudinaryConfig && profile.logo && /^https?:\/\//i.test(profile.logo)) {
                const segments = profile.logo.split('/');
                const lastSegment = segments[segments.length - 1] || '';
                const publicId = lastSegment.replace(/\.[^.]+$/, '');
                cloudinary.uploader.destroy(`skyview/school-profile/${publicId}`).catch(() => {});
            } else if (profile.logo && profile.logo.startsWith('/uploads/school-profile/')) {
                const previousLogoPath = path.join(__dirname, '..', profile.logo.replace(/^\//, ''));
                fs.promises.unlink(previousLogoPath).catch(() => {});
            }

            const storedLogo = await persistSchoolLogo(req.file);
            profile.logo = storedLogo.path;
        }

        if (!profile.name) {
            return res.status(400).json({ success: false, message: 'School name is required' });
        }

        if (!profile.shortName) {
            profile.shortName = profile.name;
        }

        if (!profile.watermarkText) {
            profile.watermarkText = profile.name.toUpperCase();
        }

        await profile.save();

        res.json({
            success: true,
            message: 'School profile updated successfully',
            profile
        });
    } catch (error) {
        console.error('School profile update error:', error);
        const status = error.message && (
            error.message.includes('Cloudinary') ||
            error.message.includes('Only image files are allowed') ||
            error.message.includes('School name is required')
        ) ? 400 : 500;

        res.status(status).json({
            success: false,
            message: error.message || 'Error updating school profile'
        });
    }
});

module.exports = router;
