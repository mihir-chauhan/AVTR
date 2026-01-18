import { AudioTranscript, VisualContext, PersonalityProfile } from '../types';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'mock-key' });

export class StyleAnalyzer {

    async analyze(transcripts: AudioTranscript[], visuals: VisualContext[]): Promise<PersonalityProfile> {
        const combinedInput = `
      AUDIO TRANSCRIPTS:
      ${transcripts.map(t => `[${t.timestamp}] ${t.text}`).join('\n')}

      VISUAL CONTEXT:
      ${visuals.map(v => `[${v.timestamp}] ${v.description}`).join('\n')}
      `;

        if (process.env.OPENAI_API_KEY === 'mock-key' || !process.env.OPENAI_API_KEY) {
            console.log("[Style] Using MOCK analysis.");
            return {
                traits: ["Casual", "Observant", "Energetic"],
                commonPhrases: ["you know", "basically"],
                fillerWordFrequency: 0.4,
                speechRate: "Moderate",
                dialect: "General American (California influence)",
                confidenceScore: 0.5,
                consistencyMetrics: {
                    totalSessions: 1,
                    lastUpdated: new Date().toISOString()
                }
            };
        }

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-5.1",
                messages: [
                    { role: "system", content: "You are an expert behavioral analyst. Analyze the provided video transcripts and visual logs to construct a personality profile. Focus on speech patterns (identifying dialects, filler words), recurring physical actions, and general demeanor. Output JSON." },
                    { role: "user", content: combinedInput }
                ],
                functions: [
                    {
                        name: "save_profile",
                        description: "Save the analyzed personality profile",
                        parameters: {
                            type: "object",
                            properties: {
                                traits: { type: "array", items: { type: "string" } },
                                commonPhrases: { type: "array", items: { type: "string" }, description: "Phrases the person repeats often" },
                                fillerWordFrequency: { type: "number", description: "0-1 scale of how often they use fillers" },
                                speechRate: { type: "string", enum: ["Slow", "Moderate", "Fast"] },
                                dialect: { type: "string", description: "Detected dialect or accent" },
                                confidenceScore: { type: "number", description: "0-1 confidence in this analysis" }
                            },
                            required: ["traits", "commonPhrases", "fillerWordFrequency", "speechRate", "dialect"]
                        }
                    }
                ],
                function_call: { name: "save_profile" }
            });

            const fnCall = response.choices[0].message.function_call;
            if (fnCall && fnCall.arguments) {
                const result = JSON.parse(fnCall.arguments);
                return {
                    ...result,
                    confidenceScore: result.confidenceScore || 0.8,
                    consistencyMetrics: {
                        totalSessions: 1,
                        lastUpdated: new Date().toISOString()
                    }
                };
            }

            throw new Error("No function call in response");

        } catch (e) {
            console.error("Analysis failed:", e);
            return {
                traits: ["Unknown"],
                commonPhrases: [],
                fillerWordFrequency: 0,
                speechRate: "Unknown",
                dialect: "Unknown",
                confidenceScore: 0,
                consistencyMetrics: {
                    totalSessions: 0,
                    lastUpdated: new Date().toISOString()
                }
            };
        }
    }

    mergeProfiles(existing: PersonalityProfile, current: PersonalityProfile): PersonalityProfile {
        // Logic: Weighted average for numbers, Union for sets, Latest for single values if confidence is higher
        const totalSessions = (existing.consistencyMetrics?.totalSessions || 0) + 1;

        // Merge unique traits
        const mergedTraits = Array.from(new Set([...existing.traits, ...current.traits]));

        // Merge unique phrases, keeping mostly the frequent ones (simplified as union here)
        const mergedPhrases = Array.from(new Set([...existing.commonPhrases, ...current.commonPhrases]));

        // Weighted average for filler frequency
        const oldFreq = existing.fillerWordFrequency || 0;
        const newFreq = current.fillerWordFrequency || 0;
        const avgFreq = ((oldFreq * (totalSessions - 1)) + newFreq) / totalSessions;

        return {
            traits: mergedTraits,
            commonPhrases: mergedPhrases,
            fillerWordFrequency: parseFloat(avgFreq.toFixed(2)),
            speechRate: current.speechRate, // Assume latest is most reflective of current mood, or could average
            dialect: existing.dialect, // Dialect shouldn't change often, keep existing unless explicit override? Let's stick to existing.
            confidenceScore: Math.min((existing.confidenceScore || 0) + 0.1, 1.0), // Increase confidence with more data
            consistencyMetrics: {
                totalSessions: totalSessions,
                lastUpdated: new Date().toISOString()
            }
        };
    }
}
