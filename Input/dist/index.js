"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_1 = __importDefault(require("./routes/api"));
const chat_1 = __importDefault(require("./routes/chat"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/avatar-platform';
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api', api_1.default);
app.use('/api/chat', chat_1.default);
// Health Check
app.get('/', (req, res) => {
    res.send('Avatar Functionality Platform API is running.');
});
// Start Server
if (process.env.MOCK_DB) {
    console.log('[MockDB] Skipping MongoDB connection');
    app.listen(PORT, () => {
        console.log(`[Server] Running on port ${PORT} (MOCK MODE)`);
    });
}
else {
    mongoose_1.default.connect(MONGO_URI)
        .then(() => {
        console.log('[DB] Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`[Server] Running on port ${PORT}`);
        });
    })
        .catch(err => {
        console.error('[DB] Connection Error:', err);
    });
}
