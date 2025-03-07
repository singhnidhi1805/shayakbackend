const Professional = require('../models/professional.model');
const Service = require('../models/service.model');

class ServiceMatchingController {
    async findMatchingProfessionals(req, res) {
        try {
            const { serviceId, location } = req.body;
    
            // Find the service
            const service = await Service.findById(serviceId);
            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }
    
            console.log(`Finding professionals for service: ${service.category}, Location: ${location.coordinates}`);
    
            // ✅ Fixed: Use `currentLocation` instead of `location`
            const matchingProfessionals = await Professional.find({
                status: 'verified',
                specializations: { $in: service.professionalTypes },
                'currentLocation.coordinates': { $exists: true, $ne: [0, 0] },
                currentLocation: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: location.coordinates
                        },
                        $maxDistance: 10000 // 10 km radius
                    }
                }
            });
    
            if (matchingProfessionals.length === 0) {
                console.warn("No matching professionals found.");
            }
    
            // Update service with matching professionals
            service.matchingProfessionals = matchingProfessionals.map(p => p._id);
            await service.save();
    
            res.json({
                message: 'Matching professionals found',
                professionals: matchingProfessionals
            });
        } catch (error) {
            console.error('Error in finding professionals:', error);
            res.status(500).json({ error: 'Failed to find matching professionals' });
        }
    }
    
  async bookService(req, res) {
    try {
      const { serviceId, professionalId } = req.body;
      const userId = req.user._id;

      // Validate service and professional match
      const service = await Service.findById(serviceId);
      const professional = await Professional.findById(professionalId);

      if (!service || !professional) {
        return res.status(404).json({ error: 'Service or Professional not found' });
      }

      // Check if professional matches service type
      if (!professional.specializations.some(spec => 
        service.professionalTypes.includes(spec)
      )) {
        return res.status(400).json({ 
          error: 'Professional specialization does not match service type' 
        });
      }

      // Create booking logic here
      const booking = new Booking({
        service: serviceId,
        professional: professionalId,
        customer: userId,
        status: 'pending'
      });
      await booking.save();

      // Send notification to professional
      await NotificationService.sendProfessionalNotification(
        professionalId, 
        'New Service Booking',
        `You have a new ${service.name} service booking`
      );

      res.status(201).json({
        message: 'Service booked successfully',
        booking
      });
    } catch (error) {
      res.status(500).json({ error: 'Booking failed' });
    }
  }
}

module.exports = new ServiceMatchingController();