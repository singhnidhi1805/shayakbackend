const mongoose = require('mongoose');
const Professional = require('../models/professional.model');
const Service = require('../models/service.model');
const Booking = require('../models/booking.model');
const NotificationService = require('../services/notification.service');

class BookingService {
    // Create new booking
    async createBooking(req, res) {
      try {
          console.log('Creating booking with data:', req.body);
          const { serviceId, location, scheduledDate } = req.body;

          // Step 1: Basic validation
          if (!serviceId || !location?.coordinates || !scheduledDate) {
              return res.status(400).json({
                  success: false,
                  message: 'Missing required fields'
              });
          }

          // Step 2: Find service first without any complex queries
          const service = await Service.findById(serviceId);
          if (!service) {
              return res.status(404).json({
                  success: false,
                  message: 'Service not found'
              });
          }

          // Step 3: Create the booking
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

          // Step 4: Save booking
          await booking.save();

          // Step 5: Find professionals separately (don't wait for this)
          Professional.find({
              specializations: service.category,
              status: 'verified',
              isAvailable: true
          })
          .limit(5)
          .then(professionals => {
              console.log('Found professionals:', professionals.length);
              // Handle professional notifications in background
              professionals.forEach(professional => {
                  // Your notification logic here
              });
          })
          .catch(err => {
              console.error('Error finding professionals:', err);
          });

          // Step 6: Return success immediately
          return res.status(201).json({
              success: true,
              data: {
                  booking: {
                      _id: booking._id,
                      status: booking.status,
                      scheduledDate: booking.scheduledDate,
                      totalAmount: booking.totalAmount,
                      service: {
                          _id: service._id,
                          name: service.name,
                          category: service.category
                      }
                  }
              }
          });

      } catch (error) {
          console.error('Booking creation error:', error);
          return res.status(500).json({
              success: false,
              message: 'Failed to create booking',
              error: error.message
          });
      }
  }

  
    async findAvailableProfessionals(service, location, scheduledDate) {
      return Professional.find({
        specializations: service.category,
        status: "verified",
        isAvailable: true,
        currentLocation: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: location.coordinates
            },
            $maxDistance: 15000 // 15km radius
          }
        }
      }).limit(5);
    }
  
    async acceptBooking(bookingId, professionalId) {
      const session = await mongoose.startSession();
      session.startTransaction();
  
      try {
        const booking = await Booking.findById(bookingId).session(session);
        if (!booking || booking.status !== 'pending') {
          throw new Error('Invalid booking or already accepted');
        }
  
        const professional = await Professional.findById(professionalId).session(session);
        if (!professional || !professional.isAvailable) {
          throw new Error('Professional not available');
        }
  
        // Update booking
        booking.professional = professionalId;
        booking.status = 'accepted';
        await booking.save();
  
        // Update professional status
        professional.isAvailable = false;
        professional.currentBooking = {
          bookingId: booking._id,
          status: 'ongoing'
        };
        await professional.save();
  
        // Notify user
        await NotificationService.sendPushNotification(booking.user, {
          type: 'BOOKING_ACCEPTED',
          bookingId: booking._id,
          professional: {
            name: professional.name,
            phone: professional.phone
          }
        });
  
        await session.commitTransaction();
        return booking;
  
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }

  // ✅ Verify service completion using secure OTP
  async verifyServiceCompletion(bookingId, enteredOtp) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
          const booking = await Booking.findById(bookingId);

          // ✅ Secure OTP verification
          const isValidOtp = await otpService.verifyOtp(booking.user.phone, enteredOtp);
          if (!isValidOtp) {
              throw new Error("❌ Invalid verification OTP.");
          }

          booking.status = 'completed';
          booking.completedAt = new Date();
          await booking.save({ session });

          // ✅ Update professional status
          await Professional.findByIdAndUpdate(booking.professional, {
              'currentBooking.status': 'none',
              'currentBooking.bookingId': null
          }, { session });

          // ✅ Notify both parties
          await Promise.all([
              NotificationService.sendPushNotification(booking.user, {
                  type: 'SERVICE_COMPLETED',
                  bookingId: booking._id
              }),
              NotificationService.sendPushNotification(booking.professional, {
                  type: 'SERVICE_COMPLETED',
                  bookingId: booking._id
              })
          ]);

          await session.commitTransaction();
          return booking;
      } catch (error) {
          await session.abortTransaction();
          throw error;
      } finally {
          session.endSession();
      }
  }
  
  async waitForProfessionalResponse(professional, booking) {
    return new Promise((resolve) => {
      console.log(`🔵 Waiting for professional ${professional.name} to respond...`);
  
      setTimeout(() => {
        // Simulating 50% chance of accepting for testing
        const accepted = Math.random() > 0.5;
        if (accepted) {
          console.log(`🟢 Professional ${professional.name} accepted.`);
        } else {
          console.warn(`⚠️ Professional ${professional.name} did not respond in time.`);
        }
        resolve({ accepted });
      }, 5000); // Wait for 5 seconds before timeout
    });
  }
  
    
    // Professional accepts booking
    async acceptBooking(bookingId, professionalId) {
      const session = await mongoose.startSession();
      session.startTransaction();
  
      try {
        const booking = await Booking.findById(bookingId);
        
        if (booking.status !== 'pending') {
          throw new Error('Booking already accepted or cancelled');
        }
  
        booking.professional = professionalId;
        booking.status = 'accepted';
        await booking.save({ session });
  
        await Professional.findByIdAndUpdate(professionalId, {
          $set: {
            'currentBooking.bookingId': booking._id,
            'currentBooking.status': 'assigned'
          }
        }, { session });
  
        await NotificationService.sendPushNotification(booking.user, {
          type: 'BOOKING_ACCEPTED',
          bookingId: booking._id,
          professionalId: professionalId
        });
  
        await session.commitTransaction();
        return booking;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }

    async rescheduleBooking(bookingId, newDate, reason) {
        const booking = await Booking.findById(bookingId);
        
        if (!booking) {
          throw new Error('Booking not found');
        }
    
        if (!['pending', 'accepted'].includes(booking.status)) {
          throw new Error('Cannot reschedule this booking');
        }
    
        // Check professional availability
        const isAvailable = await this.checkProfessionalAvailability(
          booking.professional,
          newDate
        );
    
        if (!isAvailable) {
          throw new Error('Professional not available at requested time');
        }
    
        booking.scheduledDate = newDate;
        booking.reschedulingHistory.push({
          oldDate: booking.scheduledDate,
          newDate,
          reason,
          requestedBy: booking.user
        });
    
        await booking.save();
    
        // Notify both parties
        await Promise.all([
          NotificationService.sendPushNotification(booking.user, {
            type: 'BOOKING_RESCHEDULED',
            bookingId: booking._id,
            newDate
          }),
          NotificationService.sendPushNotification(booking.professional, {
            type: 'BOOKING_RESCHEDULED',
            bookingId: booking._id,
            newDate
          })
        ]);
    
        return booking;
      }
    
      async handleEmergencyRequest(bookingData) {
        const emergencyBooking = await this.createBooking({
          ...bookingData,
          isEmergency: true,
          priority: 'high'
        });
    
        // Find professionals within 5km for emergency
        const nearbyProfessionals = await Professional.find({
          'serviceCategories.category': bookingData.service,
          'serviceCategories.verificationStatus': 'verified',
          'currentBooking.status': 'none',
          serviceArea: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: bookingData.location.coordinates
              },
              $maxDistance: 5000 // 5km for emergency
            }
          }
        });
    
        // Send emergency notifications with higher priority
        await Promise.all(nearbyProfessionals.map(professional =>
          NotificationService.sendPushNotification(professional.userId, {
            type: 'EMERGENCY_BOOKING',
            priority: 'high',
            bookingId: emergencyBooking._id,
            service: bookingData.service
          })
        ));
    
        return emergencyBooking;
      }
    

      async findMatchingProfessionals(booking) {
        try {
            console.log("Finding professionals for service:", booking.service);
            console.log("Searching near coordinates:", booking.location.coordinates);
    
            // ✅ Changed from `serviceArea` to `currentLocation`
            const professionals = await Professional.find({
                'serviceCategories.category': booking.service.category,
                'serviceCategories.verificationStatus': 'verified',
                'currentBooking.status': 'none',
                'status': 'verified',
                'currentLocation.coordinates': { $exists: true, $ne: [0, 0] }, // Ensure valid location
                currentLocation: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: booking.location.coordinates
                        },
                        $maxDistance: 15000 // 15 km radius
                    }
                }
            });
    
            console.log("Found professionals:", professionals.length);
            return professionals;
        } catch (error) {
            console.error("Error finding professionals:", error);
            return [];
        }
    }
    

    async assignProfessional(booking) {
      const matchingProfessionals = await this.findMatchingProfessionals(booking);
      
      if (matchingProfessionals.length === 0) {
          throw new Error('No professionals available for this service');
      }
  
      // Select top matching professional
      const selectedProfessional = matchingProfessionals[0];
  
      // Update booking with professional
      booking.professional = selectedProfessional._id;
      booking.status = 'assigned';
      await booking.save();
  
      // Notify professional
      await NotificationService.sendPushNotification(selectedProfessional.userId, {
          type: 'NEW_BOOKING',
          bookingDetails: booking
      });
  
      return booking;
  }
  
      async createBookingWithPreferenceMatching(bookingData) {
        const booking = new Booking(bookingData);
        
        try {
          // Validate booking details
          await booking.validate();
    
          // Find and assign matching professional
          const assignedBooking = await this.assignProfessional(booking);
    
          // Optional: Update user's service preferences if not existing
          await this.updateUserServicePreferences(
            bookingData.user, 
            bookingData.service
          );
    
          return assignedBooking;
        } catch (error) {
          // Handle fallback scenarios
          if (error.message === 'No professionals available') {
            booking.status = 'pending';
            await booking.save();
            
            // Broadcast to all verified professionals
            await this.broadcastToAllProfessionals(booking);
          }
          throw error;
        }
      }
    
      async updateUserServicePreferences(user, service) {
        const existingPreference = user.servicePreferences.find(
          pref => pref.serviceCategory.equals(service._id)
        );
    
        if (!existingPreference) {
          user.servicePreferences.push({
            serviceCategory: service._id,
            frequency: 'occasional'
          });
          await user.save();
        }
      }
    
    // Verify service completion using OTP
    async verifyServiceCompletion(bookingId, verificationCode) {
      const session = await mongoose.startSession();
      session.startTransaction();
  
      try {
        const booking = await Booking.findById(bookingId);
        
        if (booking.verificationCode !== verificationCode) {
          throw new Error('Invalid verification code');
        }
  
        booking.status = 'completed';
        booking.completedAt = new Date();
        await booking.save({ session });
  
        // Update professional status
        await Professional.findByIdAndUpdate(booking.professional, {
          'currentBooking.status': 'none',
          'currentBooking.bookingId': null
        }, { session });
  
        // Notify both parties
        await Promise.all([
          NotificationService.sendPushNotification(booking.user, {
            type: 'SERVICE_COMPLETED',
            bookingId: booking._id
          }),
          NotificationService.sendPushNotification(booking.professional, {
            type: 'SERVICE_COMPLETED',
            bookingId: booking._id
          })
        ]);
  
        await session.commitTransaction();
        return booking;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      }
    }

    async completeBooking(bookingId, verificationCode) {
      const session = await mongoose.startSession();
      session.startTransaction();
  
      try {
        const booking = await Booking.findById(bookingId).session(session);
        
        if (!booking) throw new Error('Booking not found');
        if (booking.status !== 'confirmed') {
          throw new Error('Booking is not in progress');
        }
  
        if (booking.verificationCode !== verificationCode) {
          throw new Error('Invalid verification code');
        }
  
        booking.status = 'completed';
        booking.completedAt = new Date();
        await booking.save();
  
        await Professional.findByIdAndUpdate(booking.professional, {
          $set: {
            'currentBooking.status': 'none',
            'currentBooking.bookingId': null
          }
        }, { session });
  
        await NotificationService.sendPushNotification(booking.user, {
          type: 'BOOKING_COMPLETED',
          bookingId: booking._id
        });
  
        await session.commitTransaction();
        return booking;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }

    async updateBookingLocation(bookingId, coordinates) {
      try {
        const booking = await Booking.findById(bookingId).populate('professional');
        if (!booking) {
          throw new Error('Booking not found');
        }
  
        // Update tracking info
        await Promise.all([
          redis.set(`tracking:${bookingId}:professional`, JSON.stringify(coordinates)),
          Booking.findByIdAndUpdate(bookingId, {
            'professional.currentLocation': {
              type: 'Point',
              coordinates
            }
          })
        ]);
  
        // Notify user of location update
        socketIO.to(`booking_${bookingId}`).emit('location_update', {
          bookingId,
          coordinates
        });
  
        return true;
      } catch (error) {
        logger.error('Location update failed:', error);
        throw error;
      }
    }
  
  
  
  }

  
  
  module.exports = new BookingService();