const prisma = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');

exports.registerUser = async (firstName, lastName, email, password) => {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error('Email already exists');

  const encryptedPassword = encrypt(password);
  const fullName = `${firstName} ${lastName}`;

  // Insert using Prisma mapping to your new schema
  const newUser = await prisma.user.create({
    data: {
      name: fullName,
      email: email,
      password_hash: encryptedPassword,
      role: 'CUSTOMER' // Default role
    }
  });

  return newUser;
};

exports.loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Invalid email or password');

  const decryptedPassword = decrypt(user.password_hash);
  if (password !== decryptedPassword) {
    throw new Error('Invalid email or password');
  }

  return user;
};