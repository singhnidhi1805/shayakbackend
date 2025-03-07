const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet'],
    required: true
  },
  transactionId: String,
  paymentGatewayResponse: Object,
  refundDetails: {
    amount: Number,
    reason: String,
    transactionId: String,
    processedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
