const nodemailer = require('nodemailer');
const { promisify } = require('util');
const ejs = require('ejs');
const path = require('path');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendEmail(options) {
    try {
      const template = await ejs.renderFile(
        path.join(__dirname, `../templates/emails/${options.template}.ejs`),
        options.data
      );

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: template
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      logger.error('Email sending error:', error);
      throw error;
    }
  }

  async sendBookingConfirmation(booking) {
    await this.sendEmail({
      template: 'booking-confirmation',
      to: booking.user.email,
      subject: 'Booking Confirmation',
      data: { booking }
    });
  }

  async sendWelcomeEmail(professional) {
    await this.sendEmail({
      template: 'welcome-professional',
      to: professional.email,
      subject: 'Welcome to Our Platform',
      data: { 
        name: professional.name, 
        dashboardUrl: process.env.DASHBOARD_URL || 'https://yourplatform.com/dashboard'
      }
    });
  }

  async sendProfessionalNotification(professional, booking) {
    await this.sendEmail({
      template: 'new-booking',
      to: professional.email,
      subject: 'New Booking Request',
      data: { booking, professional }
    });
  }
}

module.exports = EmailService;
