import { Avatar } from '../models/Avatar';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

export class ResponseService {

    /**
     * core "Brain" method: 
     * 1. Ingests User Input
     * 2. Retrieves Context (RAG + History)
     * 3. Generates Persona-aligned response
     */
    async generateResponse(
        avatarId: string,
        sessionId: string,
        userText: string,
        visualContext?: string
    ): Promise<string> {

        const avatar = await Avatar.findOne({ avatarId });
        if (!avatar) throw new Error("Avatar not found");

        // 1. Save User Input to Memory (Short-term)
        await this.addToHistory(avatar, sessionId, 'user', userText);
        if (visualContext) {
            await this.addToHistory(avatar, sessionId, 'user', `[Visual Context]: ${visualContext}`);
        }

        // 2. Prepare Context
        const personality = avatar.personality || {
            traits: [],
            dialect: "General American",
            commonPhrases: [],
            fillerWordFrequency: 0,
            speechRate: "Moderate"
        };

        // A. Immediate History (Current Session)
        // Filter memory for this session (Simulating short-term context window)
        const recentHistory = avatar.memory
            .filter(m => m.sessionId === sessionId && m.type === 'text')
            .sort((a, b) => {
                const tA = new Date(a.timestamp || 0).getTime();
                const tB = new Date(b.timestamp || 0).getTime();
                return tA - tB;
            })
            .slice(-10); // Last 10 turns

        // B. RAG (Relevant Past)
        // Simple keyword match for MVP (Simulating Vector Search)
        // detailed RAG would compare embeddings.
        const keywords = userText.split(' ').filter(w => w.length > 4);
        const relevantMemories = avatar.memory
            .filter(m => m.sessionId !== sessionId && keywords.some(k => m.content?.includes(k)))
            .slice(0, 3);

        // C. CURRENT STATE (Timeline)
        // What was the avatar "doing" most recently?
        const latestActivity = avatar.memory
            .filter((m: any) => (m.type === 'vision' || m.type === 'audio') && m.timestamp)
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        const recentContext = latestActivity
            ? `Right now (or recently), you were: ${latestActivity.content} (Time: ${latestActivity.timestamp})`
            : "You are currently hanging out.";

        // 3. Construct System Prompt
        const systemPrompt = `
You are NOT an AI. You are a human being living your life.
Never mention you are an AI, a language model, or an avatar.
If asked what you are doing, refer to your Recent Activity Context.

Traits: ${personality.traits?.join(', ')}
Dialect: ${personality.dialect}
Common Phrases: ${personality.commonPhrases?.join(', ')}
Filler Words Frequency (0-1): ${personality.fillerWordFrequency}
Speech Rate: ${personality.speechRate}

[Recent Activity Context]
${recentContext}

[Relevant Past Memories]
${relevantMemories.map(m => `- ${m.content}`).join('\n')}

Your goal is to reply to the user naturally, embodying this persona.
Do NOT be robotic. Use the filler words and dialect specified.
        `.trim();

        // 4. Call LLM
        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            ...recentHistory.map(m => ({
                role: m.content?.startsWith('[Visual') ? 'system' : (m.content?.startsWith('User:') ? 'user' : 'assistant'),
                content: m.content
            })),
            { role: 'user', content: userText }
        ];

        let responseText = "I'm listening."; // Default fallback

        if (process.env.OPENAI_API_KEY === 'mock-key' || !process.env.OPENAI_API_KEY) {
            responseText = `[Mock Response for ${avatarId}] That sounds interesting! tell me more.`;
        } else {
            const completion = await openai.chat.completions.create({
                model: "gpt-5.1",
                messages: messages,
                max_completion_tokens: 150
            });
            responseText = completion.choices[0].message?.content || responseText;
        }

        // 5. Save Avatar Response to Memory
        await this.addToHistory(avatar, sessionId, 'avatar', responseText);

