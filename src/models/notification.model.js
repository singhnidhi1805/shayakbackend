const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['booking_request', 'booking_confirmation', 'booking_cancellation', 
             'document_verification', 'payment_success', 'review_received',
             'location_update', 'service_reminder', 'promotional'],
      required: true
    },
    title: String,
    message: String,
    data: Object,
    read: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  // File: src/services/notification.service.js
  const admin = require('firebase-admin');
  const Notification = require('../models/notification.model');
  const User = require('../models/user.model');
  
  const sendNotification = async (userId, type, data) => {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');
  
      // Create notification in database
      const notification = await Notification.create({
        recipient: userId,
        type,
        title: getNotificationTitle(type),
        message: getNotificationMessage(type, data),
        data
      });
  
      // Send push notification if device token exists
      if (user.deviceToken) {
        await admin.messaging().send({
          token: user.deviceToken,
          notification: {
            title: notification.title,
            body: notification.message
          },
          data: {
            type: notification.type,
            id: notification._id.toString()
          }
        });
      }
  
      // Send email notification
      await sendEmailNotification(user.email, notification);
  
      return notification;
    } catch (error) {
      console.error('Notification error:', error);
      throw error;
    }
  };
  