const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');

function requireAdmin(req, res) {
    if (req.user.role !== 'admin') {
        res.status(403).json({ message: 'Access denied' });
        return false;
    }
    return true;
}

function sanitizeUser(user) {
    if (!user) return null;
    const plain = typeof user.toObject === 'function' ? user.toObject() : user;
    delete plain.password;
    return plain;
}

async function countActiveAdmins(excludeUserId = null) {
    const filter = { role: 'admin', isActive: { $ne: false } };
    if (excludeUserId) {
        filter._id = { $ne: excludeUserId };
    }
    return User.countDocuments(filter);
}

// Get all users (admin only)
router.get('/', auth, async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const users = await User.find({}, '-password').sort({ role: 1, firstName: 1, lastName: 1, username: 1 });
        res.json(users);
    } catch (error) {
        console.error('Get all users error:', error); // Debug log
        res.status(500).json({ message: error.message });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        console.log('User from token:', req.user); // Debug log
        const user = await User.findById(req.user.userId, '-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            username: user.username,
            role: user.role
        });
    } catch (error) {
        console.error('Profile error:', error); // Debug log
        res.status(500).json({ message: error.message });
    }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { firstName, lastName, email } = req.body;
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.email = email || user.email;

        await user.save();
        res.json({ 
            message: 'Profile updated successfully', 
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Update error:', error); // Debug log
        res.status(500).json({ message: error.message });
    }
});

// Get one user (admin only)
router.get('/:id', auth, async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const user = await User.findById(req.params.id, '-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Create new user (admin only)
router.post('/', auth, async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const { firstName, lastName, email, username, password, role } = req.body;
        if (!firstName || !lastName || !email || !username || !password) {
            return res.status(400).json({ message: 'First name, last name, email, username and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        
        const userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists with this email or username' });
        }

        const user = new User({
            firstName,
            lastName,
            email,
            username,
            password,
            role
        });

        await user.save();
        res.status(201).json({ 
            message: 'User created successfully', 
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Create user error:', error); // Debug log
        res.status(500).json({ message: error.message });
    }
});

// Update user (admin only)
router.put('/:id', auth, async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const { firstName, lastName, email, role, isActive } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const nextRole = role || user.role;
        const nextIsActive = isActive !== undefined ? !!isActive : user.isActive;
        if (user.role === 'admin' && (nextRole !== 'admin' || !nextIsActive)) {
            const remainingAdmins = await countActiveAdmins(user._id);
            if (remainingAdmins < 1) {
                return res.status(400).json({ message: 'At least one active admin user is required' });
            }
        }

        if (email && email !== user.email) {
            const duplicateEmail = await User.findOne({ email, _id: { $ne: user._id } });
            if (duplicateEmail) {
                return res.status(400).json({ message: 'Email is already used by another user' });
            }
        }

        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.email = email || user.email;
        user.role = nextRole;
        user.isActive = nextIsActive;

        await user.save();
        res.json({ 
            message: 'User updated successfully', 
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('Update user error:', error); // Debug log
        res.status(500).json({ message: error.message });
    }
});

// Change user password (admin only)
router.put('/:id/password', auth, async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { password } = req.body;
        if (!password || String(password).length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = String(password);
        await user.save();
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Block or unblock user (admin only)
router.put('/:id/status', auth, async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const nextIsActive = req.body.isActive !== undefined ? !!req.body.isActive : !user.isActive;
        if (user.role === 'admin' && !nextIsActive) {
            const remainingAdmins = await countActiveAdmins(user._id);
            if (remainingAdmins < 1) {
                return res.status(400).json({ message: 'At least one active admin user is required' });
            }
        }

        user.isActive = nextIsActive;
        await user.save();
        res.json({
            message: user.isActive ? 'User unblocked successfully' : 'User blocked successfully',
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('User status error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Delete user (admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'admin') {
            const remainingAdmins = await countActiveAdmins(user._id);
            if (remainingAdmins < 1) {
                return res.status(400).json({ message: 'At least one active admin user is required' });
            }
        }

        await user.deleteOne();
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error); // Debug log
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
