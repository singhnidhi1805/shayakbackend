const AWS = require('aws-sdk');
const createError = require('http-errors');
const logger = require('../config/logger');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const bucketName = process.env.AWS_S3_BUCKET_NAME;

/**
 * Upload file to S3
 * @param {Buffer} buffer - File buffer
 * @param {String} key - File key (path in S3)
 * @param {String} contentType - MIME type of the file
 * @returns {Promise<String>} - URL of the uploaded file
 */
const uploadToS3 = async (buffer, key, contentType) => {
  try {
    // Validate inputs
    if (!buffer || !key || !contentType) {
      throw new Error('Missing required parameters');
    }

    if (!bucketName) {
      throw new Error('S3 bucket name not configured');
    }

    const params = {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read' // Make accessible publicly - configure as needed
    };

    const result = await s3.upload(params).promise();
    logger.info(`File uploaded successfully: ${result.Location}`);
    return result.Location;
  } catch (error) {
    logger.error('S3 upload error:', error);
    throw createError(500, 'Failed to upload file: ' + error.message);
  }
};

/**
 * Delete file from S3
 * @param {String} fileUrl - Full URL of the file to delete
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (fileUrl) => {
  try {
    // Extract key from URL
    const key = fileUrl.split('/').slice(3).join('/');
    
    if (!key || !bucketName) {
      throw new Error('Invalid file URL or bucket not configured');
    }
    
    const params = {
      Bucket: bucketName,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
    logger.info(`File deleted successfully: ${key}`);
  } catch (error) {
    logger.error('S3 delete error:', error);
    throw createError(500, 'Failed to delete file: ' + error.message);
  }
};

module.exports = {
  uploadToS3,
  deleteFromS3
};
