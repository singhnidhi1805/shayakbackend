const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const logger = require('../config/logger');
const Professional = require('../models/professional.model');
const Booking = require('../models/booking.model');

class SocketService {
    constructor(server) {
        this.io = socketIO(server, {
            cors: {
                origin: process.env.CLIENT_URL,
                methods: ['GET', 'POST']
            }
        });

        this.setupAuth();
        this.setupEventHandlers();
    }

    setupAuth() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    throw new Error('Authentication token missing');
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.userId = decoded.id;
                socket.userRole = decoded.role;
                
                next();
            } catch (error) {
                logger.error('Socket authentication error:', error);
                next(new Error('Authentication failed'));
            }
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`User connected: ${socket.userId}, Role: ${socket.userRole}`);

            // Join user's room
            socket.join(`user_${socket.userId}`);

            // Handle location updates for professionals
            socket.on('update_location', async (data) => {
                try {
                    const { coordinates, bookingId } = data;
                    
                    if (socket.userRole !== 'professional') {
                        throw new Error('Unauthorized: Only professionals can update location');
                    }

                    // Update professional's location
                    await Professional.findByIdAndUpdate(socket.userId, {
                        'currentLocation.coordinates': coordinates,
                        'currentLocation.updatedAt': new Date()
                    });

                    // If there's an active booking, update booking tracking
                    if (bookingId) {
                        const booking = await Booking.findById(bookingId);
                        if (booking && booking.status === 'accepted') {
                            // Calculate and update ETA
                            const eta = this.calculateETA(coordinates, booking.location.coordinates);
                            
                            await Booking.findByIdAndUpdate(bookingId, {
                                'tracking.lastLocation.coordinates': coordinates,
                                'tracking.lastLocation.timestamp': new Date(),
                                'tracking.eta': eta
                            });

                            // Emit location update to user
                            this.io.to(`user_${booking.user}`).emit('professional_location', {
                                bookingId,
                                coordinates,
                                eta
                            });
                        }
                    }

                    // Store location in Redis for quick access
                    await redis.set(
                        `location:${socket.userId}`,
                        JSON.stringify({
                            coordinates,
                            timestamp: Date.now()
                        }),
                        'EX',
                        300 // Expire after 5 minutes
                    );

                } catch (error) {
                    logger.error('Location update error:', error);
                    socket.emit('error', { message: 'Failed to update location' });
                }
            });

            // Handle professional status updates
            socket.on('status_update', async (data) => {
                try {
                    const { status, bookingId } = data;
                    
                    if (!['arrived', 'started', 'completed'].includes(status)) {
                        throw new Error('Invalid status');
                    }

                    const booking = await Booking.findById(bookingId);
                    if (!booking) {
                        throw new Error('Booking not found');
                    }

                    // Update booking status
                    booking.status = status === 'arrived' ? 'in_progress' : status;
                    booking.tracking[`${status}At`] = new Date();
                    await booking.save();

                    // Notify user
                    this.io.to(`user_${booking.user}`).emit('booking_status_update', {
                        bookingId,
                        status,
                        timestamp: new Date()
                    });

                } catch (error) {
                    logger.error('Status update error:', error);
                    socket.emit('error', { message: 'Failed to update status' });
                }
            });

            // Handle chat messages
            socket.on('send_message', async (data) => {
                try {
                    const { bookingId, message } = data;
                    
                    const booking = await Booking.findById(bookingId);
                    if (!booking) {
                        throw new Error('Booking not found');
                    }

                    // Determine recipient based on sender role
                    const recipientId = socket.userRole === 'professional' 
                        ? booking.user 
                        : booking.professional;

                    this.io.to(`user_${recipientId}`).emit('new_message', {
                        bookingId,
                        message,
                        sender: socket.userId,
                        timestamp: new Date()
                    });

                } catch (error) {
                    logger.error('Message sending error:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

            // Handle disconnect
            socket.on('disconnect', async () => {
                try {
                    if (socket.userRole === 'professional') {
                        // Update professional's online status
                        await Professional.findByIdAndUpdate(socket.userId, {
                            'isOnline': false,
                            'lastSeen': new Date()
                        });

                        // Clear Redis location cache
                        await redis.del(`location:${socket.userId}`);
                    }
                    
                    logger.info(`User disconnected: ${socket.userId}`);
                } catch (error) {
                    logger.error('Disconnect handling error:', error);
                }
            });
        });
    }

    // Helper methods
    calculateETA(startCoords, endCoords) {
        const R = 6371; // Earth's radius in km
        const [lon1, lat1] = startCoords;
        const [lon2, lat2] = endCoords;

        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        // Assume average speed of 30 km/h
        return Math.round((distance / 30) * 60); // Returns ETA in minutes
    }

    toRad(value) {
        return value * Math.PI / 180;
    }

    // Method to emit events to specific users or rooms
    emitToUser(userId, eventName, data) {
        this.io.to(`user_${userId}`).emit(eventName, data);
    }

    // Method to broadcast to all connected clients
    broadcast(eventName, data) {
        this.io.emit(eventName, data);
    }
}

module.exports = SocketService;