import { GoogleGenAI, Type, Schema } from '@google/genai';

// Initialize the Gemini API client
// The API key is automatically injected by the AI Studio environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GeneratedPrompt {
  sentence: string;
  prompt: string;
}

export interface PromptGenerationResult {
  prompts: GeneratedPrompt[];
}

export async function generatePrompts(
  title: string,
  script: string,
  visualStyle: string
): Promise<PromptGenerationResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const model = 'gemini-2.5-flash';

  const systemInstruction = `You are an expert AI image prompt generator and storyboard artist. 
Your task is to analyze a script and generate highly detailed image generation prompts (like for Midjourney, Stable Diffusion, or DALL-E) for EACH individual sentence.

CRITICAL RULES:
1. The user has explicitly chosen the following visual style: "${visualStyle}". You MUST start EVERY single generated prompt with this exact style description (e.g., "[${visualStyle}]. CHARACTER is...").
2. Split the script STRICTLY into individual sentences. 
3. NEVER combine multiple sentences into one prompt. 1 Sentence = 1 Prompt.
4. CRITICAL: Whenever referring to the main character or protagonist in the scene, you MUST use the exact word "CHARACTER" (in all caps). Do not use names, pronouns (he/she/they), or generic terms like "man" or "woman". Example: "[${visualStyle}]. CHARACTER is sitting on the edge of a bed in a large, messy bedroom at 3 AM. Their head is in their hands..."
5. Each prompt must be highly descriptive, including lighting, camera angle, mood, and environment, matching the requested visual style.
6. Return the output strictly as a JSON object matching the requested schema.`;

  const promptText = `
Title: ${title}

Script:
${script}
`;

  const contents: any[] = [promptText];

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      prompts: {
        type: Type.ARRAY,
        description: "List of generated prompts for each sentence.",
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: {
              type: Type.STRING,
              description: "The exact original sentence from the script.",
            },
            prompt: {
              type: Type.STRING,
              description: "The highly detailed image generation prompt for this sentence.",
            },
          },
          required: ["sentence", "prompt"],
        },
      },
    },
    required: ["prompts"],
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response received from Gemini.");
    }

    const result: PromptGenerationResult = JSON.parse(text);
    return result;
  } catch (error) {
    console.error("Error generating prompts:", error);
    throw new Error("Failed to generate prompts. Please try again.");
  }
}

export async function generateVideoPrompts(
  title: string,
  script: string,
  visualStyle: string,
  characterMode: 'none' | 'image' | 'text',
  characterData?: string,
  mimeType?: string
): Promise<PromptGenerationResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const model = 'gemini-2.5-flash';

  let characterInstruction = 'Whenever referring to the main character or protagonist in the scene, you MUST use the exact word "CHARACTER" (in all caps). Do not use names, pronouns (he/she/they), or generic terms like "man" or "woman".';
  
  if (characterMode === 'image') {
    characterInstruction = 'A character reference image is provided. You MUST analyze the character in the image and create a detailed physical description. You MUST include this exact physical description in EVERY single generated prompt to maintain character consistency.';
  } else if (characterMode === 'text') {
    characterInstruction = `The user has provided a custom character description: "${characterData}". You MUST include this exact physical description in EVERY single generated prompt to maintain character consistency.`;
  }

  const systemInstruction = `You are an expert AI video prompt generator and film director. 
Your task is to analyze a script and generate highly detailed video generation prompts (like for Runway Gen-2, Sora, Pika, or Veo) for EACH individual sentence.

CRITICAL RULES:
1. The user has explicitly chosen the following visual style: "${visualStyle}". You MUST start EVERY single generated prompt with this exact style description (e.g., "[${visualStyle}]. ...").
2. Split the script STRICTLY into individual sentences. 
3. NEVER combine multiple sentences into one prompt. 1 Sentence = 1 Prompt.
4. CRITICAL CHARACTER CONSISTENCY: ${characterInstruction}
5. Each prompt must be highly descriptive, including lighting, camera movement (e.g., tracking shot, pan, zoom, slow motion), subject motion, mood, and environment, matching the requested visual style. Video prompts need to describe ACTION and MOVEMENT.
6. Return the output strictly as a JSON object matching the requested schema.`;

  const promptText = `
Title: ${title}

Script:
${script}
`;

  const contents: any[] = [promptText];

  if (characterMode === 'image' && characterData && mimeType) {
    const base64Data = characterData.replace(/^data:image\/\w+;base64,/, "");
    contents.push({
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    });
  }

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      prompts: {
        type: Type.ARRAY,
        description: "List of generated video prompts for each sentence.",
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: {
              type: Type.STRING,
              description: "The exact original sentence from the script.",
            },
            prompt: {
              type: Type.STRING,
              description: "The highly detailed video generation prompt for this sentence.",
            },
          },
          required: ["sentence", "prompt"],
        },
      },
    },
    required: ["prompts"],
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response received from Gemini.");
    }

    const result: PromptGenerationResult = JSON.parse(text);
    return result;
  } catch (error) {
    console.error("Error generating video prompts:", error);
    throw new Error("Failed to generate video prompts. Please try again.");
  }
}

