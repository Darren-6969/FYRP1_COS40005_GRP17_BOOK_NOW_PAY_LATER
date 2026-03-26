const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client("673433660299-lvc4flptijogcqipvlp6c5teu89ecift.apps.googleusercontent.com");
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const sharp = require('sharp');
require("dotenv").config({ path: path.resolve(__dirname, '.env') });
console.log("Current DATABASE_URL:", process.env.DATABASE_URL);
const bcrypt = require('bcryptjs');
const saltRounds = 10;
const cron = require('node-cron');

// const connectionString = process.env.DATABASE_URL ;
const crypto = require('crypto');
const port =8080;

// Add encryption and decryption keys and functions
const encryptionKey = Buffer.from('12345678901234567890123456789012', 'utf8'); // 256-bit key
const iv = Buffer.from('1234567890123456', 'utf8'); // Initialization vector
// Encryption function
const encrypt = (text) => {
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

// Decryption function
const decrypt = (encryptedText) => {
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 25060,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false   // OK for uni project; encrypts but skips strict check
  }
});

const app = express();


const getDefaultAvatarBase64 = () => {
  return new Promise((resolve, reject) => {
      const defaultAvatarPath = path.join(__dirname, '/public/avatar.png'); 
      fs.readFile(defaultAvatarPath, (err, data) => {
          if (err) {
              reject(err);
          } else {
              const base64Data = data.toString('base64');
              resolve(base64Data);
          }
      });
  });
};

const generateRandomSixDigits = () => Math.floor(100000 + Math.random() * 900000);

const failedAttempts = {}; 

app.get('/', async(req, res) => {
  // console.log('DATABASE_URL:', process.env.DATABASE_URL);
  let client;
  try {
    client = await pool.connect();
    const result = await client.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
    client.release();
  }
  }
});

app.use(express.json());
app.use(cors());

// Set up multer for file uploads with memory storage and size limits
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
      fieldSize: 25 * 1024 * 1024, 
      fileSize: 25 * 1024 * 1024  
  }
});

// Close database connection pool on server shutdown
process.on('SIGINT', async () => {
  if (pool) {
    try {
      await pool.end();   
      console.log('Database connection pool closed');
    } catch (err) {
      console.error('Error closing the connection pool:', err);
    }
  }
  process.exit();
});


// Registration
app.post('/register', async (req, res) => {
  const { firstName, lastName, username, password, email, uphoneno } = req.body;
  let client;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  
  try {
    client = await pool.connect();

    const checkUserQuery = {
      text: `
        SELECT username, uemail FROM users
        WHERE username = $1 OR uemail = $2
      `,
      values: [username, email]
    };
    
    const checkResult = await client.query(checkUserQuery);
    
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ message: 'Username or email already exists', success: false });
    }
    
    // Encrypt the password
    const encryptedPassword = encrypt(password);
    const defaultAvatarBase64 = await getDefaultAvatarBase64();

    const insertUserQuery = {
      text: `
        INSERT INTO users (
          username, password, uemail, utitle, usergroup, ustatus, uactivation, uimage,
          ufirstname, ulastname, clusterid, uphoneno
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING userid
      `,
      values: [
        username,
        encryptedPassword, 
        email,
        "Mr.",
        'Customer',
        'registered',
        'Active',
        defaultAvatarBase64,
        firstName,
        lastName, 
        '1',
        uphoneno
      ]
    };
    
    const userQueryResult = await client.query(insertUserQuery);

    const userid = userQueryResult.rows[0].userid;

    const registerAuditTrail = await client.query (
        `INSERT INTO audit_trail (
            entityid, timestamp, entitytype, actiontype, action, userid, username
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userid, timestamp, "Users", "POST", "Register An Account", userid, username
        ]
    );

    res.status(201).json({ message: 'User registered successfully', success: true });
  } catch (err) {
    console.error('Error during registration:', err.message);
    console.error(err.stack);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

//Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  let client;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);

  try {
    client = await pool.connect();

    const result = await client.query(`
      SELECT userid, usergroup, uactivation, password 
      FROM users 
      WHERE (username = $1 OR uemail = $1)
    `, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password', success: false });
    }

    const user = result.rows[0];

    if (user.uactivation === 'Inactive') {
      return res.status(403).json({ message: 'This account has been suspended. Please try to contact the administrator to activate your account.', success: false });
    }

    // Decrypt the password
    try {
      const decryptedPassword = decrypt(user.password);
      const passwordMatch = (password === decryptedPassword);
      
      if (passwordMatch) {
        delete failedAttempts[username]; // or email
        await client.query(`
          UPDATE users SET ustatus = 'login' WHERE username = $1 OR uemail = $1
        `, [username]);

        const userid = user.userid;

        const loginAuditTrail = await client.query (
            `INSERT INTO audit_trail (
                entityid, timestamp, entitytype, actiontype, action, userid, username
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              userid, timestamp, "Users", "POST", "Login", userid, username
            ]
        );

        return res.status(200).json({
          message: 'Login Successful',
          success: true,
          userid: user.userid,
          usergroup: user.usergroup,
          uactivation: user.uactivation
        });
      } else {
        const now = Date.now();
        
        if (!failedAttempts[username]) {
          failedAttempts[username] = { count: 1, lastAttemptTime: now };
        } else {
          failedAttempts[username].count++;
          failedAttempts[username].lastAttemptTime = now;
        }

        if (failedAttempts[username].count >= 5) {
          
          await client.query(`
            UPDATE users SET uactivation = 'Inactive'
            WHERE username = $1 OR uemail = $1
          `, [username]);

          delete failedAttempts[username];
          
          return res.status(403).json({ message: 'Account locked due to too many failed login attempts.', success: false });
        }
        return res.status(401).json({ message: 'Invalid username or password', success: false });
      }
    } catch (decryptError) {
      console.error('Error decrypting password:', decryptError);
      return res.status(401).json({ message: 'Invalid username or password', success: false });
    }
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

//Logout
app.post('/logout', async (req, res) => {
  const { userid } = req.body;
  let client;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);

  try {
    client = await pool.connect();
    
    const query = {
      text: `UPDATE users SET ustatus = 'logout' WHERE userid = $1`,
      values: [userid]
    };
    
    await client.query(query);

    const usernameQuery = await client.query (
      `SELECT username FROM users WHERE userid = $1`,
      [userid]
    );

    const username = usernameQuery.rows[0].username;

    const logoutAuditTrail = await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userid, timestamp, "Users", "POST", "Logout", userid, username
      ]
    );

    res.status(200).json({ message: 'Logout Successful', success: true });
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Google Login
// REPLACE your app.post("/google-login") block with this:

app.post("/google-login", async (req, res) => {
    const { token } = req.body; 
    const timestamp = new Date();
    let dbClient;

    try {
        // 1. VERIFY ACCESS TOKEN (The method that matches your Frontend)
        const googleResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!googleResponse.ok) {
            throw new Error("Invalid Access Token");
        }

        const payload = await googleResponse.json();
        const { email, given_name, family_name, picture } = payload;

        // 2. CONNECT TO DB
        dbClient = await pool.connect();
        
        // 3. CHECK IF USER EXISTS
        const result = await dbClient.query(
            "SELECT userid, usergroup, uactivation, username FROM users WHERE uemail = $1",
            [email]
        );

        if (result.rows.length > 0) {
            // --- LOGIN (User Exists) ---
            const user = result.rows[0];

            if (user.uactivation === 'Inactive') {
                return res.status(403).json({ success: false, message: "Account suspended." });
            }

            await dbClient.query("UPDATE users SET ustatus = 'login' WHERE uemail = $1", [email]);
            
            // Log Audit
            await dbClient.query(
               `INSERT INTO audit_trail (entityid, timestamp, entitytype, actiontype, action, userid, username)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
               [user.userid, timestamp, "Users", "POST", "Google Login", user.userid, user.username]
            );

            return res.status(200).json({
                success: true,
                message: "Login Successful",
                userid: user.userid,
                usergroup: user.usergroup,
                uactivation: user.uactivation,
                username: user.username
            });
        } else {
            // --- REGISTER (New User) ---
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            const username = given_name ? `${given_name}_${randomSuffix}` : `user_${randomSuffix}`;
            const dummyPassword = crypto.randomBytes(16).toString('hex');
            const encryptedPassword = encrypt(dummyPassword);

            const newUser = await dbClient.query(`
                INSERT INTO users (uemail, ufirstname, ulastname, uimage, utitle, ustatus, usergroup, uactivation, username, password, timestamp)
                VALUES ($1, $2, $3, $4, 'Mr.', 'login', 'Customer', 'Active', $5, $6, $7) 
                RETURNING userid`,
                [email, given_name || '', family_name || '', picture || '', username, encryptedPassword, timestamp]
            );

            const newUserId = newUser.rows[0].userid;

            // Log Audit
            await dbClient.query(
               `INSERT INTO audit_trail (entityid, timestamp, entitytype, actiontype, action, userid, username)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
               [newUserId, timestamp, "Users", "POST", "Google Registration", newUserId, username]
            );

            return res.status(201).json({
                success: true,
                message: "Registration Successful",
                userid: newUserId,
                usergroup: "Customer",
                uactivation: "Active",
                username: username
            });
        }
    } catch (error) {
        console.error("Login Error:", error.message);
        return res.status(401).json({ success: false, message: "Authentication Failed" });
    } finally {
        if (dbClient) dbClient.release();
    }
});

