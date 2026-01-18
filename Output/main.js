import { Room, RoomEvent, RemoteParticipant, LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';
import OpenAI from 'openai';

// --- CONFIGURATION ---
const AVATAR_API_BASE = 'https://avatarinput.onrender.com/api/chat';
const API_AVATAR_ID = 'ba96af10-6224-4eff-8cab-db4dc43535ed';
const HEYGEN_AVATAR_ID = 'bd43ce31-7425-4379-8407-60f029548e61';
const TTS_VOICE_ID = 'b952f553-f7f3-4e52-8625-86b4c415384f';

// We get this from environment via Vite
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const BITHUMAN_API_KEY = import.meta.env.VITE_BITHUMAN_API_KEY;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // For demo/hackathon purposes
});

// --- STATE ---
let sessionState = {
    sessionId: null,
    avatarId: HEYGEN_AVATAR_ID,
    room: null,
    ws: null,
    isMicActive: false,
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
};

// --- DOM ELEMENTS ---
const startBtn = document.getElementById('start-btn');
const endBtn = document.getElementById('end-btn');
const micBtn = document.getElementById('mic-btn');
const activeControls = document.getElementById('active-controls');
const transcriptContainer = document.getElementById('transcript-container');
const placeholder = document.getElementById('placeholder');
const videoContainer = document.getElementById('video-container');
const statusToast = document.getElementById('status-toast');
const statusMsg = document.getElementById('status-msg');
const audioVisualizer = document.getElementById('audio-visualizer');

// --- UTILS ---
function showToast(msg, duration = 3000) {
    statusMsg.innerText = msg;
    statusToast.classList.add('show');
    if (duration > 0) {
        setTimeout(() => statusToast.classList.remove('show'), duration);
    }
}

function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerText = text;
    transcriptContainer.appendChild(div);
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}

// --- CORE LOGIC ---

async function startBitHumanSession(avatarId) {
    if (!BITHUMAN_API_KEY) {
        console.warn("[BitHuman] No API Key provided. Video stream will be mocked.");
        return null;
    }

    try {
        console.log("[BitHuman] Starting Session...");
        // BitHuman often uses a direct LiveKit connection or a specific API to provision a room.
        // For this implementation, we will assume a standard REST endpoint to get the room token,
        // which is a common pattern (e.g., POST https://api.bithuman.io/v1/sessions).
        // NOTE: As exact public API docs for REST session init can be sparse without login,
        // we will implement a generic structure that likely matches their LiveKit provisioning.

        // Hypothetical Endpoint: Adjust if specific docs are found
        const response = await fetch('https://api.bithuman.io/v1/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${BITHUMAN_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                avatar_id: avatarId,
                voice_id: TTS_VOICE_ID
            })
        });

        if (!response.ok) {
            throw new Error(`BitHuman API Error: ${response.status}`);
        }

        const data = await response.json();

        return {
            sessionId: data.session_id,
            livekit_url: data.livekit_url, // Or data.url
            livekit_token: data.livekit_token // Or data.access_token
        };
    } catch (e) {
        console.error("[BitHuman] Failed to start:", e);
        return null;
    }
}

