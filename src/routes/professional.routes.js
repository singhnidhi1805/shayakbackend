/**
 * @swagger
 * tags:
 *   name: Professional
 *   description: API to manage Professional
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const multer = require('multer');
const { 
  getProfessionals,
  getProfessionalAvailability,
  validateProfessionalDocuments,
  updateProfessionalLocation,
  updateProfessionalProfile,
  getProfessionalById,
  verifyDocument,
  testVerifyDocument,
  checkDocumentVerificationStatus
} = require('../controllers/professional.controller');

const { ProfessionalService } = require('../services/professional.service');
/**
 * @swagger
 * /professionals:
 *   get:
 *     tags:
 *       - Professional
 *     summary: Get a list of professionals
 *     parameters:
 *       - in: query
 *         name: category
 *         description: Category of the professional
 *         schema:
 *           type: string
 *       - in: query
 *         name: rating
 *         description: Minimum rating of the professional
 *         schema:
 *           type: number
 *       - in: query
 *         name: available
 *         description: Availability of the professional
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: A list of professionals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Professional'
 *       500:
 *         description: Server error
 */
router.get('/', getProfessionals);

/**
 * @swagger
 * /professionals/{id}/availability:
 *   get:
 *     tags:
 *       - Professional
 *     summary: Get the availability of a specific professional
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the professional
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Professional availability
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   time:
 *                     type: string
 *                   available:
 *                     type: boolean
 *       500:
 *         description: Server error
 */
router.get('/:id/availability', getProfessionalAvailability);

// /**
//  * @swagger
//  * /professionals/documents/validate:
//  *   post:
//  *     tags:
//  *       - Professional
//  *     summary: Validate the professional's document
//  *     parameters:
//  *       - in: body
//  *         name: document
//  *         description: Document details to validate
//  *         required: true
//  *         schema:
//  *           type: object
//  *           properties:
//  *             professionalId:
//  *               type: string
//  *               description: The ID of the professional
//  *             documentId:
//  *               type: string
//  *               description: The ID of the document
//  *             status:
//  *               type: string
//  *               enum:
//  *                 - approved
//  *                 - rejected
//  *               description: Status of the document
//  *             remarks:
//  *               type: string
//  *               description: Additional remarks for the document
//  *     responses:
//  *       200:
//  *         description: Document validated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 status:
//  *                   type: string
//  *       403:
//  *         description: Unauthorized
//  *       500:
//  *         description: Server error
//  */
// router.post('/documents/validate', auth, validateProfessionalDocuments);

/**
 * @swagger
 * /professionals/location:
 *   put:
 *     tags:
 *       - Professional
 *     summary: Update the professional's location
 *     parameters:
 *       - in: body
 *         name: location
 *         description: Location details of the professional
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               description: Coordinates (latitude, longitude)
 *             isAvailable:
 *               type: boolean
 *               description: Availability status of the professional
 *     responses:
 *       200:
 *         description: Professional location updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       404:
 *         description: Professional not found
 *       500:
 *         description: Server error
 */
router.put('/location', auth, updateProfessionalLocation);

/**
 * @swagger
 * /professionals/profile:
 *   put:
 *     tags:
 *       - Professional
 *     summary: Update the professional's profile
 *     parameters:
 *       - in: body
 *         name: profile
 *         description: Profile details of the professional
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             specializations:
 *               type: array
 *               items:
 *                 type: string
 *               description: Specializations of the professional
 *             experience:
 *               type: string
 *               description: Experience details of the professional
 *             qualifications:
 *               type: string
 *               description: Qualifications of the professional
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       403:
 *         description: Unauthorized
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /professionals/onboard:
 *   post:
 *     tags:
 *       - Professional
 *     summary: Onboard a new professional
 *     requestBody:
 *       description: Details of the professional to onboard
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the professional
 *               email:
 *                 type: string
 *                 description: Email of the professional
 *               phone:
 *                 type: string
 *                 description: Phone number of the professional
 *               specializations:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specializations of the professional
 *               experience:
 *                 type: string
 *                 description: Professional experience
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Required documents for onboarding
 *     responses:
 *       201:
 *         description: Professional onboarded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: ID of the onboarded professional
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /professionals/metrics:
 *   get:
 *     tags:
 *       - Professional
 *     summary: Track performance metrics of a professional
 *     responses:
 *       200:
 *         description: Metrics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobsCompleted:
 *                   type: number
 *                   description: Total jobs completed by the professional
 *                 ratings:
 *                   type: number
 *                   description: Average rating of the professional
 *                 feedbacks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       feedback:
 *                         type: string
 *                         description: Customer feedback
 *                       date:
 *                         type: string
 *                         format: date-time
 *                         description: Date of feedback
 *       500:
 *         description: Server error
 */


/**
 * @swagger
 * /professionals/{id}:
 *   get:
 *     summary: Get professional by ID
 *     description: Fetches a professional's details by their unique ID.
 *     tags: [Professional]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The professional's unique ID.
 *     responses:
 *       "200":
 *         description: Successfully retrieved professional details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "123456789"
 *                 name:
 *                   type: string
 *                   example: "John Doe"
 *                 email:
 *                   type: string
 *                   example: "john.doe@example.com"
 *                 status:
 *                   type: string
 *                   enum: [under_review, verified, rejected]
 *                   example: "verified"
 *       "400":
 *         description: Invalid ID format
 *       "404":
 *         description: Professional not found
 *       "401":
 *         description: Unauthorized, missing or invalid token
 *       "500":
 *         description: Server error
 */
router.get('/:id', auth, getProfessionalById);

