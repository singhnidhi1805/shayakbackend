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
    console.log(`Verifying document: ProfessionalID=${professionalId}, DocumentID=${documentId}, isValid=${isValid}`);
    
    if (!professionalId || !documentId) {
      return res.status(400).json({ error: 'Missing required fields: professionalId and documentId' });
    }
    
    // No need to re-import mongoose if it's already imported at the top of the file
    // const mongoose = require('mongoose');
    
    // Try different methods to find the professional
    let professional = null;
    
    // 1. First, try to find by _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(professionalId)) {
      professional = await Professional.findById(professionalId);
      console.log(`Search by direct ID ${professionalId}: ${professional ? 'Found' : 'Not found'}`);
    }
    
    // 2. If not found, try to find by userId
    if (!professional) {
      professional = await Professional.findOne({ userId: professionalId });
      console.log(`Search by userId ${professionalId}: ${professional ? 'Found' : 'Not found'}`);
    }
    
    // 3. If still not found and ID starts with PRO (custom ID), try to find related document
    if (!professional && typeof professionalId === 'string' && professionalId.startsWith('PRO')) {
      const userProfessional = await Professional.findOne({ userId: professionalId });
      
      if (userProfessional) {
        console.log(`Found user professional with custom ID: ${professionalId}`);
        // Now find the professional document that references this user's ID
        professional = await Professional.findOne({ userId: userProfessional._id.toString() });
        console.log(`Search for professional linked to user: ${professional ? 'Found' : 'Not found'}`);
      }
    }
    
    if (!professional) {
      console.log(`No professional found for ID: ${professionalId}`);
      return res.status(404).json({ error: 'Professional not found' });
    }
    
    console.log(`Found professional: ${professional.name}, Documents: ${professional.documents?.length || 0}`);
    
    // Find the document by ID
    if (!professional.documents || professional.documents.length === 0) {
      return res.status(404).json({ error: 'No documents found for this professional' });
    }
    
    const documentIndex = professional.documents.findIndex(
      doc => doc._id.toString() === documentId
    );
    
    if (documentIndex === -1) {
      console.log(`Document with ID ${documentId} not found for professional ${professional._id}`);
      console.log(`Available document IDs: ${professional.documents.map(d => d._id.toString())}`);
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const document = professional.documents[documentIndex];
    console.log(`Found document: ${document.type}, current status: ${document.status}`);
    
    // Update document status
    document.status = isValid ? 'approved' : 'rejected';
    document.verifiedAt = new Date();
    document.verifiedBy = req.user ? req.user._id : 'system'; // Fixed: Use _id instead of id
    document.remarks = remarks || '';
    
    // Update the document status in the documentsStatus object
    if (!professional.documentsStatus) {
      professional.documentsStatus = {
        id_proof: 'not_submitted',
        address_proof: 'not_submitted',
        professional_certificate: 'not_submitted'
      };
    }
    
    professional.documentsStatus[document.type] = isValid ? 'approved' : 'rejected';
    
    // Check if all required documents are approved to update status
    const requiredDocuments = ['id_proof', 'address_proof'];
    const allVerified = requiredDocuments.every(
      docType => professional.documentsStatus[docType] === 'approved'
    );
    
    if (allVerified) {
      professional.status = 'verified';
      
      // Generate employee ID if not already assigned
      if (!professional.employeeId) {
        const year = new Date().getFullYear().toString().substr(-2);
        const count = await Professional.countDocuments();
        professional.employeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
      }
    } else if (isValid === false) {
      professional.status = 'document_pending';
    }
    
    // Save the updated professional document
    console.log(`Saving professional with updated document status: ${document.type} = ${document.status}`);
    await professional.save();
    
    // Try to send notification but don't block response if it fails
    try {
      if (typeof sendNotification === 'function') {
        sendNotification(
          professional.userId || professional._id.toString(), 
          'document_verification', 
          {
            documentType: document.type,
            status: isValid ? 'approved' : 'rejected',
            remarks: remarks || ''
          }
        ).catch(err => console.warn('Notification error (non-blocking):', err));
      }
    } catch (notifyError) {
      console.warn('Failed to send notification:', notifyError);
    }
    
    // Important: Send a properly structured response that matches what the frontend expects
    res.json({
      message: `Document ${isValid ? 'approved' : 'rejected'} successfully`,
      professional: {
        _id: professional._id,
        name: professional.name,
        email: professional.email,
        phone: professional.phone,
        status: professional.status,
        documentsStatus: professional.documentsStatus,
        documents: professional.documents,
        address: professional.address,
        city: professional.city,
        state: professional.state,
        pincode: professional.pincode,
        employeeId: professional.employeeId,
        createdAt: professional.createdAt,
        updatedAt: professional.updatedAt,
        onboardingStep: professional.onboardingStep,
        userId: professional.userId,
        alternatePhone: professional.alternatePhone,
        specializations: professional.specializations
      }
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ 
      error: 'Failed to verify document', 
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