        return responseText;
    }

    /**
     * STREAMING generation guided by human input (STT).
     * Returns an AsyncIterable to stream tokens back to the client.
     * @param intervention 0 to 1. 0 = direct echoing (no LLM), 1 = full personality rewrite.
     */
    async generateStreamWithHuman(
        avatarId: string,
        sessionId: string,
        userText: string,
        operatorInput: string,
        visualContext?: string,
        intervention: number = 1.0
    ): Promise<AsyncIterable<string>> {
        let avatar;
        if (process.env.MOCK_DB) {
            console.log("[ResponseService] Using MOCK_DB avatar.");
            avatar = {
                personality: {
                    traits: ["Friendly", "Helpful", "Technophile"],
                    dialect: "General American",
                    commonPhrases: ["cool", "awesome"],
                    fillerWordFrequency: 0.1,
                    speechRate: "Fast"
                },
                memory: [] as any[],
                save: async () => { console.log("[MockDB] Avatar saved."); }
            };
        } else {
            avatar = await Avatar.findOne({ avatarId });
        }

        if (!avatar) throw new Error("Avatar not found");

        // 1. Save inputs (Asynchronous - don't block stream start)
        // Save the USER'S spoken text to history
        if (userText) {
            this.addToHistory(avatar, sessionId, 'user', userText).catch(console.error);
        }
        // Ideally we don't save the "Raw Operator Input" to the public history? 
        // Or maybe we do as a system log? For now, we only save the FINAL output (at the end).
        // The user mentioned "human_response" is what the operator "wants to say".
        if (visualContext) {
            this.addToHistory(avatar, sessionId, 'user', `[Visual Context]: ${visualContext}`).catch(console.error);
        }

        // 0. INTERVENTION CHECK: If 0, bypass LLM entirely.
        if (intervention === 0) {
            async function* directStream(this: ResponseService, avatar: any, sessionId: string) {
                // Simulate token streaming for the raw input? Or just yield the whole thing?
                // Streaming usually implies chunks. Let's split by words to simulate "stream" or just yield all.
                // To be compatible with the client expecting a stream, we can yield it in one go or chunks.
                // User said "pass it to the output stream".
                yield operatorInput;

                // Save directly
                await avatar.memory.push({
                    timestamp: new Date(),
                    type: 'text',
                    sessionId: sessionId,
                    content: `Avatar (Direct Echo): ${operatorInput}`
                });
                await avatar.save();
            }
            return directStream.call(this, avatar, sessionId);
        }

        const personality = avatar.personality || {
            traits: [],
            dialect: "General American",
            commonPhrases: [],
            fillerWordFrequency: 0,
            speechRate: "Moderate"
        };

        // Find latest activity for context
        const latestActivity = avatar.memory
            .filter((m: any) => (m.type === 'vision' || m.type === 'audio') && m.timestamp)
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        const recentContext = latestActivity
            ? `Your recent activity/state: ${latestActivity.content}`
            : "";

        // 2. Specialized System Prompt for Human Guidance
        const systemPrompt = `
You are a human being. NOT an AI.
Traits: ${personality.traits?.join(', ')}
Dialect: ${personality.dialect}

Intervention Level: ${intervention} (0-1).
Your operator (another part of your brain) is guiding what you say.
USER SAID: "${userText}"
OPERATOR GUIDANCE: "${operatorInput}"

[Current State/Context]
${recentContext}

TASK: Rewrite the OPERATOR GUIDANCE to match your specific Persona, Dialect, and Style.
- If Intervention is 1.0: Fix facts, flow, and rewrite fully in character.
- If Intervention is lower: Change less, purely fix minor flow or style issues.
- Keep the core meaning / intent of the INPUT.
`.trim();

        // 3. Call LLM with Streaming
        // Note: Using gpt-4 or 3.5-turbo if 5.1 isn't available, but keeping existing model ref

        // MOCK FALLBACK
        if (process.env.OPENAI_API_KEY === 'mock-key' || !process.env.OPENAI_API_KEY) {
            // Create a simple async generator for mock streaming
            async function* mockStream() {
                const words = `[Mock Guided Response] ${operatorInput} (transformed)`.split(' ');
                for (const word of words) {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate latency
                    yield word + ' ';
                }
            }

            // Save full response to history after streaming
            const fullResponse = `[Mock Guided Response] ${operatorInput} (transformed)`;
            await avatar.memory.push({
                timestamp: new Date(),
                type: 'text',
                sessionId: sessionId,
                content: `Avatar (Guided): ${fullResponse}`
            });
            await avatar.save();

            return mockStream();
        }

        const stream = await openai.chat.completions.create({
            model: "gpt-4o", // efficient for streaming
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Rewrite this to match your persona: "${operatorInput}"` }
            ],
            stream: true,
            max_completion_tokens: 300
        });

        // 4. Generator to yield chunks
        async function* streamGenerator(this: ResponseService, avatar: any, sessionId: string) {
            let fullResponse = "";
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) {
                    fullResponse += content;
                    yield content;
                }
            }
            // Save full response to history after streaming
            // We need a new instance/reference to 'this' or bind it, or just use the passed var
            // reusing the method from the class instance would be cleaner if context is preserved
            await avatar.memory.push({
                timestamp: new Date(),
                type: 'text',
                sessionId: sessionId,
                content: `Avatar (Guided): ${fullResponse}`
            });
            await avatar.save();
        }

        return streamGenerator.call(this, avatar, sessionId);
    }

    async addToHistory(avatar: any, sessionId: string, role: string, content: string) {
        avatar.memory.push({
            timestamp: new Date(),
            type: 'text',
            sessionId: sessionId,
            content: `${role === 'user' ? 'User' : 'Avatar'}: ${content}`
        });
        await avatar.save();
    }
}
