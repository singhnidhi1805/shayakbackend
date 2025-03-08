const Professional = require('../models/professional.model');
const { sendNotification } = require('../services/notification.service');
const logger = require('../config/logger'); 

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

  // Replace your verifyDocument function with this improved version

// Optimized verifyDocument function with proper error handling and ID validation

// Modified verifyDocument function to use userId instead of _id

// Updated verifyDocument function to handle your database structure correctly

// Final optimized verifyDocument function for your actual data structure

// Adapted version of verifyDocument that handles both parameter formats

const verifyDocument = async (req, res) => {
  try {
    logger.info('Document verification request received:', req.body);

    const { professionalId, documentId, isValid, status, remarks = '' } = req.body;
    const approvalStatus = isValid !== undefined ? isValid : status === 'approved';

    // Validate required fields
    if (!professionalId || !documentId) {
      logger.warn('Missing required fields:', { professionalId, documentId });
      return res.status(400).json({ success: false, error: 'Professional ID and Document ID are required' });
    }

    // Fetch professional with timeout
    let professional;
    try {
      professional = await Promise.race([
        Professional.findById(professionalId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 5000))
      ]);
    } catch (dbError) {
      logger.error('Database query error:', dbError);
      return res.status(500).json({ success: false, error: 'Database query error', message: dbError.message });
    }

    // Check if professional exists
    if (!professional) {
      logger.warn(`Professional not found with _id: ${professionalId}`);
      return res.status(404).json({ success: false, error: 'Professional not found' });
    }

    // Find the document to verify
    const document = professional.documents.find(doc => doc._id.toString() === documentId);
    if (!document) {
      logger.warn(`Document not found for professional ID: ${professionalId}`);
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Update document status
    const newStatus = approvalStatus ? 'approved' : 'rejected';
    document.status = newStatus;
    document.verifiedAt = new Date();
    document.remarks = remarks;

    logger.info(`Updating document status for professional ID: ${professionalId} to ${newStatus}`);

    // Update documentsStatus based on document type
    professional.documentsStatus[document.type] = newStatus;

    // Determine new professional status
    const docStatusCounts = { pending: 0, approved: 0, rejected: 0, not_submitted: 0 };
    Object.values(professional.documentsStatus).forEach(status => docStatusCounts[status]++);

    if (docStatusCounts.rejected > 0) {
      professional.status = 'rejected';
    } else if (docStatusCounts.pending > 0) {
      professional.status = 'under_review';
    } else if (docStatusCounts.approved > 0 && docStatusCounts.not_submitted === 0) {
      professional.status = 'verified';
      if (professional.onboardingStep === 'documents') professional.onboardingStep = 'completed';
    }

    logger.info(`Professional status updated to: ${professional.status}`);

    // Save changes with timeout
    try {
      await Promise.race([
        professional.save(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database save timeout')), 8000))
      ]);
      logger.info(`Professional document saved successfully for professional ID: ${professionalId}`);
    } catch (saveError) {
      logger.error('Error saving professional document:', saveError);
      return res.status(500).json({ success: false, error: 'Failed to save professional updates', message: saveError.message });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: `Document ${newStatus} successfully`,
      professional
    });
  } catch (error) {
    logger.error('Error in document verification:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
};
  /**
 * Helper function to update the professional's overall status
 * based on their document statuses
 */
const updateProfessionalStatus = async (professional) => {
  // Get counts of each document status
  const statusCounts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    not_submitted: 0
  };

  // Count statuses for each document type in documentsStatus
  for (const type in professional.documentsStatus) {
    const status = professional.documentsStatus[type];
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    }
  }

  // Determine the professional's overall status
  if (statusCounts.rejected > 0) {
    // If any document is rejected, mark the professional as rejected
    professional.status = 'rejected';
  } else if (statusCounts.pending > 0) {
    // If any document is pending, mark as under review
    professional.status = 'under_review';
  } else if (statusCounts.not_submitted > 0 && statusCounts.approved > 0) {
    // If some documents are approved but others not submitted
    professional.status = 'document_pending';
  } else if (statusCounts.approved > 0 && statusCounts.not_submitted === 0) {
    // If all required documents are approved
    professional.status = 'verified';
    
    // Update the onboarding step if they're in the documents step
    if (professional.onboardingStep === 'documents') {
      professional.onboardingStep = 'complete';
    }
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
    verifyDocument,
    updateProfessionalLocation,
    updateProfessionalProfile,
    getProfessionalById,
  };
