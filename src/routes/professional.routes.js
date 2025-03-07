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
