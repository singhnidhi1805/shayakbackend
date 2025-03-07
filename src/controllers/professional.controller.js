const Professional = require('../models/professional.model');
const { sendNotification } = require('../services/notification.service');

const getProfessionals =  async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    
    // Build the query
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Count total documents
    const total = await Professional.countDocuments(query);
    
    // Find professionals with pagination
    const professionals = await Professional.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({
      professionals,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Error fetching professionals list:', error);
    res.status(500).json({ error: 'Failed to fetch professionals' });
  }
};

const getProfessionalById = async (req, res) => {
  try {
    // Check if we're looking for a professional by their userId (from auth) or their _id (from params)
    let professionalQuery = {};
    
    if (req.params.id) {
      // Check if the ID is a valid MongoDB ObjectId
      if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        professionalQuery = { _id: req.params.id };
      } else {
        // If not a valid ObjectId, try to find by userId
        professionalQuery = { userId: req.params.id };
      }
    }
    
    const professional = await Professional.findOne(professionalQuery).select('-password');
    
    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }
    
    res.json({ professional });
  } catch (error) {
    console.error('Error fetching professional:', error);
    res.status(500).json({ error: 'Failed to fetch professional details' });
  }
};

const verifyDocument = async (req, res) => {
  try {
    const { professionalId, documentId, isValid, remarks } = req.body;
    console.log(`Verifying document: professionalId=${professionalId}, documentId=${documentId}, isValid=${isValid ? 'true' : 'false'}`);

    if (!professionalId || !documentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find the professional using the same pattern as the /:id/documents route
    const mongoose = require('mongoose');
    let professional = null;
    
    // First, try direct ID match
    if (mongoose.Types.ObjectId.isValid(professionalId)) {
      professional = await Professional.findById(professionalId);
      console.log(`Search by direct ID ${professionalId}: ${professional ? 'Found' : 'Not found'}`);
    }
    
    // If not found, try as userId
    if (!professional) {
      professional = await Professional.findOne({ userId: professionalId });
      console.log(`Search by userId ${professionalId}: ${professional ? 'Found' : 'Not found'}`);
    }
    
    // If still not found, this might be a user ID with a PRO prefix
    if (!professional && professionalId.startsWith('PRO')) {
      const userProfessional = await Professional.findOne({ userId: professionalId });
      
      if (userProfessional) {
        console.log(`Found user professional with custom ID: ${professionalId}`);
        professional = await Professional.findOne({ userId: userProfessional._id.toString() });
        console.log(`Search for professional linked to user: ${professional ? 'Found' : 'Not found'}`);
      }
    }
    
    if (!professional) {
      console.log(`No professional found for ID: ${professionalId}`);
      return res.status(404).json({ error: 'Professional not found' });
    }
    
    console.log(`Found professional: ${professional.name}, ID: ${professional._id}`);

    // Now that we have the professional, update the document
    // Find the document in the professional's documents array
    const documentIndex = professional.documents.findIndex(doc => doc._id.toString() === documentId);
    
    if (documentIndex === -1) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Update the document
    professional.documents[documentIndex].status = isValid ? 'approved' : 'rejected';
    professional.documents[documentIndex].verifiedAt = new Date();
    professional.documents[documentIndex].remarks = remarks || '';
    
    // Update the documentsStatus
    const documentType = professional.documents[documentIndex].type;
    professional.documentsStatus[documentType] = isValid ? 'approved' : 'rejected';
    
    // Check if all required documents are approved
    const requiredDocuments = ['id_proof', 'address_proof'];
    const allApproved = requiredDocuments.every(type => 
      professional.documentsStatus[type] === 'approved'
    );
    
    // Update professional status if needed
    if (allApproved) {
      professional.status = 'verified';
      
      // Generate employee ID if not present
      if (!professional.employeeId) {
        const year = new Date().getFullYear().toString().substr(-2);
        const count = await Professional.countDocuments();
        professional.employeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
      }
    } else if (isValid === false) {
      professional.status = 'document_pending';
    }
    
    // Save the professional with all updates in one operation
    await professional.save();
    
    // Send the response immediately
    const response = { 
      success: true,
      message: `Document ${isValid ? 'approved' : 'rejected'} successfully`, 
      documentId,
      status: isValid ? 'approved' : 'rejected'
    };
    
    res.json(response);
    
    // After sending the response, try to send notification asynchronously
    if (typeof sendNotification === 'function') {
      try {
        sendNotification(
          professional._id.toString(),
          'document_verification',
          {
            documentType: documentType,
            status: isValid ? 'approved' : 'rejected',
            remarks: remarks || ''
          }
        ).catch(error => console.warn('Notification error (non-blocking):', error));
      } catch (notifyError) {
        console.warn('Failed to send notification:', notifyError);
      }
    }
    
    return; // Function ends here after sending response
    
  } catch (error) {
    console.error('Document verification error:', error);
    return res.status(500).json({ 
      error: 'Document verification failed',
      message: error.message
    });
  }
};
const getProfessionalAvailability = async (req, res) => {
  try {
    const { date } = req.query;
    
    const bookings = await Booking.find({
      professional: req.params.id,
      scheduledDate: {
        $gte: new Date(date),
        $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
      },
      status: { $in: ['pending', 'confirmed'] }
    });

    const slots = [];
    for (let hour = 9; hour < 18; hour++) {
      const slotTime = new Date(date);
      slotTime.setHours(hour, 0, 0, 0);
      
      const isBooked = bookings.some(booking => {
        const bookingTime = new Date(booking.scheduledDate);
        return bookingTime.getHours() === hour;
      });

      slots.push({
        time: slotTime,
        available: !isBooked
      });
    }

    res.json(slots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const validateProfessionalDocuments = async (req, res) => {
  try {
    const { professionalId, documentId, status, remarks } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const professional = await Professional.findOne({ userId: professionalId });
    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    const document = professional.documents.id(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    document.verified = status === 'approved';
    document.verifiedAt = new Date();
    document.verifiedBy = req.user._id;
    
    if (status === 'approved') {
      const allVerified = professional.documents.every(doc => doc.verified);
      if (allVerified) {
        professional.status = 'verified';
      }
    }

    await professional.save();

    await sendNotification(professionalId, 'document_verification', {
      status,
      remarks,
      documentType: document.type
    });

    res.json(professional);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProfessionalLocation = async (req, res) => {
  try {
    const { coordinates, isAvailable } = req.body;
    
    const professional = await Professional.findOne({ userId: req.user._id });
    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    professional.currentLocation.coordinates = coordinates;
    professional.activeStatus.isOnline = isAvailable;
    professional.activeStatus.lastActive = new Date();
    await professional.save();

    res.json(professional);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProfessionalProfile = async (req, res) => {
  try {
    const { specializations, experience, qualifications } = req.body;
    
    if (req.user.role !== 'professional') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const professional = await Professional.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          specializations,
          experience,
          qualifications
        }
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(professional);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


module.exports = {
    getProfessionals,
    getProfessionalAvailability,
    validateProfessionalDocuments,
    updateProfessionalLocation,
    updateProfessionalProfile,
    getProfessionalById,
    verifyDocument

  };
