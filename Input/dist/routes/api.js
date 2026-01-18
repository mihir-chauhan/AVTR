"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const ingestionService_1 = require("../services/ingestionService");
const User_1 = require("../models/User");
const Avatar_1 = require("../models/Avatar");
const IngestionJob_1 = require("../models/IngestionJob");
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_1 = require("uuid");
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ dest: 'uploads/' }); // Temp storage for MP4s
// --- AUTH & USER MANAGEMENT ---
// Create User -> Init Avatar
router.post('/auth/register', async (req, res) => {
    try {
        const { username, password, fullName } = req.body;
        const existing = await User_1.User.findOne({ username });
        if (existing)
            return res.status(400).json({ error: "Username exists" });
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const avatarId = (0, uuid_1.v4)();
        // Init Empty Avatar Profile
        await Avatar_1.Avatar.create({
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
        const user = await User_1.User.create({
            username,
            password: hashedPassword,
            fullName,
            avatarId,
            connections: { personal: [], professional: [], business: [] }
        });
        res.json({ success: true, userId: user._id, avatarId });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User_1.User.findOne({ username });
    if (!user || !(await bcrypt_1.default.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ success: true, token: "mock-jwt-token", avatarId: user.avatarId, user });
});
// --- DATA ACCESS (For Avatar Interface) ---
router.get('/avatar/:avatarId', async (req, res) => {
    const avatar = await Avatar_1.Avatar.findOne({ avatarId: req.params.avatarId });
    if (!avatar)
        return res.status(404).json({ error: "Avatar not found" });
    res.json(avatar);
});
router.get('/avatar/:avatarId/memory', async (req, res) => {
    // Basic search (mock vector search)
    const { q } = req.query;
    const avatar = await Avatar_1.Avatar.findOne({ avatarId: req.params.avatarId });
    if (!avatar)
        return res.status(404).json({ error: "Avatar not found" });
    // Simple text filter for MVP
    const results = avatar.memory.filter(m => m.content?.includes(q));
    res.json(results);
});
// --- VIDEO INGESTION ---
router.post('/ingest/:avatarId', upload.single('video'), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: "No video file" });
    const jobId = (0, uuid_1.v4)();
    const avatarId = req.params.avatarId;
    const videoPath = req.file.path;
    // Create job record
    await IngestionJob_1.IngestionJob.create({ jobId, avatarId, status: 'pending' });
    // Async processing - return immediately
    res.json({ success: true, message: "Processing started", jobId });
    // Run Internal Pipeline
    (async () => {
        try {
            await IngestionJob_1.IngestionJob.findOneAndUpdate({ jobId }, { status: 'processing' });
            await (0, ingestionService_1.processVideoUpload)(avatarId, videoPath);
            await IngestionJob_1.IngestionJob.findOneAndUpdate({ jobId }, {
                status: 'completed',
                completedAt: new Date()
            });
        }
        catch (e) {
            console.error("Ingestion failed:", e);
            await IngestionJob_1.IngestionJob.findOneAndUpdate({ jobId }, {
                status: 'failed',
                error: e.message,
                completedAt: new Date()
            });
        }
    })();
});
// Get job status
router.get('/ingest/status/:jobId', async (req, res) => {
    const job = await IngestionJob_1.IngestionJob.findOne({ jobId: req.params.jobId });
    if (!job)
        return res.status(404).json({ error: "Job not found" });
    res.json(job);
});
exports.default = router;
