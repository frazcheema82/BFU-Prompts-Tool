import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type, Schema } from '@google/genai';

function getGenAI(apiKey?: string) {
  const finalKey = apiKey || process.env.GEMINI_API_KEY;
  if (!finalKey) {
    throw new Error("No Gemini API key provided and no default key found.");
  }
  return new GoogleGenAI({ apiKey: finalKey });
}

// Global safety settings configured to BLOCK_ONLY_HIGH to allow action/fighting scripts
const relaxedSafetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  }
];

function formatError(error: any): string {
  const msg = error.message || String(error);
  if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
    return "Error 429: API limit reached. Please wait a moment and try again.";
  }
  if (msg.includes("400") || msg.toLowerCase().includes("context")) {
    return "Error 400: Script is too long or context window exceeded.";
  }
  return msg;
}

export interface GeneratedPrompt {
  sentence: string;
  prompt: string;
}

export interface CharacterDetail {
  name: string;
  age: string;
  appearance: string;
  dress: string;
  priority: string;
  mentionCount: number;
  imagePrompt: string;
}

export interface StyleRecommendation {
  mediaType: string;
  visualCategory: string;
  specificStyle: string;
  cameraStyle: string;
  era: string;
  colorPalette: string;
  reasoning: string;
  combinedStylePrompt: string;
}

export interface GenerationSettings {
  enableSceneDetection: boolean;
  enableEmotionAnalysis: boolean;
  targetAI: string;
}

export interface PromptGenerationResult {
  prompts: GeneratedPrompt[];
}

export async function extractCharacters(
  title: string,
  script: string,
  visualStyle: string,
  apiKey: string
): Promise<CharacterDetail[]> {
  const ai = getGenAI(apiKey);
  const model = 'gemini-2.5-flash';

  const systemInstruction = `You are an expert film casting director and character designer.
Your task is to analyze a script and extract all distinct characters.
For each character, infer or extract their Name, estimated Age, Physical Appearance, and Dress/Clothing based on the text.
Identify their priority in the story (e.g., "Main Protagonist", "Supporting Character", "Minor Character") and count exactly how many times they are mentioned in the script.
Crucially, generate a highly detailed standalone image generation prompt specifically for creating a portrait/character sheet of this character.
The image prompt MUST include:
- A starting tag for the requested visual style: "[${visualStyle}]"
- A 1:1 aspect ratio constraint.
- Request for a transparent or single-color background.
- Specify that it is a portrait photo with a clear, visible face.
Ensure each character has a completely distinct and unique physical description in their prompt.`;

  const contents = [`Title: ${title}\nScript:\n${script}`];

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            age: { type: Type.STRING },
            appearance: { type: Type.STRING, description: "Detailed physical appearance (face, hair, build, etc.)" },
            dress: { type: Type.STRING, description: "Clothing and style" },
            priority: { type: Type.STRING, description: "The priority or role of the character (e.g., Main, Supporting, Minor)" },
            mentionCount: { type: Type.INTEGER, description: "The exact number of times this character is mentioned in the script" },
            imagePrompt: { type: Type.STRING, description: `A highly detailed image generation prompt starting with [${visualStyle}]. Must include constraints for 1:1 ratio, transparent/single-color background, and portrait photo with a clear face.` }
          },
          required: ["name", "age", "appearance", "dress", "priority", "mentionCount", "imagePrompt"]
        }
      }
    },
    required: ["characters"]
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        safetySettings: relaxedSafetySettings,
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.7,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini.");
    return JSON.parse(text).characters;
  } catch (error: any) {
    console.error("Error extracting characters:", error);
    throw new Error(formatError(error));
  }
}

