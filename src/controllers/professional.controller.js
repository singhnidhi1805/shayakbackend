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

// const verifyDocument = async (req, res) => {
//   try {
//     const { professionalId, documentId, isValid, remarks } = req.body;
    
//     console.log('Verification request received:', {
//       professionalId,
//       documentId,
//       isValid,
//       remarks
//     });
    
//     if (!professionalId || !documentId || isValid === undefined) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }
    
//     // Find the professional document - try both ObjectId and userId
//     let professional = null;
    
//     if (mongoose.Types.ObjectId.isValid(professionalId)) {
//       professional = await Professional.findById(professionalId);
//       console.log('Searched by ObjectId:', professional ? 'Found' : 'Not found');
//     }
    
//     if (!professional) {
//       professional = await Professional.findOne({ userId: professionalId });
//       console.log('Searched by userId:', professional ? 'Found' : 'Not found');
//     }
    
//     if (!professional) {
//       return res.status(404).json({ error: 'Professional not found' });
//     }
    
//     // Find the specific document to verify
//     const documentIndex = professional.documents.findIndex(
//       doc => doc._id.toString() === documentId
//     );
    
//     if (documentIndex === -1) {
//       return res.status(404).json({ error: 'Document not found' });
//     }
    
//     console.log(`Found document at index ${documentIndex}`);
    
//     // Update the document status
//     const document = professional.documents[documentIndex];
//     document.status = isValid ? 'approved' : 'rejected';
//     document.verifiedAt = new Date();
//     document.verifiedBy = req.user?.id || null; // Handle case where user info might be missing
//     document.remarks = remarks || '';
    
//     // Update the document status in the documentsStatus object
//     professional.documentsStatus[document.type] = isValid ? 'approved' : 'rejected';
    
//     // Check if all required documents are approved to update professional status
//     const requiredDocuments = ['id_proof', 'address_proof'];
    
//     if (isValid) {
//       const allRequiredVerified = requiredDocuments.every(
//         docType => professional.documentsStatus[docType] === 'approved'
//       );
      
//       if (allRequiredVerified) {
//         professional.status = 'verified';
        
//         // Generate employee ID if not already assigned
//         if (!professional.employeeId) {
//           const year = new Date().getFullYear().toString().substr(-2);
//           const count = await Professional.countDocuments();
//           professional.employeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
//         }
//       }
//     } else {
//       // If any document is rejected, ensure professional status reflects this
//       professional.status = 'document_pending';
//     }
    
//     console.log('Saving professional with updated document status');
    
//     // Save the updated professional document - this operation could be slow
//     await professional.save();
    
//     console.log('Professional document saved successfully');
    
//     // Simplified notification to avoid potential issues
//     try {
//       // Using direct import rather than require to avoid circular dependencies
//       sendNotification(professional.userId, 'document_verification', {
//         documentType: document.type,
//         status: isValid ? 'approved' : 'rejected',
//         remarks: remarks || ''
//       }).catch(err => console.warn('Notification error (non-blocking):', err));
//     } catch (notifyError) {
//       console.warn('Failed to send notification:', notifyError);
//     }
    
//     // Return success response
//     return res.status(200).json({
//       success: true,
//       message: `Document ${isValid ? 'approved' : 'rejected'} successfully`,
//       professional: {
//         _id: professional._id,
//         name: professional.name,
//         email: professional.email,
//         status: professional.status,
//         employeeId: professional.employeeId,
//         documentsStatus: professional.documentsStatus
//       }
//     });
    
//   } catch (error) {
//     console.error('Error verifying document:', error);
//     return res.status(500).json({ 
//       error: 'Failed to verify document', 
//       details: error.message 
//     });
//   }
// };

