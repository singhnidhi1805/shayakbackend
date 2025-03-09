const professionalOnboardingService = require('../services/professional-onboarding.service');
const { validationResult } = require('express-validator');
const createError = require('http-errors');

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
  

  async verifyDocument(req, res, next) {
    try {
      const { professionalId, documentId, isValid, remarks } = req.body;

      if (!professionalId || !documentId) {
        throw createError(400, 'Professional ID and Document ID are required');
      }

      const result = await professionalOnboardingService.verifyDocument(
        professionalId,
        documentId,
        req.user._id,
        isValid,
        remarks
      );

      res.json(result);
    } catch (error) {
      next(error);
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