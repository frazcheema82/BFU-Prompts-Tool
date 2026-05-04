import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Copy, Check, Loader2, Sparkles, Download, Palette, Video, Image as ImageIcon, Trash2, User, BookOpen, Calculator, History as HistoryIcon, Clock } from 'lucide-react';
import { generatePrompts, generateVideoPrompts, estimateAmericanTalePrompts, generateAmericanTalePrompts, PromptGenerationResult } from './services/geminiService';

export interface HistoryItem {
  id: string;
  timestamp: number;
  type: 'image' | 'video' | 'american';
  title: string;
  style: string;
  count?: number;
  result: PromptGenerationResult;
}

export default function App() {
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

  // --- HISTORY STATE ---
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('prompt_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('prompt_history', JSON.stringify(history));
  }, [history]);

  const saveToHistory = (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    setHistory(prev => [{ ...item, id: Date.now().toString(), timestamp: Date.now() }, ...prev]);
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

  const handleGenerate = async () => {
    if (!title.trim() || !script.trim()) {
      setError("Please provide both a title and a script.");
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
      const generatedResult = await generatePrompts(title, script, finalStyle);
      setResult(generatedResult);
      setAppliedStyle(finalStyle);
      saveToHistory({ type: 'image', title, style: finalStyle, result: generatedResult });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
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
      
      const generatedResult = await generateVideoPrompts(
        videoTitle, 
        videoScript, 
        finalStyle, 
        characterMode, 
        characterMode === 'text' ? characterText : base64Image,
        mimeType
      );
      setVideoResult(generatedResult);
      setVideoAppliedStyle(finalStyle);
      saveToHistory({ type: 'video', title: videoTitle, style: finalStyle, result: generatedResult });
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "An unknown error occurred.");
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
    const eraNum = parseInt(americanEra);
    if (isNaN(eraNum) || eraNum < 1600 || eraNum > 1945) {
      setAmericanError("Please enter a valid era between 1600 and 1945.");
      return;
    }

    setIsEstimating(true);
    setAmericanError(null);
    setAmericanAiEstimate(null);
    
    try {
      const count = await estimateAmericanTalePrompts(americanTitle, americanScript, americanEra);
      setAmericanAiEstimate(count);
    } catch (err) {
      setAmericanError(err instanceof Error ? err.message : "Failed to estimate.");
    } finally {
      setIsEstimating(false);
    }
  };

  const handleAmericanGenerate = async (count: number) => {
    if (!americanTitle.trim() || !americanScript.trim()) {
      setAmericanError("Please provide both a title and a script.");
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
      const generatedResult = await generateAmericanTalePrompts(americanTitle, americanScript, americanEra, count);
      setAmericanResult(generatedResult);
      saveToHistory({ type: 'american', title: americanTitle, style: `Ultra-Realistic Historical (${americanEra})`, count, result: generatedResult });
    } catch (err) {
      setAmericanError(err instanceof Error ? err.message : "An unknown error occurred.");
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 hidden sm:block">
              BFU Prompts Tool
            </h1>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
            <button
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'image' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Image Prompts</span>
              <span className="sm:hidden">Image</span>
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'video' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">Video Prompts</span>
              <span className="sm:hidden">Video</span>
            </button>
            <button
              onClick={() => setActiveTab('american')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'american' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">American Tale</span>
              <span className="sm:hidden">American</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <HistoryIcon className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
              <span className="sm:hidden">History</span>
            </button>
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
                  </div>
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
                  <p className="text-sm text-gray-500 mt-1">Review your previously generated prompts. History is saved locally in your browser.</p>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear your entire history?")) {
                        setHistory([]);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear History
                  </button>
                )}
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
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
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