async function startSession() {
    try {
        showToast('Initializing Session...', 0);

        // 1. Start session on Input API (The Brain)
        const response = await fetch(`${AVATAR_API_BASE}/session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarId: API_AVATAR_ID })
        });

        const data = await response.json();
        if (!data.success) throw new Error('Failed to start session on backend');

        sessionState.sessionId = data.sessionId;
        console.log('[App] Brain Session ID:', API_AVATAR_ID);

        // 2. Start LiveAvatar (Video)
        // If Backend didn't give us keys, try Client-Side BitHuman Init
        let liveData = {
            livekit_url: data.livekit_url,
            livekit_token: data.livekit_token,
            ws_url: data.ws_url
        };

        if (!liveData.livekit_url) {
            console.log("[App] Backend missing LiveKit info. Attempting client-side BitHuman init...");
            // Use the Avatar ID from config
            // Note: 'c46ef...' looks like a uuid, HeyGen sometimes uses names or IDs.
            // We'll pass it through.
            const bitHumanData = await startBitHumanSession(sessionState.avatarId);
            if (bitHumanData) {
                liveData = bitHumanData;
                // HeyGen "Custom Mode" usually uses the 'streaming.task' endpoint for Repeating text
                // But for low-latency audio sync, we need the websocket.
                // If the start endpoint didn't give a WS url, we might rely on the standard API.
            }
        }

        startBtn.style.display = 'none';
        activeControls.style.display = 'flex';
        placeholder.style.display = 'none';

        showToast('Connecting to LiveKit Room...', 0);

        // Connect Video
        if (liveData.livekit_url && liveData.livekit_token) {
            await connectToLiveKit(liveData.livekit_url, liveData.livekit_token);
        } else {
            console.warn('[App] No LiveKit info available. Video will be placeholder.');
            // Fallback Video
            const video = document.createElement('video');
            video.src = 'https://storage.googleapis.com/heygen-demo-assets/vicky_demo.mp4';
            video.loop = true;
            video.autoplay = true;
            video.muted = true;
            videoContainer.innerHTML = '';
            videoContainer.appendChild(video);
        }

        // Connect Audio/Control Socket
        // If we got a WS URL (Custom Mode specific), use it.
        // If not, we might need a different strategy, but let's stick to the WS plan as implemented.
        if (liveData.ws_url) {
            await connectToAvatarWS(liveData.ws_url);
        }

        showToast('Call started', 2000);

        // Start listening
        toggleMic();

        addMessage('avatar', 'Session started! I\'m listening.');

    } catch (err) {
        console.error(err);
        showToast('Error: ' + err.message);
    }
}

async function endSession() {
    if (sessionState.isRecording) stopRecording();

    if (sessionState.sessionId) {
        await fetch(`${AVATAR_API_BASE}/session/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarId: API_AVATAR_ID })
        });
    }

    // Cleanup
    if (sessionState.room) sessionState.room.disconnect();
    if (sessionState.ws) sessionState.ws.close();

    startBtn.style.display = 'block';
    activeControls.style.display = 'none';
    placeholder.style.display = 'flex';

    sessionState.sessionId = null;
    sessionState.sessionId = null;
    showToast('Session Ended');
}

// --- AUDIO PLAYBACK HELPER ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

async function resampleAndEncodeAudio(audioBuffer) {
    // LiveAvatar expects 24kHz
    const targetSampleRate = 24000;
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * targetSampleRate, targetSampleRate);

    // Play the original buffer into the offline context
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const float32Data = renderedBuffer.getChannelData(0);
    const int16Data = new Int16Array(float32Data.length);

    // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
    for (let i = 0; i < float32Data.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Data[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Convert to Base64
    // Using a chunk-safe approach for large arrays if needed, but for speech segments this is okay
    let binary = '';
    const bytes = new Uint8Array(int16Data.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function playAndSendAudio(mp3Blob) {
    try {
        const arrayBuffer = await mp3Blob.arrayBuffer();

        // 1. Play Audio Locally (User Experience)
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0)); // clone for decode
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start(0);

        // 2. Prepare PCM for LiveAvatar (Video/Lipsync)
        if (sessionState.ws && sessionState.ws.readyState === WebSocket.OPEN) {
            console.log('[Audio] Resampling and sending to Avatar...');
            const base64PCM = await resampleAndEncodeAudio(audioBuffer);

            sessionState.ws.send(JSON.stringify({
                type: 'agent.speak',
                audio: base64PCM
            }));
            console.log('[Audio] Sent packet size:', base64PCM.length);
        } else {
            console.warn('[Audio] WS not connected. Video will not lipsync.');
        }

    } catch (err) {
        console.error('[Audio] Playback/Send failed:', err);
    }
}

// --- AUDIO HANDLING ---

async function toggleMic() {
    if (sessionState.isRecording) {
        stopRecording();
        micBtn.classList.remove('active');
        audioVisualizer.style.display = 'none';
    } else {
        await startRecording();
        micBtn.classList.add('active');
        audioVisualizer.style.display = 'flex';
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Visualizer logic
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyzer = audioContext.createAnalyser();
        source.connect(analyzer);

        const bars = document.querySelectorAll('.visualizer .bar');
        // VAD Parameters
        const SILENCE_THRESHOLD = 30; // 0-255, adjust based on noise
        const SILENCE_DURATION = 1500; // ms to wait before stopping
        let silenceStart = Date.now();
        let isSpeaking = false;

        function updateVisualizer() {
            if (!sessionState.isRecording) return;
            const data = new Uint8Array(analyzer.frequencyBinCount);
            analyzer.getByteFrequencyData(data);

            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            const avg = sum / data.length;

            // VAD Logic
            if (avg > SILENCE_THRESHOLD) {
                silenceStart = Date.now();
                if (!isSpeaking) {
                    isSpeaking = true;
                    console.log('[VAD] Speech started');
                }
            } else if (isSpeaking && Date.now() - silenceStart > SILENCE_DURATION) {
                console.log('[VAD] Silence detected, stopping...');
                stopRecording();
                return; // Stop loop
            }

            bars.forEach((bar, i) => {
                const val = data[i * 10] / 2;
                bar.style.height = `${Math.max(5, val)}px`;
            });
            requestAnimationFrame(updateVisualizer);
        }
        updateVisualizer();

        sessionState.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        sessionState.audioChunks = [];

        sessionState.mediaRecorder.ondataavailable = (event) => {
            sessionState.audioChunks.push(event.data);
        };

        sessionState.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(sessionState.audioChunks, { type: 'audio/webm' });
            processAudio(audioBlob);
        };

        sessionState.mediaRecorder.start();
        sessionState.isRecording = true;
        console.log('[App] Recording started');

        // Simple voice activity detection would be better, but for now we manually toggle or use a timer
        // setTimeout(() => stopRecording(), 5000); 
    } catch (err) {
        console.error('Microphone access denied:', err);
    }
}