export async function analyzeAndSuggestStyle(
  title: string,
  script: string,
  apiKey: string
): Promise<StyleRecommendation> {
  const ai = getGenAI(apiKey);
  const model = 'gemini-2.5-flash';

  const systemInstruction = `You are an expert creative director and YouTube viral content strategist.
Your task is to analyze a script and title, and recommend the absolute best visual style, media type, and overall aesthetic to make this video go viral on YouTube.
Consider what performs best: cinematic AI imagery, photorealistic historical recreations, anime/cartoon styles, or even stock media footage.
Suggest the optimal camera style, the era/setting, and the color palette.
Finally, synthesize all of this into a single 'combinedStylePrompt' that can be prefixed to image generation prompts to enforce this style globally.`;

  const contents = [`Title: ${title}\nScript:\n${script}`];

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      mediaType: { type: Type.STRING, description: "e.g., AI Generated Images, Stock Footage, 2D Animation, 3D Render" },
      visualCategory: { type: Type.STRING, description: "e.g., Realistic, Cartoonic, Cinematic, Documentary" },
      specificStyle: { type: Type.STRING, description: "Detailed style e.g., 'Dark fantasy cinematic', 'Pixar 3D style', '1990s VHS footage'" },
      cameraStyle: { type: Type.STRING, description: "e.g., 'Handheld shaky cam', 'Drone sweeping shots', 'DSLR 35mm lens'" },
      era: { type: Type.STRING, description: "e.g., 'Cyberpunk futuristic', '18th Century Victorian', 'Modern Day'" },
      colorPalette: { type: Type.STRING, description: "e.g., 'Neon cyan and magenta', 'Desaturated bleak tones', 'Warm golden hour'" },
      reasoning: { type: Type.STRING, description: "Why this specific combination will perform well and go viral on YouTube for this specific script." },
      combinedStylePrompt: { type: Type.STRING, description: "A single concise prompt string combining the style, era, camera, and colors to be used as a prefix (e.g., 'Cinematic photography, 18th Century Victorian era, shot on DSLR 35mm, sweeping drone shots, warm golden hour lighting')" }
    },
    required: ["mediaType", "visualCategory", "specificStyle", "cameraStyle", "era", "colorPalette", "reasoning", "combinedStylePrompt"]
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        safetySettings: relaxedSafetySettings,
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.7,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini.");
    return JSON.parse(text) as StyleRecommendation;
  } catch (error: any) {
    console.error("Error analyzing style:", error);
    throw new Error(formatError(error));
  }
}

