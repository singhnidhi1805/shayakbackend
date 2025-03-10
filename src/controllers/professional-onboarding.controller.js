const professionalOnboardingService = require('../services/professional-onboarding.service');
const { validationResult } = require('express-validator');
const createError = require('http-errors');
const mongoose = require('mongoose');
const Professional = require('../models/professional.model');
const { sendNotification } = require('../services/notification.service'); // Adjust path as needed

class ProfessionalOnboardingController {
  async initiateOnboarding(req, res, next) {
    try {
      // Log incoming request data
      console.log('Initiating onboarding for user:', {
        userId: req.user._id,
        requestBody: req.body
      });

      // Get validation results
      const errors = validationResult(req);
      
      // Log validation errors if any
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
        });
      }

      // Validate required fields manually as backup
      const { email, name } = req.body;
      if (!email || !name) {
        return res.status(400).json({
          error: 'Validation Error',
          details: [
            {
              msg: 'Required fields missing or invalid',
              params: ['email', 'name'],
              location: 'body'
            }
          ]
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Validation Error',
          details: [
            {
              msg: 'Invalid email format',
              param: 'email',
              location: 'body'
            }
          ]
        });
      }

      // Pass the actual user._id to the service
      const result = await professionalOnboardingService.initiateOnboarding(
        req.user._id, // Use the MongoDB _id directly
        {
          email: email.toLowerCase().trim(),
          name: name.trim()
        }
      );

      // Log successful onboarding
      console.log('Onboarding initiated successfully:', {
        userId: req.user._id,
        result
      });

      res.json({
        message: 'Onboarding initiated successfully',
        data: result
      });
    } catch (error) {
      console.error('Onboarding initiation error:', error);
      next(error);
    }
  }

  async saveOnboardingProgress(req, res, next) {
    try {
      const { step, data } = req.body;
      
      // Validate input
      if (!step || !data) {
        return res.status(400).json({ 
          error: 'Invalid request',
          message: 'Step and data are required'
        });
      }
      
      const validSteps = ['welcome', 'personal_details', 'specializations', 'documents'];
      if (!validSteps.includes(step)) {
        return res.status(400).json({ 
          error: 'Invalid step',
          message: `Step must be one of: ${validSteps.join(', ')}`
        });
      }
      
      // Pass the user's MongoDB _id directly
      const result = await professionalOnboardingService.saveOnboardingProgress(
        req.user._id, // Use the MongoDB _id
        step,
        data
      );
      
      res.json({
        message: 'Progress saved successfully',
        data: result
      });
    } catch (error) {
      console.error('Progress save error:', error);
      next(error);
    }
  }

  async uploadDocument(req, res, next) {
    try {
      // Get document type from form data
      const { documentType } = req.body;
      const file = req.file;
  
      // Validate document type
      const validDocumentTypes = ['id_proof', 'address_proof', 'professional_certificate'];
      if (!documentType || !validDocumentTypes.includes(documentType)) {
        return res.status(400).json({ 
          error: 'Invalid document type',
          message: 'Document type must be one of: id_proof, address_proof, professional_certificate'
        });
      }
  
      if (!file) {
        return res.status(400).json({ error: 'File is required' });
      }
  
      // Check file type
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ 
          error: 'Invalid file type',
          message: 'Only JPEG, PNG and PDF files are allowed'
        });
      }
  
      // Pass the user's MongoDB _id directly
      const result = await professionalOnboardingService.uploadDocument(
        req.user._id, // Use MongoDB _id
        documentType,
        file
      );
  
      res.json({
        message: 'Document uploaded successfully',
        data: result,
      });
    } catch (error) {
      console.error('Document upload error:', error);
      next(error);
    }
  }
  

  async verifyDocument(req, res) {
    // Set a reasonable timeout
    const OPERATION_TIMEOUT = 15000; // 15 seconds
    const operationStart = Date.now();
    
    try {
      // Log request for debugging
      console.log('Document verification request received:', { 
        body: JSON.stringify(req.body),
        admin: req.user._id
      });
      
      const { professionalId, documentId, isValid, remarks } = req.body;
  
      // Input validation with detailed error messages
      if (!professionalId) {
        return res.status(400).json({
          success: false,
          error: 'Professional ID is required'
        });
      }
  
      if (!documentId) {
        return res.status(400).json({
          success: false,
          error: 'Document ID is required'
        });
      }
  
      if (typeof isValid !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'isValid must be a boolean (true or false)'
        });
      }
  
      // Ensure the user is an admin
      if (req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only administrators can verify documents'
        });
      }
  
      // Find professional with timeout check
      let professional = null;
      
      try {
        // First try to find by MongoDB _id if it's a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(professionalId)) {
          professional = await Professional.findById(professionalId)
            .maxTimeMS(OPERATION_TIMEOUT);
          
          console.log(`Search by _id (${professionalId}): ${professional ? 'Found' : 'Not found'}`);
        }
        
        // If not found, try to find by userId (the "PRO..." string)
        if (!professional) {
          professional = await Professional.findOne({ userId: professionalId })
            .maxTimeMS(OPERATION_TIMEOUT);
          
          console.log(`Search by userId (${professionalId}): ${professional ? 'Found' : 'Not found'}`);
        }
      } catch (findError) {
        console.error('Error finding professional:', findError);
        return res.status(findError.name === 'MongoTimeoutError' ? 504 : 500).json({
          success: false,
          error: 'Failed to find professional',
          message: findError.message
        });
      }
  
      if (!professional) {
        return res.status(404).json({
          success: false,
          error: 'Professional not found'
        });
      }
  
      console.log(`Found professional: ${professional._id} (${professional.name})`);
      
      // Check if professional has documents
      if (!professional.documents || !professional.documents.length) {
        return res.status(400).json({
          success: false,
          error: 'Professional has no documents to verify'
        });
      }
  
      // Find the document using string comparison for safety
      const documentIndex = professional.documents.findIndex(doc => 
        doc._id.toString() === documentId
      );
  
      if (documentIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Document not found for this professional'
        });
      }
  
      const document = professional.documents[documentIndex];
      if (!document.type) {
        return res.status(400).json({
          success: false,
          error: 'Document has no type specified'
        });
      }
      
      const documentType = document.type;
      console.log(`Found document: ${documentType} (${documentId})`);
  
      // Calculate new status
      const newStatus = isValid ? 'approved' : 'rejected';
      console.log(`Updating document status to: ${newStatus}`);
      
      // Create update operations
      const updateData = {};
      updateData[`documents.${documentIndex}.status`] = newStatus;
      updateData[`documents.${documentIndex}.verifiedAt`] = new Date();
      updateData[`documents.${documentIndex}.verifiedBy`] = req.user._id;
      updateData[`documentsStatus.${documentType}`] = newStatus;
      
      // Add remarks if provided
      if (remarks) {
        updateData[`documents.${documentIndex}.remarks`] = remarks;
      }
      
      // Update the document with timeout
      try {
        professional = await Professional.findByIdAndUpdate(
          professional._id,
          { $set: updateData },
          { 
            new: true,
            maxTimeMS: OPERATION_TIMEOUT - (Date.now() - operationStart)
          }
        );
        
        if (!professional) {
          throw new Error('Failed to update document status');
        }
      } catch (updateError) {
        console.error('Error updating document status:', updateError);
        return res.status(updateError.name === 'MongoTimeoutError' ? 504 : 500).json({
          success: false,
          error: 'Failed to update document status',
          message: updateError.message
        });
      }
      
      // Define which documents are required vs. optional
      const requiredDocuments = ['id_proof', 'address_proof'];
      const optionalDocuments = ['professional_certificate'];
      
      // Check for any rejected required documents
      const hasRejectedRequired = requiredDocuments.some(
        docType => professional.documentsStatus[docType] === 'rejected'
      );
      
      // Check if all required documents are approved
      const allRequiredApproved = requiredDocuments.every(
        docType => professional.documentsStatus[docType] === 'approved'
      );
      
      // Check if any required documents are pending
      const hasRequiredPending = requiredDocuments.some(
        docType => professional.documentsStatus[docType] === 'pending'
      );
      
      // Determine the professional's overall status
      let newProfessionalStatus;
      if (hasRejectedRequired) {
        // If any required document is rejected, the status is rejected
        newProfessionalStatus = 'rejected';
      } else if (allRequiredApproved) {
        // If all required documents are approved, the status is verified
        // regardless of optional documents
        newProfessionalStatus = 'verified';
      } else if (hasRequiredPending) {
        // If any required document is pending, the status is under_review
        newProfessionalStatus = 'under_review';
      } else {
        // If some required documents are not submitted, the status is document_pending
        newProfessionalStatus = 'document_pending';
      }
      
      console.log(`Updating professional status from ${professional.status} to ${newProfessionalStatus}`);
      
      // Update onboarding step if appropriate
      let onboardingStep = professional.onboardingStep;
      if (newProfessionalStatus === 'verified' && professional.onboardingStep === 'documents') {
        onboardingStep = 'completed';
      }
      
      // Generate employee ID if verified and doesn't have one yet
      let employeeId = professional.employeeId;
      if (newProfessionalStatus === 'verified' && !professional.employeeId) {
        const year = new Date().getFullYear().toString().substr(-2);
        
        // Get the count with a short timeout
        try {
          const count = await Professional.countDocuments().maxTimeMS(2000);
          employeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
        } catch (countError) {
          // If count fails, use timestamp instead
          console.warn('Count operation failed, using timestamp instead:', countError);
          employeeId = `PRO${year}${Date.now().toString().slice(-6)}`;
        }
      }
      
      // Check if we're taking too long
      if (Date.now() - operationStart > OPERATION_TIMEOUT) {
        // If we're running out of time, return success for the document update
        // and trigger the status update asynchronously
        this.updateProfessionalStatusAsync(
          professional._id, 
          newProfessionalStatus, 
          onboardingStep, 
          employeeId
        );
        
        return res.status(200).json({
          success: true,
          message: `Document ${isValid ? 'approved' : 'rejected'} successfully. Professional status will be updated shortly.`,
          professional: professional
        });
      }
      
      // Update professional status if we have time left
      try {
        professional = await Professional.findByIdAndUpdate(
          professional._id,
          { 
            $set: {
              status: newProfessionalStatus,
              onboardingStep: onboardingStep,
              ...(employeeId ? { employeeId } : {}),
              updatedAt: new Date()
            } 
          },
          { 
            new: true,
            maxTimeMS: OPERATION_TIMEOUT - (Date.now() - operationStart)
          }
        );
      } catch (statusUpdateError) {
        console.error('Error updating professional status:', statusUpdateError);
        
        // Still return success for the document verification part
        return res.status(200).json({
          success: true,
          message: `Document ${isValid ? 'approved' : 'rejected'} successfully, but failed to update overall status.`,
          professional: professional
        });
      }
      
      // Send notification to the professional (don't wait for it)
      try {
        sendNotification(professional.userId, 'document_verification', {
          status: newStatus,
          documentType,
          remarks: remarks || ''
        }).catch(notificationError => {
          console.warn('Failed to send notification:', notificationError);
        });
      } catch (notificationError) {
        console.warn('Failed to initialize notification:', notificationError);
      }
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: `Document ${isValid ? 'approved' : 'rejected'} successfully`,
        professional
      });
      
    } catch (error) {
      console.error('Error in document verification:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to verify document'
      });
    }
  }
  
  // Helper method to update professional status asynchronously
  async updateProfessionalStatusAsync(professionalId, newStatus, onboardingStep, employeeId) {
    try {
      await Professional.findByIdAndUpdate(
        professionalId,
        { 
          $set: {
            status: newStatus,
            onboardingStep: onboardingStep,
            ...(employeeId ? { employeeId } : {}),
            updatedAt: new Date()
          } 
        },
        { maxTimeMS: 10000 }
      );
      
      console.log(`Async status update completed for professional ${professionalId}`);
    } catch (error) {
      console.error(`Async status update failed for professional ${professionalId}:`, error);
    }
  }

  async getOnboardingStatus(req, res, next) {
    try {
      // Pass the user's MongoDB _id directly
      const status = await professionalOnboardingService.getOnboardingStatus(
        req.user._id // Use MongoDB _id
      );
      res.json(status);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProfessionalOnboardingController();