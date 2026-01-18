"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionJob = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const IngestionJobSchema = new mongoose_1.default.Schema({
    jobId: { type: String, required: true, unique: true },
    avatarId: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    error: { type: String },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
}, { timestamps: true });
exports.IngestionJob = mongoose_1.default.model('IngestionJob', IngestionJobSchema);
