import fs from 'fs';
import path from 'path';
import { DailySessionData, PersonalityProfile } from '../types';

const DB_PATH = path.join(process.cwd(), 'db.json');
const PROFILE_PATH = path.join(process.cwd(), 'profile.json');

export class SimpleStorage {
    async saveSession(session: DailySessionData): Promise<void> {
        let db: DailySessionData[] = [];
        if (fs.existsSync(DB_PATH)) {
            try {
                db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            } catch (e) {
                console.warn("Could not read DB, starting fresh.");
            }
        }
        db.push(session);
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        console.log(`[Storage] Saved session ${session.sessionId} to ${DB_PATH}`);
    }

    async getProfile(): Promise<PersonalityProfile | null> {
        if (fs.existsSync(PROFILE_PATH)) {
            try {
                return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8'));
            } catch (e) {
                console.warn("Could not read Profile, returning null.");
            }
        }
        return null;
    }

    async saveProfile(profile: PersonalityProfile): Promise<void> {
        fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
        console.log(`[Storage] Updated global profile in ${PROFILE_PATH}`);
    }
}
