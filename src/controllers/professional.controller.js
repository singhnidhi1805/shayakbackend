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

    // OPTIMIZATION: Use findOneAndUpdate to find and update in one operation
    // This avoids multiple round trips to the database
    const updateOperation = await Professional.findOneAndUpdate(
      { 
        $or: [
          { _id: professionalId }, 
          { userId: professionalId }
        ],
        "documents._id": documentId 
      },
      { 
        $set: { 
          "documents.$.status": isValid ? 'approved' : 'rejected',
          "documents.$.verifiedAt": new Date(),
          "documents.$.remarks": remarks || ''
        } 
      },
      { 
        new: true, // Return the updated document
        runValidators: true // Run schema validators
      }
    );

    if (!updateOperation) {
      return res.status(404).json({ error: 'Professional or document not found' });
    }

    // At this point, we have the professional with the updated document
    // Find the document that was updated
    const document = updateOperation.documents.find(doc => doc._id.toString() === documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found after update' });
    }

    // OPTIMIZATION: Only one more database operation to update everything else
    // We update the documentsStatus and check if all required docs are approved
    const requiredDocuments = ['id_proof', 'address_proof'];
    
    // Update the documentsStatus for this specific document type
    const updateData = {
      [`documentsStatus.${document.type}`]: isValid ? 'approved' : 'rejected'
    };
    
    // Set up a flag to track if we need to update the status
    let statusUpdate = null;
    
    // Check if we need to update the overall status
    if (isValid === false) {
      // If document was rejected, update status to document_pending
      statusUpdate = 'document_pending';
    } else {
      // If document was approved, we need to check if all required docs are now approved
      // Get latest document status including our update
      const documentStatuses = {
        ...updateOperation.documentsStatus,
        [document.type]: 'approved'
      };
      
      const allRequiredApproved = requiredDocuments.every(type => 
        documentStatuses[type] === 'approved'
      );
      
      if (allRequiredApproved) {
        statusUpdate = 'verified';
        
        // Generate employee ID if needed
        if (!updateOperation.employeeId) {
          const year = new Date().getFullYear().toString().substr(-2);
          const count = await Professional.countDocuments();
          updateData.employeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
        }
      }
    }
    
    // If we need to update the status, add it to the update data
    if (statusUpdate) {
      updateData.status = statusUpdate;
    }
    
    // Perform the final update
    await Professional.updateOne(
      { _id: updateOperation._id },
      { $set: updateData }
    );

    // Return success immediately without waiting for notification
    const response = { 
      success: true,
      message: `Document ${isValid ? 'approved' : 'rejected'} successfully`, 
      documentId,
      status: isValid ? 'approved' : 'rejected'
    };
    
    res.json(response);
    
    // After sending the response, try to send notification asynchronously
    // This ensures the API responds quickly even if notification is slow
    if (typeof sendNotification === 'function') {
      try {
        sendNotification(
          updateOperation._id.toString(),
          'document_verification',
          {
            documentType: document.type,
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
