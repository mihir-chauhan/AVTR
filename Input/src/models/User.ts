import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    avatarId: { type: String, required: true }, // Links to the "Avatar" data (vector/style)
    connections: {
        personal: [{ type: String }], // Usernames or IDs
        professional: [{ type: String }],
        business: [{ type: String }]
    }
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
