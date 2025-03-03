const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Service = require('../models/service.model');
const Professional = require('../models/professional.model');
const NotificationService = require('../services/notification.service');
const logger = require('../config/logger');

class BookingController {
    // Create a new booking
    async createBooking(req, res) {
      try {
          console.log('Creating booking with data:', req.body);
          const { serviceId, location, scheduledDate } = req.body;

          // Basic validation
          if (!serviceId || !location?.coordinates || !scheduledDate) {
              res.status(400).json({
                  status: 'error',
                  message: 'Missing required fields'
              });
              return;
          }

          // Get service
          const service = await Service.findById(serviceId);
          if (!service) {
              res.status(404).json({
                  status: 'error',
                  message: 'Service not found'
              });
              return;
          }

          // Create booking first
          const booking = new Booking({
              user: req.user._id,
              service: serviceId,
              location: {
                  type: 'Point',
                  coordinates: location.coordinates
              },
              scheduledDate: new Date(scheduledDate),
              status: 'pending',
              totalAmount: service.pricing.basePrice,
              verificationCode: Math.floor(100000 + Math.random() * 900000)
          });

          // Save booking
          const savedBooking = await booking.save();

          // Find professionals (basic query first)
          const professionals = await Professional.find({
              specializations: service.category,
              status: 'verified',
              isAvailable: true
          })
          .select('name phone')
          .limit(5);

          // Send response
          res.status(201).json({
              status: 'success',
              data: {
                  booking: {
                      _id: savedBooking._id,
                      status: savedBooking.status,
                      scheduledDate: savedBooking.scheduledDate,
                      totalAmount: savedBooking.totalAmount,
                      service: {
                          _id: service._id,
                          name: service.name,
                          category: service.category
                      }
                  },
                  availableProfessionals: professionals.length
              }
          });

      } catch (error) {
          console.error('Booking creation error:', error);
          res.status(500).json({
              status: 'error',
              message: 'Internal server error',
              error: error.message
          });
      }
  }

    // Professional accepts booking
    async acceptBooking(req, res) {
      try {
          const booking = await Booking.findById(req.params.bookingId);
          
          if (!booking) {
              res.status(404).json({
                  status: 'error',
                  message: 'Booking not found'
              });
              return;
          }

          if (booking.status !== 'pending') {
              res.status(400).json({
                  status: 'error',
                  message: 'Booking already processed'
              });
              return;
          }

          booking.professional = req.user._id;
          booking.status = 'accepted';
          await booking.save();

          await Professional.findByIdAndUpdate(
              req.user._id,
              { isAvailable: false },
              { new: true }
          );

          res.json({
              status: 'success',
              data: {
                  booking: {
                      _id: booking._id,
                      status: booking.status,
                      scheduledDate: booking.scheduledDate
                  }
              }
          });

      } catch (error) {
          console.error('Accept booking error:', error);
          res.status(500).json({
              status: 'error',
              message: 'Failed to accept booking'
          });
      }
  }


    // Get active booking
    async getActiveBooking(req, res) {
      try {
          const booking = await Booking.findOne({
              user: req.user._id,
              status: { $in: ['pending', 'accepted', 'in_progress'] }
          })
          .populate('service', 'name category pricing')
          .lean();

          if (!booking) {
              res.status(404).json({
                  status: 'error',
                  message: 'No active booking found'
              });
              return;
          }

          res.json({
              status: 'success',
              data: { booking }
          });

      } catch (error) {
          console.error('Get active booking error:', error);
          res.status(500).json({
              status: 'error',
              message: 'Failed to get active booking'
          });
      }
  }

    // Get booking history
    async getBookingHistory(req, res) {
      try {
          const bookings = await Booking.find({
              user: req.user._id
          })
          .populate('service')
          .populate('professional', 'name phone')
          .sort({ createdAt: -1 })
          .limit(10);

          return res.json({
              success: true,
              bookings
          });

      } catch (error) {
          logger.error('Get booking history failed:', error);
          return res.status(500).json({ error: 'Failed to get booking history' });
      }
  }

  // Complete booking
  async completeBooking(req, res) {
      try {
          const { verificationCode } = req.body;
          const booking = await Booking.findById(req.params.bookingId);

          if (!booking) {
              return res.status(404).json({ error: 'Booking not found' });
          }

          if (booking.verificationCode !== verificationCode) {
              return res.status(400).json({ error: 'Invalid verification code' });
          }

          booking.status = 'completed';
          booking.completedAt = new Date();
          await booking.save();

          await Professional.findByIdAndUpdate(booking.professional, {
              isAvailable: true,
              $unset: { currentBooking: 1 }
          });

          return res.json({
              success: true,
              message: 'Booking completed successfully'
          });

      } catch (error) {
          logger.error('Complete booking failed:', error);
          return res.status(500).json({ error: 'Failed to complete booking' });
      }
  }

    // Get tracking info
    async getTrackingInfo(req, res) {
        try {
            const booking = await Booking.findById(req.params.bookingId)
                .populate('professional', 'name phone currentLocation');

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            // Calculate ETA if professional is assigned
            let eta = null;
            if (booking.professional?.currentLocation) {
                const distance = this.calculateDistance(
                    booking.professional.currentLocation.coordinates,
                    booking.location.coordinates
                );
                // Assume average speed of 30 km/h
                eta = Math.round((distance / 30) * 60);
            }

            res.json({
                success: true,
                tracking: {
                    status: booking.status,
                    professionalLocation: booking.professional?.currentLocation,
                    destination: booking.location,
                    eta // in minutes
                }
            });

        } catch (error) {
            logger.error('Get tracking info failed:', error);
            res.status(500).json({ error: 'Failed to get tracking info' });
        }
    }

    // Complete booking
    async completeBooking(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { verificationCode } = req.body;
            const booking = await Booking.findById(req.params.bookingId);

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            if (booking.verificationCode !== verificationCode) {
                return res.status(400).json({ error: 'Invalid verification code' });
            }

            booking.status = 'completed';
            booking.completedAt = new Date();
            await booking.save({ session });

            // Update professional status
            await Professional.findByIdAndUpdate(
                booking.professional,
                {
                    isAvailable: true,
                    $unset: { currentBooking: 1 }
                },
                { session }
            );

            // Notify both parties
            await Promise.all([
                NotificationService.sendPushNotification(booking.user, {
                    type: 'BOOKING_COMPLETED',
                    bookingId: booking._id
                }),
                NotificationService.sendPushNotification(booking.professional, {
                    type: 'BOOKING_COMPLETED',
                    bookingId: booking._id
                })
            ]);

            await session.commitTransaction();

            res.json({
                success: true,
                message: 'Booking completed successfully',
                booking: {
                    _id: booking._id,
                    status: booking.status,
                    completedAt: booking.completedAt
                }
            });

        } catch (error) {
            await session.abortTransaction();
            logger.error('Complete booking failed:', error);
            res.status(500).json({ error: 'Failed to complete booking' });
        } finally {
            session.endSession();
        }
    }

    // Helper method to calculate distance
    calculateDistance(coords1, coords2) {
        const [lon1, lat1] = coords1;
        const [lon2, lat2] = coords2;
        const R = 6371; // Earth's radius in km

        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(value) {
        return value * Math.PI / 180;
    }
}

module.exports = new BookingController();