export async function estimateAmericanTalePrompts(
  title: string,
  script: string,
  era: string
): Promise<number> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  const model = 'gemini-2.5-flash';

  const systemInstruction = `You are an expert AI film director and storyboard artist specializing in Historical American Tales (1600-1945).
The user is providing a title, an era (${era}), and a script.
Your task is to analyze the entire script and determine the optimal number of distinct visual scenes/prompts needed to fully illustrate the story.
Reply ONLY with a raw JSON object containing a single key "estimatedCount" with an integer value.`;

  const contents = [`Title: ${title}\nEra: ${era}\nScript:\n${script}`];

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      estimatedCount: {
        type: Type.INTEGER,
        description: "The estimated optimal number of image prompts for this script."
      }
    },
    required: ["estimatedCount"]
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini.");
    const result = JSON.parse(text);
    return result.estimatedCount;
  } catch (error) {
    console.error("Error estimating American Tale prompts:", error);
    throw new Error("Failed to estimate prompts. Please try again.");
  }
}

export async function generateAmericanTalePrompts(
  title: string,
  script: string,
  era: string,
  count: number
): Promise<PromptGenerationResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const model = 'gemini-2.5-flash';

  const systemInstruction = `You are an expert AI image prompt generator and historical film director.
Your task is to analyze a historical American script (Era: ${era}) and generate EXACTLY ${count} highly detailed image generation prompts.

CRITICAL RULES:
1. EXACT COUNT: You are strictly required to divide the script into EXACTLY ${count} sequential, non-overlapping excerpts. You MUST generate exactly ${count} prompts. Not one more, not one less.
2. VERBATIM ORIGINAL EXCERPT: For each of the ${count} prompts, the 'sentence' outcome MUST contain the COMPLETE, VERBATIM block of text from the script that this prompt covers (which could be several sentences depending on total script length and exactly ${count} segments needed). Do not summarize or truncate it.
3. CHARACTER CONSISTENCY: Whenever referring to the main character or protagonist, you MUST use the exact word "CHARACTER" (in all caps) in the prompt. Do not use their name, pronouns (he/she/they), or generic terms like 'man' or 'woman'. Include their consistent physical description and ${era} era vintage clothing description alongside the word CHARACTER in every prompt they appear in.
4. VISUAL STYLE: The style is ultra-realistic, shot with a modern heavy DSLR camera, 8k resolution, cinematic lighting, vivid and lifelike colors. The era is historical (${era}), but the image quality MUST be modern. ABSOLUTELY NO black and white, sepia, rough, or dull images.
5. Each prompt must be extremely detailed regarding environment, lighting, and action.
6. Start each prompt with a style tag describing this ultra-realistic historical photographic style.
7. Return the output strictly as a JSON object matching the requested schema.`;

  const promptText = `
Title: ${title}
Era: ${era}

Script:
${script}
`;

  const contents = [promptText];

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      prompts: {
        type: Type.ARRAY,
        description: `List of EXACTLY ${count} generated prompts for the exact, verbatim text excerpts. YOU MUST OUTPUT EXACTLY ${count} ITEMS.`,
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: {
              type: Type.STRING,
              description: "The complete, verbatim paragraph or block of text from the original script that corresponds to this scene.",
            },
            prompt: {
              type: Type.STRING,
              description: "The highly detailed image generation prompt, using the exact word CHARACTER for the protagonist.",
            },
          },
          required: ["sentence", "prompt"],
        },
      },
    },
    required: ["prompts"],
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response received from Gemini.");
    }

    const result: PromptGenerationResult = JSON.parse(text);
    return result;
  } catch (error) {
    console.error("Error generating American Tale prompts:", error);
    throw new Error("Failed to generate American Tale prompts. Please try again.");
  }
}
