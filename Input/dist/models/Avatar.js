"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Avatar = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const AvatarSchema = new mongoose_1.default.Schema({
    avatarId: { type: String, required: true, unique: true },
    userId: { type: String, required: true }, // Owner
    // Style / Personality (Optimized Aggregate)
    personality: {
        traits: [String],
        commonPhrases: [String],
        fillerWordFrequency: Number,
        speechRate: String,
        dialect: String,
        confidenceScore: Number,
        consistencyMetrics: {
            totalSessions: Number,
            lastUpdated: Date
        }
    },
    // Raw Memory (Vector Store simulation for this MVP)
    // In a production scaling app, this would be stored in Pinecone/Weaviate referencing avatarId.
    // For MongoDB, we'll store recent context chunks here.
    // Raw Memory (Vector Store simulation for this MVP)
    // In a production scaling app, this would be stored in Pinecone/Weaviate referencing avatarId.
    // For MongoDB, we'll store recent context chunks here.
    memory: [{
            timestamp: Date,
            type: { type: String, enum: ['audio', 'vision', 'text'] }, // Added 'text'
            sessionId: String, // To group chat messages
            content: String,
            embedding: [Number] // Placeholder for vector
        }],
    // State management for live calls
    activeSessionId: { type: String }
}, { timestamps: true });
exports.Avatar = mongoose_1.default.model('Avatar', AvatarSchema);
