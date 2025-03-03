const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        unique: true
    },
    status: {
        type: String,
        enum: ['registration_pending', 'document_pending', 'under_review', 'rejected', 'verified', 'suspended', 'inactive'],
        default: 'registration_pending'
    },
    specializations: {
        type: [String],
        required: true,
        enum: ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting']
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true,
            default: [77.5946, 12.9716]
        }
    }
}, {
    timestamps: true
});

// Indexes
professionalSchema.index({ "currentLocation": "2dsphere" });
professionalSchema.index({ "specializations": 1 });
professionalSchema.index({ "status": 1 });
professionalSchema.index({ "isAvailable": 1 });

// Ensure indexes are created
professionalSchema.post('save', async function() {
    try {
        await this.collection.createIndex({ "currentLocation": "2dsphere" });
    } catch (error) {
        console.error('Error creating index:', error);
    }
});

const Professional = mongoose.model('Professional', professionalSchema);
module.exports = Professional;