//Fetch list of customers
app.get('/users/customers', async (req, res) => {
  const { userid } = req.query;
  let client;
  
  try {
    client = await pool.connect();

    const clusterResult = await client.query(
      `
        SELECT clusterid, usergroup 
        FROM users
        WHERE userid = $1
      `,
      [userid]
    );

    const clusterid = clusterResult.rows[0].clusterid;
    const usergroup = clusterResult.rows[0].usergroup;
    let result;

    if (usergroup === 'Owner') {
      result = await client.query(`
        SELECT userid, username, uimage, ufirstname, ulastname, uemail, uphoneno, ucountry, uzipcode, uactivation, ustatus, ugender, utitle
        FROM users
        WHERE usergroup = 'Customer'
      `
      ); 
    } else {
      result = await client.query(`
        SELECT userid, username, uimage, ufirstname, ulastname, uemail, uphoneno, ucountry, uzipcode, uactivation, ustatus, ugender, utitle
        FROM users
        WHERE usergroup = 'Customer'
        AND clusterid = $1
      `,
      [clusterid]
      );
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  } 
});

// Fetch list of owners
app.get('/users/owners', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT userid, username, uimage, ufirstname, ulastname, uemail, uphoneno, ucountry, uzipcode, uactivation, ustatus,  ugender, utitle
      FROM users
      WHERE usergroup = 'Owner'
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching owners:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Fetch list of moderators
app.get('/users/moderators', async (req, res) => {
  const { userid } = req.query;
  let client;
  
  try {
    client = await pool.connect();

    const clusterResult = await client.query(
      `
        SELECT clusterid, usergroup 
        FROM users
        WHERE userid = $1
      `,
      [userid]
    );

    const clusterid = clusterResult.rows[0].clusterid;
    const usergroup = clusterResult.rows[0].usergroup;
    let result;

    if (usergroup === 'Owner') {
      // Query to fetch moderators
      result = await client.query(`
        SELECT userid, clusterid, username, uimage, ufirstname, ulastname, uemail, uphoneno, ucountry, uzipcode, uactivation, ustatus, ugender, utitle
        FROM users
        WHERE usergroup = 'Moderator'
      `);
    } else {
      result = await client.query(
        `
        SELECT userid, clusterid, username, uimage, ufirstname, ulastname, uemail, uphoneno, ucountry, uzipcode, uactivation, ustatus, ugender, utitle
        FROM users
        WHERE usergroup = 'Moderator'
        AND clusterid = $1
        `,
        [clusterid]
      );
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching moderators:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Fetch list of operators (Moderators and Administrators)
app.get('/users/operators', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT 
        u.userid, 
        u.clusterid, 
        u.username, 
        u.uimage,  
        u.ufirstname, 
        u.ulastname, 
        u.uemail, 
        u.uphoneno, 
        u.usergroup, 
        u.uactivation, 
        u.ustatus, 
        u.ugender, 
        u.ucountry, 
        u.uzipcode, 
        u.utitle,
        c.clustername
      FROM users u
      LEFT JOIN clusters c ON u.clusterid = c.clusterid
      WHERE u.usergroup IN ('Moderator', 'Administrator')
      ORDER BY u.username
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching operators:", err);
    res.status(500).json({ message: "Server error", success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Fetch list of administrators
app.get('/users/administrators', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT userid, username, uimage, ufirstname, ulastname, uemail, uphoneno, ucountry, uzipcode, uactivation, ustatus, ugender, utitle
      FROM users
      WHERE usergroup = 'Administrator'
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching administrators:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Create moderators
app.post('/users/createModerator', async (req, res) => {
  const { firstName, lastName, username, password, email, phoneNo, country, zipCode, creatorid, creatorUsername } = req.body;
  let client;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);

  try {
    client = await pool.connect();

    // Check if the username or email already exists
    const checkUser = await client.query(
      `SELECT username, uemail FROM users WHERE username = $1 OR uemail = $2`,
      [username, email]
    );

    if (checkUser.rows.length > 0) {
      return res.status(409).json({ message: "Username or email already exists", success: false });
    }

    const defaultAvatar = await getDefaultAvatarBase64();
    // Encrypt the password
    const encryptedPassword = encrypt(password);

    const createModeratorResult = await client.query(
      `INSERT INTO users (ufirstname, ulastname, username, password, uemail, uphoneno, ucountry, uzipcode, utitle, usergroup, ustatus, uactivation, uimage, clusterid, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Mr.', 'Moderator', 'registered', 'Active', $9, '1', $10)
       RETURNING userid`,
      [firstName, lastName, username, encryptedPassword, email, phoneNo, country, zipCode, defaultAvatar, timestamp]
    );

    const entityid = createModeratorResult.rows[0].userid;

    const createModeratorAuditTrail = await client.query (
        `INSERT INTO audit_trail (
            entityid, timestamp, entitytype, actiontype, action, userid, username
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entityid, timestamp, "Users", "POST", "Create New Moderator", creatorid, creatorUsername
        ]
    );
    
    res.status(201).json({ message: "User registered successfully", success: true });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).json({ message: "Server error", success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Update users by user ID
app.put('/users/updateUser/:userid', async (req, res) => {
  const { userid } = req.params;
  const { firstName, lastName, clusterid, username, email, phoneNo, country, zipCode, creatorid, creatorUsername } = req.body;
  
  let client;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000); 
  
  try {
    client = await pool.connect();

    const updateQuery = `
      UPDATE users
      SET ufirstname = $1, 
          ulastname = $2, 
          clusterid = $3,
          username = $4, 
          uemail = $5,
          uphoneno = $6,
          ucountry = $7,
          uzipcode = $8
      WHERE userid = $9
    `;

    const updateValues = [firstName, lastName, clusterid, username, email, phoneNo, country, zipCode, userid];

    await client.query(updateQuery, updateValues);

    await client.query(
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userid, timestamp, "Users", "PUT", "Update User Info", creatorid, creatorUsername]
    );

    res.status(200).json({ message: 'User updated successfully' });

  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Remove users by user ID
app.delete('/users/removeUser/:userid', async (req, res) => {
  const { userid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000); 
  let client;

  try {
    client = await pool.connect();
    
    // Check if the user exists
    const userCheck = await client.query(
      'SELECT userid FROM users WHERE userid = $1',
      [userid]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found', success: false });
    }

    // Delete the user
    await client.query(
      'DELETE FROM users WHERE userid = $1',
      [userid]
    );

    await client.query(
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userid, timestamp, "Users", "DELETE", "Delete User", creatorid, creatorUsername]
    );

    res.status(200).json({ message: 'User removed successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Suspend users by user ID
app.put('/users/suspenduser/:userid', async (req, res) => {
  const { userid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000); 
  let client;

  // Validate userid
  if (isNaN(userid)) {
    return res.status(400).json({ message: 'Invalid userid' });
  }

  try {
    client = await pool.connect();

    // Check if the user exists
    const userCheck = await client.query(
      `SELECT userid FROM users WHERE userid = $1`,
      [userid]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Suspend the user and set status to logout
    await client.query(
      `UPDATE users SET uactivation = 'Inactive' WHERE userid = $1`,
      [userid]
    );

    await client.query(
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userid, timestamp, "Users", "PUT", "Suspend User", creatorid, creatorUsername]
    );

    res.status(200).json({ message: 'User suspended successfully' });
  } catch (err) {
    console.error('Error suspending user:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Activate users by userid
app.put('/users/activateUser/:userid', async (req, res) => {
  const { userid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000); 
  let client;

  // Validate userid
  if (isNaN(userid)) {
    return res.status(400).json({ message: 'Invalid userid' });
  }

  try {
    client = await pool.connect();

    // Check if the user exists
    const userCheck = await client.query(
      `SELECT userid FROM users WHERE userid = $1`,
      [userid]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Activate the user
    await client.query(
      `UPDATE users SET uactivation = 'Active' WHERE userid = $1`,
      [userid]
    );

    await client.query(
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userid, timestamp, "Users", "PUT", "Activate User", creatorid, creatorUsername]
    );

    res.status(200).json({ message: 'User activated successfully' });
  } catch (err) {
    console.error('Error activating user:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Properties Listing
app.post('/propertiesListing', upload.array('propertyImage', 10), async (req, res) => {
  const {
      username,
      propertyPrice,
      propertyAddress,
      clusterName,
      categoryName,
      propertyBedType,
      propertyGuestPaxNo,
      propertyDescription,
      nearbyLocation,
      facilities,
      weekendRate,
      specialEventRate,
      specialEventStartDate,
      specialEventEndDate,
      earlyBirdDiscountRate,
      lastMinuteDiscountRate,
      isSpecialEventEnabled
  } = req.body;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000); 
  
  if (!req.files || req.files.length < 4) {
      return res.status(400).json({ error: 'Please upload at least 4 property images.' });
  }
  
  let client;
  try {
      client = await pool.connect();
      await client.query('BEGIN');
      // Fetch user ID and userGroup for property owner
      const userResult = await client.query(
          'SELECT userid, usergroup FROM users WHERE username = $1',
          [username]
      );
    
      if (userResult.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
      }
    
      const { userid, usergroup } = userResult.rows[0];
      // Determine propertyStatus based on userGroup
      const propertyStatus = usergroup === 'Administrator' ? 'Available' : 'Pending';
      
      // WITH THIS RESIZING CODE:
      const base64Images = await Promise.all(req.files.map(async (file) => {
        try {
          // Resize image to max dimensions while preserving aspect ratio
          const resizedImageBuffer = await sharp(file.buffer)
            .resize({
              width: 800,
              height: 600,
              fit: 'inside', // preserves aspect ratio
              withoutEnlargement: true // don't enlarge images smaller than these dimensions
            })
            .jpeg({ 
              quality: 80, // compress quality (0-100)
              progressive: true // create progressive JPEG for better loading
            })
            .toBuffer();
            
          return resizedImageBuffer.toString('base64');
        } catch (err) {
          console.error('Image processing error:', err);
          // Return original image as fallback if processing fails
          return file.buffer.toString('base64');
        }
      }));
      
      const concatenatedImages = base64Images.join(',');
      
      // Insert rate
      const rateResult = await client.query(
          `INSERT INTO rate (
              normalrate, 
              weekendrate,
              specialeventrate,
              earlybirddiscountrate,
              lastminutediscountrate,
              startdate,
              enddate,
              userid,
              timestamp
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING rateid`,
          [
              propertyPrice,
              weekendRate,
              specialEventRate,
              earlyBirdDiscountRate,
              lastMinuteDiscountRate,
              isSpecialEventEnabled ? specialEventStartDate : null,  // Use null if disabled
              isSpecialEventEnabled ? specialEventEndDate : null,    // Use null if disabled
              userid,
              timestamp
          ]
      );
    
      const rateID = rateResult.rows[0].rateid;
      let clusterID;
      const existingCluster = await client.query(
          'SELECT clusterid FROM clusters WHERE clustername = $1',
          [clusterName]
      );
      
      if (existingCluster.rows.length > 0) {
          clusterID = existingCluster.rows[0].clusterid;
      } else {
          const clusterResult = await client.query(
              `INSERT INTO clusters (clustername, clusterstate, clusterprovince)
               VALUES ($1, $2, $3)
               RETURNING clusterid`,
              [clusterName, "DefaultState", "DefaultProvince"]
          );
          clusterID = clusterResult.rows[0].clusterid;
      }
    
      let categoryID;
      const existingCategory = await client.query(
          'SELECT categoryid FROM categories WHERE categoryname = $1',
          [categoryName]
      );
    
      if (existingCategory.rows.length > 0) {
          categoryID = existingCategory.rows[0].categoryid;
      } else {
          const categoryResult = await client.query(
              `INSERT INTO categories (categoryname, availablestates)
               VALUES ($1, $2)
               RETURNING categoryid`,
              [categoryName, "DefaultStates"]
          );
          categoryID = categoryResult.rows[0].categoryid;
      }
    
      // Insert property
      const propertyListingResult = await client.query(
          `INSERT INTO properties (
              propertyno, userid, clusterid, categoryid, rateid,
              propertydescription, propertyaddress,
              propertybedtype, propertybedimage, propertyguestpaxno, propertyimage,
              propertystatus, nearbylocation, rating, facilities, policies
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING propertyid`,
          [
              "1", userid, clusterID, categoryID, rateID,
              propertyDescription, propertyAddress,
              propertyBedType, "1", propertyGuestPaxNo, concatenatedImages,
              propertyStatus, nearbyLocation, "0", facilities, "policies"
          ]
      );

      const propertyid = propertyListingResult.rows[0].propertyid;
      
      await client.query('COMMIT');

      if (usergroup === "Administrator") {
        await client.query(
          `INSERT INTO audit_trail (
              entityid, timestamp, entitytype, actiontype, action, userid, username
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [propertyid, timestamp, "Properties", "POST", "Create New Property", userid, username]
        );
      }

      res.status(201).json({ message: 'Property created successfully', propertyid });
  } catch (err) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error('Error inserting property: ', err);
      res.status(500).json({ error: 'Internal Server Error', details: err.message });
  } finally {
      if (client) {
        client.release();
      }
  }
});

// Fetch list of all property listings (Product)
app.get('/product', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const query = `
      SELECT DISTINCT ON (p.propertyid) p.*, u.username, u.uimage, r.*, c.categoryname, cl.clustername, res.reservationid, res.checkindatetime, res.checkoutdatetime, res.reservationblocktime, res.reservationstatus
      FROM properties p
      JOIN rate r ON p.rateid = r.rateid
      JOIN categories c ON p.categoryid = c.categoryid
      JOIN clusters cl ON p.clusterid = cl.clusterid
      JOIN users u ON p.userid = u.userid
      LEFT JOIN reservation res ON p.propertyid = res.propertyid
      WHERE p.propertystatus = 'Available'
    `;
    
    const result = await client.query(query);
    
    if (result.rows.length > 0) {
      console.log('Sample property object from database:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('No properties found');
    }
    
    const properties = result.rows.map(property => {
      console.log(`Property ID ${property.propertyid} - Original image data:`, 
                  property.propertyimage ? property.propertyimage.substring(0, 50) + '...' : 'No image');
      
      const processedProperty = {
      ...property,
        propertyimage: property.propertyimage ? property.propertyimage.split(',') : []
      };
      
      console.log(`Property ID ${property.propertyid} - Processed image array length:`, 
                  processedProperty.propertyimage.length);
      
      return processedProperty;
    });
    
    if (properties.length > 0) {
      console.log('Sample processed property object:');
      const sampleProperty = {...properties[0]};
      if (sampleProperty.propertyimage && sampleProperty.propertyimage.length > 0) {
        sampleProperty.propertyimage = [`${sampleProperty.propertyimage[0].substring(0, 50)}... (truncated)`, 
                                       `and ${sampleProperty.propertyimage.length - 1} more images`];
      }
      console.log(JSON.stringify(sampleProperty, null, 2));
    }

    res.status(200).json(properties);
  } catch (err) {
    console.error('Error fetching properties: ', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Fetch list of all property listings (Dashboard)
app.get('/propertiesListingTable', async (req, res) => {
  const username = req.query.username;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  let client;
  try {
    client = await pool.connect();
    
    const userResult = await client.query(
      'SELECT userid, usergroup, clusterid FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userid = userResult.rows[0].userid;
    const usergroup = userResult.rows[0].usergroup;
    const userClusterid = userResult.rows[0].clusterid;

    let query;
    let params = [];

    if (usergroup === 'Moderator') {
      // Moderator can only see their own properties
      query = `
        SELECT 
          p.propertyid, 
          p.propertyaddress, 
          p.nearbylocation,
          p.propertybedtype, 
          p.propertyguestpaxno, 
          p.propertydescription, 
          p.propertystatus, 
          p.propertyimage,
          p.facilities,
          u.ufirstname, 
          u.ulastname,
          u.username,
          u.usergroup,
          r.*,
          cl.clustername,
          c.categoryname
        FROM properties p
        JOIN users u ON p.userid = u.userid
        JOIN rate r ON p.rateid = r.rateid
        JOIN clusters cl ON p.clusterid = cl.clusterid
        JOIN categories c ON p.categoryid = c.categoryid
        WHERE p.userid = $1
      `;
      params = [userid];
    } else if (usergroup === 'Administrator' && userClusterid) {
      // Administrator can only see properties in their own cluster
      query = `
        SELECT 
          p.propertyid, 
          p.propertyaddress, 
          p.nearbylocation,
          p.propertybedtype, 
          p.propertyguestpaxno, 
          p.propertydescription, 
          p.propertystatus, 
          p.propertyimage,
          p.facilities,
          u.ufirstname, 
          u.ulastname,
          u.username,
          u.usergroup,
          r.*,
          cl.clustername,
          c.categoryname
        FROM properties p
        JOIN users u ON p.userid = u.userid
        JOIN rate r ON p.rateid = r.rateid
        JOIN clusters cl ON p.clusterid = cl.clusterid
        JOIN categories c ON p.categoryid = c.categoryid
        WHERE p.clusterid = $1
      `;
      params = [userClusterid];
    } else {
      // Other user types or Administrator without cluster can see all properties
      query = `
        SELECT 
          p.propertyid, 
          p.propertyaddress, 
          p.nearbylocation,
          p.propertybedtype, 
          p.propertyguestpaxno, 
          p.propertydescription, 
          p.propertystatus, 
          p.propertyimage,
          p.facilities,
          u.ufirstname, 
          u.ulastname,
          u.username,
          u.usergroup,
          r.*,
          cl.clustername,
          c.categoryname
        FROM properties p
        JOIN users u ON p.userid = u.userid
        JOIN rate r ON p.rateid = r.rateid
        JOIN clusters cl ON p.clusterid = cl.clusterid
        JOIN categories c ON p.categoryid = c.categoryid
      `; 
    }

    const result = await client.query(query, params);

    const properties = result.rows.map(property => ({
      ...property,
      propertyimage: property.propertyimage ? property.propertyimage.split(',') : []
    }));

    res.status(200).json({ properties });
  } catch (err) {
    console.error('Error fetching properties: ', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  } 
});

// Update an existing property listing by property ID
app.put('/propertiesListing/:propertyid', upload.array('propertyImage', 10), async (req, res) => {
    const { propertyid } = req.params;
    const {
        propertyAddress, propertyPrice, propertyDescription, nearbyLocation,
        propertyBedType, propertyGuestPaxNo, clusterName, categoryName, facilities,
        username, weekendRate, specialEventRate, specialEventStartDate, specialEventEndDate,
        earlyBirdDiscountRate, lastMinuteDiscountRate
    } = req.body;
    const { creatorid, creatorUsername } = req.query;
    const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000); 

    const removedImages = req.body.removedImages ? JSON.parse(req.body.removedImages) : [];

    let client;
    try {
        client = await pool.connect();

        // First get the user's group
        const userResult = await client.query(
            'SELECT usergroup FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const usergroup = userResult.rows[0].usergroup;

        // Fetch the current status of the property
        const propertyResult = await client.query(
            'SELECT propertystatus, propertyimage, rateid, clusterid, categoryid, facilities FROM properties WHERE propertyid = $1',
            [propertyid]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }

        let existingImages = propertyResult.rows[0].propertyimage
            ? propertyResult.rows[0].propertyimage.split(',')
            : [];

        // Filter out removed images
        existingImages = existingImages.filter(image => !removedImages.includes(image));

        // Add new uploaded images if any
        if (req.files && req.files.length > 0) {
            const newBase64Images = req.files.map(file => file.buffer.toString('base64'));
            existingImages = [...existingImages, ...newBase64Images];
        }

        const concatenatedImages = existingImages.join(',');

        // Determine the new status
        let newStatus = propertyResult.rows[0].propertystatus;
      
        if (usergroup === "Moderator") {
            newStatus = "Pending";
        }

        // Update the property details
        await client.query(
            `UPDATE properties 
             SET propertydescription = $1, 
                 propertyaddress = $2, 
                 nearbylocation = $3, 
                 propertybedtype = $4, 
                 propertyguestpaxno = $5, 
                 propertyimage = $6,
                 facilities = $7,
                 propertystatus = $8
             WHERE propertyid = $9`,
            [
                propertyDescription,
                propertyAddress,
                nearbyLocation,
                propertyBedType,
                propertyGuestPaxNo,
                concatenatedImages,
                facilities,
                newStatus,
                propertyid
            ]
        );

        await client.query(
            `UPDATE rate 
             SET normalrate = $1,
                 weekendrate = $2,
                 specialeventrate = $3,
                 earlybirddiscountrate = $4,
                 lastminutediscountrate = $5,
                 startdate = $6,
                 enddate = $7
             WHERE rateid = $8`,
            [
                propertyPrice,
                weekendRate,
                specialEventRate,
                earlyBirdDiscountRate,
                lastMinuteDiscountRate,
                specialEventStartDate,
                specialEventEndDate,
                propertyResult.rows[0].rateid
            ]
        );

        await client.query(
            `UPDATE clusters 
             SET clustername = $1 
             WHERE clusterid = $2`,
            [clusterName, propertyResult.rows[0].clusterid]
        );

        await client.query(
            `UPDATE categories 
             SET categoryname = $1 
             WHERE categoryid = $2`,
            [categoryName, propertyResult.rows[0].categoryid]
        );

      await client.query(
        `INSERT INTO audit_trail (
            entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [propertyid, timestamp, "Properties", "PUT", "Update Property Info", creatorid, creatorUsername]
      );

      res.status(200).json({ message: 'Property updated successfully' });
    } catch (err) {
        console.error('Error updating property:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    } finally {
        if (client) {
            client.release(); 
        }
    }
});

// Update Property Status API
app.patch("/updatePropertyStatus/:propertyid", async (req, res) => {
  const { propertyid } = req.params;
  const { propertyStatus } = req.body;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000); 

  if (!propertyStatus) {
    return res.status(400).json({ message: "Property status is required" });
  }

  let client;
  
  try {
    client = await pool.connect();
    
    const result = await client.query(
      'UPDATE properties SET propertystatus = $1 WHERE propertyid = $2 RETURNING *',
      [propertyStatus, propertyid] 
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
       [propertyid, timestamp, "Properties", "PATCH", "Update Property Status", creatorid, creatorUsername]
    );

    res.status(200).json({ message: "Property status updated successfully", property: result.rows[0] });
  } catch (error) {
    console.error("Error updating property status:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    if (client) {
      client.release(); 
    }
  }
});

// Remove Properties Listing
app.delete('/removePropertiesListing/:propertyid', async (req, res) => {
    const { propertyid } = req.params;
    const { creatorid, creatorUsername } = req.query;
    const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000); 
    let client;
  
    try {
      client = await pool.connect();
  
      // Check if the property exists
      const propertyCheck = await client.query(
        'SELECT propertyid FROM properties WHERE propertyid = $1',
        [propertyid]
      );
  
      if (propertyCheck.rowCount === 0) {
        return res.status(404).json({ message: 'Property not found', success: false });
      }
  
      // Delete the property from the database
      await client.query(
        'DELETE FROM properties WHERE propertyid = $1',
        [propertyid]
      );

      await client.query (
        `INSERT INTO audit_trail (
            entityid, timestamp, entitytype, actiontype, action, userid, username
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
         [propertyid, timestamp, "Properties", "DELETE", "Delete Property", creatorid, creatorUsername]
      );
  
      res.status(200).json({ message: 'Property deleted successfully', success: true });
    } catch (err) {
      console.error('Error deleting property:', err);
      res.status(500).json({ message: 'Internal Server Error'});
    } finally {
      if (client) {
        client.release();
      }
    }
});

// Check user status by userID
app.get('/checkStatus', async(req, res) => {
  const { userid } = req.query;
  let client;

  try {
    client = await pool.connect();
    
    const query = {
      text: 'SELECT userid, username, ustatus, uemail, ufirstname, ulastname FROM "users" WHERE "userid" = $1',
      values: [userid]
    };
    
    const result = await client.query(query);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      res.status(200).json({ 
        ustatus: user.ustatus,
        userInfo: user  
      });
    } else {
      console.log('User not found for ID:', userid);
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error fetching user status:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send contact us email
app.post("/contact_us", async (req, res) => {
    const { name, email, message } = req.body;
    let client;
  
    try {
      client = await pool.connect(); 
  
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `Message from ${name}`,
        html: `
        <h1>New Message from ${name}</h1>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
        <p><strong>Email:</strong> ${email}</p>`,
        replyTo: email, 
      };
  
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email", error: error.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send Booking Request Message To Administrator Or Moderator
app.post('/requestBooking/:reservationid', async (req, res) => {
  const { reservationid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000); 
  let client;

  try {
    client = await pool.connect();
    
    const result = await client.query(
      `SELECT 
        rc.rclastname, 
        rc.rctitle, 
        r.checkindatetime, 
        r.checkoutdatetime, 
        r.request, 
        r.totalprice, 
        p.propertyaddress,
        p.nearbylocation,
        u.uemail 
      FROM reservation_customer_details rc 
      JOIN reservation r ON rc.rcid = r.rcid 
      JOIN properties p ON r.propertyid = p.propertyid 
      JOIN users u ON u.userid = p.userid 
      WHERE r.reservationid = $1`,
      [reservationid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Reservation or user not found for this property' });
    }

    const { 
      rclastname: customerLastName, 
      rctitle: customerTitle, 
      checkindatetime: reservationcheckindatetime, 
      checkoutdatetime: reservationcheckoutdatetime, 
      request: reservationRequest = '-', 
      totalprice: reservationtotalprice, 
      propertyaddress: reservationProperty, 
      nearbylocation: reservationAddress,
      uemail: userEmail 
    } = result.rows[0];

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Booking Request',
      html: `
      <h1><b>Do You Accept This Booking By ${customerTitle} ${customerLastName}?</b></h1><hr/>
      <p><b>Check In Date:</b> ${reservationcheckindatetime}</p>
      <p><b>Check Out Date:</b> ${reservationcheckoutdatetime}</p>
      <p><b>Request:</b> ${reservationRequest}</p>
      <p><b>Property Name:</b> ${reservationProperty}</p>
      <p><b>Property Address:</b> ${reservationAddress}</p>
      <p><b>Total Price: <i>RM${reservationtotalprice}</i></b></p><br/>
      <p><b>Please kindly click the button below to make the decision in <b>12 hours</b> time frame.</b></p>
      <div style="margin: 10px 0;">
        <a href="https://sarawakadventures.com/login" style="background-color: black; color: white; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login</a>
      </div>
      `,
    };

    // THE FIX: Removed 'await' so it runs in the background and doesn't freeze the frontend.
    // Added a .catch() just to log errors in the console if the email fails.
    transporter.sendMail(mailOptions).catch(err => {
      console.error('Background Email Error:', err);
    });

    // ALL YOUR LOGGING CODE IS KEPT EXACTLY THE SAME BELOW
    await client.query(
      `INSERT INTO book_and_pay_log 
       (logtime, log, userid)
       VALUES ($1, $2, $3)`,
      [
        timestamp,
        `${creatorUsername} Send Booking Request (${reservationProperty})`,
        creatorid
      ]
    );

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationid, timestamp, "Reservation", "POST", "Request Booking", creatorid, creatorUsername]
    );
    
    res.status(200).json({ message: 'Request Processed Successfully' })
  } catch (err) {
    console.error('Error processing request: ', err);
    res.status(500).json({ message: 'Failed to process request', error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send Booking Request Accepted Message To Customer
app.post('/accept_booking/:reservationid', async (req, res) => {
  const { reservationid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

  try {
    client = await pool.connect();

    const result = await client.query(
      `SELECT 
        rc.rclastname, 
        rc.rcemail, 
        rc.rctitle, 
        r.checkindatetime, 
        r.checkoutdatetime, 
        r.reservationblocktime, 
        p.propertyaddress 
      FROM reservation_customer_details rc 
      JOIN reservation r ON rc.rcid = r.rcid 
      JOIN properties p ON r.propertyid = p.propertyid 
      WHERE r.reservationid = $1`,
      [reservationid]
    );

    if (result.rows.length === 0) {
      console.log('No matching reservation found.');
      return res.status(404).json({ message: 'Reservation customer or property not found' });
    }

    const data = result.rows[0];

    const {
      rclastname: customerLastName,
      rcemail: customerEmail,
      rctitle: customerTitle,
      checkindatetime: reservationCheckInDate,
      checkoutdatetime: reservationCheckOutDate,
      reservationblocktime: paymentDueDate,
      propertyaddress: reservationProperty,
    } = data;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: 'Booking Accepted',
      html: `
        <h1><b>Dear ${customerTitle} ${customerLastName},</b></h1><hr/>
        <p>Your booking for <b>${reservationProperty}</b> from <b>${reservationCheckInDate}</b> to <b>${reservationCheckOutDate}</b> has been <span style="color: green">accepted</span>.</p> 
        <p>Please kindly click the button below to make payment before <b>${paymentDueDate}</b> to secure your booking.</p>
        <div style="margin: 10px 0;">
          <a href="https://sarawakadventures.com/login" style="background-color: black; color: white; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login</a>
        </div>
      `,
    };

   // FIXED: Run in background so it doesn't freeze the UI
    transporter.sendMail(mailOptions).catch(err => {
        console.error("Background Email Failed:", err);
    });

    await client.query(
      `INSERT INTO book_and_pay_log 
       (logtime, log, userid)
       VALUES ($1, $2, $3)`,
      [
        timestamp,
        `${creatorUsername} Accepted Booking Request (${reservationProperty})`,
        creatorid
      ]
    );

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationid, timestamp, "Reservation", "POST", "Accept Booking", creatorid, creatorUsername]
    );
    
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send Payment Reminder Emails To Customers
app.post('/send_payment_reminders', async (req, res) => {
  let client;

  try {
    client = await pool.connect();

    const result = await client.query(
      `SELECT 
        r.reservationid,
        rc.rclastname,
        rc.rcemail,
        rc.rctitle,
        r.checkindatetime,
        r.reservationblocktime,
        p.propertyaddress
      FROM reservation r
      JOIN reservation_customer_details rc ON r.rcid = rc.rcid
      JOIN properties p ON r.propertyid = p.propertyid
      WHERE r.reservationstatus = 'Accepted'
      AND r.reservationblocktime::date 
          BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'`
    );

    console.log("Query result rows:", result.rows);

    if (result.rows.length === 0) {
      console.log('No matching payment reminder found.');
      return res.status(200).json({ message: 'No pending payment reminders found' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    for (const row of result.rows) {
      const blockTimeDate = new Date(row.reservationblocktime);
      const today = new Date();

      blockTimeDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const daysLeft = Math.round(
        (blockTimeDate - today) / (1000 * 60 * 60 * 24)
      );

      // Only send reminders 3, 2, or 1 days before check-in
      if (![1, 2, 3].includes(daysLeft)) continue;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: row.rcemail,
        subject: `Payment Reminder – ${daysLeft} Day(s) Before Due Date`,
        html: `
          <h1><b>Dear ${row.rctitle} ${row.rclastname},</b></h1>
          <hr/>
          <p>This is a friendly reminder that your payment for <b>${row.propertyaddress}</b> is due in <b>${daysLeft} day(s)</b>.</p>

          <p>Your check-in is scheduled for <b> ${row.checkindatetime}</b>.</p>
          
          <p>Please complete your payment before 
          <b>${row.reservationblocktime}</b> to secure your booking.</p>
        `,
      };

      await transporter.sendMail(mailOptions);

      console.log(
        `Payment reminder sent (${daysLeft} day(s)) to ${row.rcemail}`
      );
    }

    res.status(200).json({ message: 'Payment reminders sent successfully' });

  } catch (err) {
    console.error('Payment reminder error:', err);
    res.status(500).json({ message: 'Failed to send payment reminders', error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send New Room Suggestion To Customer
app.post('/suggestNewRoom/:propertyid/:reservationid', async (req, res) => {
  const { propertyid, reservationid } = req.params;
  const { creatorid, creatorUsername } = req.query; 
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

  try {
    client = await pool.connect();
    
    const propertyResult = await client.query(
      `SELECT p.propertyaddress AS "suggestPropertyAddress",
              r.normalrate AS "suggestPropertyPrice",
              p.nearbylocation AS "suggestPropertyLocation",
              p.propertybedtype AS "suggestPropertyBedType",
              p.propertyguestpaxno AS "suggestPropertyGuestPaxNo"
       FROM properties p 
       JOIN rate r ON p.rateid = r.rateid
       WHERE p.propertyid = $1`,
      [propertyid]
    );

    if (propertyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Property not found for suggestion' });
    }

    const property = propertyResult.rows[0];

    const customerReservationResult = await client.query(
      `SELECT rc.rclastname AS "customerLastName",
              rc.rcemail AS "customerEmail",
              rc.rctitle AS "customerTitle",
              p.propertyaddress AS "reservationProperty",
              r.checkindatetime AS "reservationCheckInDate",
              r.checkoutdatetime AS "reservationCheckOutDate",
              r.userid AS "customerID"
       FROM reservation r
       JOIN properties p ON p.propertyid = r.propertyid
       JOIN reservation_customer_details rc ON rc.rcid = r.rcid
       WHERE r.reservationid = $1`,
      [reservationid]
    );

    if (customerReservationResult.rows.length === 0) {
      return res.status(404).json({ message: 'User email not found for suggestion' });
    }

    const {
      customerLastName,
      customerEmail,
      customerTitle,
      reservationProperty,
      reservationCheckInDate,
      reservationCheckOutDate,
      customerID
    } = customerReservationResult.rows[0];

    const customerEmailResult = await client.query(
      `SELECT u.uemail FROM users u JOIN reservation r ON u.userid = r.userid WHERE u.userid = $1`,
      [customerID]
    );

    const actualCustomerEmail = customerEmailResult.rows[0].uemail;

    // FIXED: Ensure reservationstatus is correctly updated to 'Suggested'
    const updateSuggestedEmailResult = await client.query(
      `UPDATE reservation
       SET propertyid = $1, suggestedemail = $2, reservationstatus = 'Suggested'
       WHERE reservationid = $3
      `,
      [propertyid, actualCustomerEmail, reservationid]
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: actualCustomerEmail,
      subject: 'Booking Request Rejected & New Room Suggestion',
      html: `
      <h1><b>Dear ${customerTitle} ${customerLastName},</b></h1><hr/>
      <p>Your booking for <b>${reservationProperty}</b> from <b>${reservationCheckInDate}</b> to <b>${reservationCheckOutDate}</b> has been <span style="color: red">rejected</span> due to room unavailability during the selected time.</p> 
      <p>A similar room with the details below is suggested for your consideration:</p> 
      <h3>Property Name: ${property.suggestPropertyAddress}</h3>
      <p><b>Property Location:</b> ${property.suggestPropertyLocation}</p>
      <p><b>Bed Number:</b> ${property.suggestPropertyBedType}</p>
      <p><b>Pax Number:</b> ${property.suggestPropertyGuestPaxNo}</p>
      <p><b>Price: <i>RM${property.suggestPropertyPrice}</i></b></p><br/>
      <p>Please kindly make your decision by clicking the buttons below to login</p>
      <div style="margin: 10px 0;">
        <a href="https://sarawakadventures.com/login" style="background-color: black; color: white; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login</a>
      </div>
      `,
    };

    // FIXED: Run in background to stop freezing UI
    transporter.sendMail(mailOptions).catch(err => {
        console.error("Background Email Failed:", err);
    });

    await client.query(
      `INSERT INTO book_and_pay_log (logtime, log, userid) VALUES ($1, $2, $3)`,
      [timestamp, `Suggested new room (${property.suggestPropertyAddress})`, creatorid]
    );

    await client.query('COMMIT');

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationid, timestamp, "Reservation", "POST", "Suggest Alternative Room", creatorid, creatorUsername]
    );
    
    res.status(200).json({ message: 'Email Sent Successfully' });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send Properties Listing Request Notification From Moderator
app.post('/propertyListingRequest/:propertyid', async (req, res) => {
  const { propertyid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(); // Use standard JS Date
  let client;

  try {
    client = await pool.connect();
    
    // 1. Get Property & Moderator Info
    const moderatorResult = await client.query(
      `SELECT p.propertyaddress, u.ulastname, u.utitle, u.usergroup 
       FROM properties p 
       JOIN users u ON u.userid = p.userid 
       WHERE p.propertyid = $1`,
      [propertyid]
    );

    if (moderatorResult.rows.length === 0) {
      return res.status(404).json({ message: 'Property or moderator not found' });
    } 

    // If user is NOT a moderator, they don't need approval. Return success immediately.
    if (moderatorResult.rows[0].usergroup !== 'Moderator') {
      return res.status(200).json({ message: 'Property Created Successfully' });
    }

    const { propertyaddress: property, ulastname: moderatorLastName, utitle: moderatorTitle } = moderatorResult.rows[0];

    // 2. Get All Administrator Emails
    const administratorResult = await client.query(
      `SELECT uemail FROM users WHERE usergroup = 'Administrator'`
    );

    // If no admins exist, we can't send email, but we still return success
    if (administratorResult.rows.length === 0) {
      return res.status(200).json({ message: 'Property created (No admins found to notify)' });
    }

    const adminEmails = administratorResult.rows.map(record => record.uemail);

    // 3. Setup Email (Standard Logic)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: adminEmails,
      subject: 'Property Listing Request',
      html: `
      <h1><b>Dear Administrators,</b></h1><hr/>
      <p>Moderator ${moderatorTitle} ${moderatorLastName} would like to request listing a new property with the name of <b>${property}</b> into the "Hello Sarawak" app.</p>
      <p>Please kindly click the button below to view more details and make the decision in <b>12 hours</b> time frame.</p>
      <div style="margin: 10px 0;">
        <a href="https://sarawakadventures.com/login" style="background-color: black; color: white; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login</a>
      </div>
      `,
    };

    // ---------------------------------------------------------
    // CHANGE IS HERE: We REMOVED 'await' before transporter.sendMail
    // ---------------------------------------------------------
    
    // The email sends in the background. 
    // The .catch() ensures that if email fails, it prints to console but doesn't crash the app.
    transporter.sendMail(mailOptions).catch(err => {
        console.error("Background Email Error:", err); 
    });

    // 4. Log Audit Trail
    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [propertyid, timestamp, "Properties", "POST", "Request Property Listing", creatorid, creatorUsername]
    );
    
    // 5. Respond Immediately (User sees this instantly)
    res.status(200).json({ message: 'Request Sent Successfully' });

  } catch (err) {
    console.error('Error sending email: ', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send Property Listing Request Accepted Notification
app.post("/propertyListingAccept/:propertyid", async (req, res) => {
  const { propertyid } = req.params;
  const { creatorid, creatorUsername } = req.query;
 const timestamp = new Date(); // Just use the server's standard current time
  let client;

  try {
    client = await pool.connect();
    
    // 1. Get the details first
    const result = await client.query(
      `SELECT p.propertyaddress, u.ulastname, u.uemail, u.utitle 
       FROM properties p  
       JOIN users u ON u.userid = p.userid 
       WHERE p.propertyid = $1`,
      [propertyid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Property or user not found" });
    }

    const { propertyaddress: property, ulastname: moderatorLastName, uemail: moderatorEmail, utitle: moderatorTitle } = result.rows[0];

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: moderatorEmail,
      subject: "Property Listing Request Accepted",
      html: `
      <h1><b>Dear ${moderatorTitle} ${moderatorLastName},</b></h1><hr/>
      <p>Your request for property listing of property named <b>${property}</b> has been <span style="color: green">accepted</span> by the Administrator.</p>
      <p>Please kindly click the button below to check the details of the listed property.</p>
      <div style="margin: 10px 0;">
        <a href="https://sarawakadventures.com/login" style="background-color: black; color: white; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login</a>
      </div>
      `,
    };

    // 2. UPDATE DATABASE IMMEDIATELY (This makes the change "real")
    await client.query(
      `UPDATE properties SET propertystatus = 'Available' WHERE propertyid = $1`,
      [propertyid]
    );

    // 3. SEND EMAIL IN BACKGROUND (Removed 'await')
    // This allows the code to continue without waiting for Gmail
    transporter.sendMail(mailOptions).catch(err => {
        console.error("Background Email Failed:", err);
    });

    // 4. LOG AUDIT TRAIL
    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [propertyid, timestamp, "Properties", "POST", "Accept Property Listing", creatorid, creatorUsername]
    );
    
    // 5. SEND SUCCESS RESPONSE IMMEDIATELY
    res.status(200).json({ message: "Property Accepted Successfully" });

  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ message: "Failed to process request", error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send Property Listing Request Rejected Notification
app.post("/propertyListingReject/:propertyid", async (req, res) => {
  const { propertyid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

 try {
    client = await pool.connect();
    
    // 1. Get details
    const result = await client.query(
      `SELECT p.propertyaddress, u.ulastname, u.uemail, u.utitle 
       FROM properties p  
       JOIN users u ON u.userid = p.userid 
       WHERE p.propertyid = $1`,
      [propertyid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Property or user not found" });
    }

    const { propertyaddress: property, ulastname: moderatorLastName, uemail: moderatorEmail, utitle: moderatorTitle } = result.rows[0];

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: moderatorEmail,
      subject: "Property Listing Request Rejected",
      html: `
      <h1><b>Dear ${moderatorTitle} ${moderatorLastName},</b></h1><hr/>
      <p>Your request for property listing of property named <b>${property}</b> has been <span style="color: red">rejected</span> by the Administrator due to violation of policy.</p>
      <p>Please kindly click the button below to list the property again with appropriate information in <b>12 hours</b> time frame.</p>
      <div style="margin: 10px 0;">
        <a href="https://sarawakadventures.com/login" style="background-color: black; color: white; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login</a>
      </div>
      `,
    };

    // 2. UPDATE DATABASE IMMEDIATELY
    await client.query(
      `UPDATE properties SET propertystatus = 'Rejected' WHERE propertyid = $1`,
      [propertyid]
    );

    // 3. SEND EMAIL IN BACKGROUND (Removed 'await')
    transporter.sendMail(mailOptions).catch(err => {
        console.error("Background Email Failed:", err);
    });

    // 4. LOG AUDIT TRAIL
    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [propertyid, timestamp, "Properties", "POST", "Reject Property Listing", creatorid, creatorUsername]
    );
    
    // 5. SEND SUCCESS RESPONSE IMMEDIATELY
    res.status(200).json({ message: "Property Rejected Successfully" });

  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ message: "Failed to process request", error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send "Suggest" Notification To Operators
app.post('/sendSuggestNotification/:reservationid', async (req, res) => {
  const { userids } = req.body;
  const { reservationid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

  if (!userids || userids.length === 0) {
    return res.status(400).json({ message: 'User IDs are required' });
  }

  try {
    client = await pool.connect();
    
    // Fetch user emails
    const userResult = await client.query(
      `SELECT uemail FROM users WHERE userid = ANY($1::int[])`,
      [userids]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    const selectedEmails = userResult.rows.map(record => record.uemail);
    const emailString = selectedEmails.join(',');

    const insertSuggestedEmails = await client.query(
      `UPDATE reservation
       SET suggestedemail = $1
       WHERE reservationid = $2
       `,
       [emailString, reservationid]
    );

    // Fetch reservation and customer details
    // FIXED: 'FROM property' changed to 'FROM properties', and 'rc.rcID' to 'rc.rcid'
    const reservationResult = await client.query(
      `SELECT 
        p.propertyaddress AS "reservationProperty", 
        r.checkindatetime AS "reservationCheckInDate", 
        r.checkoutdatetime AS "reservationCheckOutDate", 
        rc.rclastname AS "customerLastName", 
        rc.rctitle AS "customerTitle"
      FROM properties p
      JOIN reservation r ON p.propertyid = r.propertyid
      JOIN reservation_customer_details rc ON rc.rcid = r.rcid
      WHERE r.reservationid = $1`,
      [reservationid]
    );

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ message: 'No reservation or customer found' });
    }

    const { 
      reservationProperty, 
      reservationCheckInDate, 
      reservationCheckOutDate, 
      customerLastName, 
      customerTitle 
    } = reservationResult.rows[0];

    // Email configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: selectedEmails,
      subject: 'Suggestion Available',
      html: `
      <h1><b>Dear Operators,</b></h1><hr/>
      <p>Reservation of customer <b>${customerTitle} ${customerLastName}</b> is now open for suggestion with the following details:</p>
      <p><b>Property Name:</b> ${reservationProperty}</p>
      <p><b>Check In Date:</b> ${reservationCheckInDate}</p>
      <p><b>Check Out Date:</b> ${reservationCheckOutDate}</p>
      <br/>
      <p>Please kindly click the button below to pick up the "Suggest" opportunity on a first-come, first-served basis.</p>
      <p>You may <b>ignore</b> this message if <b>not interested</b>.</p>
      <div style="margin: 10px 0;">
        <a href="https://sarawakadventures.com/login" style="background-color: black; color: white; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login</a>
      </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    await client.query(
      `INSERT INTO book_and_pay_log 
       (logtime, log, userid)
       VALUES ($1, $2, $3)`,
      [
        timestamp,
        `${creatorUsername} Send Suggest Notification`,
        creatorid
      ]
    );

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationid, timestamp, "Reservation", "POST", "Send Suggest Notification", creatorid, creatorUsername]
    );
    
    res.status(200).json({ message: 'Email Sent Successfully' });

  } catch (err) {
    console.error('Error sending email: ', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  }
});

// Send Reservation Picked Up Notification To Original Reservation Owner
app.post('/sendPickedUpNotification/:reservationid', async (req, res) => {
  const { reservationid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const { userids } = req.body; // FIXED: Added this to prevent the "userids is not defined" crash
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

  if (!userids || userids.length === 0) {
    return res.status(400).json({ message: 'User IDs are required' });
  }

  try {
    client = await pool.connect();
    
    // Fetch user emails
    // FIXED: Corrected invalid SQL table aliases (u.users, p.properties) and added column aliases
    const reservationOwnerResult = await client.query(
      `SELECT u.username AS "reservationOwnerUsername", 
              u.uemail AS "reservationOwnerEmail", 
              u.utitle AS "reservationOwnerTitle"
       FROM users u 
       JOIN properties p ON u.userid = p.userid
       JOIN reservation r ON p.propertyid = r.propertyid
       WHERE r.reservationid = $1
       `,
      [reservationid]
    );

    if (reservationOwnerResult.rows.length === 0) {
      return res.status(404).json({ message: 'No uEmail found' });
    }

    const { reservationOwnerUsername, reservationOwnerEmail, reservationOwnerTitle } = reservationOwnerResult.rows[0];

    // Fetch reservation and customer details
    // FIXED: Changed rc.rcID to rc.rcid
    const reservationResult = await client.query(
      `SELECT 
        p.propertyaddress AS "reservationProperty", 
        r.checkindatetime AS "reservationCheckInDate", 
        r.checkoutdatetime AS "reservationCheckOutDate", 
        rc.rclastname AS "customerLastName", 
        rc.rctitle AS "customerTitle"
      FROM properties p
      JOIN reservation r ON p.propertyid = r.propertyid
      JOIN reservation_customer_details rc ON rc.rcid = r.rcid
      WHERE r.reservationid = $1`,
      [reservationid]
    );

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ message: 'No reservation or customer found' });
    }

    const { 
      reservationProperty, 
      reservationCheckInDate, 
      reservationCheckOutDate, 
      customerLastName, 
      customerTitle 
    } = reservationResult.rows[0];

    // Email configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: reservationOwnerEmail,
      subject: `Reservation Picked Up`,
      html: `
      <h1><b>Dear ${reservationOwnerTitle} ${reservationOwnerUsername},</b></h1><hr/>
      <p>Reservation of customer <b>${customerTitle} ${customerLastName}</b> with the following details is picked up by <b>${creatorUsername}</b>:</p>
      <p><b>Property Name:</b> ${reservationProperty}</p>
      <p><b>Check In Date:</b> ${reservationCheckInDate}</p>
      <p><b>Check Out Date:</b> ${reservationCheckOutDate}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    await client.query(
      `INSERT INTO book_and_pay_log 
       (logtime, log, userid)
       VALUES ($1, $2, $3)`,
      [
        timestamp,
        `${reservationProperty} Reservation Picked Up By ${creatorUsername}`,
        creatorid
      ]
    );

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationid, timestamp, "Reservation", "POST", "Reservation Picked Up", creatorid, creatorUsername]
    );
    
    res.status(200).json({ message: 'Email Sent Successfully' });

  } catch (err) {
    console.error('Error sending email: ', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Send Suggested Room Rejected Message To Operators
app.post('/reject_suggested_room/:propertyid/', async (req, res) => {
  const { propertyid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

  try {
    // Fetch property details for suggestion
    client = await pool.connect();
    
    const propertyResult = await client.query(
      `SELECT p.propertyaddress AS "suggestPropertyAddress",
              r.normalrate AS "suggestPropertyPrice",
              p.nearbylocation AS "suggestPropertyLocation",
              p.propertybedtype AS "suggestPropertyBedType",
              p.propertyguestpaxno AS "suggestPropertyGuestPaxNo",
              u.uemail AS "operatorEmail",
              u.username AS "operatorUsername",
              u.utitle AS "operatorTitle"
       FROM properties p 
       JOIN rate r ON p.rateid = r.rateid
       JOIN users u ON p.userid = u.userid
       WHERE p.propertyid = $1`,
      [propertyid]
    );

    if (propertyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }

    const property = propertyResult.rows[0];

    // Email configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: property.operatorEmail,
      subject: 'Suggested Room Rejected',
      html: `
      <h1><b>Dear ${property.operatorTitle} ${property.operatorUsername},</b></h1><hr/>
      <p>Your suggested room <b>${property.suggestPropertyAddress}</b> has been <span style="color: red">Rejected</span>.</p> 
      <p>All Actions For This Reservation Will Be <b>Terminated</b>.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    await client.query(
      `INSERT INTO book_and_pay_log 
       (logtime, log, userid)
       VALUES ($1, $2, $3)`,
      [
        timestamp,
        `Rejected Suggested Room (${property.suggestPropertyAddress})`,
        creatorid
      ]
    );

    await client.query('COMMIT');

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [propertyid, timestamp, "Properties", "POST", "Rejected Suggested Room", creatorid, creatorUsername]
    );
    
    res.status(200).json({ message: 'Email Sent Successfully' });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Create reservation for property
app.post('/reservation/:userid', async (req, res) => {
  const { propertyid, checkindatetime, checkoutdatetime, reservationstatus, request, totalprice, rcfirstname, rclastname, rcemail, rcphoneno, rctitle } = req.body;
  const userid = req.params.userid;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

  if (!userid) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    client = await pool.connect();
    
    const customerResult = await client.query(
      `INSERT INTO reservation_customer_details 
       (rcfirstname, rclastname, rcemail, rcphoneno, rctitle)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING rcid`,
      [rcfirstname, rclastname, rcemail, rcphoneno, rctitle]
    );

    const rcid = customerResult.rows[0].rcid;
// FIXED: Set expiry to 24 hours from NOW so admin has time to react
    const reservationDateTime = new Date(Date.now() + 8 * 60 * 60 * 1000); // Malaysia Time
    const checkIn = new Date(checkindatetime);
    
   // This gives the admin 24 hours to handle the request before it expires
let reservationblocktime = new Date(reservationDateTime.getTime() + 24 * 60 * 60 * 1000);

// For last-minute bookings, ensure it doesn't expire AFTER they check in
if (reservationblocktime > checkIn) {
  reservationblocktime = new Date(checkIn.getTime() - 1000);
}
    const reservationResult = await client.query(
      `INSERT INTO reservation 
       (propertyid, checkindatetime, checkoutdatetime, 
        reservationblocktime, request, totalprice, rcid, 
        reservationstatus, userid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING reservationid`,
      [
        propertyid,
        checkindatetime,
        checkoutdatetime,
        reservationblocktime,
        request,
        parseFloat(parseFloat(totalprice).toFixed(2)),
        rcid,
        reservationstatus,
        userid
      ]
    );

    const reservationid = reservationResult.rows[0].reservationid;

    const userResult = await client.query('SELECT username FROM users WHERE userid = $1', [userid]);
    const username = userResult.rows.length > 0 ? userResult.rows[0].username : userid;

    await client.query(
      `INSERT INTO Book_and_Pay_Log 
       (logTime, log, userID)
       VALUES ($1, $2, $3)`,
      [
        reservationDateTime,
        `${username} created reservation #${reservationid} for property #${propertyid}`,
        userid
      ]
    );

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationid, timestamp, "Reservation", "POST", "Create Reservation", creatorid, creatorUsername]
    );

    await client.query('COMMIT');

    res.status(201).json({ 
       message: 'Reservation created successfully', 
      reservationid 
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error inserting reservation data:', err);
    res.status(500).json({ 
      message: 'Internal Server Error', 
      details: err.message 
    }); 
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Fetch Book and Pay Log
app.get('/users/booklog', async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: "Missing userid parameter" });
  }

  let client;

  try {
    client = await pool.connect();

    const ownerResult = await client.query(
      `SELECT usergroup, username
       FROM users
       WHERE userid = $1`,
      [userid]
    );

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const usergroup = ownerResult.rows[0].usergroup;

    let result;
    let formattedRows;

    if (usergroup === 'Owner') {
      result = await client.query(`
        SELECT 
            b.userid, 
            u.username, 
            b.logtime AS timestamp, 
            b.log AS action
        FROM book_and_pay_log b
        JOIN users u ON b.userid = u.userid
        ORDER BY b.logtime DESC;
      `);

      // Format timestamps to remove T and milliseconds with Z
      formattedRows = result.rows.map(row => {
  if (row.timestamp) {
    // 1. Create a date object from the database timestamp
    const date = new Date(row.timestamp);
    
    // 2. Convert to Malaysia Time string (Asia/Kuching)
    // This handles the +8 hours automatically and correctly
    row.timestamp = date.toLocaleString('en-GB', { 
      timeZone: 'Asia/Kuching',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    }).replace(',', ''); // format: DD/MM/YYYY HH:mm:ss
  }
  return row;
});
    } else {
      // First get the user's cluster ID
      const userClusterResult = await client.query(
        `SELECT clusterid FROM users WHERE userid = $1`,
        [userid]
      );

      if (userClusterResult.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const userClusterid = userClusterResult.rows[0].clusterid;

      // Get book and pay logs for users in the same cluster
      result = await client.query(`
        SELECT 
            b.userid, 
            u.username, 
            b.logtime AS timestamp, 
            b.log AS action
        FROM book_and_pay_log b
        JOIN users u ON b.userid = u.userid
        WHERE u.clusterid = $1
        ORDER BY b.logtime DESC;
      `, [userClusterid]);

      // Format timestamps to remove T and milliseconds with Z
      formattedRows = result.rows.map(row => {
        if (row.timestamp) {
          const date = new Date(row.timestamp);
          row.timestamp = date.toISOString().replace('T', ' ').split('.')[0];
        }
        return row;
      });
    }

    res.json(formattedRows);
  } catch (err) {
    console.error('Error fetching Book Log:', err);
    res.status(500).json({ message: 'Internal Server Error', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.get("/users/finance", async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: "Missing userid parameter" });
  }

  try {
    const ownerResult = await pool.query(
      `SELECT usergroup
       FROM users
       WHERE userid = $1
       `,
      [userid]
    );

    const usergroup = ownerResult.rows[0].usergroup;

    let result;

    if (usergroup === 'Owner') {
      result = await pool.query(
        `
        SELECT 
          TO_CHAR(checkindatetime, 'YYYY-MM') AS month,
          SUM(totalprice) AS monthlyrevenue,
          COUNT(reservationid) AS monthlyreservations
        FROM reservation
        WHERE reservationstatus = 'Paid'
        GROUP BY TO_CHAR(checkindatetime, 'YYYY-MM')
        ORDER BY month;
        `,
      );
    } else if (usergroup === 'Moderator') { 
        const clusterResult = await pool.query(
          `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
          [userid]
        );
    
        if (clusterResult.rows.length === 0) {
          return res.status(404).json({ message: "No cluster found for this user" });
        }
    
        const clusterids = clusterResult.rows.map(row => row.clusterid);
    
        result = await pool.query(
          `
          SELECT 
            TO_CHAR(checkindatetime, 'YYYY-MM') AS month,
            SUM(totalprice) AS monthlyrevenue,
            COUNT(reservationid) AS monthlyreservations
          FROM reservation
          WHERE reservationstatus = 'Paid'
            AND propertyid IN (
              SELECT propertyid FROM properties 
              WHERE clusterid = ANY($1)
              AND userid = $2
            )
          GROUP BY TO_CHAR(checkindatetime, 'YYYY-MM')
          ORDER BY month;
          `,
          [clusterids, userid]
        ); 
    } else {
       const clusterResult = await pool.query(
          `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
          [userid]
        );
    
        if (clusterResult.rows.length === 0) {
          return res.status(404).json({ message: "No cluster found for this user" });
        }
    
        const clusterids = clusterResult.rows.map(row => row.clusterid);
    
        result = await pool.query(
          `
          SELECT 
            TO_CHAR(checkindatetime, 'YYYY-MM') AS month,
            SUM(totalprice) AS monthlyrevenue,
            COUNT(reservationid) AS monthlyreservations
          FROM reservation
          WHERE reservationstatus = 'Paid'
            AND propertyid IN (
              SELECT propertyid FROM properties WHERE clusterid = ANY($1)
            )
          GROUP BY TO_CHAR(checkindatetime, 'YYYY-MM')
          ORDER BY month;
          `,
          [clusterids]
        ); 
    }

    if (result.rows && result.rows.length > 0) {
      console.log("Monthly data:", result.rows);

      res.json({
        monthlyData: result.rows,
      });
    } else {
      res.status(404).json({ message: "No reservation found for this user" });
    }
  } catch (err) {
    console.error("Error fetching finance data:", err);
    res.status(500).json({ message: "Internal Server Error", details: err.message });
  }
});

app.get("/users/occupancy_rate", async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: "Missing userid parameter" });
  }

  try {
    const ownerResult = await pool.query(
      `SELECT usergroup
       FROM users
       WHERE userid = $1
       `,
      [userid]
    );

    const usergroup = ownerResult.rows[0].usergroup;

    let result;

    if (usergroup === 'Owner') {
      result = await pool.query(`
        WITH monthly_data AS (
            SELECT 
                TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
                SUM(EXTRACT(DAY FROM (r.checkoutdatetime - r.checkindatetime))) AS total_reserved_nights,
                SUM(r.totalprice) AS monthly_revenue,
                COUNT(r.reservationid) AS monthly_reservations
            FROM reservation r
            JOIN properties p ON r.propertyid = p.propertyid
            WHERE r.reservationstatus = 'Paid'
            GROUP BY TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ),
        total_available_nights AS (
            SELECT 
                TO_CHAR(gs.month, 'YYYY-MM') AS month,
                COUNT(p.propertyid) * DATE_PART('day', gs.month + INTERVAL '1 month' - INTERVAL '1 day') AS total_available_nights
            FROM (
                SELECT generate_series(
                    (SELECT DATE_TRUNC('month', MIN(checkindatetime)) FROM reservation),
                    (SELECT DATE_TRUNC('month', MAX(checkoutdatetime)) FROM reservation),
                    INTERVAL '1 month'
                ) AS month
            ) gs
            CROSS JOIN properties p
            WHERE p.propertystatus = 'Available'
            GROUP BY gs.month
        )
        SELECT 
            md.month,
            md.monthly_revenue,
            md.monthly_reservations,
            md.total_reserved_nights,
            tan.total_available_nights,
            (md.total_reserved_nights::DECIMAL / NULLIF(tan.total_available_nights, 0) * 100) AS occupancy_rate
        FROM monthly_data md
        JOIN total_available_nights tan ON md.month = tan.month
        ORDER BY md.month;
      `,);
    } else if (usergroup === 'Moderator') {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      result = await pool.query(`
        WITH monthly_data AS (
            SELECT 
                TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
                SUM(EXTRACT(DAY FROM (r.checkoutdatetime - r.checkindatetime))) AS total_reserved_nights,
                SUM(r.totalprice) AS monthly_revenue,
                COUNT(r.reservationid) AS monthly_reservations
            FROM reservation r
            JOIN properties p ON r.propertyid = p.propertyid
            WHERE r.reservationstatus = 'Paid'
            AND p.clusterid = ANY($1)
            AND p.userid = $2
            GROUP BY TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ),
        total_available_nights AS (
            SELECT 
                TO_CHAR(gs.month, 'YYYY-MM') AS month,
                COUNT(p.propertyid) * DATE_PART('day', gs.month + INTERVAL '1 month' - INTERVAL '1 day') AS total_available_nights
            FROM (
                SELECT generate_series(
                    (SELECT DATE_TRUNC('month', MIN(checkindatetime)) FROM reservation),
                    (SELECT DATE_TRUNC('month', MAX(checkoutdatetime)) FROM reservation),
                    INTERVAL '1 month'
                ) AS month
            ) gs
            CROSS JOIN properties p
            WHERE p.propertystatus = 'Available'
            AND p.clusterid = ANY($1)
            AND p.userid = $2
            GROUP BY gs.month
        )
        SELECT 
            md.month,
            md.monthly_revenue,
            md.monthly_reservations,
            md.total_reserved_nights,
            tan.total_available_nights,
            (md.total_reserved_nights::DECIMAL / NULLIF(tan.total_available_nights, 0) * 100) AS occupancy_rate
        FROM monthly_data md
        JOIN total_available_nights tan ON md.month = tan.month
        ORDER BY md.month;
      `, [clusterids, userid]);
    } else {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      result = await pool.query(`
        WITH monthly_data AS (
            SELECT 
                TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
                SUM(EXTRACT(DAY FROM (r.checkoutdatetime - r.checkindatetime))) AS total_reserved_nights,
                SUM(r.totalprice) AS monthly_revenue,
                COUNT(r.reservationid) AS monthly_reservations
            FROM reservation r
            JOIN properties p ON r.propertyid = p.propertyid
            WHERE r.reservationstatus = 'Paid'
            AND p.clusterid = ANY($1)
            GROUP BY TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ),
        total_available_nights AS (
            SELECT 
                TO_CHAR(gs.month, 'YYYY-MM') AS month,
                COUNT(p.propertyid) * DATE_PART('day', gs.month + INTERVAL '1 month' - INTERVAL '1 day') AS total_available_nights
            FROM (
                SELECT generate_series(
                    (SELECT DATE_TRUNC('month', MIN(checkindatetime)) FROM reservation),
                    (SELECT DATE_TRUNC('month', MAX(checkoutdatetime)) FROM reservation),
                    INTERVAL '1 month'
                ) AS month
            ) gs
            CROSS JOIN properties p
            WHERE p.propertystatus = 'Available'
            AND p.clusterid = ANY($1)
            GROUP BY gs.month
        )
        SELECT 
            md.month,
            md.monthly_revenue,
            md.monthly_reservations,
            md.total_reserved_nights,
            tan.total_available_nights,
            (md.total_reserved_nights::DECIMAL / NULLIF(tan.total_available_nights, 0) * 100) AS occupancy_rate
        FROM monthly_data md
        JOIN total_available_nights tan ON md.month = tan.month
        ORDER BY md.month;
      `, [clusterids]);
    }
    
    if (result.rows.length > 0) {
      console.log("Monthly data with occupancy rate:", result.rows);
      res.json({ monthlyData: result.rows });
    } else {
      res.status(404).json({ message: "No reservation found" });
    }
  } catch (err) {
    console.error("Error fetching occupancy rate data:", err);
    res.status(500).json({ message: "Internal Server Error", details: err.message });
  }
});

app.get("/users/RevPAR", async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: "Missing userid parameter" });
  }

  try {
    const ownerResult = await pool.query(
      `SELECT usergroup
       FROM users
       WHERE userid = $1
       `,
      [userid]
    );

    const usergroup = ownerResult.rows[0].usergroup;

    let propertyCountResult;
    let revparResult;

    if (usergroup === 'Owner') {
      propertyCountResult = await pool.query(
        `SELECT COUNT(*) AS available_properties 
         FROM properties 
         WHERE propertystatus = 'Available';`,
      );

      const availableProperties = parseInt(propertyCountResult.rows[0].available_properties);

      if (availableProperties === 0) {
        return res.status(404).json({ message: "No available properties found" });
      }
  
      revparResult = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          COALESCE(SUM(r.totalprice), 0) / $1 AS revpar
        FROM 
          reservation r
        INNER JOIN 
          properties p ON r.propertyid = p.propertyid
        WHERE 
          p.propertystatus = 'Available'
          AND r.reservationstatus = 'Paid'
        GROUP BY 
          TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY 
          month;
        `,
        [availableProperties]
      );
    } else if (usergroup === 'Moderator') {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      propertyCountResult = await pool.query(
        `SELECT COUNT(*) AS available_properties 
         FROM properties 
         WHERE propertystatus = 'Available' 
           AND clusterid = ANY($1)
           AND userid = $2;`,
        [clusterids, userid]
      );
  
      const availableProperties = parseInt(propertyCountResult.rows[0].available_properties);
  
      if (availableProperties === 0) {
        return res.status(404).json({ message: "No available properties found" });
      }
  
      revparResult = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          COALESCE(SUM(r.totalprice), 0) / $2 AS revpar
        FROM 
          reservation r
        INNER JOIN 
          properties p ON r.propertyid = p.propertyid
        WHERE 
          p.propertystatus = 'Available'
          AND p.clusterid = ANY($1)
          AND r.reservationstatus = 'Paid'
        GROUP BY 
          TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY 
          month;
        `,
        [clusterids, availableProperties]
      );
    } else {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      propertyCountResult = await pool.query(
        `SELECT COUNT(*) AS available_properties 
         FROM properties 
         WHERE propertystatus = 'Available' 
           AND clusterid = ANY($1);`,
        [clusterids]
      );
  
      const availableProperties = parseInt(propertyCountResult.rows[0].available_properties);
  
      if (availableProperties === 0) {
        return res.status(404).json({ message: "No available properties found" });
      }
  
      revparResult = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          COALESCE(SUM(r.totalprice), 0) / $2 AS revpar
        FROM 
          reservation r
        INNER JOIN 
          properties p ON r.propertyid = p.propertyid
        WHERE 
          p.propertystatus = 'Available'
          AND p.clusterid = ANY($1)
          AND r.reservationstatus = 'Paid'
        GROUP BY 
          TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY 
          month;
        `,
        [clusterids, availableProperties]
      );
    }
    
    if (revparResult.rows.length > 0) {
      res.json({
        monthlyData: revparResult.rows,
      });
    } else {
      res.status(404).json({ message: "No reservation data found for RevPAR" });
    }
  } catch (err) {
    console.error("Error fetching monthly RevPAR data:", err);
    res.status(500).json({ message: "Internal Server Error", details: err.message });
  }
});

app.get("/users/cancellation_rate", async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: "Missing userid parameter" });
  }

  try {
    const ownerResult = await pool.query(
      `SELECT usergroup
       FROM users
       WHERE userid = $1
       `,
      [userid]
    );

    const usergroup = ownerResult.rows[0].usergroup;

    let cancellationRateResult;

    if (usergroup === 'Owner') {
      cancellationRateResult = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          (COUNT(CASE WHEN r.reservationstatus = 'Canceled' THEN 1 END) * 100.0) / NULLIF(COUNT(r.reservationid), 0) AS cancellation_rate
        FROM 
          reservation r
        INNER JOIN 
          properties p ON r.propertyid = p.propertyid
        GROUP BY 
          TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY 
          month;
        `,
      );
    } else if (usergroup === 'Moderator') {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      cancellationRateResult = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          (COUNT(CASE WHEN r.reservationstatus = 'Canceled' THEN 1 END) * 100.0) / NULLIF(COUNT(r.reservationid), 0) AS cancellation_rate
        FROM 
          reservation r
        INNER JOIN 
          properties p ON r.propertyid = p.propertyid
        WHERE 
          p.clusterid = ANY($1)
        AND 
          p.userid = $2
        GROUP BY 
          TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY 
          month;
        `,
        [clusterids, userid]
      );
    } else {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      cancellationRateResult = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          (COUNT(CASE WHEN r.reservationstatus = 'Canceled' THEN 1 END) * 100.0) / NULLIF(COUNT(r.reservationid), 0) AS cancellation_rate
        FROM 
          reservation r
        INNER JOIN 
          properties p ON r.propertyid = p.propertyid
        WHERE 
          p.clusterid = ANY($1)
        GROUP BY 
          TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY 
          month;
        `,
        [clusterids]
      );
    }

    if (cancellationRateResult.rows.length > 0) {
      res.json({
        monthlyData: cancellationRateResult.rows,
      });
    } else {
      res.status(404).json({ message: "No cancellation rate data found" });
    }
  } catch (err) {
    console.error("Error fetching cancellation rate data:", err);
    res.status(500).json({ message: "Internal Server Error", details: err.message });
  }
});

app.get("/users/customer_retention_rate", async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: "Missing userid parameter" });
  }

  try {
    const ownerResult = await pool.query(
      `SELECT usergroup
       FROM users
       WHERE userid = $1
       `,
      [userid]
    );

    const usergroup = ownerResult.rows[0].usergroup;

    let result;

    if (usergroup === 'Owner') {
      result = await pool.query(
        `
        WITH monthly_users AS (
          SELECT 
            TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
            r.userid
          FROM reservation r
          INNER JOIN properties p ON r.propertyid = p.propertyid
        ),
        all_users AS (
          SELECT DISTINCT userid FROM users
        )
        SELECT 
          mu.month,
          (COUNT(DISTINCT mu.userid) * 100.0) / NULLIF((SELECT COUNT(*) FROM all_users), 0) AS customer_retention_rate
        FROM monthly_users mu
        GROUP BY mu.month
        ORDER BY mu.month;
        `,
      );
    } else if (usergroup === 'Moderator') {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      result = await pool.query(
        `
        WITH monthly_users AS (
          SELECT 
            TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
            r.userid
          FROM reservation r
          INNER JOIN properties p ON r.propertyid = p.propertyid
          WHERE p.clusterid = ANY($1)
          AND p.userid = $2
        ),
        all_users AS (
          SELECT DISTINCT userid FROM users
        )
        SELECT 
          mu.month,
          (COUNT(DISTINCT mu.userid) * 100.0) / NULLIF((SELECT COUNT(*) FROM all_users), 0) AS customer_retention_rate
        FROM monthly_users mu
        GROUP BY mu.month
        ORDER BY mu.month;
        `,
        [clusterids, userid]
      );
    } else {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      result = await pool.query(
        `
        WITH monthly_users AS (
          SELECT 
            TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
            r.userid
          FROM reservation r
          INNER JOIN properties p ON r.propertyid = p.propertyid
          WHERE p.clusterid = ANY($1)
        ),
        all_users AS (
          SELECT DISTINCT userid FROM users
        )
        SELECT 
          mu.month,
          (COUNT(DISTINCT mu.userid) * 100.0) / NULLIF((SELECT COUNT(*) FROM all_users), 0) AS customer_retention_rate
        FROM monthly_users mu
        GROUP BY mu.month
        ORDER BY mu.month;
        `,
        [clusterids]
      );
    }
    
    if (result.rows.length > 0) {
      console.log("Customer Retention Rate result:", result.rows);
      res.json({
        monthlyData: result.rows,
      });
    } else {
      res.status(404).json({ message: "No retention data found" });
    }
  } catch (err) {
    console.error("Error fetching customer retention rate data:", err);
    res.status(500).json({ message: "Internal Server Error", details: err.message });
  }
});

app.get("/users/guest_satisfaction_score", async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: "Missing userid parameter" });
  }

  try {
    const ownerResult = await pool.query(
      `SELECT usergroup
       FROM users
       WHERE userid = $1
       `,
      [userid]
    );

    const usergroup = ownerResult.rows[0].usergroup;

    let result;

    if (usergroup === 'Owner') {
      result = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          AVG(p.rating) AS guest_satisfaction_score
        FROM reservation r
        INNER JOIN properties p ON r.propertyid = p.propertyid
        WHERE p.rating IS NOT NULL
        GROUP BY TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY month;
        `,
      );
    } else if (usergroup === 'Moderator') {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      result = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          AVG(p.rating) AS guest_satisfaction_score
        FROM reservation r
        INNER JOIN properties p ON r.propertyid = p.propertyid
        WHERE p.clusterid = ANY($1) 
        AND p.rating IS NOT NULL
        AND p.userid = $2
        GROUP BY TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY month;
        `,
        [clusterids, userid]
      );
    } else {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map(row => row.clusterid);
  
      result = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          AVG(p.rating) AS guest_satisfaction_score
        FROM reservation r
        INNER JOIN properties p ON r.propertyid = p.propertyid
        WHERE p.clusterid = ANY($1) AND p.rating IS NOT NULL
        GROUP BY TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY month;
        `,
        [clusterids]
      );
    }

    if (result.rows.length > 0) {
      console.log("Guest Satisfaction Score result:", result.rows);
      res.json({
        monthlyData: result.rows,
      });
    } else {
      res.status(404).json({ message: "No rating data found" });
    }
  } catch (err) {
    console.error("Error fetching guest satisfaction score data:", err);
    res.status(500).json({ message: "Internal Server Error", details: err.message });
  }
});

app.get("/users/alos", async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: "Missing userid parameter" });
  }

  try {
    const ownerResult = await pool.query(
      `SELECT usergroup
       FROM users
       WHERE userid = $1
       `,
      [userid]
    );

    const usergroup = ownerResult.rows[0].usergroup;

    let result;

    if (usergroup === 'Owner') {
      result = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          COALESCE(SUM(EXTRACT(DAY FROM r.checkoutdatetime - r.checkindatetime)) / NULLIF(COUNT(r.reservationid), 0), 0) AS average_length_of_stay
        FROM reservation r
        INNER JOIN properties p ON r.propertyid = p.propertyid
        GROUP BY TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY month;
        `,
      );
    } else if (usergroup === 'Moderator') {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map((row) => row.clusterid);
  
      result = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          COALESCE(SUM(EXTRACT(DAY FROM r.checkoutdatetime - r.checkindatetime)) / NULLIF(COUNT(r.reservationid), 0), 0) AS average_length_of_stay
        FROM reservation r
        INNER JOIN properties p ON r.propertyid = p.propertyid
        WHERE p.clusterid = ANY($1)
        AND p.userid = $2
        GROUP BY TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY month;
        `,
        [clusterids, userid]
      );
    } else {
      const clusterResult = await pool.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster found for this user" });
      }
  
      const clusterids = clusterResult.rows.map((row) => row.clusterid);
  
      result = await pool.query(
        `
        SELECT 
          TO_CHAR(r.checkindatetime, 'YYYY-MM') AS month,
          COALESCE(SUM(EXTRACT(DAY FROM r.checkoutdatetime - r.checkindatetime)) / NULLIF(COUNT(r.reservationid), 0), 0) AS average_length_of_stay
        FROM reservation r
        INNER JOIN properties p ON r.propertyid = p.propertyid
        WHERE p.clusterid = ANY($1)
        GROUP BY TO_CHAR(r.checkindatetime, 'YYYY-MM')
        ORDER BY month;
        `,
        [clusterids]
      );
    }
    
    if (result.rows.length > 0) {
      console.log("Average Length of Stay result:", result.rows);
      res.json({
        monthlyData: result.rows,
      });
    } else {
      res.status(404).json({ message: "No ALOS data found" });
    }
  } catch (err) {
    console.error("Error fetching ALOS data:", err);
    res.status(500).json({ message: "Internal Server Error", details: err.message });
  }
});

// Fetch reservations for the logged-in user
app.get('/cart', async (req, res) => {
  const userid = req.query.userid;

  if (!userid || isNaN(userid)) {
    return res.status(400).json({ error: 'Invalid or missing userid' });
  }

  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(
      `SELECT 
        r.reservationid,
        r.propertyid,
        p.*,
        r.checkindatetime,
        r.checkoutdatetime,
        r.reservationblocktime,
        r.request,
        r.totalprice,
        r.reservationstatus,
        r.rcid,
        r.userid
      FROM 
        reservation r
      JOIN 
        properties p ON r.propertyid = p.propertyid
        WHERE 
        r.userid = $1`,
      [userid]
    );

    const reservations = result.rows.map(reservation => ({
      ...reservation,
      propertyimage: reservation.propertyimage ? reservation.propertyimage.split(',') : []
    }));

    res.status(200).json({ userid, reservations });
  } catch (err) {
    console.error('Error fetching reservations by userid:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Get property owner's PayPal ID
app.get('/property/owner-paypal/:propertyId', async (req, res) => {
  const propertyId = req.params.propertyId;
  
  if (!propertyId || isNaN(propertyId)) {
    return res.status(400).json({ error: 'Invalid property ID' });
  }
  
  let client;
  try {
    client = await pool.connect();
    
    // FIXED: Use correct column name 'userid' instead of 'owner_id'
    const ownerResult = await client.query(
      `SELECT userid FROM properties WHERE propertyid = $1`,
      [propertyId]
    );
    
    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    const ownerId = ownerResult.rows[0].userid;
    
    // Get PayPal ID and user details
    const paypalResult = await client.query(
      `SELECT paypalid, ufirstname, ulastname, usergroup FROM users WHERE userid = $1`,
      [ownerId]
    );
    
    if (paypalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property owner not found' });
    }
    
    const ownerData = paypalResult.rows[0];
    
    // Check if owner has valid user group (case-insensitive)
    const userGroupLower = ownerData.usergroup.toLowerCase();
    
    if (!['administrator', 'moderator'].includes(userGroupLower)) {
      return res.status(403).json({ error: 'Property not owned by a valid payment recipient' });
    }
    
    if (!ownerData.paypalid) {
      return res.status(400).json({ error: 'Property owner has no PayPal ID configured' });
    }
    
    res.status(200).json({
      payPalId: ownerData.paypalid,
      ownerName: `${ownerData.ufirstname} ${ownerData.ulastname}`,
      ownerGroup: ownerData.usergroup
    });
    
  } catch (err) {
    console.error('Error fetching property owner PayPal ID:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Fetch all reservations (Dashboard)
app.get('/reservationTable', async (req, res) => {
    const username = req.query.username;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    let client;
  
    try {
        client = await pool.connect();

        const userResult = await client.query(
            'SELECT userid, usergroup FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userid = userResult.rows[0].userid;
        const usergroup = userResult.rows[0].usergroup;

        let query = `
            SELECT 
                r.reservationid,
                r.propertyid,
                p.propertyaddress, 
                p.propertyimage,
                p.userid,
                u.username AS property_owner_username, -- Fetch the property owner's username
                r.checkindatetime,
                r.checkoutdatetime,
                r.reservationblocktime,
                r.request,
                r.totalprice,
                r.reservationstatus,
                r.rcid,
                rc.rcfirstname,
                rc.rclastname,
                rc.rcemail,
                rc.rcphoneno,
                rc.rctitle
            FROM reservation r
            JOIN properties p ON r.propertyid = p.propertyid
            JOIN users u ON p.userid = u.userid -- Join with users to get the username
            JOIN reservation_customer_details rc ON r.rcid = rc.rcid
        `;

        // Add filtering for Moderators
        if (usergroup === 'Moderator') {
            query += ' AND p.userid = $1';
        }

        const params = usergroup === 'Moderator' ? [userid] : [];
        const result = await client.query(query, params);

        const reservations = result.rows.map(reservation => ({
            ...reservation,
            propertyimage: reservation.propertyimage ? reservation.propertyimage.split(',') : []
        }));

        res.status(200).json({ reservations });
    } catch (err) {
        console.error('Error fetching reservation data for reservation table:', err);
        res.status(500).json({ message: 'Internal Server Error', details: err.message });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Update reservation status
app.patch('/updateReservationStatus/:reservationid', async (req, res) => {
  const { reservationid } = req.params;
  const { reservationStatus } = req.body;
  const { userid } = req.query;
  let client;

  try {
    client = await pool.connect();
    
    const result = await client.query(
      'UPDATE reservation SET reservationstatus = $1 WHERE reservationid = $2 RETURNING *',
      [reservationStatus, reservationid]
    );

    const userResult = await client.query('SELECT username FROM users WHERE userid = $1', [userid]);
    const username = userResult.rows[0].username;

    await client.query(
      `INSERT INTO Book_and_Pay_Log 
       (logTime, log, userID)
       VALUES ($1, $2, $3)`,
      [
        new Date(),
        `${username} updated reservation status to ${reservationStatus}`,
        userid
      ]
    );

    await client.query('COMMIT');

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'error' });
    }

    res.status(200).json({ message: 'success' });
  } catch (error) {
    console.error('error:', error);
    res.status(500).json({ message: 'server error' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Remove reservation
app.delete('/removeReservation/:reservationid', async (req, res) => {
  const { reservationid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

  try {
    client = await pool.connect();
    
    // Delete reservation from the Reservation table
    const result = await client.query(
      `DELETE FROM reservation WHERE reservationid = $1`, 
      [reservationid]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    await client.query('COMMIT');

    await client.query(
      `INSERT INTO Book_and_Pay_Log 
       (logTime, log, userID)
       VALUES ($1, $2, $3)`,
      [
        new Date(),
        `Removed reservation #${reservationid} for property #${propertyid}`,
        userid
      ]
    );

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationid, timestamp, "Reservation", "DELETE", "Remove Reservation", creatorid, creatorUsername]
    );

    res.status(200).json({ message: 'Reservation removed successfully' });
  } catch (err) {
    console.error('Error deleting reservation:', err);
    res.status(500).json({ message: 'Internal Server Error', details: err.message });
  }
});

// Get Properties Of Particular Administrator For "Suggest"
app.get('/operatorProperties/:userid/:reservationid', async (req, res) => {
  const { userid, reservationid } = req.params;
  let client;

  if (!userid) {
    return res.status(400).json({ message: 'User ID of Operator is not found' });
  }

  try {
    client = await pool.connect();

    // 1. Get the user's role and cluster to know which properties to show
    const userResult = await client.query('SELECT usergroup, clusterid FROM users WHERE userid = $1', [userid]);
    if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
    }
    const { usergroup, clusterid } = userResult.rows[0];

    // 2. Get the Check-In and Check-Out dates to accurately check for overlaps
    const reservationResults = await client.query(
      `SELECT checkindatetime, checkoutdatetime
       FROM reservation 
       WHERE reservationid = $1
      `,
      [reservationid]
    );

    if (reservationResults.rows.length === 0) {
        return res.status(404).json({ message: 'Original reservation not found' });
    }

    const checkInDate = reservationResults.rows[0].checkindatetime;
    const checkOutDate = reservationResults.rows[0].checkoutdatetime;
    
    // 3. Dynamic Query: Only block properties if they have ACTIVE overlapping bookings
    let queryText = `
       SELECT p.*, r.normalrate, r.weekendrate, r.specialeventrate, r.earlybirddiscountrate, r.lastminutediscountrate
       FROM properties p
       JOIN rate r ON p.rateid = r.rateid
       WHERE p.propertystatus = 'Available'
         AND NOT EXISTS (
           SELECT 1
           FROM reservation res
           WHERE res.propertyid = p.propertyid
             AND res.reservationstatus IN ('Pending', 'Accepted', 'Paid', 'Published')
             AND res.checkindatetime < $2 
             AND res.checkoutdatetime > $1
         )
    `;
    
    let queryParams = [checkInDate, checkOutDate];

    // If Administrator, show all available properties in their cluster. Otherwise, show their own.
    if (usergroup === 'Administrator' && clusterid) {
        queryText += ` AND p.clusterid = $3`;
        queryParams.push(clusterid);
    } else {
        queryText += ` AND p.userid = $3`;
        queryParams.push(userid);
    }

    const result = await client.query(queryText, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No properties found for this Operator' });
    }

    const propertiesWithSeparatedImages = result.rows.map(property => ({
      ...property,
      images: property.propertyimage ? property.propertyimage.split(',') : [],
    }));

    res.status(200).json({
      status: 'success',
      message: 'Properties Retrieved Successfully',
      data: propertiesWithSeparatedImages,
    });
  } catch (err) {
    console.error('Error retrieving properties: ', err);
    res.status(500).json({
      message: 'An error occurred while retrieving properties',
      error: err.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});
// Get user information
app.get('/getUserInfo/:userid', async (req, res) => {
  const { userid } = req.params;
  let client;
  console.log(userid);

  try {
    client = await pool.connect();
    
    const result = await client.query(
      `SELECT 
        "utitle",
        "ufirstname",
        "ulastname",
        "uemail",
        "uphoneno"
      FROM "users"
      WHERE "userid" = $1`,
      [userid] 
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User information not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting user information:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get decrypted user password
app.get('/users/getDecryptedPassword/:userid', async (req, res) => {
  const { userid } = req.params;
  let client;

  try {
    client = await pool.connect();
    console.log("userid:", userid);
    const result = await client.query(
      `SELECT password FROM users WHERE userid = $1`,
      [userid] 
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const encryptedPassword = result.rows[0].password;
    // console.log("encryptedPassword:", encryptedPassword);
    try {
      // Decrypt password
      const decryptedPassword = decrypt(encryptedPassword);
      console.log("decryptedPassword:", decryptedPassword);
      res.status(200).json({ success: true, password: decryptedPassword });
    } catch (decryptError) {
      console.error('Error decrypting password:', decryptError);
      res.status(500).json({ success: false, message: 'Failed to decrypt password' });
    }

  } catch (err) {
    console.error('Error fetching password:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Forget Password
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  let client;
  try {
    client = await pool.connect();

    // Check if the email exists in the database
    const userResult = await client.query(
      'SELECT userid, username FROM users WHERE uemail = $1', 
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Email not registered' });
    }

    const { userid, username } = userResult.rows[0];

    // Generate a new random password
    const newPassword = Math.random().toString(36).slice(-8);

    // Encrypt the new password
    const encryptedPassword = encrypt(newPassword);

    await client.query(
      'UPDATE users SET password = $1 WHERE userid = $2',
      [encryptedPassword, userid]
    );

    // Email configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Hello Sarawak Password Reset',
      html: `
        <h1>Dear ${username}</h1>
        <p>You have requested a new temporary password. You may use this temporary password for your next login.</p>
        <h2 style="color: #4CAF50; font-size: 24px;">${newPassword}</h2>
        <p>Please use this password to log in and immediately change your password.</p>
        <p>If you did not request a password reset, please contact the administrator immediately.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'New password has been sent to your email' });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error', details: err.message });
  } finally {
    if (client) {
      client.release(); 
    }
  }
});

// Get User Details
app.get('/users/:userid', async (req, res) => {
  const { userid } = req.params;

  if (isNaN(userid)) {
    return res.status(400).json({ message: "Invalid userid" });
  }

  let client;
  try {
    client = await pool.connect();
    
    const query = {
      text: "SELECT * FROM users WHERE userid = $1",
      values: [userid]
    };
    
    const result = await client.query(query);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching user data:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Update user profile
app.put('/users/updateProfile/:userid', async (req, res) => {
  const { userid } = req.params;
  const { username, password, ufirstname, ulastname, udob, utitle, ugender, uemail, uphoneno, ucountry, uzipcode, paypalid } = req.body;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;
  try {
    client = await pool.connect();
    // Encrypt the password
    const encryptedPassword = encrypt(password);
    // Update user profile
    const query = `
      UPDATE users 
      SET 
        username = $1, 
        password = $2, 
        ufirstname = $3, 
        ulastname = $4, 
        udob = $5,
        utitle = $6,
        ugender = $7,
        uemail = $8, 
        uphoneno = $9, 
        ucountry = $10, 
        uzipcode = $11,
        paypalid = $12
      WHERE userid = $13
      RETURNING userid;
    `;
    const values = [username, encryptedPassword, ufirstname, ulastname, udob, utitle, ugender, uemail, uphoneno, ucountry, uzipcode, paypalid, userid];
    const result = await client.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found or no changes made.', success: false });
    }
    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userid, timestamp, "Users", "PUT", "Update Profile", creatorid, creatorUsername]
    );
    res.status(200).json({ message: 'Profile updated successfully.', success: true });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ message: 'An error occurred while updating the profile.', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Upload user avatar
app.post('/users/uploadAvatar/:userid', async (req, res) => {
  const { userid } = req.params;
  const { uimage } = req.body;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);

  if (!userid || isNaN(userid)) {
    return res.status(400).json({ message: 'Invalid userid' });
  }

  if (!uimage) {
      return res.status(400).json({ message: 'No image data provided.' });
  }

  let client;

  try {
    client = await pool.connect();

    // Check if user exists
    const userCheck = await client.query('SELECT userid FROM users WHERE userid = $1', [userid]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const result = await client.query(
      `UPDATE users SET uimage = $1 WHERE userid = $2 RETURNING userid, uimage`,
      [uimage, userid]
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ message: 'Failed to update user avatar' });
    }

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userid, timestamp, "Users", "POST", "Upload Avatar", creatorid, creatorUsername]
    );

    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: result.rows[0], 
    });
  } catch (err) {
    console.error('Error uploading avatar:', err.message);
    return res.status(500).json({ message: `Error uploading avatar: ${err.message}` });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.post('/reviews', async (req, res) => {
    const { userid, propertyid, review, rating } = req.body; 
    const { creatorUsername } = req.query;
    const reviewdate = new Date(); 

    if (!userid || !propertyid || !review || !rating) {
        return res.status(400).json({ message: 'Missing required fields: userid, propertyid, review, or rating' });
    }

    let client;
    try {
        client = await pool.connect();
        
        // First check if the user is a Customer
        const userCheckQuery = {
            text: 'SELECT usergroup FROM users WHERE userid = $1',
            values: [userid]
        };
        
        const userResult = await client.query(userCheckQuery);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Please login first' });
        }
        
        if (userResult.rows[0].usergroup !== 'Customer') {
            return res.status(403).json({ message: 'Please login first' });
        }

        // Check if user has already submitted a review for this property
        const existingReviewQuery = {
            text: 'SELECT reviewid FROM reviews WHERE userid = $1 AND propertyid = $2',
            values: [userid, propertyid]
        };
        
        const existingReviewResult = await client.query(existingReviewQuery);
        
        if (existingReviewResult.rows.length > 0) {
            return res.status(409).json({ message: 'You have already submitted a review for this property' });
        }

        // Begin transaction
        await client.query('BEGIN');

        // Insert the review
        const insertReviewQuery = {
            text: `INSERT INTO reviews (userid, propertyid, review, reviewdate) 
                   VALUES ($1, $2, $3, $4) RETURNING reviewid;`,
            values: [userid, propertyid, review, reviewdate]
        };
        
        const reviewResult = await client.query(insertReviewQuery);
        
        // Update the property rating
        const propertyQuery = {
            text: 'SELECT rating, ratingno FROM properties WHERE propertyid = $1',
            values: [propertyid]
        };
        
        const propertyResult = await client.query(propertyQuery);
        
        if (propertyResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Property not found' });
        }
        
        const currentProperty = propertyResult.rows[0];
        let newRatingNo = currentProperty.ratingno ? currentProperty.ratingno + 1 : 1;
        let currentTotalRating = currentProperty.rating ? currentProperty.rating * currentProperty.ratingno : 0;
        let newTotalRating = currentTotalRating + parseFloat(rating);
        let newAverageRating = newTotalRating / newRatingNo;
        
        // Update the property with the new rating
        const updatePropertyQuery = {
            text: 'UPDATE properties SET rating = $1, ratingno = $2 WHERE propertyid = $3',
            values: [newAverageRating, newRatingNo, propertyid]
        };
        
        await client.query(updatePropertyQuery);
        
        // Commit transaction
        await client.query('COMMIT');

        await client.query (
          `INSERT INTO audit_trail (
              entityid, timestamp, entitytype, actiontype, action, userid, username
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [propertyid, reviewdate, "Properties", "POST", "Review Property", userid, creatorUsername]
        );
        
        res.status(201).json({ 
            message: 'Review added successfully', 
            reviewid: reviewResult.rows[0].reviewid,
            newRating: newAverageRating
        });
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error adding review:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        if (client) {
            client.release(); 
        }
    }
});

app.get('/reviews/:propertyid', async (req, res) => {
    const propertyid = req.params.propertyid;
    
    if (!propertyid) {
        return res.status(400).json({ message: 'Property ID is required' });
    }

    let client;
    try {
        client = await pool.connect();
        
        // Get reviews for the property with user information
        const reviewsQuery = {
            text: `
                SELECT r.reviewid, r.review, r.reviewdate, 
                       u.userid, u.username, u.uimage as avatar, p.propertyid, p.rating, p.ratingno,
                       EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.timestamp)) as years_on_platform
                FROM reviews r
                JOIN users u ON r.userid = u.userid
                JOIN properties p ON r.propertyid = p.propertyid
                WHERE r.propertyid = $1
                ORDER BY r.reviewdate DESC
            `,
            values: [propertyid]
        };
        
        const reviewsResult = await client.query(reviewsQuery);
        
        // If no reviews, get property data directly
        let propertyData;
        if (reviewsResult.rows.length === 0) {
            const propertyQuery = {
                text: 'SELECT propertyid, rating, ratingno FROM properties WHERE propertyid = $1',
                values: [propertyid]
            };
            const propertyResult = await client.query(propertyQuery);
            
            if (propertyResult.rows.length === 0) {
                return res.status(404).json({ message: 'Property not found' });
            }
            
            propertyData = {
                propertyid: propertyResult.rows[0].propertyid,
                rating: propertyResult.rows[0].rating || 0,
                ratingno: propertyResult.rows[0].ratingno || 0
            };
        } else {
            // Extract property data from the first review row
            propertyData = {
                propertyid: reviewsResult.rows[0].propertyid,
                rating: reviewsResult.rows[0].rating || 0,
                ratingno: reviewsResult.rows[0].ratingno || 0
            };
        }
        
        // Format reviews for frontend
        const reviews = reviewsResult.rows.map(row => {
            const reviewDate = new Date(row.reviewdate);
            const now = new Date();
            
            // Calculate relative time for datePosted
            let datePosted;
            const diffTime = Math.abs(now - reviewDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 7) {
                datePosted = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
            } else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                datePosted = `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
            } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30);
                datePosted = `${months} ${months === 1 ? 'month' : 'months'} ago`;
            } else {
                const years = Math.floor(diffDays / 365);
                datePosted = `${years} ${years === 1 ? 'year' : 'years'} ago`;
            }
            
            return {
                id: row.reviewid,
                name: row.username,
                avatar: row.avatar || null, // Return the avatar as is, frontend will handle formatting
                yearsOnPlatform: Math.floor(row.years_on_platform) || 0,
                isNew: row.years_on_platform < 1,
                datePosted: datePosted,
                comment: row.review
            };
        });
        
        // Return consolidated response with reviews and property data
        res.status(200).json({
            reviews: reviews,
            property: propertyData
        });
        
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Assign role to user
app.post('/users/assignRole/:userid/:role', async (req, res) => {
  const { userid, role } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

  try {
    client = await pool.connect();
    
    const validRoles = ['Customer', 'Moderator', 'Administrator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role', success: false });
    }

    await client.query(
      `UPDATE users SET usergroup = $1 WHERE userid = $2`,
      [role, userid]
    );

    await client.query(
      `INSERT INTO audit_trail (
         entityid, timestamp, entitytype, actiontype, action, userid, username
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userid, timestamp, 'Users', 'POST', 'Assign User Role', creatorid, creatorUsername]
    );

    res.status(200).json({ message: 'Role assigned successfully', success: true });
  } catch (err) {
    console.error('Error assigning role:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) client.release();
  }
});

// Audit Trails
app.get("/auditTrails", async (req, res) => {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ message: "Missing userid parameter" });
  }

  let client;

  try {
    client = await pool.connect();

    const ownerResult = await client.query(
      `SELECT usergroup
       FROM users
       WHERE userid = $1
       `,
      [userid]
    );

    const usergroup = ownerResult.rows[0].usergroup;

    let result;

    if (usergroup === 'Owner') {
      result = await client.query(
        `
        SELECT 
          audittrailid, entityid, timestamp, entitytype, actiontype, action, userid, username
        FROM audit_trail
        `
      );
    } else {
      const clusterResult = await client.query(
        `SELECT DISTINCT clusterid FROM users WHERE userid = $1`,
        [userid]
      );
  
      if (clusterResult.rows.length === 0) {
        return res.status(404).json({ message: "No cluster or usergroup found for this user" });
      }
  
      const clusterids = clusterResult.rows.map((row) => row.clusterid);
  
      result = await client.query(
        `
        SELECT 
          a.audittrailid, a.entityid, a.timestamp, a.entitytype, a.actiontype, a.action, a.userid, a.username
        FROM audit_trail a 
        JOIN users u
        ON a.userid = u.userid
        WHERE u.clusterid = ANY($1);
        `,
        [clusterids]
      );
    }

    // Format timestamps to yyyy-mm-dd hh:mm:ss
    const formattedRows = result.rows.map(row => {
      if (row.timestamp) {
        const date = new Date(row.timestamp);
        row.timestamp = date.toISOString().replace('T', ' ').split('.')[0]; 
      }
      return row;
    });

    if (formattedRows.length > 0) {
      console.log("Audit trails result:", formattedRows);
      res.json({
        auditTrails: formattedRows,
      });
    } else {
      res.status(404).json({ message: "No audit trail found" });
    }
  } catch (err) {
    console.error("Error fetching audit trail data:", err);
    res.status(500).json({ message: "Internal Server Error", details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Fetch Suggested Reservation
app.get('/suggestedReservations/:userid', async (req, res) => {
  const { userid } = req.params;
  
  let client;
  
  try {
      client = await pool.connect();
  
      const userEmail = await pool.query(
        `
          SELECT 
            uemail
          FROM users
          WHERE userid = $1;
        `,
        [userid]
      );
  
      const uemail = userEmail.rows[0].uemail;
  
      const result = await client.query(
        `
          SELECT r.*, p.*
          FROM reservation r
          JOIN properties p ON r.propertyid = p.propertyid
          WHERE $1 = ANY (string_to_array(suggestedemail, ','))
          AND reservationstatus = 'Suggested'
        `,
        [uemail]
      );

      // Process the properties to handle images like in /product endpoint
      const processedReservations = result.rows.map(reservation => {
        console.log(`Reservation ID ${reservation.reservationid} - Original image data:`, 
                    reservation.propertyimage ? reservation.propertyimage.substring(0, 50) + '...' : 'No image');
        
        const processedReservation = {
          ...reservation,
          propertyimage: reservation.propertyimage ? reservation.propertyimage.split(',') : []
        };
        
        console.log(`Reservation ID ${reservation.reservationid} - Processed image array length:`, 
                    processedReservation.propertyimage.length);
        
        return processedReservation;
      });
      
      if (processedReservations.length > 0) {
        console.log('Sample processed reservation object:');
        const sampleReservation = {...processedReservations[0]};
        if (sampleReservation.propertyimage && sampleReservation.propertyimage.length > 0) {
          sampleReservation.propertyimage = [`${sampleReservation.propertyimage[0].substring(0, 50)}... (truncated)`, 
                                           `and ${sampleReservation.propertyimage.length - 1} more images`];
        }
        console.log(JSON.stringify(sampleReservation, null, 2));
      }
      
      res.json(processedReservations);
  } catch (err) {
    console.error('Error fetching suggested reservations:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Fetch Published Reservation
app.get('/publishedReservations/:userid', async (req, res) => {
  const { userid } = req.params;
  
  let client;
  
  try {
      client = await pool.connect();
  
      const userEmail = await pool.query(
        `
          SELECT 
            uemail
          FROM users
          WHERE userid = $1;
        `,
        [userid]
      );
  
     const uemail = userEmail.rows[0].uemail;
  
     const result = await client.query(
      `
         SELECT r.*, p.*
         FROM reservation r
         JOIN properties p ON r.propertyid = p.propertyid
         WHERE $1 = ANY (string_to_array(suggestedemail, ','))
         AND reservationstatus = 'Published'
       `,
       [uemail]
     );
      
     res.json(result.rows);
  } catch (err) {
    console.error('Error fetching published reservations:', err);
    res.status(500).json({ message: 'Server error', success: false });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// GET all clusters
app.get('/clusters', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clusters ORDER BY clustername');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching clusters:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch clusters' });
  }
});

// GET unique cluster names
app.get('/clusters/names', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT clustername FROM clusters ORDER BY clustername');
    res.json(result.rows.map(row => row.clustername));
  } catch (error) {
    console.error('Error fetching cluster names:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cluster names' });
  }
});

// POST create a new cluster
app.post('/clusters', async (req, res) => {
  const { clusterName, clusterState, clusterProvince } = req.body;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  
  if (!clusterName || !clusterState || !clusterProvince) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cluster name, state, and province are required' 
    });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO clusters (clustername, clusterstate, clusterprovince, timestamp) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [clusterName, clusterState, clusterProvince, timestamp]
    );
    
    res.json({ 
      success: true, 
      message: 'Cluster created successfully', 
      cluster: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creating cluster:', error);
    res.status(500).json({ success: false, message: 'Failed to create cluster' });
  }
});

// PUT update a cluster
app.put('/clusters/:id', async (req, res) => {
  const { id } = req.params;
  const { clusterName, clusterState, clusterProvince } = req.body;
  
  if (!clusterName || !clusterState || !clusterProvince) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cluster name, state, and province are required' 
    });
  }
  
  try {
    const result = await pool.query(
      `UPDATE clusters 
       SET clustername = $1, clusterstate = $2, clusterprovince = $3 
       WHERE clusterid = $4 
       RETURNING *`,
      [clusterName, clusterState, clusterProvince, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cluster not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Cluster updated successfully', 
      cluster: result.rows[0] 
    });
  } catch (error) {
    console.error('Error updating cluster:', error);
    res.status(500).json({ success: false, message: 'Failed to update cluster' });
  }
});

// DELETE a cluster
app.delete('/clusters/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if there are any properties associated with this cluster
    const propertyCheck = await pool.query(
      'SELECT COUNT(*) FROM properties WHERE clusterid = $1',
      [id]
    );
    
    if (parseInt(propertyCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete cluster because it has associated properties'
      });
    }
    
    const result = await pool.query(
      'DELETE FROM clusters WHERE clusterid = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cluster not found' });
    }
    
    res.json({ success: true, message: 'Cluster deleted successfully' });
  } catch (error) {
    console.error('Error deleting cluster:', error);
    res.status(500).json({ success: false, message: 'Failed to delete cluster' });
  }
});

// GET all categories
app.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY categoryname');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// Send Payment Successfull Message To Operator
app.post('/payment_success/:reservationid', async (req, res) => {
  const { reservationid } = req.params;
  const { creatorid, creatorUsername } = req.query;
  const timestamp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let client;

  try {
    client = await pool.connect();

    const result = await client.query(
      `SELECT 
        rc.rclastname, 
        rc.rcemail, 
        rc.rctitle, 
        r.checkindatetime, 
        r.checkoutdatetime, 
        r.reservationblocktime, 
        p.propertyaddress,
        u.ulastname,
        u.uemail,
        u.utitle
      FROM reservation_customer_details rc 
      JOIN reservation r ON rc.rcid = r.rcid 
      JOIN properties p ON r.propertyid = p.propertyid 
      JOIN users u ON p.userid = u.userid
      WHERE r.reservationid = $1`,
      [reservationid]
    );

    if (result.rows.length === 0) {
      console.log('No matching reservation found.');
      return res.status(404).json({ message: 'Reservation customer or property not found' });
    }

    const data = result.rows[0];

    const {
      rclastname: customerLastName,
      rcemail: customerEmail,
      rctitle: customerTitle,
      checkindatetime: reservationCheckInDate,
      checkoutdatetime: reservationCheckOutDate,
      reservationblocktime: paymentDueDate,
      propertyaddress: reservationProperty,
      ulastname: operatorLastName,
      uemail: operatorEmail,
      utitle: operatorTitle,
    } = data;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const customerMailOptions = {
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: 'Your Payment Was Successful',
      html: `
        <h1><b>Dear ${customerTitle} ${customerLastName},</b></h1><hr/>
        <p>Thank you for your payment!</p>
        <p>Your booking for <b>${reservationProperty}</b> from <b>${reservationCheckInDate}</b> to <b>${reservationCheckOutDate}</b> has been <span style="color: blue">confirmed</span>.</p>
        <p>We look forward to your stay.</p>
        <br/>
        <p>You may log in to your account to view the reservation details.</p>
        <div style="margin: 10px 0;">
          <a href="https://sarawakadventures.com/login" style="background-color: black; color: white; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 5px;">Login</a>
        </div>
      `,
    };

    const operatorMailOptions = {
      from: process.env.EMAIL_USER,
      to: operatorEmail,
      subject: 'Customer Payment Received',
      html: `
        <h1><b>Dear ${operatorTitle} ${operatorLastName},</b></h1><hr/>
        <p>The booking for <b>${reservationProperty}</b> from <b>${reservationCheckInDate}</b> to <b>${reservationCheckOutDate}</b> has been <span style="color: blue">paid</span> by the customer.</p> 
        <p>Please prepare the room for the customer’s check-in.</p>
        <br/>
        <p>Click the button below if you wish to view the reservation details.</p>
        <div style="margin: 10px 0;">
          <a href="https://sarawakadventures.com/login" style="background-color: black; color: white; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 5px;">Login</a>
        </div>
      `,
    };

    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(operatorMailOptions);

    await client.query(
      `INSERT INTO book_and_pay_log 
       (logtime, log, userid)
       VALUES ($1, $2, $3)`,
      [
        timestamp,
        `${creatorUsername} Made Payment For (${reservationProperty})`,
        creatorid
      ]
    );

    await client.query (
      `INSERT INTO audit_trail (
          entityid, timestamp, entitytype, actiontype, action, userid, username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationid, timestamp, "Reservation", "POST", "Make Payment", creatorid, creatorUsername]
    );
    
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// add for checking date overlapping
// API endpoint to check overlap
app.post('/check-date-overlap/:propertyId', async (req, res) => {
  const propertyId = req.params.propertyId;
  const { checkIn } = req.body;
  let client;

  // Validate inputs
  if (!propertyId || !checkIn ) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    client = await pool.connect();

    // Query: check overlap for the given property ID
    const query = `
      SELECT r.reservationid
      FROM reservation r
      INNER JOIN properties p ON r.propertyid = p.propertyid 
      WHERE p.propertyid = $1
        AND r.checkindatetime = $2
        AND r.reservationstatus NOT IN ('cancelled', 'canceled')
      LIMIT 1
    `;

    const result = await client.query(query, [propertyId, checkIn]);

    const hasOverlap = result.rows.length > 0;

    return res.status(200).json({ overlap: hasOverlap });
  } catch (error) {
    console.error('Error checking date overlap:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
});

// GET unique category names

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// Schedule a daily job to send payment reminders
cron.schedule('30 14 * * *', async () => {
  console.log('Running scheduled payment reminder job...');
  try {
    const response = await fetch(`http://localhost:${port}/send_payment_reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    console.log('Scheduled job result:', result);
  } catch (error) {
    console.error('Scheduled payment reminder job failed:', error);
  }
});