/**
 * @swagger
 * /professionals/documents/verify:
 *   post:
 *     summary: Verify professional documents
 *     description: Allows an admin to verify a professional's uploaded documents.
 *     tags: [Professional]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professionalId:
 *                 type: string
 *                 example: "123456789"
 *               documentId:
 *                 type: string
 *                 example: "doc123"
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 example: "approved"
 *               reason:
 *                 type: string
 *                 example: "Document verified successfully."
 *     responses:
 *       "200":
 *         description: Document verification status updated successfully
 *       "400":
 *         description: Missing or invalid parameters
 *       "401":
 *         description: Unauthorized, missing or invalid token
 *       "404":
 *         description: Professional or document not found
 *       "500":
 *         description: Server error
 */
router.post('/documents/verify', auth, verifyDocument);

/**
 * @swagger
 * /professionals/{id}/documents:
 *   get:
 *     summary: Get professional documents by professional ID
 *     description: Fetches the documents of a professional by their ID.
 *     tags: [Professional]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The professional's ID (either _id or userId).
 *     responses:
 *       "200":
 *         description: Successfully retrieved professional documents
 *       "404":
 *         description: Professional not found
 *       "500":
 *         description: Server error
 */
router.get('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching documents for professional with ID: ${id}`);
    
    const mongoose = require('mongoose');
    const Professional = require('../models/professional.model'); // Adjust path as needed
    
    // Try to find the professional by the given ID
    let professional = null;
    
    // First, try direct ID match
    if (mongoose.Types.ObjectId.isValid(id)) {
      professional = await Professional.findById(id);
      console.log(`Search by direct ID ${id}: ${professional ? 'Found' : 'Not found'}`);
    }
    
    // If not found, try as userId
    if (!professional) {
      professional = await Professional.findOne({ userId: id });
      console.log(`Search by userId ${id}: ${professional ? 'Found' : 'Not found'}`);
    }
    
    // If still not found, this might be a user ID, so check if it matches the first document's pattern
    if (!professional && id.startsWith('PRO')) {
      // First, get the user document with this custom ID
      const userProfessional = await Professional.findOne({ userId: id });
      
      if (userProfessional) {
        console.log(`Found user professional with custom ID: ${id}`);
        // Now find the professional document that references this user's ID
        professional = await Professional.findOne({ userId: userProfessional._id.toString() });
        console.log(`Search for professional linked to user: ${professional ? 'Found' : 'Not found'}`);
      }
    }
    
    if (!professional) {
      console.log(`No professional found for ID: ${id}`);
      return res.status(404).json({ error: 'Professional not found' });
    }
    
    console.log(`Found professional: ${professional.name}, Documents: ${professional.documents.length}`);
    
    // Return the professional with documents
    res.json({ 
      professional: {
        _id: professional._id,
        name: professional.name,
        email: professional.email,
        phone: professional.phone,
        userId: professional.userId,
        status: professional.status,
        onboardingStep: professional.onboardingStep,
        documentsStatus: professional.documentsStatus,
        documents: professional.documents,
        // Include other necessary fields
        address: professional.address,
        city: professional.city,
        state: professional.state,
        pincode: professional.pincode,
        employeeId: professional.employeeId,
        createdAt: professional.createdAt,
        updatedAt: professional.updatedAt,
        alternatePhone: professional.alternatePhone,
        specializations: professional.specializations
      }
    });
  } catch (error) {
    console.error('Error fetching professional documents:', error);
    res.status(500).json({ error: 'Failed to fetch professional documents: ' + error.message });
  }
});

/**
 * @swagger
 * /professionals/documents/test-verify:
 *   post:
 *     summary: Test document verification
 *     description: Allows an admin to test the verification of a professional's documents.
 *     tags: [Professional]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professionalId:
 *                 type: string
 *                 example: "123456789"
 *               documentId:
 *                 type: string
 *                 example: "doc123"
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 example: "approved"
 *               reason:
 *                 type: string
 *                 example: "Test verification successful."
 *     responses:
 *       "200":
 *         description: Test document verification status updated successfully
 *       "400":
 *         description: Missing or invalid parameters
 *       "401":
 *         description: Unauthorized, missing, or invalid token
 *       "404":
 *         description: Professional or document not found
 *       "500":
 *         description: Server error
 */
router.post('/documents/test-verify', auth, testVerifyDocument);

/**
 * @swagger
 * /professionals/documents/check-status:
 *   post:
 *     summary: Check document verification status
 *     description: Allows a professional to check the status of their document verification.
 *     tags: [Professional]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professionalId:
 *                 type: string
 *                 example: "123456789"
 *               documentId:
 *                 type: string
 *                 example: "doc123"
 *     responses:
 *       "200":
 *         description: Document verification status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documentId:
 *                   type: string
 *                   example: "doc123"
 *                 status:
 *                   type: string
 *                   enum: [pending, approved, rejected]
 *                   example: "approved"
 *                 remarks:
 *                   type: string
 *                   example: "Document verified successfully."
 *       "400":
 *         description: Missing or invalid parameters
 *       "401":
 *         description: Unauthorized, missing, or invalid token
 *       "404":
 *         description: Professional or document not found
 *       "500":
 *         description: Server error
 */
router.post('/documents/check-status', auth, checkDocumentVerificationStatus);



router.put('/profile', auth, updateProfessionalProfile);

router.post('/onboard', auth, async (req, res) => {
    try {
      const { error } = professionalValidation.onboarding.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
  
      const professional = await ProfessionalService.onboardProfessional(req.body);
      res.status(201).json(professional);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.put('/location', auth, async (req, res) => {
    try {
      const { coordinates } = req.body;
      await ProfessionalService.updateLocation(req.user._id, coordinates);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get('/metrics', auth, async (req, res) => {
    try {
      const metrics = await ProfessionalService.trackPerformanceMetrics(req.user._id);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

module.exports = router;