const testVerifyDocument = async (req, res) => {
  try {
    const { professionalId, documentId, isValid } = req.body;
    
    // Just return success without performing any database operations
    return res.status(200).json({
      success: true,
      message: 'Test verification endpoint working',
      received: {
        professionalId,
        documentId,
        isValid
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Test endpoint error' });
  }
};

// 2. Now let's fix the actual verification function
const verifyDocument = async (req, res) => {
  // Add a timeout to ensure the function doesn't hang indefinitely
  const responseTimeout = setTimeout(() => {
    console.error('Document verification timed out!');
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Operation timed out',
        message: 'The verification request took too long to process'
      });
    }
  }, 25000); // 25 second server-side timeout
  
  try {
    console.log('Verification request body:', req.body);
    const { professionalId, documentId, isValid, remarks } = req.body;
    
    if (!professionalId || !documentId || isValid === undefined) {
      clearTimeout(responseTimeout);
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find the professional document using a more efficient approach
    // Instead of doing multiple queries, use a single query with $or
    const professionalQuery = {
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(professionalId) ? professionalId : null },
        { userId: professionalId }
      ]
    };
    
    console.log('Finding professional with query:', JSON.stringify(professionalQuery));
    
    // Use lean() for better performance when you don't need a full Mongoose document
    const professional = await Professional.findOne(professionalQuery);
    
    if (!professional) {
      clearTimeout(responseTimeout);
      return res.status(404).json({ error: 'Professional not found' });
    }
    
    console.log(`Found professional: ${professional.name}`);
    
    // Find the document by ID
    const document = professional.documents.id(documentId);
    
    if (!document) {
      clearTimeout(responseTimeout);
      return res.status(404).json({ error: 'Document not found' });
    }
    
    console.log(`Found document of type: ${document.type}`);
    
    // Update document fields
    document.status = isValid ? 'approved' : 'rejected';
    document.verifiedAt = new Date();
    document.verifiedBy = req.user?.id || null;
    document.remarks = remarks || '';
    
    // Update document status in the professional record
    professional.documentsStatus[document.type] = isValid ? 'approved' : 'rejected';
    
    // Update professional status based on documents
    if (isValid) {
      // Check if all required documents are approved
      const requiredDocuments = ['id_proof', 'address_proof'];
      const allApproved = requiredDocuments.every(
        docType => professional.documentsStatus[docType] === 'approved'
      );
      
      if (allApproved) {
        professional.status = 'verified';
        
        // Generate employee ID if needed
        if (!professional.employeeId) {
          const year = new Date().getFullYear().toString().substr(-2);
          const count = await Professional.countDocuments();
          professional.employeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
        }
      }
    } else {
      professional.status = 'document_pending';
    }
    
    console.log('Saving professional document...');
    
    // Save the professional record
    // This is likely where the timeout is happening
    // Use a promise with timeout to prevent hanging
    const savePromise = professional.save();
    const saveWithTimeout = Promise.race([
      savePromise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database save operation timed out')), 10000);
      })
    ]);
    
    try {
      await saveWithTimeout;
      console.log('Professional document saved successfully');
    } catch (saveError) {
      console.error('Error saving professional document:', saveError);
      clearTimeout(responseTimeout);
      return res.status(500).json({ 
        error: 'Database operation timed out', 
        message: 'Could not complete the verification process'
      });
    }
    
    // Send notification in the background
    // Don't wait for it to complete
    try {
      process.nextTick(() => {
        sendNotification(professional.userId, 'document_verification', {
          documentType: document.type,
          status: isValid ? 'approved' : 'rejected',
          remarks: remarks || ''
        }).catch(err => console.warn('Notification error (non-blocking):', err));
      });
    } catch (notifyError) {
      console.warn('Failed to queue notification:', notifyError);
    }
    
    // Clear the timeout since we're responding successfully
    clearTimeout(responseTimeout);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: `Document ${isValid ? 'approved' : 'rejected'} successfully`,
      professional: {
        _id: professional._id,
        name: professional.name,
        status: professional.status,
        documentsStatus: professional.documentsStatus
      }
    });
    
  } catch (error) {
    // Clear the timeout since we're responding with an error
    clearTimeout(responseTimeout);
    
    console.error('Error in verifyDocument:', error);
    return res.status(500).json({ 
      error: 'Failed to verify document', 
      details: error.message 
    });
  }
};

// 3. Add this function to extract just the document verification logic without database operations
const checkDocumentVerificationStatus = async (req, res) => {
  try {
    const { professionalId, documentId } = req.body;
    
    if (!professionalId || !documentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find the professional document
    const professionalQuery = {
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(professionalId) ? professionalId : null },
        { userId: professionalId }
      ]
    };
    
    // Use projection to get only what we need
    const professional = await Professional.findOne(professionalQuery, {
      name: 1,
      documents: 1,
      documentsStatus: 1
    }).lean();
    
    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }
    
    // Find the document
    const document = professional.documents.find(
      doc => doc._id.toString() === documentId
    );
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    return res.status(200).json({
      professional: {
        name: professional.name,
        document: document,
        documentStatus: professional.documentsStatus[document.type]
      }
    });
  } catch (error) {
    console.error('Error checking document status:', error);
    return res.status(500).json({ error: 'Failed to check document status' });
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
    verifyDocument,
  testVerifyDocument,
  checkDocumentVerificationStatus

  };
