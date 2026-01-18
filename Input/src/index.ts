import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';
import chatRoutes from './routes/chat';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/avatar-platform';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);
app.use('/api/chat', chatRoutes);

// Health Check
app.get('/', (req, res) => {
    res.send('Avatar Functionality Platform API is running.');
});

// Start Server
if (process.env.MOCK_DB) {
    console.log('[MockDB] Skipping MongoDB connection');
    app.listen(PORT, () => {
        console.log(`[Server] Running on port ${PORT} (MOCK MODE)`);
    });
} else {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log('[DB] Connected to MongoDB');
            app.listen(PORT, () => {
                console.log(`[Server] Running on port ${PORT}`);
            });
        })
        .catch(err => {
            console.error('[DB] Connection Error:', err);
        });
}

