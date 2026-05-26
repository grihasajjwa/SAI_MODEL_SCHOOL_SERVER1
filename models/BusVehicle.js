const mongoose = require('mongoose');

const busVehicleSchema = new mongoose.Schema({
    vehicleNumber: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('BusVehicle', busVehicleSchema);
