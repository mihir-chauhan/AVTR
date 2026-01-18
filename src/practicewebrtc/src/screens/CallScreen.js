import { useParams, useNavigate } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import { Room, RoomEvent, VideoPresets, Track } from "livekit-client";
import { Rnd } from "react-rnd";
import "./CallScreen.css";

function CallScreen() {
    const params = useParams();
    const localUsername = params.username;
    const roomName = params.room;

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localBubbleRef = useRef(null);
    const remoteBubbleRef = useRef(null);
    const localAudioContextRef = useRef(null);
    const remoteAudioContextRef = useRef(null);

    const roomRef = useRef(null);
    const isConnectedRef = useRef(false);
    const isLocalMutedRef = useRef(false);

    const getDefaultRemoteLayout = () => ({
        x: window.innerWidth * 0.025,
        y: window.innerHeight * 0.025,
        width: window.innerWidth * 0.95,
        height: window.innerHeight * 0.85,
    });

    const getDefaultLocalLayout = () => ({
        x: 20,
        y: window.innerHeight - 240,
        width: 200,
        height: 200,
    });

    const getDefaultTranscriptionLayout = () => ({
        x: window.innerWidth - 320,
        y: 100,
        width: 300,
        height: 400,
    });

    const [remoteLayout, setRemoteLayout] = useState(getDefaultRemoteLayout());
    const [localLayout, setLocalLayout] = useState(getDefaultLocalLayout());
    const [transcriptionLayout, setTranscriptionLayout] = useState(getDefaultTranscriptionLayout());
    const [transcripts, setTranscripts] = useState([]);
    const [localVideoTrack, setLocalVideoTrack] = useState(null);
    const [isResetting, setIsResetting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showTranscript, setShowTranscript] = useState(true);

    // Sync ref with state
    useEffect(() => {
        isLocalMutedRef.current = isMuted;
    }, [isMuted]);

    const resetLayout = () => {
        setIsResetting(true);
        setRemoteLayout(getDefaultRemoteLayout());
        setLocalLayout(getDefaultLocalLayout());
        setTranscriptionLayout(getDefaultTranscriptionLayout());
        setTimeout(() => setIsResetting(false), 500);
    };

    const toggleMute = () => {
        if (!roomRef.current?.localParticipant) return;
        const newState = !isMuted;
        roomRef.current.localParticipant.setMicrophoneEnabled(!newState);
        setIsMuted(newState);
    };

    const toggleTranscript = () => {
        setShowTranscript(!showTranscript);
    };

    // Audio Analysis for Glow Effect
    const setupAudioAnalysis = (mediaStreamOrTrack, bubbleRef, isLocal = false) => {
        if (!mediaStreamOrTrack) return null;

        try {
            let stream;
            if (mediaStreamOrTrack instanceof MediaStream) {
                stream = mediaStreamOrTrack;
            } else {
                stream = new MediaStream([mediaStreamOrTrack]);
            }

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 32;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateVolume = () => {
                if (audioContext.state === "closed") return;

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                let intensity = average / 255;

                // Force 0 for local if muted
                if (isLocal && isLocalMutedRef.current) {
                    intensity = 0;
                }

                if (bubbleRef.current) {
                    if (intensity > 0.05) {
                        const spread = 10 + (intensity * 40);
                        const alpha = 0.4 + (intensity * 0.6);
                        bubbleRef.current.style.boxShadow = `0 0 ${spread}px ${intensity * 10}px rgba(138, 43, 226, ${alpha})`;
                        bubbleRef.current.style.border = `2px solid rgba(138, 43, 226, ${alpha})`;
                    } else {
                        bubbleRef.current.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                        bubbleRef.current.style.border = '2px solid transparent';
                    }
                }
                requestAnimationFrame(updateVolume);
            };
            updateVolume();
            return audioContext;
        } catch (error) {
            console.error("Audio analysis setup failed:", error);
            return null;
        }
    };

    useEffect(() => {
        if (isConnectedRef.current) return;
        isConnectedRef.current = true;

        async function joinRoom() {
            try {
                // 1. Get Token
                const response = await fetch(`/api/token?room=${roomName || 'default'}&identity=${localUsername || 'user'}&mode=ai`);
                const data = await response.json();

                // 2. Connect to LiveKit Room
                const room = new Room({
                    adaptiveStream: true,
                    dynacast: true,
                    videoCaptureDefaults: {
                        resolution: VideoPresets.h720.resolution,
                    },
                });
                roomRef.current = room;

                // Handle Avatar Track Subscription
                room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                    console.log("Track Subscribed:", track.kind, participant.identity);
                    if (track.kind === Track.Kind.Video) {
                        track.attach(remoteVideoRef.current);
                    } else if (track.kind === Track.Kind.Audio) {
                        track.attach(); // Auto-attaches to document body

                        // Setup Visualizer for Avatar
                        if (remoteAudioContextRef.current) remoteAudioContextRef.current.close();
                        remoteAudioContextRef.current = setupAudioAnalysis(track.mediaStreamTrack, remoteBubbleRef, false);
                    }
                });

                // Handle Data Messages (Transcripts)
                room.on(RoomEvent.DataReceived, (payload, participant) => {
                    const strData = new TextDecoder().decode(payload);
                    try {
                        const json = JSON.parse(strData);
                        // Assume agent sends { type: "transcript" | "response", text: "..." }
                        // Based on previous agent code, it sends "mode_changed", "error".
                        // We'll adapt if we want transcripts. Currently agent doesn't stream explicit transcripts 
                        // in JSON format for the chat bubble, but let's leave this hook here.
                        if (json.text) {
                            setTranscripts(prev => [...prev, {
                                sender: json.type === 'response' ? 'Avatar' : 'System',
                                text: json.text
                            }]);
                        }
                    } catch (e) { }
                });

                await room.connect(data.url, data.token);
                console.log("Connected to LiveKit Room");

                // 3. Publish Local Camera & Mic
                const localTracks = await room.localParticipant.enableCameraAndMicrophone();

                // Setup Local Video Preview
                const videoTrack = localTracks.find(t => t.kind === Track.Kind.Video);
                if (videoTrack) {
                    setLocalVideoTrack(videoTrack);
                }

                // Setup Local Audio Visualizer
                const audioTrack = localTracks.find(t => t.kind === Track.Kind.Audio);
                if (audioTrack) {
                    localAudioContextRef.current = setupAudioAnalysis(audioTrack.mediaStreamTrack, localBubbleRef, true);
                }

            } catch (error) {
                console.error("Error joining room:", error);
            }
        }

        joinRoom();

        return () => {
            if (roomRef.current) {
                roomRef.current.disconnect();
            }
            if (localAudioContextRef.current) localAudioContextRef.current.close();
            if (remoteAudioContextRef.current) remoteAudioContextRef.current.close();
            isConnectedRef.current = false;
        };
    }, [localUsername, roomName]);

    // Separate effect for attaching local video to ensure it works with React lifecycle
    useEffect(() => {
        if (localVideoTrack && localVideoRef.current) {
            console.log("Attaching local video track to ref");
            localVideoTrack.attach(localVideoRef.current);
        }
    }, [localVideoTrack]);

    const navigate = useNavigate();

    const handleEndCall = () => {
        if (roomRef.current) roomRef.current.disconnect();
        navigate('/');
        window.location.reload();
    };

    return (
        <div className="call-screen-container">
            {/* Remote Video (Avatar) */}
            <Rnd
                size={{ width: remoteLayout.width, height: remoteLayout.height }}
                position={{ x: remoteLayout.x, y: remoteLayout.y }}
                onDragStop={(e, d) => setRemoteLayout(prev => ({ ...prev, x: d.x, y: d.y }))}
                onResizeStop={(e, direction, ref, delta, position) => {
                    setRemoteLayout({
                        width: parseInt(ref.style.width),
                        height: parseInt(ref.style.height),
                        ...position,
                    });
                }}
                bounds="parent"
                style={{ zIndex: 10, transition: isResetting ? "all 0.5s ease" : "none" }}
            >
                <div className="video-bubble remote-bubble" ref={remoteBubbleRef} style={{ transition: "box-shadow 0.1s ease, border-color 0.1s ease", border: "2px solid transparent" }}>
                    <video
                        ref={remoteVideoRef}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "20px" }}
                    />
                </div>
            </Rnd>

            {/* Local Video (User) */}
            <Rnd
                size={{ width: localLayout.width, height: localLayout.height }}
                position={{ x: localLayout.x, y: localLayout.y }}
                onDragStop={(e, d) => setLocalLayout(prev => ({ ...prev, x: d.x, y: d.y }))}
                onResizeStop={(e, direction, ref, delta, position) => {
                    setLocalLayout({
                        width: parseInt(ref.style.width),
                        height: parseInt(ref.style.height),
                        ...position,
                    });
                }}
                bounds="parent"
                style={{ zIndex: 11, transition: isResetting ? "all 0.5s ease" : "none" }}
            >
                <div className="video-bubble local-bubble" ref={localBubbleRef} style={{ transition: "box-shadow 0.1s ease, border-color 0.1s ease", border: "2px solid transparent", position: "relative" }}>
                    <video
                        ref={localVideoRef}
                        muted
                        autoPlay
                        playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "20px", transform: "scaleX(-1)" }}
                    />
                    {isMuted && (
                        <div style={{
                            position: "absolute", top: "10px", right: "10px",
                            backgroundColor: "rgba(0, 0, 0, 0.6)", borderRadius: "50%", padding: "8px",
                            display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)"
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" style={{ width: "20px", height: "20px" }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4m-3 0h6" />
                            </svg>
                        </div>
                    )}
                </div>
            </Rnd>

            {/* Transcription Bubble */}
            {showTranscript && (
                <Rnd
                    size={{ width: transcriptionLayout.width, height: transcriptionLayout.height }}
                    position={{ x: transcriptionLayout.x, y: transcriptionLayout.y }}
                    onDragStop={(e, d) => setTranscriptionLayout(prev => ({ ...prev, x: d.x, y: d.y }))}
                    onResizeStop={(e, direction, ref, delta, position) => {
                        setTranscriptionLayout({
                            width: parseInt(ref.style.width),
                            height: parseInt(ref.style.height),
                            ...position,
                        });
                    }}
                    bounds="parent"
                    style={{ zIndex: 12, transition: isResetting ? "all 0.5s ease" : "none" }}
                >
                    <div className="transcription-bubble">
                        {transcripts.length === 0 ? (
                            <div style={{ opacity: 0.5, fontStyle: 'italic' }}>Conversation transcript will appear here...</div>
                        ) : (
                            transcripts.map((t, i) => (
                                <div key={i} className="transcription-line">
                                    <span className="transcription-sender">{t.sender}:</span>
                                    {t.text}
                                </div>
                            ))
                        )}
                    </div>
                </Rnd>
            )}

            {/* Control Bar */}
            <div className="control-bar-container">
                <div className="control-bar">
                    <button className="reset-btn" onClick={resetLayout} title="Reset Layout">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                    </button>
                    <button className="transcript-btn" onClick={toggleTranscript} title={showTranscript ? "Hide Transcript" : "Show Transcript"} style={{ backgroundColor: showTranscript ? "#3b82f6" : undefined }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                        </svg>
                    </button>
                    <button className="mute-btn" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"} style={{ backgroundColor: isMuted ? "#ef4444" : undefined }}>
                        {isMuted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4m-3 0h6" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                            </svg>
                        )}
                    </button>
                    <button className="end-call-btn" onClick={handleEndCall}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25-2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CallScreen;
