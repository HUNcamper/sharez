// Code credit: https://github.com/whats-this/api/blob/master/lib/fileS3.js

const AWS = require('aws-sdk');
const config = require('../config.json');	// config file

// Create service configuration object
const serviceConfiguration = {
  apiVersion: '2006-03-01',
  accessKeyId: config['S3'].acceskey,
  correctClockSkew: true,
  secretAccessKey: config['S3'].secretkey,
  sslEnabled: true
};
if (config['S3'].endpoint_url) {
  serviceConfiguration.endpoint = new AWS.Endpoint(config['S3'].endpoint_url);
  serviceConfiguration.signatureVersion = 'v4';
}

// Create S3 client
module.exports = new AWS.S3(serviceConfiguration);