
import { VisionProcessor } from './src/core/processing/vision';
import path from 'path';

async function main() {
    console.log("Starting verification...");
    const vp = new VisionProcessor("mock-key"); // Puppeteer needs real key? Code says if mock-key -> return mock.
    // Wait, the new code still checks for 'mock-key' effectively returning mock results immediately!
    // I need to use a FAKE 'real' key to trigger the puppeteer path.
    // But then the SDK in the browser will fail auth.
    // However, the user wants to see the BROWSER launch.
    // I will use "test-key" to trigger Puppeteer path.

    // The previous implementation had a "Mock Mode" check at the top.
    // My new implementation also has it.
    // If I pass "test-key", it proceeds to Puppeteer.
    // Inside Puppeteer, the SDK will likely fail with "Unauthorized", but we should see logs from the browser.

    const vpReal = new VisionProcessor("sk-test-fake-key");
    const videoPath = path.resolve(process.cwd(), "test_video.mp4");

    console.log(`Processing ${videoPath}...`);
    const results = await vpReal.processVideo(videoPath);

    console.log("Results:", JSON.stringify(results, null, 2));
}

main().catch(console.error);
