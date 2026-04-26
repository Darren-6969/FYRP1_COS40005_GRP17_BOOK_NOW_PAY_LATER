const crypto = require('crypto');

const encryptionKey = Buffer.from('12345678901234567890123456789012', 'utf8'); // 256-bit key
const iv = Buffer.from('1234567890123456', 'utf8'); // Initialization vector

exports.encrypt = (text) => {
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

exports.decrypt = (encryptedText) => {
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};