export async function generatePrompts(
  title: string,
  script: string,
  visualStyle: string,
  uploadedCharacters: { name: string; details: string; imageBase64?: string; mimeType?: string }[] = [],
  settings: GenerationSettings | undefined,
  apiKey: string
): Promise<PromptGenerationResult> {
  const ai = getGenAI(apiKey);

  const model = 'gemini-2.5-flash';

  let characterConsistencyRules = '';
  if (uploadedCharacters && uploadedCharacters.length > 0) {
    characterConsistencyRules = `4. CRITICAL CHARACTER CONSISTENCY: The user has uploaded reference images and descriptions for specific characters. When a character's name appears or is implied in a sentence, you MUST include their precise physical description, facial features, and clothing in the generated prompt to maintain absolute consistency. Use the character's exact NAME in the prompt so it's unequivocally clear who is in the scene.`;
  } else {
    characterConsistencyRules = `4. CRITICAL: Whenever referring to the main character or protagonist in the scene, you MUST use the exact word "CHARACTER" (in all caps). Do not use names, pronouns (he/she/they), or generic terms like "man" or "woman". Example: "[${visualStyle}]. CHARACTER is sitting on the edge of a bed in a large, messy bedroom at 3 AM. Their head is in their hands..."`;
  }

  let sceneDetectionRule = settings?.enableSceneDetection 
    ? `\n- SCENE DETECTION: Group sentences intelligently into scenes. If consecutive sentences occur in the same location and time, maintain the EXACT same background and environmental details across their prompts to ensure continuity.`
    : ``;
    
  let emotionAnalysisRule = settings?.enableEmotionAnalysis 
    ? `\n- EMOTION & MOOD ANALYSIS: Analyze the mood of the sentence (e.g., sad, happy, scary, tense). Automatically adjust the lighting, color grading, and camera angles in the prompt to match this mood (e.g., low-key lighting for sad, bright warm sunlight for happy).`
    : ``;
    
  let targetAIRule = ``;
  if (settings?.targetAI && settings.targetAI !== 'Default') {
     if (settings.targetAI === 'Midjourney') {
       targetAIRule = `\n- TARGET PROCESSOR: Format the prompt specifically for Midjourney. Use concise, comma-separated evocative tags instead of full conversational sentences, and ALWAYS append trailing parameters like --ar 16:9 --v 6.0 at the end.`;
     } else if (settings.targetAI === 'DALL-E 3') {
       targetAIRule = `\n- TARGET PROCESSOR: Format the prompt specifically for DALL-E 3. Use highly descriptive, natural conversational English. Be explicit about every detail in a coherent paragraph.`;
     } else if (settings.targetAI === 'Stable Diffusion' || settings.targetAI === 'Flux') {
       targetAIRule = `\n- TARGET PROCESSOR: Format the prompt specifically for ${settings.targetAI}. Use a blend of natural language subject descriptions followed by comma-separated modifier tags (e.g., masterpiece, best quality, ultra-detailed).`;
     } else {
       targetAIRule = `\n- TARGET PROCESSOR: Format the prompt specifically for ${settings.targetAI}. Tailor the structure to match the standard best practices for ${settings.targetAI}.`;
     }
  }

  const systemInstruction = `You are an expert AI image prompt generator and storyboard artist. 
Your task is to analyze a script and generate highly detailed image generation prompts for EACH individual sentence.

CRITICAL RULES:
1. The user has explicitly chosen the following visual style: "${visualStyle}". You MUST start EVERY single generated prompt with this exact style description (e.g., "[${visualStyle}]").
2. Split the script STRICTLY into individual sentences. 
3. NEVER combine multiple sentences into one prompt. 1 Sentence = 1 Prompt.
${characterConsistencyRules}
5. Each prompt must be highly descriptive, including lighting, camera angle, mood, and environment, matching the requested visual style.${sceneDetectionRule}${emotionAnalysisRule}${targetAIRule}
6. Return the output strictly as a JSON object matching the requested schema.`;

  const promptText = `
Title: ${title}

Script:
${script}
`;

  const contents: any[] = [promptText];

  if (uploadedCharacters && uploadedCharacters.length > 0) {
    uploadedCharacters.forEach(c => {
      contents.push(`Character Name: ${c.name}\nDetails: ${c.details}`);
      if (c.imageBase64 && c.mimeType) {
        contents.push({
          inlineData: {
            data: c.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
            mimeType: c.mimeType
          }
        });
      }
    });
  }

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
        safetySettings: relaxedSafetySettings,
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
  } catch (error: any) {
    console.error("Error generating prompts:", error);
    throw new Error(formatError(error));
  }
}

export async function generateVideoPrompts(
  title: string,
  script: string,
  visualStyle: string,
  characterMode: 'none' | 'image' | 'text',
  characterData: string | undefined,
  mimeType: string | undefined,
  apiKey: string
): Promise<PromptGenerationResult> {
  const ai = getGenAI(apiKey);

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
        safetySettings: relaxedSafetySettings,
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
  } catch (error: any) {
    console.error("Error generating video prompts:", error);
    throw new Error(formatError(error));
  }
}

export async function estimateAmericanTalePrompts(
  title: string,
  script: string,
  era: string,
  apiKey: string
): Promise<number> {
  const ai = getGenAI(apiKey);
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
        safetySettings: relaxedSafetySettings,
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
  } catch (error: any) {
    console.error("Error estimating American Tale prompts:", error);
    throw new Error(formatError(error));
  }
}

export async function generateAmericanTalePrompts(
  title: string,
  script: string,
  era: string,
  count: number,
  apiKey: string
): Promise<PromptGenerationResult> {
  const ai = getGenAI(apiKey);

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
        safetySettings: relaxedSafetySettings,
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
  } catch (error: any) {
    console.error("Error generating American Tale prompts:", error);
    throw new Error(formatError(error));
  }
}

export interface ChannelStrategyResult {
  overview: string;
  nicheAnalysis: string;
  visualDirection: {
    mediaType: string;
    atmosphere: string;
    characterProtocols: string;
    environmentalFocus: string;
    eraAndSetting: string;
    cameraAndFraming: string;
  };
  suggestedStyles: {
    styleName: string;
    description: string;
    promptPrefix: string;
  }[];
  contentRoadmap: string;
}

