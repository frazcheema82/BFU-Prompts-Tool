import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Copy, Check, Loader2, Sparkles, Download, Palette, Video, Image as ImageIcon, Trash2, User, BookOpen, Calculator, History as HistoryIcon, Clock, Plus, ArrowRight, Wand2, LogOut, KeyRound, ShieldAlert } from 'lucide-react';
import { generatePrompts, generateVideoPrompts, estimateAmericanTalePrompts, generateAmericanTalePrompts, PromptGenerationResult, extractCharacters, CharacterDetail, analyzeAndSuggestStyle, StyleRecommendation } from './services/geminiService';
import { useAuth } from './contexts/AuthContext';
import { collection, onSnapshot, addDoc, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from './services/firebaseService';
import { Link } from 'react-router-dom';

export interface HistoryItem {
  id: string;
  timestamp: number;
  type: 'image' | 'video' | 'american';
  title: string;
  style: string;
  count?: number;
  result: PromptGenerationResult;
}

export interface UploadCharacterData {
  id: string;
  name: string;
  details: string;
  imagePreview: string | null;
  imageFile: File | null;
}

export default function App() {
  const { user, profile, logout, isAdmin, isAllowed, loading, loginWithGoogle } = useAuth();
  const [availableKeys, setAvailableKeys] = useState<{id: string, name: string, keyValue: string, assignedTo?: string}[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [todayGenerations, setTodayGenerations] = useState<number>(0);

  const getWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
  const getCharCount = (text: string) => text.length;
  const MAX_WORDS = 3000;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'api_keys'), (snapshot) => {
      const keys = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAvailableKeys(keys);
      
      const allowedKeyIndex = keys.findIndex(k => k.assignedTo === user?.email || isAdmin);
      const initialKey = allowedKeyIndex >= 0 ? keys[allowedKeyIndex] : undefined;

      if (keys.length > 0 && !selectedApiKey) {
        setSelectedApiKey(initialKey?.keyValue || '');
      }
    }, (err) => {
      console.error("api_keys observer error in App:", err);
    });
    return () => unsub();
  }, [selectedApiKey, user]);



  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'american' | 'history'>('image');

  // --- IMAGE PROMPTS STATE ---
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  
  const [mainStyle, setMainStyle] = useState('Cartoonic');
  const [subStyle, setSubStyle] = useState('2D hand-drawn vector illustration');
  const [customStyle, setCustomStyle] = useState('');
  const [appliedStyle, setAppliedStyle] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
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

  // --- CHARACTER EXTRACTION & UPLOAD (IMAGE PROMPTS) ---
  const [extractedChars, setExtractedChars] = useState<CharacterDetail[] | null>(null);
  const [isExtractingChars, setIsExtractingChars] = useState(false);
  const [charExtractError, setCharExtractError] = useState<string | null>(null);
  const [uploadedChars, setUploadedChars] = useState<UploadCharacterData[]>([]);

  // --- STYLE RECOMMENDATION ---
  const [styleRecommendation, setStyleRecommendation] = useState<StyleRecommendation | null>(null);
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [styleAnalysisError, setStyleAnalysisError] = useState<string | null>(null);

  // --- HISTORY STATE ---
  const [history, setHistory] = useState<HistoryItem[]>([]);

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

  const saveToHistory = async (item: Omit<HistoryItem, 'id' | 'timestamp'> & { error?: string }) => {
    try {
      const keyName = availableKeys.find(k => k.keyValue === selectedApiKey)?.name || 'Default';
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
        apiKeyUsed: keyName,
        createdAt: Date.now(),
        hidden: false
      });
    } catch (err) {
      console.error("Failed to save generation to DB", err);
    }
  };

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
  
  const [isAmericanGenerating, setIsAmericanGenerating] = useState(false);
  const [americanResult, setAmericanResult] = useState<PromptGenerationResult | null>(null);
  const [americanError, setAmericanError] = useState<string | null>(null);
  
  const [americanCopiedIndex, setAmericanCopiedIndex] = useState<number | null>(null);
  const [americanCopiedAll, setAmericanCopiedAll] = useState(false);
  const [americanSentenceCopiedIndex, setAmericanSentenceCopiedIndex] = useState<number | null>(null);
  const [americanSentenceCopiedAll, setAmericanSentenceCopiedAll] = useState(false);
  const americanFileInputRef = useRef<HTMLInputElement>(null);

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
    setCharExtractError(null);
    try {
      const allowedKey = availableKeys.find(k => k.keyValue === selectedApiKey && (k.assignedTo === user?.email || isAdmin));
      if (!selectedApiKey || !allowedKey) throw new Error("Please select a valid assigned API Key first. Only an Admin can assign you an API Key.");
      const result = await extractCharacters(title, script, finalStyle, selectedApiKey);
      setExtractedChars(result);
    } catch (err) {
      setCharExtractError(err instanceof Error ? err.message : 'Unknown error during extraction.');
    } finally {
      setIsExtractingChars(false);
    }
  };

  const handleAnalyzeStyle = async () => {
    if (!title.trim() || !script.trim()) {
      setStyleAnalysisError('Please provide both a title and script first.');
      return;
    }
    setIsAnalyzingStyle(true);
    setStyleAnalysisError(null);
    try {
      const allowedKey = availableKeys.find(k => k.keyValue === selectedApiKey && (k.assignedTo === user?.email || isAdmin));
      if (!selectedApiKey || !allowedKey) throw new Error("Please select a valid assigned API Key first. Only an Admin can assign you an API Key.");
      const result = await analyzeAndSuggestStyle(title, script, selectedApiKey);
      setStyleRecommendation(result);
    } catch (err) {
      setStyleAnalysisError(err instanceof Error ? err.message : 'Unknown error during style analysis.');
    } finally {
      setIsAnalyzingStyle(false);
    }
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
    setError(null);
    setResult(null);

    try {
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

      const allowedKey = availableKeys.find(k => k.keyValue === selectedApiKey && (k.assignedTo === user?.email || isAdmin));
      if (!selectedApiKey || !allowedKey) throw new Error("Please select a valid assigned API Key first. Only an Admin can assign you an API Key.");
      const generatedResult = await generatePrompts(
        title, 
        script, 
        finalStyle, 
        uploadedCharsPayload,
        { enableSceneDetection, enableEmotionAnalysis, targetAI },
        selectedApiKey
      );
      setResult(generatedResult);
      setAppliedStyle(finalStyle);
      saveToHistory({ type: 'image', title, style: finalStyle, result: generatedResult });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errMsg);
      saveToHistory({ type: 'image', title, style: finalStyle || 'Unknown', result: { prompts: [] }, error: errMsg });
    } finally {
      setIsGenerating(false);
    }
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
    setVideoError(null);
    setVideoResult(null);

    try {
      let base64Image: string | undefined;
      let mimeType: string | undefined;
      if (characterMode === 'image' && characterImagePreview && characterImageFile) {
        base64Image = characterImagePreview;
        mimeType = characterImageFile.type;
      }
      
      const allowedKey = availableKeys.find(k => k.keyValue === selectedApiKey && (k.assignedTo === user?.email || isAdmin));
      if (!selectedApiKey || !allowedKey) throw new Error("Please select a valid assigned API Key first. Only an Admin can assign you an API Key.");
      const generatedResult = await generateVideoPrompts(
        videoTitle, 
        videoScript, 
        finalStyle, 
        characterMode, 
        characterMode === 'text' ? characterText : base64Image,
        mimeType,
        selectedApiKey
      );
      setVideoResult(generatedResult);
      setVideoAppliedStyle(finalStyle);
      saveToHistory({ type: 'video', title: videoTitle, style: finalStyle, result: generatedResult });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An unknown error occurred.";
      setVideoError(errMsg);
      saveToHistory({ type: 'video', title: videoTitle, style: finalStyle || 'Unknown', result: { prompts: [] }, error: errMsg });
    } finally {
      setIsVideoGenerating(false);
    }
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
    setAmericanError(null);
    setAmericanAiEstimate(null);
    
    try {
      const allowedKey = availableKeys.find(k => k.keyValue === selectedApiKey && (k.assignedTo === user?.email || isAdmin));
      if (!selectedApiKey || !allowedKey) throw new Error("Please select a valid assigned API Key first. Only an Admin can assign you an API Key.");
      const count = await estimateAmericanTalePrompts(americanTitle, americanScript, americanEra, selectedApiKey);
      setAmericanAiEstimate(count);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to estimate.";
      setAmericanError(errMsg);
      saveToHistory({ type: 'american', title: americanTitle, style: `Ultra-Realistic Historical (${americanEra})`, count: 0, result: { prompts: [] }, error: `Estimation Error: ${errMsg}` });
    } finally {
      setIsEstimating(false);
    }
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
    setAmericanError(null);
    setAmericanResult(null);

    try {
      const allowedKey = availableKeys.find(k => k.keyValue === selectedApiKey && (k.assignedTo === user?.email || isAdmin));
      if (!selectedApiKey || !allowedKey) throw new Error("Please select a valid assigned API Key first. Only an Admin can assign you an API Key.");
      const generatedResult = await generateAmericanTalePrompts(americanTitle, americanScript, americanEra, count, selectedApiKey);
      setAmericanResult(generatedResult);
      saveToHistory({ type: 'american', title: americanTitle, style: `Ultra-Realistic Historical (${americanEra})`, count, result: generatedResult });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An unknown error occurred.";
      setAmericanError(errMsg);
      saveToHistory({ type: 'american', title: americanTitle, style: `Ultra-Realistic Historical (${americanEra})`, count: count, result: { prompts: [] }, error: errMsg });
    } finally {
      setIsAmericanGenerating(false);
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
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 hidden lg:block">
              BFU Prompts
            </h1>
          </div>
          
          <div className="flex items-center bg-gray-100 p-1 rounded-lg overflow-x-auto gap-1">
            <button
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'image' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Image</span>
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'video' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">Video</span>
            </button>
            <button
              onClick={() => setActiveTab('american')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'american' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">American Tale</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <HistoryIcon className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-xs text-gray-500 font-medium tracking-wide uppercase">Generations Today</span>
              <span className="text-sm font-bold text-indigo-600">{todayGenerations}</span>
            </div>

            <div className="flex flex-col items-end gap-1 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-gray-500" />
                <select 
                  value={selectedApiKey}
                  onChange={(e) => setSelectedApiKey(e.target.value)}
                  className="bg-transparent text-sm text-gray-700 font-medium focus:outline-none focus:ring-0 appearance-none py-1 truncate max-w-[120px] cursor-pointer"
                >
                  {availableKeys.length === 0 ? (
                    <option value="">No Keys</option>
                  ) : (
                    availableKeys.map(k => {
                      const canUse = k.assignedTo === user?.email || isAdmin;
                      return (
                        <option key={k.id} value={k.keyValue} disabled={!canUse}>
                          {k.name} {!canUse ? '(Locked)' : ''}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
              {!availableKeys.some(k => k.assignedTo === user?.email || isAdmin) && (
                <button
                  onClick={async () => {
                    try {
                      await addDoc(collection(db, 'api_key_requests'), {
                        userId: user?.uid,
                        email: user?.email,
                        createdAt: Date.now(),
                        status: 'pending'
                      });
                      alert('Request submitted to admin!');
                    } catch (e) {
                      console.error(e);
                      alert('Failed to submit request.');
                    }
                  }}
                  className="text-[10px] text-indigo-600 hover:underline font-semibold"
                >
                  Request API Key
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200"
                  title="Admin Panel"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span className="hidden lg:inline">Admin</span>
                </Link>
              )}
              <div className="group relative">
                <button className="flex items-center gap-2 focus:outline-none">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
                      <User className="w-4 h-4 text-indigo-600" />
                    </div>
                  )}
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out / Switch
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
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

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleExtractCharacters}
                      disabled={isExtractingChars || !title.trim() || !script.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                      {isExtractingChars ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                      {isExtractingChars ? "Extracting Characters..." : "Fetch Characters & Details"}
                    </button>

                    <button
                      onClick={handleAnalyzeStyle}
                      disabled={isAnalyzingStyle || !title.trim() || !script.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                      {isAnalyzingStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      {isAnalyzingStyle ? "Analyzing Script..." : "Analyze & Suggest Best Style"}
                    </button>
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
                         {extractedChars.map((char, idx) => (
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
                              value={char.name} 
                              onChange={(e) => handleUpdateUploadedChar(char.id, 'name', e.target.value)}
                              placeholder="e.g., Alice" 
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold tracking-wider text-gray-600 uppercase mb-1">Physical Description & Dress</label>
                            <textarea 
                              value={char.details} 
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
            <div className="flex flex-col items-center gap-4">
              {error && (
                <div className="w-full p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}
              
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !title.trim() || !script.trim()}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing & Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Image Prompts
                  </>
                )}
              </button>
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
                  {result.prompts.map((item, index) => (
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
            <div className="flex flex-col items-center gap-4">
              {videoError && (
                <div className="w-full p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {videoError}
                </div>
              )}
              <button
                onClick={handleVideoGenerate}
                disabled={isVideoGenerating || !videoTitle.trim() || !videoScript.trim()}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-lg"
              >
                {isVideoGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing & Generating...
                  </>
                ) : (
                  <>
                    <Video className="w-5 h-5" />
                    Generate Video Prompts
                  </>
                )}
              </button>
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
                  {videoResult.prompts.map((item, index) => (
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
                          {isEstimating ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : "Analyze Script & Estimate"}
                        </button>
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
            <div className="flex flex-col items-center gap-4">
              {americanError && americanQuantityMode === 'user' && (
                <div className="w-full p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {americanError}
                </div>
              )}
              {americanError && americanQuantityMode === 'ai' && americanAiEstimate !== null && (
                <div className="w-full p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {americanError}
                </div>
              )}
              <button
                onClick={() => handleAmericanGenerate(americanQuantityMode === 'user' ? americanUserCount : americanAiEstimate!)}
                disabled={isAmericanGenerating || !americanTitle.trim() || !americanScript.trim() || (americanQuantityMode === 'ai' && americanAiEstimate === null)}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-lg"
              >
                {isAmericanGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating {americanQuantityMode === 'user' ? americanUserCount : americanAiEstimate} Prompts...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Prompts {americanQuantityMode === 'ai' && americanAiEstimate !== null ? `(${americanAiEstimate})` : ''}
                  </>
                )}
              </button>
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
                  {americanResult.prompts.map((item, index) => (
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
                              {item.type === 'image' ? 'Image' : item.type === 'video' ? 'Video' : 'American Tale'}
                            </span>
                            <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-200">{item.style}</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500 font-bold ml-1">
                              {item.result.prompts.length} Prompts
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            onClick={() => {
                              const blob = new Blob([item.result.prompts.map(p => p.prompt).join('\n\n')], { type: 'text/plain' });
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
                              {item.result.prompts.map((p, i) => (
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
                              ))}
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
      </main>
    </div>
  );
}
