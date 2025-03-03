const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting']
    },
    description: {
        type: String,
        trim: true
    },
    pricing: {
        basePrice: {
            type: Number,
            required: true,
            min: 0
        },
        pricingModel: {
            type: String,
            enum: ['fixed', 'hourly', 'per_unit', 'custom'],
            default: 'fixed'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);