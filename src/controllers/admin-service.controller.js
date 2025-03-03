const Service = require('../models/service.model');
const logger = require('../config/logger');
const createError = require('http-errors');

class AdminServiceController {
  async createServiceTemplate(req, res) {
    try {
      const { 
        name, 
        category, 
        description, 
        pricing, 
        serviceDetails, 
        customizationOptions 
      } = req.body;

      const newTemplate = new Service({
        name,
        category,
        description,
        pricing,
        serviceDetails,
        customizationOptions,
        createdBy: req.user._id,
        approvedBy: req.user._id
      });

      await newTemplate.save();

      res.status(201).json({
        message: 'Service template created successfully',
        service: newTemplate
      });
    } catch (error) {
      logger.error('Error creating service template', error);
      res.status(500).json({ error: 'Failed to create service template' });
    }
  }

  async updateServiceTemplate(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedTemplate = await Service.findByIdAndUpdate(
        id, 
        { 
          ...updateData, 
          updatedAt: new Date(),
          approvedBy: req.user._id 
        },
        { new: true, runValidators: true }
      );

      if (!updatedTemplate) {
        return res.status(404).json({ error: 'Service template not found' });
      }

      res.json({
        message: 'Service template updated successfully',
        service: updatedTemplate
      });
    } catch (error) {
      logger.error('Error updating service template', error);
      res.status(500).json({ error: 'Failed to update service template' });
    }
  }

  async listServiceTemplates(req, res) {
    try {
      const { category, status } = req.query;
      const filter = {};

      if (category) filter.category = category;
      if (status) filter.isActive = status === 'active';

      const templates = await Service.find(filter)
        .sort({ createdAt: -1 })
        .select('-createdBy -approvedBy');

      res.json({
        message: 'Service templates retrieved successfully',
        templates
      });
    } catch (error) {
      logger.error('Error listing service templates', error);
      res.status(500).json({ error: 'Failed to retrieve service templates' });
    }
  }
}

module.exports = new AdminServiceController();