function stopRecording() {
    if (sessionState.mediaRecorder && sessionState.isRecording) {
        sessionState.mediaRecorder.stop();
        sessionState.isRecording = false;
        console.log('[App] Recording stopped');

        // Re-start recording for next turn after a delay?
        // Or let the user toggle. 
    }
}

async function processAudio(blob) {
    try {
        showToast('Processing Speech...', 0);

        // 1. STT via Whisper
        const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
        });

        const userText = transcription.text;
        if (!userText.trim()) return;

        addMessage('user', userText);

        // 2. Brain via Output API
        showToast('Thinking...', 0);
        const response = await fetch(`${AVATAR_API_BASE}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                avatarId: API_AVATAR_ID,
                sessionId: sessionState.sessionId,
                text: userText
            })
        });

        const data = await response.json();

        if (!data.success || !data.response) {
            throw new Error(data.error || 'Invalid response from Brain API');
        }

        const avatarText = data.response;

        addMessage('avatar', avatarText);
        statusToast.classList.remove('show');

        // 3. TTS + LiveAvatar WebSocket
        await playAvatarResponse(avatarText);

        // Resume listening
        setTimeout(() => toggleMic(), 1000);

    } catch (err) {
        console.error('Processing error:', err);
        showToast('Error processing response');
    }
}

// --- LIVEAVATAR INTEGRATION ---

async function playAvatarResponse(text) {
    try {
        console.log(`[TTS] Requesting voice for: "${text}"`);
        showToast('Generating Audio...', 0);

        // 1. Generate Audio via OpenAI TTS (MP3 for easy playback)
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: text,
            response_format: "mp3"
        });

        const blob = await mp3.blob();

        // 2. Play Locally & Send
        showToast('Speaking...', 2000);
        await playAndSendAudio(blob);

    } catch (err) {
        console.error('TTS Error:', err);
        showToast('TTS Error: ' + err.message);
    }
}

// --- EVENT LISTENERS ---
startBtn.addEventListener('click', startSession);
endBtn.addEventListener('click', endSession);
micBtn.addEventListener('click', toggleMic);

// For demo, if user presses 'Enter', we could also trigger mic toggle
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !sessionState.isRecording && sessionState.sessionId) {
        toggleMic();
    }
});

async function connectToLiveKit(url, token) {
    if (!url || !token) return;

    sessionState.room = new Room();

    sessionState.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === 'video') {
            const element = track.attach();
            videoContainer.innerHTML = ''; // Remove placeholder
            videoContainer.appendChild(element);
        }
        if (track.kind === 'audio') {
            track.attach();
        }
    });

    await sessionState.room.connect(url, token);
    console.log('[App] Connected to LiveKit');
}

async function connectToAvatarWS(wsUrl) {
    if (!wsUrl) return;
    sessionState.ws = new WebSocket(wsUrl);
    sessionState.ws.onopen = () => console.log('[App] LiveAvatar WS connected');
    sessionState.ws.onmessage = (e) => console.log('[App] WS Msg:', e.data);
}