export async function generateChannelStrategy(
  niche: string,
  researchData: string,
  titles: string,
  scripts: string,
  apiKey?: string
): Promise<ChannelStrategyResult> {
  try {
    const ai = getGenAI(apiKey);
    const prompt = `You are an expert YouTube Strategist and Channel Planner.
I will provide you with the following inputs:
- Niche/Context: ${niche}
- Channel Data/Research: ${researchData}
- Sample Titles: ${titles}
- Sample Scripts/Content: ${scripts}

Analyze provided details. Provide: 1. Target audience psychological profile (overview and niche analysis). 2. Visual direction (Stock/AI/Hybrid). 3. Asset recommendations for consistency: Atmosphere, Character Protocols, Environmental focus, Era/Setting, Camera Styles. 4. Suggested Styles: 2-3 styles with ready-to-use Prompt Prefixes. 5. Roadmap.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topP: 0.9,
        safetySettings: relaxedSafetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            nicheAnalysis: { type: Type.STRING },
            visualDirection: {
              type: Type.OBJECT,
              properties: {
                mediaType: { type: Type.STRING },
                atmosphere: { type: Type.STRING },
                characterProtocols: { type: Type.STRING },
                environmentalFocus: { type: Type.STRING },
                eraAndSetting: { type: Type.STRING },
                cameraAndFraming: { type: Type.STRING },
              },
              required: ["mediaType", "atmosphere", "characterProtocols", "environmentalFocus", "eraAndSetting", "cameraAndFraming"]
            },
            suggestedStyles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  styleName: { type: Type.STRING },
                  description: { type: Type.STRING },
                  promptPrefix: { type: Type.STRING }
                },
                required: ["styleName", "description", "promptPrefix"]
              }
            },
            contentRoadmap: { type: Type.STRING }
          },
          required: ["overview", "nicheAnalysis", "visualDirection", "suggestedStyles", "contentRoadmap"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No text returned from Gemini API.");
    }
    
    return JSON.parse(text) as ChannelStrategyResult;
  } catch (error: any) {
    console.error("Error generating Channel Strategy:", error);
    throw new Error(formatError(error));
  }
}

export async function generateDeepScenePrompts(
  strategy: ChannelStrategyResult,
  stylePrefix: string,
  title: string,
  script: string,
  targetCount: number,
  apiKey?: string
): Promise<PromptGenerationResult> {
  try {
    const ai = getGenAI(apiKey);
    
    const systemPrompt = `You are an expert AI Cinematographer.
Analyze the ENTIRE script. Imagine the cinematography. Create Exactly ${targetCount} distinct visual moments. 
DO NOT map to sentences literal-wise; synthesize the whole narrative. Ensure each prompt includes the provided Style Prefix from the strategy. 
Prompts must be extremely detailed (lighting, texture, lens).

Style Prefix to prepend to each prompt: "${stylePrefix}"

Strategy Visual Direction:
- Media Type: ${strategy.visualDirection.mediaType}
- Atmosphere: ${strategy.visualDirection.atmosphere}
- Camera/Framing: ${strategy.visualDirection.cameraAndFraming}
- Setting: ${strategy.visualDirection.eraAndSetting}

Video Title: ${title}
Script:
${script}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro",
      contents: [{ role: 'user', parts: [{ text: "Please generate the scene prompts for the script now focusing on specific lighting and angles." }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        topP: 0.9,
        safetySettings: relaxedSafetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sentence: { type: Type.STRING, description: "The Scene Title/Context" },
                  prompt: { type: Type.STRING, description: "The Full Detailed AI Prompt" }
                },
                required: ["sentence", "prompt"]
              }
            }
          },
          required: ["prompts"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No text returned from Gemini API.");
    }

    const result: PromptGenerationResult = JSON.parse(text);
    return result;
  } catch (error: any) {
    console.error("Error generating Deep Scene Prompts:", error);
    throw new Error(formatError(error)); // Keep signature
  }
}

