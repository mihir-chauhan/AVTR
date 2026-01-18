"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const responseService_1 = require("../services/responseService");
const Avatar_1 = require("../models/Avatar");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
const responseService = new responseService_1.ResponseService();
// Start a new conversation session
router.post('/session/start', async (req, res) => {
    const { avatarId } = req.body;
    const sessionId = (0, uuid_1.v4)();
    // Ideally update Avatar activeSessionId
    try {
        await Avatar_1.Avatar.findOneAndUpdate({ avatarId }, { activeSessionId: sessionId });
        res.json({ success: true, sessionId });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// End a session
router.post('/session/end', async (req, res) => {
    const { avatarId } = req.body;
    try {
        await Avatar_1.Avatar.findOneAndUpdate({ avatarId }, { activeSessionId: null });
        res.json({ success: true, message: "Session ended" });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Log text-only history (if just recording, not generating)
router.post('/history', async (req, res) => {
    const { avatarId, sessionId, role, content } = req.body;
    try {
        const avatar = await Avatar_1.Avatar.findOne({ avatarId });
        if (!avatar)
            return res.status(404).json({ error: "Avatar not found" });
        await responseService.addToHistory(avatar, sessionId, role, content);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Generate a response (The Brain)
router.post('/generate', async (req, res) => {
    const { avatarId, sessionId, text, visualContext } = req.body;
    try {
        const response = await responseService.generateResponse(avatarId, sessionId, text, visualContext);
        res.json({ success: true, response });
    }
    catch (e) {
        console.error("Chat Generation Error:", e);
        res.status(500).json({ error: e.message });
    }
});
// In-memory store for pending requests: sessionId -> { res, body }
const pendingRequests = new Map();
// Stream a guided response (Human-in-the-loop)
// Step 1: User calls this. It hangs until operator gives input.
router.post('/generate_with_human', async (req, res) => {
    const { avatarId, sessionId, text, visualContext, intervention } = req.body;
    console.log(`[HumanLoop] Received request for session ${sessionId}. Waiting for operator...`);
    // Set headers for streaming text immediately so client knows it's a stream
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    // Optional: Send a keep-alive comment or just wait
    // res.write(": waiting_for_human\n");
    // Store the request and hang
    pendingRequests.set(sessionId, {
        res,
        context: {
            avatarId,
            text,
            visualContext,
            intervention: intervention !== undefined ? Number(intervention) : 1
        }
    });
    // Handle client disconnect
    req.on('close', () => {
        if (pendingRequests.has(sessionId)) {
            console.log(`[HumanLoop] Client disconnected for session ${sessionId}`);
            pendingRequests.delete(sessionId);
        }
    });
});
// Step 2: Operator calls this. It triggers the response on the hanging connection.
router.post('/human_response', async (req, res) => {
    const { sessionId, humanResponse } = req.body;
    const pending = pendingRequests.get(sessionId);
    if (!pending) {
        return res.status(404).json({ error: "No pending request found for this session ID" });
    }
    // Remove from map immediately so we don't process twice
    pendingRequests.delete(sessionId);
    // Send immediate success to Operator
    res.json({ success: true, message: "Response sent to user" });
    const { res: userRes, context } = pending;
    console.log(`[HumanLoop] Processing operator response for session ${sessionId}`);
    try {
        const stream = await responseService.generateStreamWithHuman(context.avatarId, sessionId, context.text, humanResponse, context.visualContext, context.intervention);
        for await (const chunk of stream) {
            userRes.write(chunk);
        }
        userRes.end();
        console.log(`[HumanLoop] Completed response for session ${sessionId}`);
    }
    catch (e) {
        console.error("Stream Generation Error:", e);
        userRes.write(`\n[ERROR]: ${e.message}`);
        userRes.end();
    }
});
exports.default = router;
