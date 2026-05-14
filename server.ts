import 'dotenv/config';
import express from "express";
import path from "path";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API endpoints
  app.post("/api/gemini", async (req, res) => {
    try {
      const { model: modelName, contents, systemInstruction, responseSchema, responseMimeType, apiKey, temperature } = req.body;
      
      const serverKey = process.env.GEMINI_API_KEY;
      const effectiveKey = apiKey || serverKey;

      if (!effectiveKey) {
        return res.status(401).json({ error: "No Gemini API key provided and no default server key found." });
      }

      const ai = new GoogleGenAI({ 
        apiKey: effectiveKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
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
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        }
      ];

      const response = await ai.models.generateContent({
        model: modelName || 'gemini-1.5-pro',
        contents,
        config: {
          systemInstruction,
          responseSchema,
          responseMimeType,
          temperature,
          safetySettings: relaxedSafetySettings,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error in Server:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
