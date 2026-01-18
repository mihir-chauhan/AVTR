import express from 'express';
import multer from 'multer';
import { processVideoUpload } from '../services/ingestionService';
import { User } from '../models/User';
import { Avatar } from '../models/Avatar';
import { IngestionJob } from '../models/IngestionJob';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Temp storage for MP4s

// --- AUTH & USER MANAGEMENT ---

// Create User -> Init Avatar
router.post('/auth/register', async (req, res) => {
    try {
        const { username, password, fullName } = req.body;
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: "Username exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const avatarId = uuidv4();

        // Init Empty Avatar Profile
        await Avatar.create({
            avatarId,
            userId: username, // using username as link for now
            personality: {
                traits: [],
                commonPhrases: [],
                fillerWordFrequency: 0,
                speechRate: "Moderate",
                dialect: "General American",
                confidenceScore: 0,
                consistencyMetrics: { totalSessions: 0, lastUpdated: new Date() }
            },
            memory: []
        });

        const user = await User.create({
            username,
            password: hashedPassword,
            fullName,
            avatarId,
            connections: { personal: [], professional: [], business: [] }
        });

        res.json({ success: true, userId: user._id, avatarId });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

router.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ success: true, token: "mock-jwt-token", avatarId: user.avatarId, user });
});

// --- DATA ACCESS (For Avatar Interface) ---

router.get('/avatar/:avatarId', async (req, res) => {
    const avatar = await Avatar.findOne({ avatarId: req.params.avatarId });
    if (!avatar) return res.status(404).json({ error: "Avatar not found" });
    res.json(avatar);
});

router.get('/avatar/:avatarId/memory', async (req, res) => {
    // Basic search (mock vector search)
    const { q } = req.query;
    const avatar = await Avatar.findOne({ avatarId: req.params.avatarId });
    if (!avatar) return res.status(404).json({ error: "Avatar not found" });

    // Simple text filter for MVP
    const results = avatar.memory.filter(m => m.content?.includes(q as string));
    res.json(results);
});

// --- VIDEO INGESTION ---

router.post('/ingest/:avatarId', upload.single('video'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No video file" });

    const jobId = uuidv4();
    const avatarId = req.params.avatarId as string;
    const videoPath = req.file.path;

    // Create job record
    await IngestionJob.create({ jobId, avatarId, status: 'pending' });

    // Async processing - return immediately
    res.json({ success: true, message: "Processing started", jobId });

    // Run Internal Pipeline
    (async () => {
        try {
            await IngestionJob.findOneAndUpdate({ jobId }, { status: 'processing' });
            await processVideoUpload(avatarId, videoPath);
            await IngestionJob.findOneAndUpdate({ jobId }, {
                status: 'completed',
                completedAt: new Date()
            });
        } catch (e) {
            console.error("Ingestion failed:", e);
            await IngestionJob.findOneAndUpdate({ jobId }, {
                status: 'failed',
                error: (e as Error).message,
                completedAt: new Date()
            });
        }
    })();
});

// Get job status
router.get('/ingest/status/:jobId', async (req, res) => {
    const job = await IngestionJob.findOne({ jobId: req.params.jobId });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
});

export default router;
