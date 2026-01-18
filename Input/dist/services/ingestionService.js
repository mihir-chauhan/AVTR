"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVideoUpload = processVideoUpload;
const vision_1 = require("../core/processing/vision");
const audio_1 = require("../core/processing/audio");
const style_1 = require("../core/processing/style");
const Avatar_1 = require("../models/Avatar");
const fs_1 = __importDefault(require("fs"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const API_KEY = process.env.OVERSHOOT_API_KEY || 'mock-key';
async function getVideoMetadata(filePath) {
    return new Promise((resolve) => {
        fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.warn(`[Ingestion] Custom metadata extraction failed, using file birthtime: ${err.message}`);
                // Fallback to file creation time or now
                try {
                    const stats = fs_1.default.statSync(filePath);
                    resolve(stats.birthtime || new Date());
                }
                catch {
                    resolve(new Date());
                }
                return;
            }
            // check format tags
            const tags = metadata.format.tags || {};
            const creationTime = tags['creation_time'] || tags['date'];
            if (creationTime) {
                const date = new Date(creationTime);
                if (!isNaN(date.getTime())) {
                    console.log(`[Ingestion] Found video creation time: ${date.toISOString()}`);
                    resolve(date);
                    return;
                }
            }
            console.log(`[Ingestion] No valid creation_time found in metadata, using current time.`);
            resolve(new Date());
        });
    });
}
async function processVideoUpload(avatarId, filePath) {
    console.log(`[Ingestion] Starting job for Avatar ${avatarId}`);
    // 0. Extract Timeline Metadata (creation time)
    const creationTime = await getVideoMetadata(filePath);
    // 1. Process in PARALLEL with graceful failure handling
    const vision = new vision_1.VisionProcessor(API_KEY);
    const audio = new audio_1.AudioProcessor();
    const style = new style_1.StyleAnalyzer();
    // Use Promise.allSettled so one failure doesn't block the other
    const results = await Promise.allSettled([
        vision.processVideo(filePath),
        audio.processAudio(filePath)
    ]);
    // Extract results, using empty arrays for failures
    const visuals = results[0].status === 'fulfilled' ? results[0].value : [];
    const transcripts = results[1].status === 'fulfilled' ? results[1].value : [];
    // Log any failures
    if (results[0].status === 'rejected') {
        console.error(`[Ingestion] Vision processing failed:`, results[0].reason?.message || results[0].reason);
    }
    if (results[1].status === 'rejected') {
        console.error(`[Ingestion] Audio processing failed:`, results[1].reason?.message || results[1].reason);
    }
    // Check if we have any data to work with
    if (visuals.length === 0 && transcripts.length === 0) {
        console.error(`[Ingestion] Both vision and audio failed. Cannot generate profile.`);
        throw new Error('Both vision and audio processing failed');
    }
    console.log(`[Ingestion] Processing complete. Visuals: ${visuals.length}, Transcripts: ${transcripts.length}`);
    // 2. Analyze (even with partial data)
    const currentProfile = await style.analyze(transcripts, visuals);
    // 3. Update Database (Optimization Loop)
    const avatar = await Avatar_1.Avatar.findOne({ avatarId });
    if (avatar) {
        const oldProfile = avatar.personality;
        const newTotalSessions = (oldProfile.consistencyMetrics?.totalSessions || 0) + 1;
        // Update filler word freq (Weighted Avg)
        const oldFreq = oldProfile.fillerWordFrequency || 0;
        const newFreq = currentProfile.fillerWordFrequency || 0;
        const avgFreq = ((oldFreq * (newTotalSessions - 1)) + newFreq) / newTotalSessions;
        // Save Analysis
        avatar.personality = {
            ...currentProfile,
            fillerWordFrequency: avgFreq,
            consistencyMetrics: {
                totalSessions: newTotalSessions,
                lastUpdated: new Date()
            }
        };
        // Store Memory (Vector Simulation)
        const newMemories = [
            ...transcripts.map(t => ({ timestamp: creationTime, type: 'audio', content: t.text })),
            ...visuals.map(v => ({ timestamp: creationTime, type: 'vision', content: v.description }))
        ];
        avatar.memory.push(...newMemories);
        await avatar.save();
        console.log(`[Ingestion] Avatar ${avatarId} updated successfully.`);
    }
    // cleanup
    try {
        fs_1.default.unlinkSync(filePath);
    }
    catch (e) {
        console.warn(`[Ingestion] Could not delete temp file: ${filePath}`);
    }
}
