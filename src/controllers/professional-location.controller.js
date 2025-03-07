const Professional = require('../models/professional.model');


const ProfessionalLocationController = {
    async updateLocation(req, res) {
        try {
          console.log('Received location update request:', {
            body: req.body,
            userId: req.user?._id
          });
    
          const { latitude, longitude, accuracy, heading, speed, isAvailable } = req.body;
          const professionalId = req.user?._id;
    
          if (!professionalId) {
            console.error('No professional ID found in request');
            return res.status(401).json({
              error: 'Authentication required',
              message: 'Professional ID not found in request'
            });
          }
    
          // Validate coordinates
          if (!latitude || !longitude || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            console.error('Invalid coordinates:', { latitude, longitude });
            return res.status(400).json({
              error: 'Invalid coordinates',
              message: 'Latitude must be between -90 and 90, longitude between -180 and 180'
            });
          }
    
          const locationUpdate = {
            'currentLocation.location': {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            'currentLocation.accuracy': accuracy,
            'currentLocation.heading': heading,
            'currentLocation.speed': speed,
            'currentLocation.timestamp': new Date(),
            'currentLocation.isAvailable': isAvailable ?? true,
            lastLocationUpdate: new Date(),
            isOnline: true
          };
    
          console.log('Attempting to update location for professional:', {
            professionalId,
            locationUpdate
          });
    
          // Push to location history
          const historyEntry = {
            location: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            accuracy,
            timestamp: new Date(),
            source: 'gps'
          };
    
          const professional = await Professional.findByIdAndUpdate(
            professionalId,
            {
              $set: locationUpdate,
              $push: {
                locationHistory: {
                  $each: [historyEntry],
                  $position: 0,
                  $slice: 100 // Keep last 100 locations
                }
              }
            },
            { new: true }
          ).exec(); // Add .exec() for better error handling
    
          if (!professional) {
            console.error('Professional not found:', professionalId);
            return res.status(404).json({ 
              error: 'Professional not found',
              message: `No professional found with ID: ${professionalId}`
            });
          }
    
          console.log('Location updated successfully:', {
            professionalId,
            currentLocation: professional.currentLocation
          });
    
          res.json({
            message: 'Location updated successfully',
            data: {
              currentLocation: professional.currentLocation,
              isOnline: professional.isOnline,
              lastLocationUpdate: professional.lastLocationUpdate
            }
          });
    
        } catch (error) {
          console.error('Location update error:', {
            error: error.message,
            stack: error.stack
          });
          res.status(500).json({ 
            error: 'Failed to update location',
            message: error.message
          });
        }
      },
  
    async getNearbyProfessionals(req, res) {
      try {
        const { latitude, longitude, radius = 5000, specializations } = req.query; // radius in meters
  
        if (!latitude || !longitude) {
          return res.status(400).json({
            error: 'Missing coordinates',
            message: 'Latitude and longitude are required'
          });
        }
  
        const query = {
          'currentLocation.location': {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
              },
              $maxDistance: parseInt(radius)
            }
          },
          'currentLocation.isAvailable': true,
          isOnline: true,
          status: 'verified'
        };
  
        // Add specializations filter if provided
        if (specializations) {
          const specializationList = specializations.split(',');
          query.specializations = { $in: specializationList };
        }
  
        const professionals = await Professional.find(query)
          .select('name specializations currentLocation ratings')
          .limit(50);
  
        res.json({
          message: 'Nearby professionals retrieved successfully',
          data: {
            professionals: professionals.map(pro => ({
              id: pro._id,
              name: pro.name,
              specializations: pro.specializations,
              location: pro.currentLocation,
              distance: calculateDistance(
                latitude,
                longitude,
                pro.currentLocation.location.coordinates[1],
                pro.currentLocation.location.coordinates[0]
              ),
              rating: pro.ratings?.average || 0
            }))
          }
        });
  
      } catch (error) {
        console.error('Error fetching nearby professionals:', error);
        res.status(500).json({ error: 'Failed to fetch nearby professionals' });
      }
    }
  };
  
  // Helper function to calculate distance
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }
  
  module.exports =  ProfessionalLocationController;