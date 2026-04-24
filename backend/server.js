require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const db = require('./database');
const authMiddleware = require('./middleware/auth');

// ---- CLOUDINARY CONFIG ----
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const PORT = process.env.PORT || 3000;

// ---- MIDDLEWARE ----
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(FRONTEND_DIR));

// Rate limiting on auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

// ---- MULTER + CLOUDINARY STORAGE ----
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    return {
      folder: 'farwa-portfolio',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm', 'avi'],
      transformation: isVideo ? [] : [{ quality: 'auto', fetch_format: 'auto' }]
    };
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'), false);
    }
  }
});

// ---- ROUTES ----

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login
app.post('/api/auth/login', authLimiter, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = jwt.sign(
    { role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, message: 'Login successful' });
});

// Get all portfolio items (public)
app.get('/api/portfolio', (req, res) => {
  db.all(
    'SELECT * FROM portfolio_items ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      const items = rows.map(row => ({
        ...row,
        is_video: !!row.is_video,
        url: row.cloudinary_url
      }));
      res.json({ items });
    }
  );
});

// Upload portfolio item (protected)
app.post('/api/portfolio', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { title, category, description } = req.body;
  if (!title || !category) {
    cloudinary.uploader.destroy(req.file.filename);
    return res.status(400).json({ error: 'Title and category are required' });
  }

  const id = uuidv4();
  const isVideo = req.file.mimetype.startsWith('video/') ? 1 : 0;
  const cloudinaryId = req.file.filename;
  const cloudinaryUrl = req.file.path;

  db.run(
    `INSERT INTO portfolio_items (id, title, category, description, cloudinary_id, cloudinary_url, file_type, is_video, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, category, description || '', cloudinaryId, cloudinaryUrl, req.file.mimetype, isVideo, req.file.size],
    function(err) {
      if (err) {
        cloudinary.uploader.destroy(cloudinaryId, { resource_type: isVideo ? 'video' : 'image' });
        return res.status(500).json({ error: 'Failed to save item' });
      }
      res.status(201).json({
        message: 'Portfolio item added',
        item: {
          id, title, category,
          description: description || '',
          cloudinary_id: cloudinaryId,
          cloudinary_url: cloudinaryUrl,
          file_type: req.file.mimetype,
          is_video: !!isVideo,
          file_size: req.file.size,
          url: cloudinaryUrl,
          created_at: new Date().toISOString()
        }
      });
    }
  );
});

// Delete portfolio item (protected)
app.delete('/api/portfolio/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  db.get('SELECT cloudinary_id, is_video FROM portfolio_items WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Item not found' });

    db.run('DELETE FROM portfolio_items WHERE id = ?', [id], (err2) => {
      if (err2) return res.status(500).json({ error: 'Failed to delete item' });

      const resourceType = row.is_video ? 'video' : 'image';
      cloudinary.uploader.destroy(row.cloudinary_id, { resource_type: resourceType }, (err3) => {
        if (err3) console.error('Cloudinary delete error:', err3);
      });

      res.json({ message: 'Item deleted successfully' });
    });
  });
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum is 100MB.' });
  }
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
