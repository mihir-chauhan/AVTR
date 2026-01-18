import mongoose from 'mongoose';

const IngestionJobSchema = new mongoose.Schema({
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

export const IngestionJob = mongoose.model('IngestionJob', IngestionJobSchema);
