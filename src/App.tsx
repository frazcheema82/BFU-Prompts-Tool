import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Copy, Check, Loader2, Sparkles, Download, Palette, Video, Image as ImageIcon, Trash2, User, BookOpen, Calculator, History as HistoryIcon, Clock, Plus, ArrowRight, Wand2, LogOut, KeyRound, ShieldAlert, Stethoscope, ScrollText, Menu, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { generatePrompts, generateVideoPrompts, estimateAmericanTalePrompts, generateAmericanTalePrompts, generateChannelStrategy, generateDeepScenePrompts, PromptGenerationResult, ChannelStrategyResult, extractCharacters, CharacterDetail, analyzeAndSuggestStyle, StyleRecommendation, enhanceScript, EnhancedScriptResult, ScriptStrategyResult, detectTargetAudience, analyzeScriptStrategy, generateScriptPart } from './services/geminiService';
import { useAuth } from './contexts/AuthContext';
import { collection, onSnapshot, addDoc, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from './services/firebaseService';
import { Link } from 'react-router-dom';

export interface HistoryItem {
  id: string;
  timestamp: number;
  type: 'image' | 'video' | 'american' | 'channel';
  title: string;
  style: string;
  count?: number;
  result: any;
}

export interface UploadCharacterData {
  id: string;
  name: string;
  details: string;
  imagePreview: string | null;
  imageFile: File | null;
}

export interface SavedChannel {
  id: string;
  name: string;
  strategy: ChannelStrategyResult;
  timestamp: number;
}

export default function App() {
  const { user, profile, logout, isAdmin, isAllowed, loading, loginWithGoogle } = useAuth();
  const [todayGenerations, setTodayGenerations] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [systemApiKey, setSystemApiKey] = useState<string | undefined>(undefined);

  const getWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
  const getCharCount = (text: string) => text.length;
  const MAX_WORDS = 4000;

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'generations'),
      where('userId', '==', user.uid)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      let count = 0;
      const loadedHistory: HistoryItem[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId === user.uid) {
          if (data.createdAt >= today.getTime() && data.status === 'success') {
            count++;
          }
          if (data.status === 'success' && !data.hidden && data.result) {
            loadedHistory.push({
              id: doc.id,
              timestamp: data.createdAt,
              type: data.type || 'image',
              title: data.title,
              style: data.style,
              result: data.result
            });
          }
        }
      });
      loadedHistory.sort((a,b) => b.timestamp - a.timestamp);
      setTodayGenerations(count);
      setHistory(loadedHistory);
    }, (err) => {
      console.error("Generations observer error:", err);
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Fetch central system key for all users
    const unsubKey = onSnapshot(doc(db, 'system_config', 'gemini'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemApiKey(snapshot.data().keyValue || undefined);
      }
    }, (error) => {
      console.error("Error fetching system key:", error);
    });
    return () => unsubKey();
  }, [user]);

  const saveToHistory = async (item: Omit<HistoryItem, 'id' | 'timestamp'> & { error?: string }) => {
    try {
      await addDoc(collection(db, 'generations'), {
        userId: user?.uid || 'unknown',
        userEmail: user?.email || 'unknown',
        title: item.title,
        style: item.style,
        type: item.type,
        targetAI: 'various',
        result: item.result || null,
        error: item.error || null,
        status: item.error ? 'failed' : 'success',
        apiKeyUsed: 'System Key',
        createdAt: Date.now(),
        hidden: false
      });
    } catch (err) {
      console.error("Failed to save generation to DB", err);
    }
  };

  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'american' | 'channel' | 'script' | 'history'>('image');

  // --- IMAGE PROMPTS STATE ---
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  
  const [mainStyle, setMainStyle] = useState('Cartoonic');
  const [subStyle, setSubStyle] = useState('2D hand-drawn vector illustration');
  const [customStyle, setCustomStyle] = useState('');
  const [appliedStyle, setAppliedStyle] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState('');
  const [generateProgress, setGenerateProgress] = useState(0);
  const generateAbortRef = useRef<boolean>(false);
  const [result, setResult] = useState<PromptGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSentenceIndex, setCopiedSentenceIndex] = useState<number | null>(null);
  const [copiedSentenceAll, setCopiedSentenceAll] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ADVANCED GENERATION SETTINGS ---
  const [enableSceneDetection, setEnableSceneDetection] = useState(false);
  const [enableEmotionAnalysis, setEnableEmotionAnalysis] = useState(false);
  const [targetAI, setTargetAI] = useState('Default');

  // --- VIRAL SCRIPT ARCHITECT STATE ---
  const [scriptNiche, setScriptNiche] = useState('');
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptLanguage, setScriptLanguage] = useState('');
  const [scriptCountry, setScriptCountry] = useState('');
  const [isSuggestingAudience, setIsSuggestingAudience] = useState(false);
  const [scriptStage, setScriptStage] = useState<'input' | 'analysis' | 'generation'>('input');
  const [scriptStrategy, setScriptStrategy] = useState<ScriptStrategyResult | null>(null);
  const [scriptPreferredWords, setScriptPreferredWords] = useState<number>(0);
  const [scriptParts, setScriptParts] = useState<string[]>([]);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [currentScriptPart, setCurrentScriptPart] = useState(0);

  // --- CHARACTER EXTRACTION & UPLOAD (IMAGE PROMPTS) ---
  const [extractedChars, setExtractedChars] = useState<CharacterDetail[] | null>(null);
  const [isExtractingChars, setIsExtractingChars] = useState(false);
  const [extractStatus, setExtractStatus] = useState('');
  const [extractProgress, setExtractProgress] = useState(0);
  const extractAbortRef = useRef<boolean>(false);
  const [charExtractError, setCharExtractError] = useState<string | null>(null);
  const [uploadedChars, setUploadedChars] = useState<UploadCharacterData[]>([]);

  // --- STYLE RECOMMENDATION ---
  const [styleRecommendation, setStyleRecommendation] = useState<StyleRecommendation | null>(null);
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [styleStatus, setStyleStatus] = useState('');
  const [styleProgress, setStyleProgress] = useState(0);
  const styleAbortRef = useRef<boolean>(false);
  const [styleAnalysisError, setStyleAnalysisError] = useState<string | null>(null);

  // --- AI DOCTOR (SCRIPT ENHANCER) ---
  const [isEnhancingScript, setIsEnhancingScript] = useState(false);
  const [enhanceStatus, setEnhanceStatus] = useState('');
  const [enhanceProgress, setEnhanceProgress] = useState(0);
  const enhanceAbortRef = useRef<boolean>(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [enhancedResult, setEnhancedResult] = useState<EnhancedScriptResult | null>(null);

  // --- HISTORY STATE ---
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // --- VIDEO PROMPTS STATE ---
  const [videoTitle, setVideoTitle] = useState('');
  const [videoScript, setVideoScript] = useState('');
  
  const [videoMainStyle, setVideoMainStyle] = useState('Realistic');
  const [videoSubStyle, setVideoSubStyle] = useState('Cinematic photography');
  const [videoCustomStyle, setVideoCustomStyle] = useState('');
  const [videoAppliedStyle, setVideoAppliedStyle] = useState('');
  
  const [characterMode, setCharacterMode] = useState<'none' | 'image' | 'text'>('none');
  const [characterImageFile, setCharacterImageFile] = useState<File | null>(null);
  const [characterImagePreview, setCharacterImagePreview] = useState<string | null>(null);
  const [characterText, setCharacterText] = useState('');
  
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [videoStatus, setVideoStatus] = useState('');
  const [videoProgress, setVideoProgress] = useState(0);
  const videoAbortRef = useRef<boolean>(false);
  const [videoResult, setVideoResult] = useState<PromptGenerationResult | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  
  const [videoCopiedIndex, setVideoCopiedIndex] = useState<number | null>(null);
  const [videoCopiedAll, setVideoCopiedAll] = useState(false);
  const [videoSentenceCopiedIndex, setVideoSentenceCopiedIndex] = useState<number | null>(null);
  const [videoSentenceCopiedAll, setVideoSentenceCopiedAll] = useState(false);
  
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const videoImageInputRef = useRef<HTMLInputElement>(null);

  // --- AMERICAN TALE PROMPTS STATE ---
  const [americanTitle, setAmericanTitle] = useState('');
  const [americanEra, setAmericanEra] = useState('1800');
  const [americanScript, setAmericanScript] = useState('');
  
  const [americanQuantityMode, setAmericanQuantityMode] = useState<'user' | 'ai'>('user');
  const [americanUserCount, setAmericanUserCount] = useState<number>(30);
  
  const [americanAiEstimate, setAmericanAiEstimate] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateStatus, setEstimateStatus] = useState('');
  const [estimateProgress, setEstimateProgress] = useState(0);
  const estimateAbortRef = useRef<boolean>(false);
  
  const [isAmericanGenerating, setIsAmericanGenerating] = useState(false);
  const [americanStatus, setAmericanStatus] = useState('');
  const [americanProgress, setAmericanProgress] = useState(0);
  const americanAbortRef = useRef<boolean>(false);
  const [americanResult, setAmericanResult] = useState<PromptGenerationResult | null>(null);
  const [americanError, setAmericanError] = useState<string | null>(null);
  
  const [americanCopiedIndex, setAmericanCopiedIndex] = useState<number | null>(null);
  const [americanCopiedAll, setAmericanCopiedAll] = useState(false);
  const [americanSentenceCopiedIndex, setAmericanSentenceCopiedIndex] = useState<number | null>(null);
  const [americanSentenceCopiedAll, setAmericanSentenceCopiedAll] = useState(false);
  const americanFileInputRef = useRef<HTMLInputElement>(null);

  // --- CHANNEL PLANNER STATE ---
  const [channelResearch, setChannelResearch] = useState('');
  const [channelNiche, setChannelNiche] = useState('');
  const [channelData, setChannelData] = useState('');
  const [channelTitles, setChannelTitles] = useState('');
  const [channelScripts, setChannelScripts] = useState('');
  const [isChannelGenerating, setIsChannelGenerating] = useState(false);
  const [channelResult, setChannelResult] = useState<ChannelStrategyResult | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const channelFileInputRef = useRef<HTMLInputElement>(null);
  const channelResultRef = useRef<HTMLElement>(null);
  const [isUploadingOnline, setIsUploadingOnline] = useState(false);
  
  const getEffectiveApiKey = () => {
    return systemApiKey;
  };

  const [savedChannels, setSavedChannels] = useState<SavedChannel[]>(() => {
    const saved = localStorage.getItem('saved_channels');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  
  // Follow Up Generator State
  const [deepVideoTitle, setDeepVideoTitle] = useState('');
  const [deepVideoScript, setDeepVideoScript] = useState('');
  const [deepTargetCount, setDeepTargetCount] = useState<number>(20);
  const [isDeepGenerating, setIsDeepGenerating] = useState(false);
  const [deepResult, setDeepResult] = useState<PromptGenerationResult | null>(null);
  const [deepError, setDeepError] = useState<string | null>(null);
  
  useEffect(() => {
    localStorage.setItem('saved_channels', JSON.stringify(savedChannels));
  }, [savedChannels]);


  const realisticStyles = [
    'Cinematic photography',
    'Cinematic photography, western American, 18th Century.',
    'Photorealistic 8k',
    'Documentary style',
    'Polaroid vintage photo',
    'Macro photography',
    'Custom'
  ];

  const cartoonicStyles = [
    '2D hand-drawn vector illustration',
    '3D Pixar/Disney style animation',
    'Japanese Anime style',
    'Vintage comic book',
    'Flat vector art',
    'Watercolor illustration',
    'Custom'
  ];

  useEffect(() => {
    if (mainStyle === 'Realistic') {
      setSubStyle(realisticStyles[0]);
    } else if (mainStyle === 'Cartoonic') {
      setSubStyle(cartoonicStyles[0]);
    }
  }, [mainStyle]);

  useEffect(() => {
    if (videoMainStyle === 'Realistic') {
      setVideoSubStyle(realisticStyles[0]);
    } else if (videoMainStyle === 'Cartoonic') {
      setVideoSubStyle(cartoonicStyles[0]);
    }
  }, [videoMainStyle]);

  // --- IMAGE HANDLERS ---
  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setScript(event.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  const handleExtractCharacters = async () => {
    if (!title.trim() || !script.trim()) {
      setCharExtractError('Please provide both a title and script first.');
      return;
    }
    const finalStyle = subStyle === 'Custom' ? customStyle : subStyle;
    if (!finalStyle.trim()) {
      setCharExtractError('Please select a visual style first.');
      return;
    }

    setIsExtractingChars(true);
    setExtractStatus('Preparing script...');
    setExtractProgress(10);
    setCharExtractError(null);
    extractAbortRef.current = false;

    try {
      const updateProgress = (step: string, progress: number) => {
        if (!extractAbortRef.current) {
          setExtractStatus(step);
          setExtractProgress(progress);
        }
      };

      updateProgress('Reading script details...', 20);
      await new Promise(r => setTimeout(r, 600));
      if (extractAbortRef.current) return;

      updateProgress('Analyzing characters and relationships...', 40);
      const effectiveKey = getEffectiveApiKey();
      
      const extractionPromise = extractCharacters(title, script, finalStyle, effectiveKey);
      
      // Simulate progress while waiting for API
      const interval = setInterval(() => {
        setExtractProgress(p => p < 90 ? p + 2 : p);
      }, 500);

      const result = await extractionPromise;
      clearInterval(interval);

      if (extractAbortRef.current) return;
      
      updateProgress('Formatting character sheets...', 95);
      await new Promise(r => setTimeout(r, 400));
      
      if (extractAbortRef.current) return;
      setExtractedChars(result);
      setExtractStatus('Done!');
      setExtractProgress(100);
    } catch (err) {
      if (!extractAbortRef.current) {
        setCharExtractError(err instanceof Error ? err.message : 'Unknown error during extraction.');
      }
    } finally {
      if (!extractAbortRef.current) {
        setIsExtractingChars(false);
      }
    }
  };

  const handleStopExtracting = () => {
    extractAbortRef.current = true;
    setIsExtractingChars(false);
    setExtractStatus('Stopped');
    setExtractProgress(0);
  };

  const handleAnalyzeStyle = async () => {
    if (!title.trim() || !script.trim()) {
      setStyleAnalysisError('Please provide both a title and script first.');
      return;
    }
    setIsAnalyzingStyle(true);
    setStyleStatus('Scanning script narrative...');
    setStyleProgress(15);
    setStyleAnalysisError(null);
    styleAbortRef.current = false;

    try {
      const updateProgress = (step: string, progress: number) => {
        if (!styleAbortRef.current) {
          setStyleStatus(step);
          setStyleProgress(progress);
        }
      };

      updateProgress('Identifying key themes...', 35);
      await new Promise(r => setTimeout(r, 600));
      if (styleAbortRef.current) return;

      updateProgress('Recommending visual aesthetics...', 60);
      const effectiveKey = getEffectiveApiKey();
      
      const analysisPromise = analyzeAndSuggestStyle(title, script, effectiveKey);
      
      const interval = setInterval(() => {
        setStyleProgress(p => p < 95 ? p + 5 : p);
      }, 400);

      const result = await analysisPromise;
      clearInterval(interval);

      if (styleAbortRef.current) return;
      
      setStyleRecommendation(result);
      setStyleStatus('Done!');
      setStyleProgress(100);
    } catch (err) {
      if (!styleAbortRef.current) {
        setStyleAnalysisError(err instanceof Error ? err.message : 'Unknown error during style analysis.');
      }
    } finally {
      if (!styleAbortRef.current) {
        setIsAnalyzingStyle(false);
      }
    }
  };

  const handleStopAnalyzingStyle = () => {
    styleAbortRef.current = true;
    setIsAnalyzingStyle(false);
    setStyleStatus('Stopped');
    setStyleProgress(0);
  };

  const handleEnhanceScript = async (target: 'image' | 'video' | 'american') => {
    let currentTitle = '';
    let currentScript = '';
    let setScriptFn: (s: string) => void = () => {};

    if (target === 'image') {
      currentTitle = title;
      currentScript = script;
      setScriptFn = setScript;
    } else if (target === 'video') {
      currentTitle = videoTitle;
      currentScript = videoScript;
      setScriptFn = setVideoScript;
    } else if (target === 'american') {
      currentTitle = americanTitle;
      currentScript = americanScript;
      setScriptFn = setAmericanScript;
    }

    if (!currentTitle.trim() || !currentScript.trim()) {
      setEnhanceError('Please provide both a title and script first.');
      return;
    }
    
    setIsEnhancingScript(true);
    setEnhanceStatus('Diagnosing script...');
    setEnhanceProgress(10);
    setEnhanceError(null);
    setEnhancedResult(null);
    enhanceAbortRef.current = false;

    try {
      const updateProgress = (step: string, progress: number) => {
        if (!enhanceAbortRef.current) {
          setEnhanceStatus(step);
          setEnhanceProgress(progress);
        }
      };

      updateProgress('Identifying YouTube niche & trends...', 25);
      await new Promise(r => setTimeout(r, 800));
      if (enhanceAbortRef.current) return;

      updateProgress('Applying virality framework...', 45);
      const effectiveKey = getEffectiveApiKey();
      
      const enhancementPromise = enhanceScript(currentTitle, currentScript, effectiveKey);
      
      const interval = setInterval(() => {
        setEnhanceProgress(p => p < 92 ? p + 2 : p);
      }, 700);

      const result = await enhancementPromise;
      clearInterval(interval);

      if (enhanceAbortRef.current) return;
      
      updateProgress('Refinement & Anti-Slop polishing...', 95);
      await new Promise(r => setTimeout(r, 600));
      
      if (enhanceAbortRef.current) return;
      
      setEnhancedResult(result);
      setScriptFn(result.enhancedScript); // Automatically replace the script
      setEnhanceStatus('Script Enhanced Successfully!');
      setEnhanceProgress(100);
      
      // Auto clear success status after 5 seconds
      setTimeout(() => {
        if (!enhanceAbortRef.current) {
          setEnhanceStatus('');
          setEnhanceProgress(0);
        }
      }, 5000);
      
    } catch (err) {
      if (!enhanceAbortRef.current) {
        setEnhanceError(err instanceof Error ? err.message : 'Unknown error during script enhancement.');
      }
    } finally {
      if (!enhanceAbortRef.current) {
        setIsEnhancingScript(false);
      }
    }
  };

  const handleStopEnhancing = () => {
    enhanceAbortRef.current = true;
    setIsEnhancingScript(false);
    setEnhanceStatus('Stopped');
    setEnhanceProgress(0);
  };

  const applySuggestedStyle = () => {
    if (styleRecommendation) {
      setMainStyle('Custom');
      setCustomStyle(styleRecommendation.combinedStylePrompt);
    }
  };

  const handleAddUploadedChar = () => {
    setUploadedChars(prev => [...prev, {
      id: Date.now().toString(),
      name: '',
      details: '',
      imagePreview: null,
      imageFile: null
    }]);
  };

  const handleRemoveUploadedChar = (id: string) => {
    setUploadedChars(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateUploadedChar = (id: string, field: keyof UploadCharacterData, value: any) => {
    setUploadedChars(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleCharImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleUpdateUploadedChar(id, 'imagePreview', event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
      handleUpdateUploadedChar(id, 'imageFile', file);
    }
  };

  const syncExtractedToUploads = (char: CharacterDetail) => {
    setUploadedChars(prev => [...prev, {
      id: Date.now().toString(),
      name: char.name,
      details: `Age: ${char.age}\nAppearance: ${char.appearance}\nDress: ${char.dress}`,
      imagePreview: null,
      imageFile: null
    }]);
  };

  const handleGenerate = async () => {
    if (!title.trim() || !script.trim()) {
      setError("Please provide both a title and a script.");
      return;
    }
    if (getWordCount(script) > MAX_WORDS) {
      setError(`Script is too long. Max allowed is ${MAX_WORDS} words.`);
      return;
    }

    const finalStyle = subStyle === 'Custom' ? customStyle : subStyle;
    if (!finalStyle.trim()) {
      setError("Please provide a custom style description.");
      return;
    }

    setIsGenerating(true);
    setGenerateStatus('Starting generation...');
    setGenerateProgress(5);
    setError(null);
    setResult(null);
    generateAbortRef.current = false;

    try {
      const updateProgress = (step: string, progress: number) => {
        if (!generateAbortRef.current) {
          setGenerateStatus(step);
          setGenerateProgress(progress);
        }
      };

      updateProgress('Processing character visuals...', 15);
      const uploadedCharsPayload = await Promise.all(uploadedChars.map(async (c) => {
         let base64 = '';
         let mimeType = '';
         if (c.imageFile) {
            base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(c.imageFile!);
            });
            mimeType = c.imageFile.type;
         }
         return {
           name: c.name,
           details: c.details,
           imageBase64: base64,
           mimeType: mimeType
         };
      }));

      if (generateAbortRef.current) return;
      updateProgress('Building scene storyboard...', 30);
      await new Promise(r => setTimeout(r, 1000));
      
      if (generateAbortRef.current) return;
      updateProgress('Calling Gemini AI...', 50);

      const effectiveKey = getEffectiveApiKey();
      const generationPromise = generatePrompts(
        title, 
        script, 
        finalStyle, 
        uploadedCharsPayload,
        { enableSceneDetection, enableEmotionAnalysis, targetAI },
        effectiveKey
      );

      const interval = setInterval(() => {
        setGenerateProgress(p => p < 95 ? p + 2 : p);
      }, 1000);

      const generatedResult = await generationPromise;
      clearInterval(interval);

      if (generateAbortRef.current) return;
      
      updateProgress('Completing final prompts...', 98);
      setResult(generatedResult);
      setAppliedStyle(finalStyle);
      saveToHistory({ type: 'image', title, style: finalStyle, result: generatedResult });
      setGenerateStatus('Done!');
      setGenerateProgress(100);
    } catch (err) {
      if (!generateAbortRef.current) {
        const errMsg = err instanceof Error ? err.message : "An unknown error occurred.";
        setError(errMsg);
        saveToHistory({ type: 'image', title, style: finalStyle || 'Unknown', result: { prompts: [] }, error: errMsg });
      }
    } finally {
      if (!generateAbortRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleStopGenerating = () => {
    generateAbortRef.current = true;
    setIsGenerating(false);
    setGenerateStatus('Stopped');
    setGenerateProgress(0);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    if (!result) return;
    const allPrompts = result.prompts.map(p => p.prompt).join('\n\n');
    navigator.clipboard.writeText(allPrompts);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadAll = () => {
    if (!result) return;
    const allPrompts = result.prompts.map(p => p.prompt).join('\n\n');
    const blob = new Blob([allPrompts], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'prompts'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- VIDEO HANDLERS ---
  const handleVideoTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) setVideoScript(event.target.result as string);
    };
    reader.readAsText(file);
  };

  const handleVideoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCharacterImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) setCharacterImagePreview(event.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeVideoImage = () => {
    setCharacterImageFile(null);
    setCharacterImagePreview(null);
    if (videoImageInputRef.current) videoImageInputRef.current.value = '';
  };

  const handleVideoGenerate = async () => {
    if (!videoTitle.trim() || !videoScript.trim()) {
      setVideoError("Please provide both a title and a script.");
      return;
    }
    if (getWordCount(videoScript) > MAX_WORDS) {
      setVideoError(`Script is too long. Max allowed is ${MAX_WORDS} words.`);
      return;
    }
    const finalStyle = videoSubStyle === 'Custom' ? videoCustomStyle : videoSubStyle;
    if (!finalStyle.trim()) {
      setVideoError("Please provide a custom style description.");
      return;
    }
    if (characterMode === 'text' && !characterText.trim()) {
      setVideoError("Please provide a character description.");
      return;
    }
    if (characterMode === 'image' && !characterImagePreview) {
      setVideoError("Please upload a character reference image.");
      return;
    }

    setIsVideoGenerating(true);
    setVideoStatus('Processing video narrative...');
    setVideoProgress(10);
    setVideoError(null);
    setVideoResult(null);
    videoAbortRef.current = false;

    try {
      const updateProgress = (step: string, progress: number) => {
        if (!videoAbortRef.current) {
          setVideoStatus(step);
          setVideoProgress(progress);
        }
      };

      let base64Image: string | undefined;
      let mimeType: string | undefined;
      if (characterMode === 'image' && characterImagePreview && characterImageFile) {
        updateProgress('Analyzing character features...', 25);
        base64Image = characterImagePreview;
        mimeType = characterImageFile.type;
      }
      
      if (videoAbortRef.current) return;
      updateProgress('Generating cinematic storyboard...', 40);

      const effectiveKey = getEffectiveApiKey();
      const generationPromise = generateVideoPrompts(
        videoTitle, 
        videoScript, 
        finalStyle, 
        characterMode, 
        characterMode === 'text' ? characterText : base64Image,
        mimeType,
        effectiveKey
      );

      const interval = setInterval(() => {
        setVideoProgress(p => p < 95 ? p + 2 : p);
      }, 1000);

      const generatedResult = await generationPromise;
      clearInterval(interval);

      if (videoAbortRef.current) return;
      
      updateProgress('Finalizing video sequence...', 98);
      setVideoResult(generatedResult);
      setVideoAppliedStyle(finalStyle);
      saveToHistory({ type: 'video', title: videoTitle, style: finalStyle, result: generatedResult });
      setVideoStatus('Done!');
      setVideoProgress(100);
    } catch (err) {
      if (!videoAbortRef.current) {
        const errMsg = err instanceof Error ? err.message : "An unknown error occurred.";
        setVideoError(errMsg);
        saveToHistory({ type: 'video', title: videoTitle, style: finalStyle || 'Unknown', result: { prompts: [] }, error: errMsg });
      }
    } finally {
      if (!videoAbortRef.current) {
        setIsVideoGenerating(false);
      }
    }
  };

  const handleStopVideoGenerate = () => {
    videoAbortRef.current = true;
    setIsVideoGenerating(false);
    setVideoStatus('Stopped');
    setVideoProgress(0);
  };

  const copyVideoToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setVideoCopiedIndex(index);
    setTimeout(() => setVideoCopiedIndex(null), 2000);
  };

  const handleVideoCopyAll = () => {
    if (!videoResult) return;
    const allPrompts = videoResult.prompts.map(p => p.prompt).join('\n\n');
    navigator.clipboard.writeText(allPrompts);
    setVideoCopiedAll(true);
    setTimeout(() => setVideoCopiedAll(false), 2000);
  };

  const handleVideoDownloadAll = () => {
    if (!videoResult) return;
    const allPrompts = videoResult.prompts.map(p => p.prompt).join('\n\n');
    const blob = new Blob([allPrompts], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'video_prompts'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- AMERICAN TALE HANDLERS ---
  const handleAmericanTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) setAmericanScript(event.target.result as string);
    };
    reader.readAsText(file);
  };

  const handleAmericanEstimate = async () => {
    if (!americanTitle.trim() || !americanScript.trim()) {
      setAmericanError("Please provide both a title and a script.");
      return;
    }
    if (getWordCount(americanScript) > MAX_WORDS) {
      setAmericanError(`Script is too long. Max allowed is ${MAX_WORDS} words.`);
      return;
    }
    const eraNum = parseInt(americanEra);
    if (isNaN(eraNum) || eraNum < 1600 || eraNum > 1945) {
      setAmericanError("Please enter a valid era between 1600 and 1945.");
      return;
    }

    setIsEstimating(true);
    setEstimateStatus('Scanning historical context...');
    setEstimateProgress(15);
    setAmericanError(null);
    setAmericanAiEstimate(null);
    estimateAbortRef.current = false;
    
    try {
      const updateProgress = (step: string, progress: number) => {
        if (!estimateAbortRef.current) {
          setEstimateStatus(step);
          setEstimateProgress(progress);
        }
      };

      updateProgress('Calculating key visual anchor points...', 45);
      const effectiveKey = getEffectiveApiKey();
      const countPromise = estimateAmericanTalePrompts(americanTitle, americanScript, americanEra, effectiveKey);
      
      const interval = setInterval(() => {
        setEstimateProgress(p => p < 90 ? p + 5 : p);
      }, 500);

      const count = await countPromise;
      clearInterval(interval);

      if (estimateAbortRef.current) return;

      setAmericanAiEstimate(count);
      setEstimateStatus('Done!');
      setEstimateProgress(100);
    } catch (err) {
      if (!estimateAbortRef.current) {
        const errMsg = err instanceof Error ? err.message : "Failed to estimate.";
        setAmericanError(errMsg);
        saveToHistory({ type: 'american', title: americanTitle, style: `Ultra-Realistic Historical (${americanEra})`, count: 0, result: { prompts: [] }, error: `Estimation Error: ${errMsg}` });
      }
    } finally {
      if (!estimateAbortRef.current) {
        setIsEstimating(false);
      }
    }
  };

  const handleStopEstimate = () => {
    estimateAbortRef.current = true;
    setIsEstimating(false);
    setEstimateStatus('Stopped');
    setEstimateProgress(0);
  };

  const handleAmericanGenerate = async (count: number) => {
    if (!americanTitle.trim() || !americanScript.trim()) {
      setAmericanError("Please provide both a title and a script.");
      return;
    }
    if (getWordCount(americanScript) > MAX_WORDS) {
      setAmericanError(`Script is too long. Max allowed is ${MAX_WORDS} words.`);
      return;
    }
    const eraNum = parseInt(americanEra);
    if (isNaN(eraNum) || eraNum < 1600 || eraNum > 1945) {
      setAmericanError("Please enter a valid era between 1600 and 1945.");
      return;
    }

    setIsAmericanGenerating(true);
    setAmericanStatus('Researching era authenticity...');
    setAmericanProgress(10);
    setAmericanError(null);
    setAmericanResult(null);
    americanAbortRef.current = false;

    try {
      const updateProgress = (step: string, progress: number) => {
        if (!americanAbortRef.current) {
          setAmericanStatus(step);
          setAmericanProgress(progress);
        }
      };

      updateProgress('Building realistic scene prompts...', 35);
      const effectiveKey = getEffectiveApiKey();
      const generationPromise = generateAmericanTalePrompts(americanTitle, americanScript, americanEra, count, effectiveKey);
      
      const interval = setInterval(() => {
        setAmericanProgress(p => p < 95 ? p + 2 : p);
      }, 1500);

      const generatedResult = await generationPromise;
      clearInterval(interval);

      if (americanAbortRef.current) return;

      updateProgress('Polishing historical storyboard...', 98);
      setAmericanResult(generatedResult);
      saveToHistory({ type: 'american', title: americanTitle, style: `Ultra-Realistic Historical (${americanEra})`, count, result: generatedResult });
      setAmericanStatus('Done!');
      setAmericanProgress(100);
    } catch (err) {
      if (!americanAbortRef.current) {
        const errMsg = err instanceof Error ? err.message : "An unknown error occurred.";
        setAmericanError(errMsg);
        saveToHistory({ type: 'american', title: americanTitle, style: `Ultra-Realistic Historical (${americanEra})`, count: count, result: { prompts: [] }, error: errMsg });
      }
    } finally {
      if (!americanAbortRef.current) {
        setIsAmericanGenerating(false);
      }
    }
  };

  const handleStopAmericanGenerate = () => {
    americanAbortRef.current = true;
    setIsAmericanGenerating(false);
    setAmericanStatus('Stopped');
    setAmericanProgress(0);
  };

  // --- VIRAL SCRIPT ARCHITECT LOGIC ---
  const handleDetectAudience = async () => {
    if (!scriptNiche || !scriptTitle) return;
    setIsSuggestingAudience(true);
    try {
      const effectiveKey = getEffectiveApiKey();
      const res = await detectTargetAudience(scriptNiche, scriptTitle, effectiveKey);
      setScriptLanguage(res.language || '');
      setScriptCountry(res.country || '');
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSuggestingAudience(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!scriptNiche || !scriptTitle || !scriptLanguage || !scriptCountry) return;
    setIsGeneratingScript(true);
    setScriptError(null);
    try {
      const effectiveKey = getEffectiveApiKey();
      const strategy = await analyzeScriptStrategy({
        niche: scriptNiche,
        title: scriptTitle,
        language: scriptLanguage,
        country: scriptCountry
      }, effectiveKey);
      setScriptStrategy(strategy);
      setScriptPreferredWords(strategy.recommendedWordCount || 0);
      setScriptStage('analysis');
    } catch (err: any) {
      setScriptError(err.message || 'Analysis failed');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGenerateNextPart = async () => {
    if (!scriptStrategy) return;
    setIsGeneratingScript(true);
    setScriptError(null);
    try {
      const effectiveKey = getEffectiveApiKey();
      const part = await generateScriptPart({
        strategy: scriptStrategy,
        partIndex: currentScriptPart,
        totalParts: scriptStrategy.outline.length,
        targetWords: scriptPreferredWords,
        previousContent: scriptParts.join('\n\n'),
        language: scriptLanguage
      }, effectiveKey);
      
      setScriptParts(prev => [...prev, part]);
      setCurrentScriptPart(prev => prev + 1);
      setScriptStage('generation');
    } catch (err: any) {
      setScriptError(err.message || 'Generation failed');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGenerateAllRemaining = async () => {
    if (!scriptStrategy) return;
    setIsGeneratingScript(true);
    setScriptError(null);
    try {
      const effectiveKey = getEffectiveApiKey();
      let currentParts = [...scriptParts];
      let currentIdx = currentScriptPart;
      
      while (currentIdx < scriptStrategy.outline.length) {
        const part = await generateScriptPart({
          strategy: scriptStrategy,
          partIndex: currentIdx,
          totalParts: scriptStrategy.outline.length,
          targetWords: scriptPreferredWords,
          previousContent: currentParts.join('\n\n'),
          language: scriptLanguage
        }, effectiveKey);
        
        currentParts.push(part);
        currentIdx++;
        setScriptParts([...currentParts]);
        setCurrentScriptPart(currentIdx);
      }
      setScriptStage('generation');
    } catch (err: any) {
      setScriptError(err.message || 'Complete generation failed');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const resetScriptModule = () => {
    setScriptStage('input');
    setScriptStrategy(null);
    setScriptParts([]);
    setCurrentScriptPart(0);
    setScriptError(null);
  };

  const sendToImageGenerator = () => {
    setScript(scriptParts.join('\n\n'));
    setTitle(scriptTitle);
    setActiveTab('image');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const sendToVideoGenerator = () => {
    setVideoScript(scriptParts.join('\n\n'));
    setVideoTitle(scriptTitle);
    setActiveTab('video');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- CHANNEL PLANNER HANDLERS ---
  const handleGenerateChannelPlan = async () => {
    setIsChannelGenerating(true);
    setChannelError(null);
    setChannelResult(null);

    try {
      const effectiveKey = getEffectiveApiKey();
      
      const generatedResult = await generateChannelStrategy(
        channelResearch,
        channelNiche,
        channelData,
        channelTitles,
        channelScripts,
        effectiveKey
      );
      
      const newChannel: SavedChannel = {
        id: Date.now().toString(),
        name: channelNiche,
        strategy: generatedResult,
        timestamp: Date.now(),
      };
      setSavedChannels(prev => [newChannel, ...prev]);
      setSelectedChannelId(newChannel.id);
      
      setChannelResult(generatedResult);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An unknown error occurred.";
      setChannelError(errMsg);
    } finally {
      setIsChannelGenerating(false);
    }
  };

  const handleUploadOnline = async () => {
    if (!channelResult || !channelNiche.trim()) return;
    setIsUploadingOnline(true);
    try {
      await saveToHistory({ 
        type: 'channel', 
        title: `Channel Plan: ${channelNiche.substring(0, 30)}...`, 
        style: 'Strategy', 
        count: channelResult?.suggestedStyles?.length || 0, 
        result: channelResult 
      });
      alert('Strategy successfully uploaded online to Firebase!');
    } catch (err) {
      alert('Error uploading strategy online: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsUploadingOnline(false);
    }
  };

  const handleGenerateDeepScenePrompts = async (stylePrefix: string) => {
    const selectedChannel = savedChannels.find(c => c.id === selectedChannelId);
    if (!selectedChannel) {
      setDeepError("Please select a valid Channel Strategy.");
      return;
    }

    setIsDeepGenerating(true);
    setDeepError(null);
    setDeepResult(null);

    try {
      const effectiveKey = getEffectiveApiKey();
      
      const generatedResult = await generateDeepScenePrompts(
        selectedChannel.strategy,
        stylePrefix,
        deepVideoTitle,
        deepVideoScript,
        deepTargetCount,
        effectiveKey
      );
      
      setDeepResult(generatedResult);
      saveToHistory({ 
        type: 'video', 
        title: `Deep Scene: ${deepVideoTitle}`, 
        style: `${selectedChannel.name} Style`, 
        count: generatedResult?.prompts?.length || 0, 
        result: generatedResult 
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An unknown error occurred.";
      setDeepError(errMsg);
      saveToHistory({ 
        type: 'video', 
        title: `Deep Scene: ${deepVideoTitle}`, 
        style: `${selectedChannel?.name || 'Unknown'} Style`, 
        count: 0, 
        result: { prompts: [] }, 
        error: errMsg 
      });
    } finally {
      setIsDeepGenerating(false);
    }
  };

  const copyAmericanToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setAmericanCopiedIndex(index);
    setTimeout(() => setAmericanCopiedIndex(null), 2000);
  };

  const handleAmericanCopyAll = () => {
    if (!americanResult) return;
    const allPrompts = americanResult.prompts.map(p => p.prompt).join('\n\n');
    navigator.clipboard.writeText(allPrompts);
    setAmericanCopiedAll(true);
    setTimeout(() => setAmericanCopiedAll(false), 2000);
  };

  const handleAmericanDownloadAll = () => {
    if (!americanResult) return;
    const allPrompts = americanResult.prompts.map(p => p.prompt).join('\n\n');
    const blob = new Blob([allPrompts], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${americanTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'american_tale_prompts'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copySentenceToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedSentenceIndex(index);
    setTimeout(() => setCopiedSentenceIndex(null), 2000);
  };
  const handleSentenceCopyAll = () => {
    if (!result) return;
    const allSentences = result.prompts.map(p => p.sentence).join('\n\n');
    navigator.clipboard.writeText(allSentences);
    setCopiedSentenceAll(true);
    setTimeout(() => setCopiedSentenceAll(false), 2000);
  };
  const handleSentenceDownloadAll = () => {
    if (!result) return;
    const allSentences = result.prompts.map(p => p.sentence).join('\n\n');
    const blob = new Blob([allSentences], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'image_sentences'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyVideoSentenceToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setVideoSentenceCopiedIndex(index);
    setTimeout(() => setVideoSentenceCopiedIndex(null), 2000);
  };
  const handleVideoSentenceCopyAll = () => {
    if (!videoResult) return;
    const allSentences = videoResult.prompts.map(p => p.sentence).join('\n\n');
    navigator.clipboard.writeText(allSentences);
    setVideoSentenceCopiedAll(true);
    setTimeout(() => setVideoSentenceCopiedAll(false), 2000);
  };
  const handleVideoSentenceDownloadAll = () => {
    if (!videoResult) return;
    const allSentences = videoResult.prompts.map(p => p.sentence).join('\n\n');
    const blob = new Blob([allSentences], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'video_sentences'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyAmericanSentenceToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setAmericanSentenceCopiedIndex(index);
    setTimeout(() => setAmericanSentenceCopiedIndex(null), 2000);
  };
  const handleAmericanSentenceCopyAll = () => {
    if (!americanResult) return;
    const allSentences = americanResult.prompts.map(p => p.sentence).join('\n\n');
    navigator.clipboard.writeText(allSentences);
    setAmericanSentenceCopiedAll(true);
    setTimeout(() => setAmericanSentenceCopiedAll(false), 2000);
  };
  const handleAmericanSentenceDownloadAll = () => {
    if (!americanResult) return;
    const allSentences = americanResult.prompts.map(p => p.sentence).join('\n\n');
    const blob = new Blob([allSentences], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${americanTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'american_sentences'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleHideGeneration = async (id: string) => {
    try {
      await updateDoc(doc(db, 'generations', id), { hidden: true });
    } catch (err) {
      console.error(err);
      alert('Error hiding generation');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm transform -rotate-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">BFU Prompts</h1>
          <p className="text-gray-500 mb-8 text-sm">Secure access for authorized personnel only.</p>

          <button
            onClick={loginWithGoogle}
            className="w-full relative group overflow-hidden rounded-xl bg-white border border-gray-300 shadow-sm hover:border-gray-400 hover:shadow-md transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center justify-center gap-3 px-6 py-3.5">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="font-semibold text-gray-700">Sign in with Google</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (isAllowed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">User Not Found</h1>
          <p className="text-gray-500 mb-6 text-sm">Your email <strong>{user?.email}</strong> is not registered.</p>
          
          <button
            onClick={async () => {
              try {
                await addDoc(collection(db, 'access_requests'), {
                  email: user?.email?.toLowerCase(),
                  createdAt: Date.now(),
                  status: 'pending'
                });
                alert('Access request sent to Admin!');
              } catch (e) {
                console.error(e);
                alert('Could not send right now or already requested!');
              }
            }}
            className="w-full mb-3 relative group overflow-hidden rounded-xl bg-indigo-600 shadow-sm hover:bg-indigo-700 transition duration-300"
          >
            <div className="relative flex items-center justify-center gap-3 px-6 py-3.5">
              <span className="font-semibold text-white">Request to Admin</span>
            </div>
          </button>

          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-900 text-sm font-medium underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F0F2F5] text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Glossy Sidebar Navigation */}
      <motion.nav 
        initial={false}
        animate={{ 
          x: typeof window !== 'undefined' && window.innerWidth < 1024 
            ? (isSidebarOpen ? 0 : -280) 
            : 0 
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed lg:relative w-[280px] lg:w-64 h-full bg-white/70 backdrop-blur-xl border-r border-white/40 flex flex-col z-[70] shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-200 transform hover:rotate-6 transition-transform cursor-pointer">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
            BFU AI
          </h1>
        </div>

        <div className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {[
            { id: 'image', icon: ImageIcon, label: 'Image Engine' },
            { id: 'video', icon: Video, label: 'Video Storyboard' },
            { id: 'american', icon: BookOpen, label: 'American Tales' },
            { id: 'script', icon: ScrollText, label: 'Viral Script' },
            { id: 'channel', icon: Video, label: 'Channel Planner' },
            { id: 'history', icon: HistoryIcon, label: 'Recent Cycles' },
          ].map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ x: 4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setActiveTab(item.id as any);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 relative group overflow-hidden ${
                activeTab === item.id 
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-100' 
                  : 'text-gray-500 hover:bg-gray-100/50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-indigo-600'}`} />
              <span>{item.label}</span>
              {activeTab === item.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white"
                />
              )}
            </motion.button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {/* Daily Goal Visualizer */}
          <div className="p-4 rounded-3xl bg-indigo-50/50 border border-indigo-100/50 backdrop-blur-sm">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Daily Pulse</span>
              <span className="text-xs font-bold text-indigo-600">{todayGenerations} cycles</span>
            </div>
            <div className="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((todayGenerations / 50) * 100, 100)}%` }}
                className="h-full bg-indigo-500 rounded-full"
              />
            </div>
          </div>

          {/* User Profile Glossy */}
          <div className="p-3 rounded-3xl bg-white/40 border border-white/60 backdrop-blur-md shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm" />
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center border-2 border-white shadow-sm">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.displayName?.split(' ')[0] || 'Explorer'}</p>
                <button onClick={logout} className="text-[10px] font-medium text-gray-500 hover:text-red-500 transition-colors uppercase tracking-tight">System Exit</button>
              </div>
              {isAdmin && (
                <Link to="/admin" className="p-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
                  <ShieldAlert className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Minimal Navigation */}
        <header className="h-16 px-4 lg:px-8 flex items-center justify-between border-b border-gray-200/50 bg-white/40 backdrop-blur-lg shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 lg:hidden text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="h-4 w-px bg-gray-300 hidden md:block" />
            <div className="flex items-center gap-2 px-3 py-1.5 ">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                Gemini 1.5 Pro Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="px-3 py-1.5 rounded-2xl bg-white border border-gray-200 shadow-sm text-[10px] font-bold text-gray-400 uppercase tracking-widest">
               v1.0.7
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
        
        {/* ================= IMAGE PROMPTS TAB ================= */}
        {activeTab === 'image' && (
          <>
            {/* Input Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">1. Story Details</h2>
                  <p className="text-sm text-gray-500 mt-1">Provide the title and the script you want to convert into image prompts.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                      Project Title
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., The Cyberpunk Detective"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="script" className="block text-sm font-medium text-gray-700">
                        Script / Story
                      </label>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <Upload className="w-4 h-4" />
                        Upload .txt file
                      </button>
                      <input
                        type="file"
                        accept=".txt"
                        ref={fileInputRef}
                        onChange={handleTextFileUpload}
                        className="hidden"
                      />
                    </div>
                    <textarea
                      id="script"
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      placeholder="Paste your script here. The AI will analyze it and generate one prompt per sentence..."
                      rows={8}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-y"
                    />
                    <div className="flex justify-end mt-1">
                      <span className={`text-xs font-medium ${getWordCount(script) > MAX_WORDS ? 'text-red-600' : 'text-gray-500'}`}>
                        Words: {getWordCount(script)} / {MAX_WORDS} | Characters: {getCharCount(script)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Character Extraction & Style Analysis Action */}
                <div className="pt-4 border-t border-gray-100 flex flex-col items-start gap-4">
                  <p className="text-sm text-gray-600 font-medium">Looking for character consistency or style suggestions? Let AI help you.</p>
                  
                  {charExtractError && (
                    <div className="w-full p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                      {charExtractError}
                    </div>
                  )}
                  {styleAnalysisError && (
                    <div className="w-full p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                      {styleAnalysisError}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 w-full">
                    <div className="flex flex-wrap gap-3">
                      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                        <button
                          onClick={handleExtractCharacters}
                          disabled={isExtractingChars || !title.trim() || !script.trim()}
                          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm relative group"
                        >
                          {isExtractingChars ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                          {isExtractingChars ? "Extracting..." : "Fetch Characters & Details"}
                        </button>
                        {isExtractingChars && (
                          <button 
                            onClick={handleStopExtracting}
                            className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase text-center mt-1"
                          >
                            Stop Extraction
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                        <button
                          onClick={handleAnalyzeStyle}
                          disabled={isAnalyzingStyle || !title.trim() || !script.trim()}
                          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm relative group"
                        >
                          {isAnalyzingStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                          {isAnalyzingStyle ? "Analyzing..." : "Analyze & Suggest Best Style"}
                        </button>
                        {isAnalyzingStyle && (
                          <button 
                            onClick={handleStopAnalyzingStyle}
                            className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase text-center mt-1"
                          >
                            Stop Analysis
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                        <button
                          onClick={() => handleEnhanceScript('image')}
                          disabled={isEnhancingScript || !title.trim() || !script.trim()}
                          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm relative group"
                        >
                          {isEnhancingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
                          {isEnhancingScript ? "Doctor at Work..." : "AI Doctor: Polish & Viral Fix"}
                        </button>
                        {isEnhancingScript && (
                          <button 
                            onClick={handleStopEnhancing}
                            className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase text-center mt-1"
                          >
                            Stop Doctor
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Overall Tool Progress for Mini Modules */}
                    {(isExtractingChars || isAnalyzingStyle || isEnhancingScript) && (
                      <div className="w-full space-y-2 py-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-bold text-indigo-600 animate-pulse">
                            {isExtractingChars ? extractStatus : isAnalyzingStyle ? styleStatus : enhanceStatus}
                          </span>
                          <span className="text-xs font-mono text-gray-500">
                            {isExtractingChars ? extractProgress : isAnalyzingStyle ? styleProgress : enhanceProgress}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-600 transition-all duration-500 ease-out" 
                            style={{ width: `${isExtractingChars ? extractProgress : isAnalyzingStyle ? styleProgress : enhanceProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {enhancedResult && !isEnhancingScript && (
                      <div className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2 animate-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <Sparkles className="w-4 h-4" />
                          <h4 className="text-sm font-bold">Script Diagnosis Complete</h4>
                        </div>
                        <p className="text-xs text-emerald-600 italic">Your script has been polished for YouTube virality. The original has been replaced.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-white p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block">Niche</span>
                            <span className="text-sm font-semibold text-gray-700">{enhancedResult.niche}</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block">Sub-Niche</span>
                            <span className="text-sm font-semibold text-gray-700">{enhancedResult.subNiche}</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block">Micro-Niche</span>
                            <span className="text-sm font-semibold text-gray-700">{enhancedResult.microNiche}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Style Recommendation Display */}
                  {styleRecommendation && (
                    <div className="w-full mt-4 bg-indigo-50/50 rounded-xl border border-indigo-100 p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
                       <h3 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                         <Sparkles className="w-4 h-4 text-indigo-600" /> AI Style Recommendation
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                         <div><span className="font-semibold text-gray-700">Media Type:</span> <span className="text-gray-900 font-medium">{styleRecommendation.mediaType}</span></div>
                         <div><span className="font-semibold text-gray-700">Visual Category:</span> <span className="text-gray-900 font-medium">{styleRecommendation.visualCategory}</span></div>
                         <div><span className="font-semibold text-gray-700">Specific Style:</span> <span className="text-gray-900 font-medium">{styleRecommendation.specificStyle}</span></div>
                         <div><span className="font-semibold text-gray-700">Camera Style:</span> <span className="text-gray-900 font-medium">{styleRecommendation.cameraStyle}</span></div>
                         <div><span className="font-semibold text-gray-700">Color Palette:</span> <span className="text-gray-900 font-medium">{styleRecommendation.colorPalette}</span></div>
                         <div><span className="font-semibold text-gray-700">Era/Setting:</span> <span className="text-gray-900 font-medium">{styleRecommendation.era}</span></div>
                       </div>
                       
                       <div className="mb-4">
                         <span className="font-semibold text-gray-700 text-sm block mb-1">Why this works:</span>
                         <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{styleRecommendation.reasoning}</p>
                       </div>

                       <div className="mb-4">
                         <span className="font-semibold text-gray-700 text-sm block mb-1">Full Style Prompt:</span>
                         <code className="block text-xs bg-gray-900 text-green-400 p-3 rounded font-mono">{styleRecommendation.combinedStylePrompt}</code>
                       </div>

                       <button 
                         onClick={applySuggestedStyle}
                         className="w-full flex justify-center items-center gap-1.5 px-4 py-2 mt-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                       >
                         <Check className="w-4 h-4" /> Apply This Formatted Style
                       </button>
                    </div>
                  )}
                  
                  {/* Extracted Characters Grid */}
                  {extractedChars && extractedChars.length > 0 && (
                    <div className="w-full pt-4 animate-in fade-in slide-in-from-top-2">
                       <h3 className="text-md font-bold text-gray-900 mb-3">Extracted Characters</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {(extractedChars || []).map((char, idx) => (
                           <div key={idx} className="bg-gray-50 rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-between">
                             <div>
                               <h4 className="font-bold text-gray-900 flex items-center justify-between">
                                 {char.name}
                                 <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{char.age}</span>
                               </h4>
                               <div className="flex flex-wrap gap-2 mt-2">
                                 <span className="inline-flex px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-md border border-blue-200">
                                   Role: {char.priority}
                                 </span>
                                 <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-md border border-green-200">
                                   Mentions: {char.mentionCount}
                                 </span>
                               </div>
                               <div className="text-sm text-gray-600 mt-3 space-y-1">
                                 <p><span className="font-semibold text-gray-800">Appearance:</span> {char.appearance}</p>
                                 <p><span className="font-semibold text-gray-800">Dress:</span> {char.dress}</p>
                               </div>
                               <div className="mt-4 pt-3 border-t border-gray-200">
                                 <p className="text-xs font-bold text-gray-500 mb-1 uppercase">Image Prompt</p>
                                 <p className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-200 max-h-32 overflow-y-auto">{char.imagePrompt}</p>
                               </div>
                             </div>
                             
                             <div className="flex flex-col gap-2 mt-4">
                               <div className="flex gap-2">
                                 <button 
                                   onClick={() => {
                                     navigator.clipboard.writeText(char.imagePrompt);
                                   }}
                                   className="flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
                                 >
                                   <Copy className="w-3.5 h-3.5" /> Copy Prompt
                                 </button>
                                 <button 
                                   onClick={() => syncExtractedToUploads(char)}
                                   className="flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm"
                                 >
                                   <ArrowRight className="w-3.5 h-3.5" /> Map Character
                                 </button>
                               </div>
                               <a 
                                 href={`https://image.pollinations.ai/prompt/${encodeURIComponent(char.imagePrompt)}?width=512&height=512&nologo=true`}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="w-full flex justify-center items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm text-center"
                               >
                                 <ImageIcon className="w-3.5 h-3.5" /> Generate Image (External Tool)
                               </a>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Style Selection Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-indigo-600" />
                    2. Visual Style
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Select the art style for your images. This will be applied to every prompt.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Main Category</label>
                    <select
                      value={mainStyle}
                      onChange={(e) => setMainStyle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    >
                      <option value="Cartoonic">Cartoonic</option>
                      <option value="Realistic">Realistic</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Specific Style</label>
                    <select
                      value={subStyle}
                      onChange={(e) => setSubStyle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    >
                      {(mainStyle === 'Realistic' ? realisticStyles : cartoonicStyles).map(style => (
                        <option key={style} value={style}>{style}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {subStyle === 'Custom' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enter Custom Style</label>
                    <input
                      type="text"
                      value={customStyle}
                      onChange={(e) => setCustomStyle(e.target.value)}
                      placeholder="e.g., 8-bit pixel art, cyberpunk synthwave..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Multiple Character Upload Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                 <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-indigo-600" />
                      3. Character Maps (Optional)
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Upload characters to maintain rigorous visual consistency across scenes.</p>
                  </div>
                  <button onClick={handleAddUploadedChar} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition-colors">
                    <Plus className="w-4 h-4" /> Add Character
                  </button>
                </div>

                {uploadedChars.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No characters mapped yet.</p>
                    <p className="text-xs text-gray-400">Click "Add Character" or map one from your extracted details.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {uploadedChars.map((char, idx) => (
                      <div key={char.id} className="relative p-5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col md:flex-row gap-5 hover:border-indigo-300 transition-colors group">
                        
                        <button 
                          onClick={() => handleRemoveUploadedChar(char.id)}
                          className="absolute -top-3 -right-3 bg-white border border-gray-200 text-red-500 p-1.5 rounded-full shadow-sm hover:bg-red-50 hover:text-red-600 transition-colors md:opacity-0 md:group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex-1 space-y-3">
                          <div>
                            <label className="block text-xs font-bold tracking-wider text-gray-600 uppercase mb-1">Character Name</label>
                            <input 
                              type="text" 
                              value={char.name || ''} 
                              onChange={(e) => handleUpdateUploadedChar(char.id, 'name', e.target.value)}
                              placeholder="e.g., Alice" 
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold tracking-wider text-gray-600 uppercase mb-1">Physical Description & Dress</label>
                            <textarea 
                              value={char.details || ''} 
                              onChange={(e) => handleUpdateUploadedChar(char.id, 'details', e.target.value)}
                              placeholder="Descibe their age, traits, and clothing..." 
                              rows={3}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm resize-y"
                            />
                          </div>
                        </div>

                        <div className="w-full md:w-48 flex-shrink-0">
                          <label className="block text-xs font-bold tracking-wider text-gray-600 uppercase mb-1">Reference Image</label>
                          <div className="h-32 w-full border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden relative group/img cursor-pointer hover:border-indigo-400 transition-colors flex items-center justify-center">
                            {char.imagePreview ? (
                              <img src={char.imagePreview} alt={char.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center text-gray-400 flex flex-col items-center">
                                <ImageIcon className="w-6 h-6 mb-1" />
                                <span className="text-xs font-medium px-2">Click to Upload</span>
                              </div>
                            )}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => handleCharImageUpload(char.id, e)}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Advanced Generation Settings Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    4. Advanced Generation Settings (Optional)
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Fine-tune how the AI groups and formats your generated prompts.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0 pt-0.5">
                        <input type="checkbox" checked={enableSceneDetection} onChange={(e) => setEnableSceneDetection(e.target.checked)} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">Scene Detection (Auto-Grouping)</div>
                        <div className="text-xs text-gray-500 mt-1">Automatically group sentences in the same location/time to maintain a 100% consistent background environment.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0 pt-0.5">
                        <input type="checkbox" checked={enableEmotionAnalysis} onChange={(e) => setEnableEmotionAnalysis(e.target.checked)} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">Emotion & Mood Analysis</div>
                        <div className="text-xs text-gray-500 mt-1">Detect sentence mood automatically adjust lighting and camera angles (e.g., low-key lighting for sad scenes).</div>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target AI For Prompts</label>
                    <select
                      value={targetAI}
                      onChange={(e) => setTargetAI(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    >
                      <option value="Default">Default (Generic)</option>
                      <option value="Midjourney">Midjourney</option>
                      <option value="DALL-E 3">DALL-E 3</option>
                      <option value="Stable Diffusion">Stable Diffusion</option>
                      <option value="Flux">Flux</option>
                      <option value="Nano Bnana">Nano Bnana</option>
                      <option value="Gemini">Gemini</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                       If selected, prompts will be specifically formatted for this AI generator (e.g., comma-separated tags and aspect ratios for Midjourney, natural English for DALL-E 3).
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Action Section */}
            <div className="flex flex-col items-center gap-4 w-full pt-12 md:pt-16">
              {error && (
                <div className="w-full p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}
              
              <div className="w-full max-w-xl space-y-4">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !title.trim() || !script.trim()}
                  className="w-full px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-lg relative overflow-hidden"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Storyboard...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Image Prompts
                    </>
                  )}
                </button>

                {isGenerating && (
                  <div className="space-y-3 p-4 bg-white border border-indigo-100 rounded-2xl shadow-sm animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
                        <span className="text-sm font-bold text-gray-800">{generateStatus}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-indigo-600">{generateProgress}%</span>
                    </div>
                    
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-700 ease-in-out" 
                        style={{ width: `${generateProgress}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-gray-400 font-medium italic">Processing large scripts may take up to 60 seconds...</p>
                      <button
                        onClick={handleStopGenerating}
                        className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors border border-red-100"
                      >
                        <Trash2 className="w-3 h-3" />
                        Stop Generation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Results Section */}
            {result && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Generated Prompts</h2>
                    <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                      <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">Style:</span>
                      <span className="text-sm font-medium text-indigo-900">{appliedStyle}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-4 sm:mt-0">
                    <div className="flex items-center gap-2 mr-2">
                      <button
                        onClick={handleSentenceCopyAll}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 shadow-sm transition-colors"
                      >
                        {copiedSentenceAll ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        {copiedSentenceAll ? "Copied All Sentences" : "Copy All Sentences"}
                      </button>
                      <button
                        onClick={handleSentenceDownloadAll}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 shadow-sm transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Download Sentences
                      </button>
                    </div>
                    <div className="hidden sm:block w-px h-6 bg-gray-300"></div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyAll}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-indigo-600 shadow-sm transition-colors"
                      >
                        {copiedAll ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="text-green-600">Copied All Prompts</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy All Prompts
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleDownloadAll}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-semibold text-indigo-700 hover:bg-indigo-100 shadow-sm transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download Prompts
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-8">
                  {(result?.prompts || []).map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl border border-gray-200 p-5 shadow-sm hover:border-indigo-300 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="text-sm font-semibold text-gray-700">Prompt Pair</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(item.prompt, index)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 shadow-sm transition-colors"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="text-green-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy Prompt
                            </>
                          )}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Sentence Box */}
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold tracking-wider text-gray-500 uppercase">Original Sentence</label>
                            <button
                              onClick={() => copySentenceToClipboard(item.sentence, index)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold transition-colors"
                            >
                              {copiedSentenceIndex === index ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              {copiedSentenceIndex === index ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <textarea 
                            readOnly
                            value={item.sentence}
                            className="w-full flex-1 min-h-[140px] p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 italic focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                          />
                        </div>
                        
                        {/* Prompt Box */}
                        <div className="flex flex-col">
                          <label className="text-xs font-bold tracking-wider text-indigo-600 uppercase mb-2">Generated Image Prompt</label>
                          <textarea 
                            defaultValue={item.prompt}
                            className="w-full flex-1 min-h-[140px] p-3 bg-white border border-indigo-200 rounded-lg text-sm text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y shadow-inner"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ================= VIDEO PROMPTS TAB ================= */}
        {activeTab === 'video' && (
          <>
            {/* Input Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">1. Video Story Details</h2>
                  <p className="text-sm text-gray-500 mt-1">Provide the title and the script you want to convert into video prompts.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="videoTitle" className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                    <input
                      type="text"
                      id="videoTitle"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="e.g., The Cyberpunk Detective"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="videoScript" className="block text-sm font-medium text-gray-700">Script / Story</label>
                      <button
                        onClick={() => videoFileInputRef.current?.click()}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <Upload className="w-4 h-4" />
                        Upload .txt file
                      </button>
                      <input type="file" accept=".txt" ref={videoFileInputRef} onChange={handleVideoTextFileUpload} className="hidden" />
                    </div>
                    <textarea
                      id="videoScript"
                      value={videoScript}
                      onChange={(e) => setVideoScript(e.target.value)}
                      placeholder="Paste your script here. The AI will analyze it and generate one video prompt per sentence..."
                      rows={8}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-y"
                    />
                    <div className="flex justify-end mt-1">
                      <span className={`text-xs font-medium ${getWordCount(videoScript) > MAX_WORDS ? 'text-red-600' : 'text-gray-500'}`}>
                        Words: {getWordCount(videoScript)} / {MAX_WORDS} | Characters: {getCharCount(videoScript)}
                      </span>
                    </div>
                  </div>

                  {/* AI DOCTOR Section (Video) */}
                  <div className="pt-4 border-t border-gray-100 flex flex-col items-start gap-4">
                    <p className="text-sm text-gray-600 font-medium">Looking for virality optimization? Let AI help you.</p>
                    
                    {enhanceError && activeTab === 'video' && (
                      <div className="w-full p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                        {enhanceError}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex flex-wrap gap-3">
                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                          <button
                            onClick={() => handleEnhanceScript('video')}
                            disabled={isEnhancingScript || !videoTitle.trim() || !videoScript.trim()}
                            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm relative group"
                          >
                            {isEnhancingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
                            {isEnhancingScript ? "Doctor at Work..." : "AI Doctor: Polish & Viral Fix"}
                          </button>
                          {isEnhancingScript && (
                            <button 
                              onClick={handleStopEnhancing}
                              className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase text-center mt-1"
                            >
                              Stop Doctor
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Overall Tool Progress for Mini Modules */}
                      {isEnhancingScript && activeTab === 'video' && (
                        <div className="w-full space-y-2 py-2 animate-in fade-in slide-in-from-top-1">
                          <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-indigo-600 animate-pulse">
                              {enhanceStatus}
                            </span>
                            <span className="text-xs font-mono text-gray-500">
                              {enhanceProgress}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 transition-all duration-500 ease-out" 
                              style={{ width: `${enhanceProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {enhancedResult && !isEnhancingScript && activeTab === 'video' && (
                        <div className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2 animate-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <Sparkles className="w-4 h-4" />
                            <h4 className="text-sm font-bold">Script Diagnosis Complete</h4>
                          </div>
                          <p className="text-xs text-emerald-600 italic">Your script has been polished for YouTube virality. The original has been replaced.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-white p-2 rounded-lg border border-emerald-100">
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Niche</span>
                              <span className="text-sm font-semibold text-gray-700">{enhancedResult.niche}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-emerald-100">
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Sub-Niche</span>
                              <span className="text-sm font-semibold text-gray-700">{enhancedResult.subNiche}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-emerald-100">
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Micro-Niche</span>
                              <span className="text-sm font-semibold text-gray-700">{enhancedResult.microNiche}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Video Style Selection Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-indigo-600" />
                    2. Visual Style
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Select the art style for your videos. This will be applied to every prompt.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Main Category</label>
                    <select value={videoMainStyle} onChange={(e) => setVideoMainStyle(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                      <option value="Cartoonic">Cartoonic</option>
                      <option value="Realistic">Realistic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Specific Style</label>
                    <select value={videoSubStyle} onChange={(e) => setVideoSubStyle(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                      {(videoMainStyle === 'Realistic' ? realisticStyles : cartoonicStyles).map(style => (
                        <option key={style} value={style}>{style}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {videoSubStyle === 'Custom' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enter Custom Style</label>
                    <input type="text" value={videoCustomStyle} onChange={(e) => setVideoCustomStyle(e.target.value)} placeholder="e.g., 8-bit pixel art, cyberpunk synthwave..." className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
                  </div>
                )}
              </div>
            </section>

            {/* Video Character Consistency Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-600" />
                    3. Character Consistency (Optional)
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Choose how you want to maintain character consistency across video prompts.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <label className={`flex-1 p-4 border rounded-xl cursor-pointer transition-colors ${characterMode === 'none' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="charMode" value="none" checked={characterMode === 'none'} onChange={() => setCharacterMode('none')} className="hidden" />
                    <div className="font-medium text-gray-900">No Reference</div>
                    <div className="text-xs text-gray-500 mt-1">AI will use the word "CHARACTER" for the protagonist.</div>
                  </label>
                  <label className={`flex-1 p-4 border rounded-xl cursor-pointer transition-colors ${characterMode === 'image' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="charMode" value="image" checked={characterMode === 'image'} onChange={() => setCharacterMode('image')} className="hidden" />
                    <div className="font-medium text-gray-900">Image Upload</div>
                    <div className="text-xs text-gray-500 mt-1">Upload an image for AI to analyze and describe.</div>
                  </label>
                  <label className={`flex-1 p-4 border rounded-xl cursor-pointer transition-colors ${characterMode === 'text' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="charMode" value="text" checked={characterMode === 'text'} onChange={() => setCharacterMode('text')} className="hidden" />
                    <div className="font-medium text-gray-900">Custom Text</div>
                    <div className="text-xs text-gray-500 mt-1">Write your own character description.</div>
                  </label>
                </div>

                {characterMode === 'image' && (
                  <div className="animate-in fade-in slide-in-from-top-2 flex items-start gap-6">
                    <div className="flex-1">
                      {!characterImagePreview ? (
                        <div onClick={() => videoImageInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 hover:border-indigo-400 transition-colors cursor-pointer group">
                          <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-medium text-gray-900">Click to upload character image</p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                        </div>
                      ) : (
                        <div className="relative inline-block">
                          <img src={characterImagePreview} alt="Character Reference" className="h-48 w-auto rounded-xl border border-gray-200 object-cover shadow-sm" />
                          <button onClick={removeVideoImage} className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-200 transition-colors shadow-sm" title="Remove image">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <input type="file" accept="image/*" ref={videoImageInputRef} onChange={handleVideoImageUpload} className="hidden" />
                    </div>
                  </div>
                )}

                {characterMode === 'text' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Character Description</label>
                    <textarea
                      value={characterText}
                      onChange={(e) => setCharacterText(e.target.value)}
                      placeholder="e.g., A tall man with short black hair, wearing a red jacket and blue jeans..."
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-y"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Video Action Section */}
            <div className="flex flex-col items-center gap-4 w-full pt-12 md:pt-16">
              {videoError && (
                <div className="w-full p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {videoError}
                </div>
              )}
              
              <div className="w-full max-w-xl space-y-4">
                <button
                  onClick={handleVideoGenerate}
                  disabled={isVideoGenerating || !videoTitle.trim() || !videoScript.trim()}
                  className="w-full px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-lg relative overflow-hidden"
                >
                  {isVideoGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Video Storyboard...
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5" />
                      Generate Video Prompts
                    </>
                  )}
                </button>

                {isVideoGenerating && (
                  <div className="space-y-3 p-4 bg-white border border-indigo-100 rounded-2xl shadow-sm animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
                        <span className="text-sm font-bold text-gray-800">{videoStatus}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-indigo-600">{videoProgress}%</span>
                    </div>
                    
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-700 ease-in-out" 
                        style={{ width: `${videoProgress}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-gray-400 font-medium italic">Processing large scripts may take up to 60 seconds...</p>
                      <button
                        onClick={handleStopVideoGenerate}
                        className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors border border-red-100"
                      >
                        <Trash2 className="w-3 h-3" />
                        Stop Generation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Video Results Section */}
            {videoResult && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Generated Video Prompts</h2>
                    <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                      <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">Style:</span>
                      <span className="text-sm font-medium text-indigo-900">{videoAppliedStyle}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-4 sm:mt-0">
                    <div className="flex items-center gap-2 mr-2">
                      <button
                        onClick={handleVideoSentenceCopyAll}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 shadow-sm transition-colors"
                      >
                        {videoSentenceCopiedAll ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        {videoSentenceCopiedAll ? "Copied All Sentences" : "Copy All Sentences"}
                      </button>
                      <button
                        onClick={handleVideoSentenceDownloadAll}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 shadow-sm transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Download Sentences
                      </button>
                    </div>
                    <div className="hidden sm:block w-px h-6 bg-gray-300"></div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleVideoCopyAll} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-indigo-600 shadow-sm transition-colors">
                        {videoCopiedAll ? <><Check className="w-4 h-4 text-green-600" /><span className="text-green-600">Copied All Prompts</span></> : <><Copy className="w-4 h-4" />Copy All Prompts</>}
                      </button>
                      <button onClick={handleVideoDownloadAll} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-semibold text-indigo-700 hover:bg-indigo-100 shadow-sm transition-colors">
                        <Download className="w-4 h-4" />Download Prompts
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-8">
                  {(videoResult?.prompts || []).map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl border border-gray-200 p-5 shadow-sm hover:border-indigo-300 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{index + 1}</span>
                          <span className="text-sm font-semibold text-gray-700">Video Prompt Pair</span>
                        </div>
                        <button onClick={() => copyVideoToClipboard(item.prompt, index)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 shadow-sm transition-colors">
                          {videoCopiedIndex === index ? <><Check className="w-4 h-4 text-green-600" /><span className="text-green-600">Copied</span></> : <><Copy className="w-4 h-4" />Copy Prompt</>}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold tracking-wider text-gray-500 uppercase">Original Sentence</label>
                            <button
                              onClick={() => copyVideoSentenceToClipboard(item.sentence, index)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold transition-colors"
                            >
                              {videoSentenceCopiedIndex === index ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              {videoSentenceCopiedIndex === index ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <textarea readOnly value={item.sentence} className="w-full flex-1 min-h-[140px] p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 italic focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-xs font-bold tracking-wider text-indigo-600 uppercase mb-2">Generated Video Prompt</label>
                          <textarea defaultValue={item.prompt} className="w-full flex-1 min-h-[140px] p-3 bg-white border border-indigo-200 rounded-lg text-sm text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y shadow-inner" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ================= AMERICAN TALE TAB ================= */}
        {activeTab === 'american' && (
          <>
            {/* Input Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">1. American Tale Details</h2>
                  <p className="text-sm text-gray-500 mt-1">Provide the title, historical era (1600-1945), and the script. The script can be long (5,000+ words).</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-3">
                      <label htmlFor="americanTitle" className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                      <input
                        type="text"
                        id="americanTitle"
                        value={americanTitle}
                        onChange={(e) => setAmericanTitle(e.target.value)}
                        placeholder="e.g., The Gold Rush Letters"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="americanEra" className="block text-sm font-medium text-gray-700 mb-1">Era (1600-1945)</label>
                      <input
                        type="number"
                        id="americanEra"
                        min="1600"
                        max="1945"
                        value={americanEra}
                        onChange={(e) => setAmericanEra(e.target.value)}
                        placeholder="e.g., 1850"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="americanScript" className="block text-sm font-medium text-gray-700">Script / Story</label>
                      <button
                        onClick={() => americanFileInputRef.current?.click()}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <Upload className="w-4 h-4" />
                        Upload .txt file
                      </button>
                      <input type="file" accept=".txt" ref={americanFileInputRef} onChange={handleAmericanTextFileUpload} className="hidden" />
                    </div>
                    <textarea
                      id="americanScript"
                      value={americanScript}
                      onChange={(e) => setAmericanScript(e.target.value)}
                      placeholder="Paste your long script here. The AI will extract key moments..."
                      rows={12}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-y"
                    />
                    <div className="flex justify-end mt-1">
                      <span className={`text-xs font-medium ${getWordCount(americanScript) > MAX_WORDS ? 'text-red-600' : 'text-gray-500'}`}>
                        Words: {getWordCount(americanScript)} / {MAX_WORDS} | Characters: {getCharCount(americanScript)}
                      </span>
                    </div>
                  </div>

                  {/* AI DOCTOR Section (American) */}
                  <div className="pt-4 border-t border-gray-100 flex flex-col items-start gap-4">
                    <p className="text-sm text-gray-600 font-medium">Looking for historical accuracy & virality? Let AI help you.</p>
                    
                    {enhanceError && activeTab === 'american' && (
                      <div className="w-full p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                        {enhanceError}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex flex-wrap gap-3">
                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                          <button
                            onClick={() => handleEnhanceScript('american')}
                            disabled={isEnhancingScript || !americanTitle.trim() || !americanScript.trim()}
                            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm relative group"
                          >
                            {isEnhancingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
                            {isEnhancingScript ? "Doctor at Work..." : "AI Doctor: Polish & Viral Fix"}
                          </button>
                          {isEnhancingScript && (
                            <button 
                              onClick={handleStopEnhancing}
                              className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase text-center mt-1"
                            >
                              Stop Doctor
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Overall Tool Progress for Mini Modules */}
                      {isEnhancingScript && activeTab === 'american' && (
                        <div className="w-full space-y-2 py-2 animate-in fade-in slide-in-from-top-1">
                          <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-indigo-600 animate-pulse">
                              {enhanceStatus}
                            </span>
                            <span className="text-xs font-mono text-gray-500">
                              {enhanceProgress}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 transition-all duration-500 ease-out" 
                              style={{ width: `${enhanceProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {enhancedResult && !isEnhancingScript && activeTab === 'american' && (
                        <div className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2 animate-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <Sparkles className="w-4 h-4" />
                            <h4 className="text-sm font-bold">Script Diagnosis Complete</h4>
                          </div>
                          <p className="text-xs text-emerald-600 italic">Your script has been polished for YouTube virality. The original has been replaced.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-white p-2 rounded-lg border border-emerald-100">
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Niche</span>
                              <span className="text-sm font-semibold text-gray-700">{enhancedResult.niche}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-emerald-100">
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Sub-Niche</span>
                              <span className="text-sm font-semibold text-gray-700">{enhancedResult.subNiche}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-emerald-100">
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Micro-Niche</span>
                              <span className="text-sm font-semibold text-gray-700">{enhancedResult.microNiche}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Visual Style Info Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-indigo-600" />
                    2. Visual Style: Ultra-Realistic Historical
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    The visual style is <strong>locked</strong> to high-quality realistic photography. 
                    The AI will generate prompts for modern heavy DSLR camera quality, 8k resolution, vivid colors, and lifelike textures, 
                    while accurately reflecting the characters and environment of the {americanEra} era. No black and white or dull images.
                  </p>
                </div>
              </div>
            </section>

            {/* Prompt Quantity Selection Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-indigo-600" />
                    3. Prompt Quantity
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Choose how many images you want to generate for this story.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <label className={`flex-1 p-4 border rounded-xl cursor-pointer transition-colors ${americanQuantityMode === 'user' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="qtyMode" value="user" checked={americanQuantityMode === 'user'} onChange={() => setAmericanQuantityMode('user')} className="hidden" />
                    <div className="font-medium text-gray-900">I will specify the number</div>
                    <div className="text-xs text-gray-500 mt-1">Generate an exact number of key scene prompts.</div>
                  </label>
                  <label className={`flex-1 p-4 border rounded-xl cursor-pointer transition-colors ${americanQuantityMode === 'ai' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="qtyMode" value="ai" checked={americanQuantityMode === 'ai'} onChange={() => { setAmericanQuantityMode('ai'); setAmericanAiEstimate(null); }} className="hidden" />
                    <div className="font-medium text-gray-900">Let AI decide</div>
                    <div className="text-xs text-gray-500 mt-1">AI will analyze the story and suggest the best number of prompts.</div>
                  </label>
                </div>

                {americanQuantityMode === 'user' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Prompts</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={americanUserCount}
                      onChange={(e) => setAmericanUserCount(parseInt(e.target.value) || 1)}
                      className="w-32 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  </div>
                )}

                {americanQuantityMode === 'ai' && (
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-top-2">
                    {americanAiEstimate === null ? (
                      <>
                        <Calculator className="w-10 h-10 text-indigo-300 mb-3" />
                        <h3 className="text-md font-semibold text-gray-800 mb-2">Estimate Required Prompts</h3>
                        <p className="text-sm text-gray-500 max-w-md mb-4">Click below to let the AI analyze your script and determine how many distinct visual scenes are needed.</p>
                        <button
                          onClick={handleAmericanEstimate}
                          disabled={isEstimating || !americanTitle.trim() || !americanScript.trim()}
                          className="px-6 py-2.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2"
                        >
                          {isEstimating ? <><Loader2 className="w-4 h-4 animate-spin" /> {estimateStatus} ({estimateProgress}%)</> : "Analyze Script & Estimate"}
                        </button>
                        {isEstimating && (
                           <button onClick={handleStopEstimate} className="text-xs text-red-500 font-bold uppercase mt-2">Stop Analysis</button>
                        )}
                        {americanError && <p className="text-sm text-red-600 mt-3">{americanError}</p>}
                      </>
                    ) : (
                      <>
                        <div className="bg-green-100 text-green-700 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-3 shadow-inner">
                          {americanAiEstimate}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">AI Suggests {americanAiEstimate} Prompts</h3>
                        <p className="text-sm text-gray-500 mb-6">Based on the provided ${americanEra} script, this is the optimal number of key scenes.</p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => { setAmericanAiEstimate(null); handleAmericanEstimate(); }}
                            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium shadow-sm transition-all"
                          >
                            Retry Estimate
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

              </div>
            </section>

            {/* American Tale Action Section */}
            <div className="flex flex-col items-center gap-4 w-full pt-12 md:pt-16">
              {americanError && (
                <div className="w-full p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {americanError}
                </div>
              )}
              
              <div className="w-full max-w-xl space-y-4">
                <button
                  onClick={() => handleAmericanGenerate(americanQuantityMode === 'user' ? americanUserCount : americanAiEstimate!)}
                  disabled={isAmericanGenerating || !americanTitle.trim() || !americanScript.trim() || (americanQuantityMode === 'ai' && americanAiEstimate === null)}
                  className="w-full px-8 py-4 bg-indigo-900 hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-lg relative overflow-hidden"
                >
                  {isAmericanGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Rendering Historical Storyboard...
                    </>
                  ) : (
                    <>
                      <ScrollText className="w-5 h-5" />
                      Generate American Tale Prompts
                    </>
                  )}
                </button>

                {isAmericanGenerating && (
                  <div className="space-y-3 p-4 bg-white border border-indigo-100 rounded-2xl shadow-sm animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-900 rounded-full animate-ping" />
                        <span className="text-sm font-bold text-gray-800">{americanStatus}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-indigo-900">{americanProgress}%</span>
                    </div>
                    
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                      <div 
                        className="h-full bg-indigo-900 transition-all duration-700 ease-in-out" 
                        style={{ width: `${americanProgress}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-gray-400 font-medium italic">Processing deep historical narratives may take up to 90 seconds...</p>
                      <button
                        onClick={handleStopAmericanGenerate}
                        className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors border border-red-100"
                      >
                        <Trash2 className="w-3 h-3" />
                        Stop Rendering
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* American Tale Results Section */}
            {americanResult && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">American Tale Prompts</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                        <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">Era:</span>
                        <span className="text-sm font-medium text-indigo-900">{americanEra}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                        <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">Count:</span>
                        <span className="text-sm font-medium text-indigo-900">{americanResult.prompts.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-4 sm:mt-0">
                    <div className="flex items-center gap-2 mr-2">
                      <button
                        onClick={handleAmericanSentenceCopyAll}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 shadow-sm transition-colors"
                      >
                        {americanSentenceCopiedAll ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        {americanSentenceCopiedAll ? "Copied All Sentences" : "Copy All Sentences"}
                      </button>
                      <button
                        onClick={handleAmericanSentenceDownloadAll}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 shadow-sm transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Download Sentences
                      </button>
                    </div>
                    <div className="hidden sm:block w-px h-6 bg-gray-300"></div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleAmericanCopyAll} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-indigo-600 shadow-sm transition-colors">
                        {americanCopiedAll ? <><Check className="w-4 h-4 text-green-600" /><span className="text-green-600">Copied All Prompts</span></> : <><Copy className="w-4 h-4" />Copy All Prompts</>}
                      </button>
                      <button onClick={handleAmericanDownloadAll} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-semibold text-indigo-700 hover:bg-indigo-100 shadow-sm transition-colors">
                        <Download className="w-4 h-4" />Download Prompts
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-8">
                  {(americanResult?.prompts || []).map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl border border-gray-200 p-5 shadow-sm hover:border-indigo-300 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{index + 1}</span>
                          <span className="text-sm font-semibold text-gray-700">Scene Excerpt & Prompt</span>
                        </div>
                        <button onClick={() => copyAmericanToClipboard(item.prompt, index)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 shadow-sm transition-colors">
                          {americanCopiedIndex === index ? <><Check className="w-4 h-4 text-green-600" /><span className="text-green-600">Copied</span></> : <><Copy className="w-4 h-4" />Copy Prompt</>}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold tracking-wider text-gray-500 uppercase">Original Script Excerpt</label>
                            <button
                              onClick={() => copyAmericanSentenceToClipboard(item.sentence, index)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold transition-colors"
                            >
                              {americanSentenceCopiedIndex === index ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              {americanSentenceCopiedIndex === index ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <textarea readOnly value={item.sentence} className="w-full flex-1 min-h-[160px] p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 italic focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-xs font-bold tracking-wider text-indigo-600 uppercase mb-2">Generated Visual Prompt</label>
                          <textarea defaultValue={item.prompt} className="w-full flex-1 min-h-[160px] p-3 bg-white border border-indigo-200 rounded-lg text-sm text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y shadow-inner" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ================= VIRAL SCRIPT ARCHITECT TAB ================= */}
        {activeTab === 'script' && (
          <>
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
               <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 <ScrollText className="w-6 h-6 text-indigo-600" />
                 Viral Script Architect
               </h2>
               <button 
                onClick={resetScriptModule}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-2 bg-white border border-gray-200 rounded-xl shadow-sm transition-colors"
               >
                 <Plus className="w-4 h-4" /> Reset Module
               </button>
            </div>

            {/* ERROR DISPLAY */}
            {scriptError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{scriptError}</p>
              </div>
            )}

            {/* STAGE 1: INPUT */}
            {scriptStage === 'input' && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 ring-4 ring-indigo-50/50">
                      <Wand2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Stage 1: Core Intelligence</h3>
                      <p className="text-sm text-gray-500 mt-1">Initialize the algorithmic foundation of your script.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Channel Niche</label>
                        <input 
                          type="text"
                          placeholder="e.g. Historical Mystery, Tech Documentaries..."
                          value={scriptNiche}
                          onChange={(e) => setScriptNiche(e.target.value)}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Proposed Video Title</label>
                        <input 
                          type="text"
                          placeholder="e.g. The Secret History of the Pyramids..."
                          value={scriptTitle}
                          onChange={(e) => setScriptTitle(e.target.value)}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                        />
                      </div>
                    </div>

                      <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-200/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-700 ml-1">Algorithm Target Audience</label>
                        <button 
                          onClick={handleDetectAudience}
                          disabled={isSuggestingAudience || !scriptNiche || !scriptTitle}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-100 rounded-xl shadow-sm transition-all"
                        >
                          {isSuggestingAudience ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          AI Decide Best Audience
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">Primary Language</span>
                          <input 
                            type="text"
                            placeholder="e.g. Urdu, English..."
                            value={scriptLanguage}
                            onChange={(e) => setScriptLanguage(e.target.value)}
                            className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">Target Region</span>
                          <input 
                            type="text"
                            placeholder="e.g. Pakistan, Global..."
                            value={scriptCountry}
                            onChange={(e) => setScriptCountry(e.target.value)}
                            className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleStartAnalysis}
                      disabled={isGeneratingScript || !scriptNiche || !scriptTitle || !scriptLanguage || !scriptCountry}
                      className="w-full py-5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:shadow-indigo-200 disabled:opacity-50 transition-all flex items-center justify-center gap-3 active:scale-[0.99]"
                    >
                      {isGeneratingScript ? (
                        <><Loader2 className="w-6 h-6 animate-spin" /> Analyzing Algorithmic Strategy...</>
                      ) : (
                        <><Zap className="w-6 h-6" /> Start Deep Analysis</>
                      ) }
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {/* STAGE 2: ANALYSIS */}
            {scriptStage === 'analysis' && scriptStrategy && (
              <motion.section 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Categorization */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden text-balance">
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                         <ShieldAlert className="w-24 h-24" />
                      </div>
                      <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 text-nowrap">
                        <Palette className="w-4 h-4" /> Ranking Identity
                      </h3>
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                           <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Niche</span>
                           <span className="font-bold text-gray-900">{scriptStrategy.niche}</span>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                           <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Sub-Niche</span>
                           <span className="font-bold text-gray-900">{scriptStrategy.subNiche}</span>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                           <span className="block text-[10px] text-indigo-400 font-bold uppercase mb-1 tracking-wider">Micro-Niche Target</span>
                           <span className="font-black text-indigo-700 italic">{scriptStrategy.microNiche}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-xl shadow-gray-200 border border-gray-800">
                      <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 text-nowrap">
                        <Clock className="w-4 h-4" /> Format Metrics
                      </h3>
                      <div className="space-y-6">
                         <div>
                            <label className="block text-sm font-bold text-gray-400 mb-2">Target Word Count</label>
                            <input 
                              type="number"
                              value={scriptPreferredWords}
                              onChange={(e) => setScriptPreferredWords(Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xl font-black text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                              {scriptStrategy.wordCountJustification}
                            </p>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Strategy */}
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                       <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 text-nowrap">
                        <Sparkles className="w-4 h-4" /> Algorithmic Strategy
                      </h3>
                      <div className="bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100 mb-8">
                         <h4 className="text-sm font-bold text-gray-900 mb-2">Anti-Slop Approach:</h4>
                         <p className="text-sm text-gray-700 leading-relaxed font-medium">{scriptStrategy.strategicApproach}</p>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-900 ml-1 italic">Ranking Triggers (Bypassing AI Quality Filters)</h4>
                        <div className="flex flex-wrap gap-2">
                          {(scriptStrategy?.rankingTriggers || []).map((trigger, i) => (
                            <span key={i} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-600">
                              {trigger}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                      <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-6">Execution Outline</h3>
                      <div className="space-y-4">
                        {(scriptStrategy?.outline || []).map((step, i) => (
                          <div key={i} className="flex gap-4 group">
                             <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center text-xs font-black text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                   {i + 1}
                                </div>
                                {i < scriptStrategy.outline.length - 1 && <div className="w-0.5 h-full bg-gray-100 mt-2" />}
                             </div>
                             <div className="pb-6">
                                <h5 className="text-sm font-bold text-gray-900 mb-1">{step.heading}</h5>
                                <p className="text-xs text-gray-500 font-medium italic">{step.focus}</p>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateNextPart}
                      disabled={isGeneratingScript}
                      className="w-full py-5 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                    >
                      {isGeneratingScript ? (
                        <><Loader2 className="w-6 h-6 animate-spin" /> Constructing Initial Foundations...</>
                      ) : (
                        <><Wand2 className="w-6 h-6" /> Confirm Blueprint & Start Generation</>
                      )}
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {/* STAGE 3: GENERATION */}
            {scriptStage === 'generation' && scriptStrategy && (
               <motion.section 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                {/* Generation Status Bar */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-3 h-3 bg-indigo-600 rounded-full animate-pulse shadow-[0_0_12px_rgba(79,70,229,0.5)]" />
                      <div>
                        <h4 className="text-sm font-black text-gray-900">
                          {currentScriptPart >= scriptStrategy.outline.length ? 'Viral Masterpiece Complete' : `Architecting Part ${currentScriptPart + 1} of ${scriptStrategy.outline.length}`}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-400 font-medium tracking-wide">
                            {currentScriptPart >= scriptStrategy.outline.length ? 'Final review and export phase' : `Focus: ${scriptStrategy.outline[currentScriptPart]?.heading}`}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded font-bold uppercase">Humanized Model</span>
                        </div>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={sendToImageGenerator}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                      >
                         <ImageIcon className="w-3.5 h-3.5" /> Send to Image Gen
                      </button>
                      <button 
                        onClick={sendToVideoGenerator}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                      >
                         <Video className="w-3.5 h-3.5" /> Send to Video Gen
                      </button>
                      <div className="w-px h-6 bg-gray-200 mx-1" />
                      <button 
                        onClick={() => {
                          const fullTxt = scriptParts.join('\n\n');
                          navigator.clipboard.writeText(fullTxt);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Copy All"
                      >
                         <Copy className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => {
                          const fullTxt = scriptParts.join('\n\n');
                          const blob = new Blob([fullTxt], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${scriptTitle.replace(/\s+/g, '_')}_Viral_Script.txt`;
                          a.click();
                        }}
                        className="p-2 text-gray-400 hover:text-emerald-600 transition-colors"
                        title="Download All"
                      >
                         <Download className="w-5 h-5" />
                      </button>
                   </div>
                </div>

                {/* Script Display */}
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                  <div className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar bg-gray-50/30">
                    <div className="max-w-3xl mx-auto space-y-12">
                       {scriptParts.map((part, i) => (
                         <motion.div 
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={i} 
                          className="prose prose-indigo max-w-none prose-p:text-gray-700 prose-p:leading-[1.8] prose-p:text-lg prose-headings:text-gray-900 prose-headings:font-black prose-p:mb-8"
                        >
                           <div className="markdown-body">
                             <Markdown>{part}</Markdown>
                           </div>
                         </motion.div>
                       ))}
                       {isGeneratingScript && (
                         <div className="flex flex-col items-center justify-center p-12 space-y-4 opacity-50">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                            <p className="text-sm font-bold text-gray-500 animate-pulse">Architecting next sequence...</p>
                         </div>
                       )}
                    </div>
                  </div>

                  <div className="p-6 bg-white border-t border-gray-100 flex items-center justify-center gap-4">
                    {currentScriptPart < scriptStrategy.outline.length ? (
                      <>
                        <button 
                          disabled={isGeneratingScript}
                          onClick={handleGenerateNextPart}
                          className="flex items-center gap-3 px-8 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-all shadow-xl shadow-gray-200"
                        >
                           {isGeneratingScript ? (
                             <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                           ) : (
                             <><ArrowRight className="w-5 h-5" /> Next Sequence</>
                           )}
                        </button>
                        <button 
                          disabled={isGeneratingScript}
                          onClick={handleGenerateAllRemaining}
                          className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-xl shadow-indigo-100"
                        >
                           {isGeneratingScript ? (
                             <><Loader2 className="w-5 h-5 animate-spin" /> Finalizing Script...</>
                           ) : (
                             <><Sparkles className="w-5 h-5" /> Generate All Remaining</>
                           )}
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-600 font-bold italic">
                        <Check className="w-5 h-5" /> Entire Outline Synthesized
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}
          </>
        )}

        {/* ================= CHANNEL PLANNER TAB ================= */}
        {activeTab === 'channel' && (
          <>
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
               <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 <Video className="w-6 h-6 text-indigo-600" />
                 Channel Master Planner
               </h2>
               <div className="w-64">
                 <select
                   className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                   value={selectedChannelId}
                   onChange={(e) => {
                     setSelectedChannelId(e.target.value);
                     const c = savedChannels.find(ch => ch.id === e.target.value);
                     if (c) setChannelResult(c.strategy);
                     else setChannelResult(null);
                   }}
                 >
                   <option value="" disabled>Saved Channels...</option>
                   {savedChannels.length === 0 && <option value="" disabled>No channels saved yet</option>}
                   {savedChannels.map(c => (
                     <option key={c.id} value={c.id}>{c.name}</option>
                   ))}
                 </select>
               </div>
            </div>

            {/* Stage 1: The Blueprint Form */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <HistoryIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Stage 1: Initialize Visual Strategy</h2>
                    <p className="text-sm text-gray-500 mt-1">Provide niche, channel data, titles, and scripts to construct a strategy.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Research</label>
                      <textarea
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors resize-y text-sm min-h-[120px]"
                        placeholder="Paste channel research, audience insights, etc..."
                        value={channelResearch}
                        onChange={(e) => setChannelResearch(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Niche Selection</label>
                      <textarea
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors resize-y text-sm min-h-[120px]"
                        placeholder="e.g., historical documentaries, tech reviews, true crime..."
                        value={channelNiche}
                        onChange={(e) => setChannelNiche(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Channel Data</label>
                       <textarea
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors resize-y text-sm min-h-[120px]"
                        placeholder="Describe target demographics, competitors, analytics goals..."
                        value={channelData}
                        onChange={(e) => setChannelData(e.target.value)}
                       />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">30 Titles</label>
                      <textarea
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors resize-y text-sm min-h-[120px]"
                        placeholder="Paste 30 titles for the channel..."
                        value={channelTitles}
                        onChange={(e) => setChannelTitles(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">1 Complete Script</label>
                      <button 
                        onClick={() => channelFileInputRef.current?.click()}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" /> Upload .txt
                      </button>
                      <input type="file" accept=".txt" className="hidden" ref={channelFileInputRef} onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => { if (event.target?.result) setChannelScripts(event.target.result as string); };
                          reader.readAsText(file);
                        }}
                      />
                    </div>
                    <textarea
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors resize-y text-sm bg-gray-50 min-h-[150px]"
                      placeholder="Paste in some sample scripts or rough outlines..."
                      value={channelScripts}
                      onChange={(e) => setChannelScripts(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                {channelError && (
                  <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{channelError}</p>
                  </div>
                )}
                
                <button
                  onClick={handleGenerateChannelPlan}
                  disabled={isChannelGenerating}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChannelGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing Strategy...</>
                  ) : (
                    <><Wand2 className="w-5 h-5" /> Generate Channel Plan</>
                  )}
                </button>
              </div>
            </section>

            {/* Stage 2: Results Section Hub */}
            {channelResult && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 animate-in fade-in" ref={channelResultRef}>
                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-indigo-500" />
                      Stage 2: Visual Identity Hub
                    </h2>
                    <button
                      onClick={handleUploadOnline}
                      disabled={isUploadingOnline}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {isUploadingOnline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload Online
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                        <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-2">Psychological Overview</h3>
                        <p className="text-gray-800 text-sm leading-relaxed">{channelResult.overview}</p>
                      </div>
                      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Niche Analysis</h3>
                        <p className="text-gray-800 text-sm leading-relaxed">{channelResult.nicheAnalysis}</p>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Content Roadmap</h3>
                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{channelResult.contentRoadmap}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg border border-gray-800">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Palette className="w-4 h-4" /> Channel DNA
                        </h3>
                        <ul className="space-y-4 text-sm">
                          <li>
                            <span className="block text-gray-500 text-xs uppercase mb-1">Media Type</span>
                            <span className="font-medium text-emerald-400">{channelResult.visualDirection.mediaType}</span>
                          </li>
                          <li>
                            <span className="block text-gray-500 text-xs uppercase mb-1">Atmosphere</span>
                            <span className="font-medium text-indigo-300">{channelResult.visualDirection.atmosphere}</span>
                          </li>
                          <li>
                            <span className="block text-gray-500 text-xs uppercase mb-1">Character Protocols</span>
                            <span className="font-medium">{channelResult.visualDirection.characterProtocols}</span>
                          </li>
                          <li>
                            <span className="block text-gray-500 text-xs uppercase mb-1">Environmental Focus</span>
                            <span className="font-medium text-amber-200">{channelResult.visualDirection.environmentalFocus}</span>
                          </li>
                          <li>
                            <span className="block text-gray-500 text-xs uppercase mb-1">Era / Setting</span>
                            <span className="font-medium">{channelResult.visualDirection.eraAndSetting}</span>
                          </li>
                          <li>
                            <span className="block text-gray-500 text-xs uppercase mb-1">Camera / Framing</span>
                            <span className="font-medium text-blue-300">{channelResult.visualDirection.cameraAndFraming}</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Suggested Visual Styles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {(channelResult?.suggestedStyles || []).map((style, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
                           <div>
                            <h4 className="font-bold text-gray-900 mb-2 leading-tight">{style.styleName}</h4>
                            <p className="text-sm text-gray-500 mb-4">{style.description}</p>
                           </div>
                           <div className="mt-4 pt-4 border-t border-gray-100">
                             <p className="text-xs font-mono text-gray-400 mb-2 truncate" title={style.promptPrefix}>{style.promptPrefix}</p>
                             <button
                               onClick={() => navigator.clipboard.writeText(style.promptPrefix)}
                               className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition"
                             >
                               <Copy className="w-4 h-4" /> Copy Prefix
                             </button>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Stage 3: Deep Scene Generation */}
            {selectedChannelId && (
              <section className="bg-gray-950 rounded-2xl shadow-xl border border-gray-800 overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center text-indigo-400">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Stage 3: Deep Scene Generation</h2>
                      <p className="text-sm text-gray-400 mt-1">Generate perfectly customized full-scale scene prompts for a specific video script.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-gray-900 p-6 rounded-xl border border-gray-800">
                    <div className="md:col-span-8">
                      <label className="block text-sm font-medium text-gray-300 mb-2">New Video Title</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="A title to help the AI frame the video context..."
                        value={deepVideoTitle}
                        onChange={(e) => setDeepVideoTitle(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-4">
                       <label className="block text-sm font-medium text-gray-300 mb-2">Target Frame Count</label>
                       <input
                        type="number"
                        className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                        value={deepTargetCount}
                        onChange={(e) => setDeepTargetCount(Number(e.target.value) || 20)}
                      />
                    </div>
                    <div className="md:col-span-12">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Full Video Script</label>
                      <textarea
                        className="w-full px-4 py-4 bg-gray-950 border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 min-h-[200px]"
                        placeholder="Paste the ENTIRE script for this specific video here..."
                        value={deepVideoScript}
                        onChange={(e) => setDeepVideoScript(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-8">
                    {deepError && (
                      <div className="mb-4 p-4 bg-red-900/30 border border-red-800 text-red-400 rounded-lg text-sm flex items-start gap-2">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p>{deepError}</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                       <div className="w-full sm:w-1/2">
                          <label className="block text-sm font-medium text-gray-400 mb-2">Select Style to Apply</label>
                          <select id="deepStyleSelector" className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-indigo-500">
                             {(channelResult?.suggestedStyles || []).map((s, i) => (
                               <option key={i} value={s.promptPrefix}>{s.styleName}</option>
                             ))}
                          </select>
                       </div>
                       <div className="w-full sm:w-1/2 pt-6">
                         <button
                            onClick={() => {
                              const select = document.getElementById('deepStyleSelector') as HTMLSelectElement;
                              handleGenerateDeepScenePrompts(select.value);
                            }}
                            disabled={isDeepGenerating || !deepVideoTitle.trim() || !deepVideoScript.trim()}
                            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                         >
                            {isDeepGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Synthesizing Scenes...</> : <><Sparkles className="w-5 h-5" /> Generate Active Production Prompts</>}
                         </button>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Deep Results */}
                {deepResult && (
                  <div className="border-t border-gray-800 bg-gray-950 p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white">Production Prompts</h3>
                      <button
                        onClick={() => {
                          const allExtracted = deepResult.prompts.map(p => p.prompt).join('\n\n');
                          const blob = new Blob([allExtracted], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Deep_Scene_${deepVideoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg flex items-center gap-2"
                      >
                         <Download className="w-4 h-4" /> Download All
                      </button>
                    </div>

                    <div className="space-y-4">
                      {deepResult.prompts.map((p, i) => (
                        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <h4 className="text-emerald-400 font-bold mb-1">Scene {i + 1}: {p.sentence}</h4>
                            <button
                               onClick={() => navigator.clipboard.writeText(p.prompt)}
                               className="text-gray-500 hover:text-white transition"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-gray-300 text-sm leading-relaxed font-mono bg-gray-950 p-4 rounded-lg border border-gray-800">{p.prompt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
        
        {/* ================= HISTORY TAB ================= */}
        {activeTab === 'history' && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <HistoryIcon className="w-6 h-6 text-indigo-600" />
                    Generation History
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Review your generated prompts. History is saved in the cloud.</p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-100">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Your history is empty.</p>
                  <p className="text-sm text-gray-400 mt-1">Generated prompts will appear here.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {history.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden hover:border-indigo-300 transition-colors bg-white">
                      <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{item.title}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                              {item.type === 'image' ? 'Image' : item.type === 'video' ? 'Video' : item.type === 'american' ? 'American Tale' : 'Channel Plan'}
                            </span>
                            <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-200">{item.style}</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500 font-bold ml-1">
                              {item.type === 'channel' ? (item.result?.videoIdeas?.length || 0) + ' Ideas' : (item.result?.prompts?.length || 0) + ' Prompts'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {item.type !== 'channel' && (
                            <button
                              onClick={() => {
                                const blob = new Blob([(item.result?.prompts || []).map((p: any) => p.prompt).join('\n\n')], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'history_prompts'}.txt`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 shadow-sm transition-colors cursor-pointer"
                            >
                              <Download className="w-4 h-4" /> Download
                            </button>
                          )}
                          <button
                            onClick={() => handleHideGeneration(item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 shadow-sm transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" /> Hide
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-white">
                        <details className="group">
                          <summary className="flex justify-between items-center font-medium cursor-pointer list-none text-sm text-indigo-600 hover:text-indigo-800">
                            <span>View details & prompts</span>
                            <span className="transition group-open:rotate-180">
                              <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                            </span>
                          </summary>
                          <div className="text-gray-600 mt-4 group-open:animate-fadeIn">
                            <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
                              {item.type === 'channel' ? (
                                <div className="space-y-4">
                                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                    <h4 className="font-bold text-indigo-900 mb-2">Content Strategy</h4>
                                    <p className="text-sm text-indigo-800 whitespace-pre-line">{item.result?.contentStrategy}</p>
                                  </div>
                                  <h4 className="font-bold text-gray-900 mt-4">Video Ideas</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {item.result?.videoIdeas?.map((idea: any, i: number) => (
                                      <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                         <p className="font-bold text-gray-800">{idea.title}</p>
                                         <p className="text-sm text-gray-600 mt-1">{idea.description}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                item.result?.prompts?.map((p: any, i: number) => (
                                 <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div>
                                     <p className="text-xs font-bold text-gray-500 uppercase mb-1">Sentence {i+1}</p>
                                     <p className="text-sm italic">{p.sentence}</p>
                                   </div>
                                   <div>
                                     <p className="text-xs font-bold text-indigo-600 uppercase mb-1">Prompt {i+1}</p>
                                     <p className="text-sm font-medium text-gray-900 leading-relaxed bg-white p-2 rounded border border-gray-200">{p.prompt}</p>
                                   </div>
                                 </div>
                               ))
                              )}
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  </div>
);
}
