"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const UserSchema = new mongoose_1.default.Schema({
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
exports.User = mongoose_1.default.model('User', UserSchema);
