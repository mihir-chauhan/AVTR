import { VisionProcessor } from '../core/processing/vision';
import { AudioProcessor } from '../core/processing/audio';
import { StyleAnalyzer } from '../core/processing/style';
import { Avatar } from '../models/Avatar';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

const API_KEY = process.env.OVERSHOOT_API_KEY || 'mock-key';

async function getVideoMetadata(filePath: string): Promise<Date> {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.warn(`[Ingestion] Custom metadata extraction failed, using file birthtime: ${err.message}`);
                // Fallback to file creation time or now
                try {
                    const stats = fs.statSync(filePath);
                    resolve(stats.birthtime || new Date());
                } catch {
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

export async function processVideoUpload(avatarId: string, filePath: string) {
    console.log(`[Ingestion] Starting job for Avatar ${avatarId}`);

    // 0. Extract Timeline Metadata (creation time)
    const creationTime = await getVideoMetadata(filePath);

    // 1. Process in PARALLEL with graceful failure handling
    const vision = new VisionProcessor(API_KEY);
    const audio = new AudioProcessor();
    const style = new StyleAnalyzer();

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
    const avatar = await Avatar.findOne({ avatarId });
    if (avatar) {
        const oldProfile: any = avatar.personality;
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

        avatar.memory.push(...newMemories as any);
        await avatar.save();
        console.log(`[Ingestion] Avatar ${avatarId} updated successfully.`);
    }

    // cleanup
    try {
        fs.unlinkSync(filePath);
    } catch (e) {
        console.warn(`[Ingestion] Could not delete temp file: ${filePath}`);
    }
}
