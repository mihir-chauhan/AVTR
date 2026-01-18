import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { AudioTranscript } from '../types';
import OpenAI from 'openai';

// Placeholder for OpenAI client
// In a real app, inject this instance or key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'mock-key' });

export class AudioProcessor {
    constructor() { }

    /**
     * Extracts audio from video and transcribes it.
     */
    async processAudio(videoPath: string): Promise<AudioTranscript[]> {
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
        if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
        }

        return transcripts;
    }

    private extractAudio(inputPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .output(outputPath)
                .noVideo()
                .audioCodec('libmp3lame') // or aac
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }

    private async transcribe(audioPath: string): Promise<AudioTranscript[]> {
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
            const fileStream = fs.createReadStream(audioPath);
            const transcript = await openai.audio.transcriptions.create({
                file: fileStream,
                model: "whisper-1",
                response_format: "verbose_json", // Gives segments with time
                timestamp_granularities: ["segment"] // or word
            });

            // Map Whisper result to our AudioTranscript format
            // This is a rough mapping
            return (transcript as any).segments?.map((seg: any) => ({
                timestamp: new Date(Date.now() + seg.start * 1000).toISOString(), // Relative to start
                text: seg.text,
                // We'll need a secondary pass for dialect/filler words if Whisper cleans them up too much.
                // But strict prompt can help. 
            })) || [];

        } catch (e) {
            console.error("Transcribe error:", e);
            return [];
        }
    }
}
