"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioProcessor = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
const openai_1 = __importDefault(require("openai"));
// Placeholder for OpenAI client
// In a real app, inject this instance or key
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY || 'mock-key' });
class AudioProcessor {
    constructor() { }
    /**
     * Extracts audio from video and transcribes it.
     */
    async processAudio(videoPath) {
        const audioPath = videoPath.replace(/\.[^/.]+$/, "") + "_extracted.mp3";
        console.log(`[Audio] Extracting audio to ${audioPath}...`);
        await this.extractAudio(videoPath, audioPath);
        console.log(`[Audio] Transcribing...`);
        const transcripts = await this.transcribe(audioPath);
        console.log(`[Audio] Transcription complete. Found ${transcripts.length} segments.`);
        if (transcripts.length > 0) {
            console.log(`[Audio] Sample: "${transcripts[0].text}"`);
        }
        // Cleanup
        if (fs_1.default.existsSync(audioPath)) {
            fs_1.default.unlinkSync(audioPath);
        }
        return transcripts;
    }
    extractAudio(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(inputPath)
                .output(outputPath)
                .noVideo()
                .audioCodec('libmp3lame') // or aac
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }
    async transcribe(audioPath) {
        // Check if we are running with a mock key
        if (process.env.OPENAI_API_KEY === 'mock-key' || !process.env.OPENAI_API_KEY) {
            console.log("[Audio] Using MOCK transcription (no API key provided).");
            return [
                { timestamp: new Date().toISOString(), text: "Um, hi, I'm just walking to the store.", fillerWords: ["Um"], dialect: "General American", sentiment: "Neutral" },
                { timestamp: new Date().toISOString(), text: "It's pretty sunny out here, you know?", fillerWords: ["you know"], dialect: "General American", sentiment: "Positive" }
            ];
        }
        // Real OpenAI Whisper implementation (simplified)
        try {
            const fileStream = fs_1.default.createReadStream(audioPath);
            const transcript = await openai.audio.transcriptions.create({
                file: fileStream,
                model: "whisper-1",
                response_format: "verbose_json", // Gives segments with time
                timestamp_granularities: ["segment"] // or word
            });
            // Map Whisper result to our AudioTranscript format
            // This is a rough mapping
            return transcript.segments?.map((seg) => ({
                timestamp: new Date(Date.now() + seg.start * 1000).toISOString(), // Relative to start
                text: seg.text,
                // We'll need a secondary pass for dialect/filler words if Whisper cleans them up too much.
                // But strict prompt can help. 
            })) || [];
        }
        catch (e) {
            console.error("Transcribe error:", e);
            return [];
        }
    }
}
exports.AudioProcessor = AudioProcessor;
