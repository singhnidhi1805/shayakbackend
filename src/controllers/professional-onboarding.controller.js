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
      const { email, name, specializations } = req.body;
      if (!email || !name || !specializations || !Array.isArray(specializations) || specializations.length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          details: [
            {
              msg: 'Required fields missing or invalid',
              params: ['email', 'name', 'specializations'],
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

      // Validate specializations
      const validSpecializations = [
        'plumbing',
        'electrical',
        'carpentry',
        'cleaning',
        'painting',
        'landscaping',
        'moving',
        'pest_control'
      ];

      const invalidSpecializations = specializations.filter(
        spec => !validSpecializations.includes(spec.toLowerCase())
      );

      if (invalidSpecializations.length > 0) {
        return res.status(400).json({
          error: 'Validation Error',
          details: [
            {
              msg: 'Invalid specializations',
              param: 'specializations',
              value: invalidSpecializations,
              location: 'body'
            }
          ]
        });
      }

      // If validation passes, proceed with onboarding
      const result = await professionalOnboardingService.initiateOnboarding(
        req.user._id,
        {
          email: email.toLowerCase().trim(),
          name: name.trim(),
          specializations: specializations.map(s => s.toLowerCase())
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

  async uploadDocument(req, res, next) {
    try {
      // Get document type from form data
      const { documentType } = req.body;
      const file = req.file;
  
      // Validate document type
      const validDocumentTypes = ['id_proof', 'address_proof', 'qualification'];
      if (!documentType || !validDocumentTypes.includes(documentType)) {
        return res.status(400).json({ 
          error: 'Invalid document type',
          message: 'Document type must be one of: id_proof, address_proof, qualification'
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
  
      const result = await professionalOnboardingService.uploadDocument(
        req.user._id,
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
      const status = await professionalOnboardingService.getOnboardingStatus(
        req.user._id
      );
      res.json(status);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProfessionalOnboardingController();