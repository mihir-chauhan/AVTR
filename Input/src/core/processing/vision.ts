import { VisualContext } from '../types';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { RealtimeVision } from '@overshoot/sdk'; // Kept for type reference if needed, or remove if strictly unused. 
// Actually I am not using RealtimeVision usage IN the node code, but I might want to keep it if I use the type?
// The node code uses `require`. The type is not used.
// Remove it.

export class VisionProcessor {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Helper to get video duration using ffprobe
     */
    private async getVideoDuration(videoPath: string): Promise<number> {
        return new Promise((resolve) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    console.warn(`[Vision] Could not get video duration, defaulting to 20s: ${err.message}`);
                    return resolve(20);
                }
                const duration = metadata.format.duration;
                resolve(duration ? parseFloat(duration.toString()) : 20);
            });
        });
    }

    /**
     * Processes a video file using the Overshoot SDK inside a Headless Browser.
     * @param videoPath Absolute path to the video file.
     * @returns Promise<VisualContext[]>
     */
    async processVideo(videoPath: string): Promise<VisualContext[]> {
        // Check if using mock key
        if (this.apiKey === 'mock-key' || !this.apiKey) {
            console.log('[Vision] Using MOCK mode - no real API key provided');
            return [
                {
                    timestamp: new Date().toISOString(),
                    description: "User is typing on a keyboard (Simulated)"
                },
                {
                    timestamp: new Date().toISOString(),
                    description: "User is looking at a computer screen (Simulated)"
                }
            ];
        }

        try {
            const videoDuration = await this.getVideoDuration(videoPath);
            const durationMs = videoDuration * 1000;

            console.log(`[Vision] Starting HEADLESS processing for ${videoPath} (Duration: ${videoDuration}s)`);

            // 1. Dynamic Import Puppeteer (to avoid build-time issues if strict)
            const puppeteer = require('puppeteer');

            // 2. Launch Browser
            const browser = await puppeteer.launch({
                headless: "new", // or true
                args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for some environments like Render/Docker
            });
            const page = await browser.newPage();

            // 3. Inject Log Forwarding
            page.on('console', (msg: any) => {
                const text = msg.text();
                if (text.startsWith('[Vision Stream]')) console.log(text);
                else if (text.startsWith('[RealtimeVision]')) { /* Ignore noisy debug */ }
                else if (msg.type() === 'error') console.error('[Browser Error]', text);
            });

            // 4. Load SDK Source
            // We read the ESM file and transform it to expose RealtimeVision globally
            const sdkPath = path.resolve(process.cwd(), 'node_modules/@overshoot/sdk/dist/index.mjs');
            let sdkSource = fs.readFileSync(sdkPath, 'utf-8');
            // Hacky transformation: remove export, expose to window
            sdkSource = sdkSource.replace(/export\s*\{[^}]+\};/g, "window.RealtimeVision = RealtimeVision;");

            // 5. Setup Page Content
            // We use a file input to load the video
            await page.setContent(`
                <html>
                    <body>
                        <input type="file" id="video-upload" />
                        <script type="module">
                            ${sdkSource}
                        </script>
                        <script>
                            window.processResults = [];
                            window.processingDone = false;
                            
                            window.runVision = async (apiKey) => {
                                try {
                                    const fileInput = document.getElementById('video-upload');
                                    if (!fileInput.files.length) throw new Error("No file selected in browser");
                                    
                                    const videoFile = fileInput.files[0];
                                    console.log('[Vision Stream] Browser loaded file: ' + videoFile.name);

                                    const vision = new window.RealtimeVision({
                                        apiUrl: 'https://cluster1.overshoot.ai/api/v0.2',
                                        apiKey: apiKey,
                                        prompt: 'The video is a First-Person View (Ego-centric) from the user\\'s smart glasses. Describe what the user is DOING (e.g., "User is typing", "User is holding a cup"). Do NOT describe people facing the camera as the user. Focus on the user\\'s hands, interactions, and environment.',
                                        source: { type: 'video', file: videoFile },
                                        processing: {
                                            clip_length_seconds: 1,
                                            delay_seconds: 1,
                                            fps: 30,
                                            sampling_ratio: 0.1
                                        },
                                        onResult: (result) => {
                                            if (result.ok) {
                                                const video = document.querySelector('video');
                                                const timeStr = video ? (video.currentTime.toFixed(2) + 's') : '0s';
                                                
                                                window.processResults.push({
                                                    timestamp: timeStr,
                                                    description: result.result
                                                });
                                                console.log('[Vision Stream] [' + timeStr + '] Result: ' + result.result.substring(0, 100) + '...');
                                            }
                                        },
                                        onError: (err) => {
                                            console.error('[Vision Stream] Error: ' + err.message);
                                        }
                                    });

                                    await vision.start();
                                    
                                    // Wait for video duration roughly? 
                                    // The SDK creates a video element. We can find it and listen to 'ended'.
                                    // RealtimeVision creates the element internally. We can inspect the DOM.
                                    
                                    // Hard timer: stop processing based on video length
                                    console.log(\`[Vision Stream] Processing started. Timer set for ${videoDuration} seconds...\`);
                                    setTimeout(() => {
                                        console.log(\`[Vision Stream] ${videoDuration}s reached. Stopping SDK...\`);
                                        vision.stop().then(() => {
                                            window.processingDone = true;
                                            console.log('[Vision Stream] Stream stopped. Processing complete.');
                                        }).catch(err => {
                                            console.error('[Vision Stream] Error stopping vision:', err);
                                            window.processingDone = true; // Still finish
                                        });
                                    }, ${durationMs});

                                } catch (e) {
                                    console.error(e.message);
                                    window.processingDone = true; // Exit
                                }
                            };
                        </script>
                    </body>
                </html>
            `);

            // 6. Upload File using Puppeteer API
            const inputUploadHandle = await page.$('input[type=file]');
            await inputUploadHandle.uploadFile(videoPath);


            // 7. Start Processing
            await page.evaluate((key: any) => {
                // @ts-ignore
                window.runVision(key);
            }, this.apiKey);

            // 8. Wait for Completion
            // We poll the 'window.processingDone' flag
            // Timeout set to duration + 60s buffer
            await page.waitForFunction('window.processingDone === true', { timeout: durationMs + 60000 });

            // 9. Retrieve Results
            const results = await page.evaluate(() => {
                // @ts-ignore
                return window.processResults;
            });

            await browser.close();

            console.log(`[Vision] Finished processing. Got ${results.length} visual contexts.`);
            return results as VisualContext[];

        } catch (error: any) {
            console.error(`[Vision] Error processing video (Headless):`, error.message);
            // Fallback
            return [
                {
                    timestamp: new Date().toISOString(),
                    description: "User activity captured from video (API unavailable)"
                }
            ];
        }
    }
}
