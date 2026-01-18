/**
 * Beyond Presence Real-Time Avatar API Example (Node.js)
 * Using LiveKit Agents Plugin
 */
import { VoiceAssistant, createWorker } from "@livekit/agents";
import { OpenAI, SileroVAD } from "@livekit/agents-plugin-openai";
import { BeyAvatar } from "@livekit/agents-plugin-bey";

// Your API key
const BEY_API_KEY = "sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE";
const AVATAR_ID = "b63ba4e6-d346-45d0-ad28-5ddffaac0bd0_v2";

const worker = createWorker({
  entrypoint: async (ctx) => {
    // Connect to the room
    await ctx.connect({ autoSubscribe: true });

    // Initialize the voice assistant
    const assistant = new VoiceAssistant(
      {
        vad: new SileroVAD(),
        stt: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
        llm: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
        tts: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
        chatContext: [
          {
            role: "system",
            content: "You are a helpful AI assistant with a realistic avatar.",
          },
        ],
      },
      {
        room: ctx.room,
        participant: ctx.participant,
      }
    );

    // Create avatar session
    const avatar = new BeyAvatar({
      avatarId: AVATAR_ID,
      apiKey: BEY_API_KEY,
    });

    // Start avatar session
    await avatar.start(assistant.session, ctx.room);

    // Start the assistant
    assistant.start();

    // Cleanup on disconnect
    ctx.room.on("disconnected", () => {
      assistant.close();
    });
  },
});

worker.run();
