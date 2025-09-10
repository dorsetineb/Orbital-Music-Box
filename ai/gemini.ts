import { GoogleGenAI, Type } from "@google/genai";

export interface AINote {
    track: number; // 0-3
    angle: number; // 0-359
    colorIndex: number; // 0-6
}

// It's recommended to initialize the SDK outside of the function
// to avoid re-initialization on every call.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// Define the expected JSON schema for the AI's response
const schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            track: {
                type: Type.INTEGER,
                description: 'The track for the note (0-3, where 0 is outermost).',
            },
            angle: {
                type: Type.INTEGER,
                description: 'The placement angle for the note (0-359 degrees).',
            },
            colorIndex: {
                type: Type.INTEGER,
                description: 'The index of the note color (0-6).',
            },
        },
        required: ["track", "angle", "colorIndex"],
    },
};


export const generateComposition = async (): Promise<AINote[]> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a pleasant, simple, and melodic musical composition for a 4-track circular sequencer. 
            - There are 4 concentric tracks, indexed 0 (outermost) to 3 (innermost).
            - There are 7 available musical notes, indexed 0 through 6.
            - Provide between 8 and 15 notes for the composition.
            - Ensure the notes are somewhat sparse and create a gentle, calming melody. Avoid dense clusters of notes.
            - Distribute notes across all four tracks.
            - The angle determines the timing of the note. Distribute the angles to create a rhythm.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        
        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);
        
        // Basic validation of the parsed structure
        if (!Array.isArray(parsed)) {
            throw new Error("AI response is not an array.");
        }
        
        // TODO: Add more specific validation of array items if needed
        return parsed as AINote[];

    } catch (error)
    {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error && error.message.includes('API_KEY')) {
             throw new Error("AI feature is disabled. API key is not configured.");
        }
        throw new Error("Failed to generate AI composition.");
    }
};
