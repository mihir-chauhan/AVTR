export interface VisualContext {
    timestamp: string; // ISO string
    description: string;
}

export interface AudioTranscript {
    timestamp: string;
    text: string;
    dialect?: string;
    fillerWords?: string[];
    sentiment?: string;
}

export interface DailySessionData {
    sessionId: string;
    date: string;
    videoPath: string;
    visualContext: VisualContext[];
    transcript: AudioTranscript[];
    personalityProfile?: PersonalityProfile;
}

export interface PersonalityProfile {
    traits: string[];
    commonPhrases: string[];
    fillerWordFrequency: number;
    speechRate: string; // e.g., "fast", "measured"
    dialect: string;
    // New fields for long-term optimization
    confidenceScore?: number; // 0-1, how much data backs this
    consistencyMetrics?: {
        totalSessions: number;
        lastUpdated: string;
    };
}

export interface ChatMessage {
    role: 'user' | 'avatar' | 'system';
    content: string;
    timestamp: string;
}

export interface ChatSession {
    sessionId: string;
    avatarId: string;
    history: ChatMessage[];
    startTime: string;
    endTime?: string;
    isActive: boolean;
}
