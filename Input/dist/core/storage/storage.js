"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleStorage = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DB_PATH = path_1.default.join(process.cwd(), 'db.json');
const PROFILE_PATH = path_1.default.join(process.cwd(), 'profile.json');
class SimpleStorage {
    async saveSession(session) {
        let db = [];
        if (fs_1.default.existsSync(DB_PATH)) {
            try {
                db = JSON.parse(fs_1.default.readFileSync(DB_PATH, 'utf-8'));
            }
            catch (e) {
                console.warn("Could not read DB, starting fresh.");
            }
        }
        db.push(session);
        fs_1.default.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        console.log(`[Storage] Saved session ${session.sessionId} to ${DB_PATH}`);
    }
    async getProfile() {
        if (fs_1.default.existsSync(PROFILE_PATH)) {
            try {
                return JSON.parse(fs_1.default.readFileSync(PROFILE_PATH, 'utf-8'));
            }
            catch (e) {
                console.warn("Could not read Profile, returning null.");
            }
        }
        return null;
    }
    async saveProfile(profile) {
        fs_1.default.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
        console.log(`[Storage] Updated global profile in ${PROFILE_PATH}`);
    }
}
exports.SimpleStorage = SimpleStorage;
