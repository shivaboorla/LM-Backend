// backend/server.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB (adjust your connection string as needed)
// mongoose.connect('mongodb://localhost:27017/mydb', { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connect('mongodb://localhost:27017/lminsurancedb')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));


// Define User schema and model
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, default: 'user' }
});
const User = mongoose.model('User', UserSchema);

const ItemSchema = new mongoose.Schema({
  policyNumber: { type: String, required: true },
  customerId: { type: String},
  policyType: { type: String},
  status: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', ItemSchema);

// Secret key for JWT
const secretKey = 'your_secret_key';

// Register endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, role });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, role: user.role }, secretKey, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) return res.status(500).json({ error: 'Failed to authenticate token' });
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
}

// In your backend/server.js, after your other endpoints

// Policy endpoint to return user details and policy info
app.get('/api/policy', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Construct policy details based on the user information.
    const policy = {
      username: user.username,
      role: user.role,
      policyNumber: 'POL123456789', // Example policy number
      validTill: '2025-12-31'
    };
    res.json({ 
      message: 'Policy details fetched successfully', 
      data: policy 
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching policy details' });
  }
});



// Protected dashboard endpoint
app.get('/api/dashboard', verifyToken, (req, res) => {
  // Optional: enforce role-based access (example for a 'user' role)
  if (req.userRole !== 'user') {
    return res.status(403).json({ error: 'Access denied' });
    }
  else if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
      res.json({ message: 'Welcome to the dashboard!', username: username });
    // const role = req.userRole;

//     if (role === 'admin') {
//     res.json({
//       message: 'Welcome Admin!',
//       dashboardData: {
//         users: [
//           { id: 1, name: 'John Doe', role: 'user' },
//           { id: 2, name: 'Jane Smith', role: 'admin' }
//         ],
//         settings: {
//           canEdit: true,
//           systemStatus: 'operational'
//         }
//       }
//     });
//   } else if (role === 'user') {
//     res.json({
//       message: 'Welcome User!',
//       dashboardData: {
//         notifications: [
//           { id: 1, text: 'Your order has been shipped.' },
//           { id: 2, text: 'Your profile was updated successfully.' }
//         ],
//         recentActivity: ['Logged in', 'Viewed profile', 'Made a purchase']
//       }
//     });
//   } else {
//     res.json({
//       message: 'Welcome Guest!',
//       dashboardData: {
//         info: 'Limited access. Please login for more details.'
//       }
//     });
//   }
});

// Create an item (Admin only)
app.post('/api/items', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  try {
    const newItem = new Item(req.body);
    const savedItem = await newItem.save();
    res.status(201).json({ message: 'Item created successfully', data: savedItem });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Get all items (All authenticated users)
app.get('/api/items', verifyToken, async (req, res) => {
  try {
    const items = await Item.find();
    res.json({ message: 'Items fetched successfully', data: items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Get a single item by ID (All authenticated users)
app.get('/api/items/:id', verifyToken, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item fetched successfully', data: item });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Update an item (Admin only)
app.put('/api/items/:id', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  try {
    const updatedItem = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item updated successfully', data: updatedItem });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete an item (Admin only)
app.delete('/api/items/:id', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
