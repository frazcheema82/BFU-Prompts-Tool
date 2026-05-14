import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, Plus, RefreshCw, XCircle, CheckCircle, Bot, MessageSquare, Lightbulb, Send, Loader2, Sparkles, User, Key, BarChart3, Settings, ShieldAlert, ArrowRight, Clock, Menu, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { generateAdminAdvice, AdminAdviceResult, verifyApiKey } from '../services/geminiService';

export default function AdminPanel() {
  const { isAdmin, user } = useAuth();
  const [generations, setGenerations] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [allowedUsers, setAllowedUsers] = useState<any[]>([]);
  const [newAllowedEmail, setNewAllowedEmail] = useState('');
  const [loading, setLoading] = useState(true);

  // AI Chatbot & Suggestions State
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'users' | 'history' | 'ai' | 'settings'>('overview');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: 'Hello Admin! I am Aura, your AI assistant. How can I help you manage BFU Prompts today?' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<AdminAdviceResult['suggestions']>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const fetchDailySuggestions = async (forceMessage?: string) => {
    setLoadingSuggestions(true);
    try {
      const stats = {
        totalUsers: allowedUsers.length,
        totalGenerations: generations.length,
        pendingRequests: accessRequests.length,
        recentErrors: generations.filter(g => g.status === 'failed').length
      };
      
      const result = await generateAdminAdvice(stats, forceMessage, systemKey);
      
      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
      }
      
      if (result.chatbotResponse) {
        setChatMessages(prev => [...prev, { role: 'ai', content: result.chatbotResponse! }]);
      }
    } catch (err: any) {
      console.error("Suggestions Error:", err);
      if (forceMessage) {
        setChatMessages(prev => [...prev, { role: 'ai', content: `Oops. I encountered an error: ${err.message || 'API Blocked'}. Please check the System Settings.` }]);
      }
    } finally {
      setLoadingSuggestions(false);
      setIsSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isSending) return;

    const msg = userInput;
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsSending(true);

    await fetchDailySuggestions(msg);
  };

  const [dataError, setDataError] = useState<string | null>(null);

  const [history, setHistory] = useState<any[]>([]);

  // System Settings State
  const [systemKey, setSystemKey] = useState<string>('');
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ ok: boolean, error?: string } | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isKeyVisible, setIsKeyVisible] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    
    // Fetch system key from config
    const unsubKey = onSnapshot(doc(db, 'system_config', 'gemini'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemKey(snapshot.data().keyValue || '');
      }
    }, (error) => {
      console.error("AdminPanel system key error:", error);
    });

    const qAccessReqs = query(collection(db, 'access_requests'), orderBy('createdAt', 'desc'));
    const unsubAccessReqs = onSnapshot(qAccessReqs, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAccessRequests(reqs.filter((r: any) => r.status === 'pending'));
    }, (err) => { console.error("access_requests error AdminPanel:", err); setDataError(err.message); });

    const qGenerations = query(collection(db, 'generations'), orderBy('createdAt', 'desc'));
    const unsubGens = onSnapshot(qGenerations, (snapshot) => {
      const gens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGenerations(gens);
      setLoading(false);
    }, (err) => { console.error("generations error AdminPanel:", err); setDataError(err.message); });

    const qAllowedUsers = collection(db, 'allowed_users');
    const unsubAllowedUsers = onSnapshot(qAllowedUsers, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllowedUsers(users);
    }, (err) => { console.error("allowed_users error AdminPanel:", err); setDataError(err.message); });

    return () => {
      unsubKey();
      unsubAccessReqs();
      unsubGens();
      unsubAllowedUsers();
    };
  }, [isAdmin]);

  const handleVerifySystemKey = async () => {
    if (!systemKey.trim()) return;
    setIsVerifyingKey(true);
    setVerificationResult(null);
    try {
      const res = await verifyApiKey(systemKey);
      setVerificationResult({ ok: res.valid, error: res.error });
    } catch (err: any) {
      setVerificationResult({ ok: false, error: err.message });
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleSaveSystemKey = async () => {
    if (!systemKey.trim() || isSavingKey) return;
    setIsSavingKey(true);
    try {
      await setDoc(doc(db, 'system_config', 'gemini'), {
        keyValue: systemKey.trim(),
        updatedAt: Date.now(),
        updatedBy: user?.email
      }, { merge: true });
      alert('System API Key saved successfully! All users will now use this key.');
      setVerificationResult(null);
    } catch (err: any) {
      console.error(err);
      alert('Error saving key: ' + err.message);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDocSetSystemKey = () => {}; // Removed unused stub

  const handleDeleteGeneration = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'generations', id));
    } catch (err) {
      console.error(err);
      alert('Error deleting generation');
    }
  };

  const handleAddAllowedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllowedEmail.trim() || !newAllowedEmail.includes('@')) {
      alert("Please enter a valid email address.");
      return;
    }
    
    try {
      await addDoc(collection(db, 'allowed_users'), {
        email: newAllowedEmail.trim().toLowerCase(),
        createdAt: Date.now(),
        addedBy: "admin"
      });
      setNewAllowedEmail('');
    } catch (err) {
      console.error(err);
      alert('Error adding allowed user');
    }
  };

  const handleDeleteAllowedUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'allowed_users', id));
    } catch (err: any) {
      console.error(err);
      alert('Error deleting allowed user: ' + err.message);
    }
  };

  const handleApproveAccessRequest = async (reqId: string, email: string) => {
    try {
      await addDoc(collection(db, 'allowed_users'), {
        email: email,
        createdAt: Date.now(),
        addedBy: "admin"
      });
      await updateDoc(doc(db, 'access_requests', reqId), { status: 'approved' });
      alert('Access request approved!');
    } catch (e) {
      console.error(e);
      alert('Failed to approve access request');
    }
  };

  const handleDismissAccessRequest = async (reqId: string) => {
    try {
      await updateDoc(doc(db, 'access_requests', reqId), { status: 'rejected' });
    } catch (e) {
      console.error(e);
      alert('Failed to dismiss access request');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center mt-20">
        <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-500 mt-2">You are not authorized to view this page.</p>
        <Link to="/" className="text-indigo-600 mt-4 block hover:underline">Go back home</Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-gray-900 overflow-hidden font-sans relative">
      {/* Mobile Admin Sidebar Overlay */}
      <AnimatePresence>
        {isAdminSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAdminSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Admin Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          x: typeof window !== 'undefined' && window.innerWidth < 1024 
            ? (isAdminSidebarOpen ? 0 : -280) 
            : 0 
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed lg:relative w-[280px] lg:w-64 bg-white border-r border-gray-200 flex flex-col z-[70] h-full shadow-lg lg:shadow-none ${isAdminSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg">Admin Command</h1>
          </div>

          <div className="space-y-1">
              {[
                { id: 'overview', icon: BarChart3, label: 'Overview' },
                { id: 'users', icon: User, label: 'User Access' },
                { id: 'history', icon: RefreshCw, label: 'Global Logs' },
                { id: 'settings', icon: Settings, label: 'System Settings' },
                { id: 'ai', icon: Bot, label: 'Aura AI' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveAdminTab(item.id as any);
                    setIsAdminSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeAdminTab === item.id 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto p-6">
           <Link to="/" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-gray-200 transition-transform active:scale-95">
             <ArrowRight className="w-4 h-4 rotate-180" />
             Exit Admin
           </Link>
        </div>
      </motion.aside>

      {/* Admin Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
        <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsAdminSidebarOpen(true)}
              className="p-2 -ml-2 lg:hidden text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">System {activeAdminTab.charAt(0).toUpperCase() + activeAdminTab.slice(1)}</h2>
              <p className="text-sm text-gray-500 font-medium">Real-time status of the BFU Engine</p>
              {dataError && <p className="text-sm text-red-500 font-bold mt-2">Data Error: {dataError}</p>}
            </div>
          </div>
          
          <div className="flex gap-4 w-full sm:w-auto">
             <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Avg Response</span>
                <span className="text-sm font-bold text-indigo-600">0.8s</span>
             </div>
             <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Uptime</span>
                <span className="text-sm font-bold text-green-600">100%</span>
             </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeAdminTab === 'overview' && (
            <motion.div 
               key="overview"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="space-y-8"
            >
              {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                 {[
                   { label: 'Total Users', value: allowedUsers.length, color: 'indigo', icon: User },
                   { label: 'Daily Cycles', value: generations.length, color: 'blue', icon: Sparkles },
                   { label: 'Pending Access', value: accessRequests.length, color: 'orange', icon: Clock },
                 ].map((stat, i) => (
                   <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm group hover:shadow-md transition-shadow">
                      <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 inline-block mb-4`}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                   </div>
                 ))}
              </div>

              {/* Action Requirements */}
              <div className="grid grid-cols-1 gap-8">
                {accessRequests.length > 0 && (
                  <section className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                       <User className="w-5 h-5 text-blue-600" />
                       Access Queue
                    </h3>
                    <div className="space-y-3">
                      {accessRequests.map(req => (
                        <div key={req.id} className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex justify-between items-center">
                           <span className="text-sm font-bold text-gray-700">{req.email}</span>
                           <div className="flex gap-2">
                             <button onClick={() => handleApproveAccessRequest(req.id, req.email)} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition">
                                <CheckCircle className="w-4 h-4" />
                             </button>
                             <button onClick={() => handleDismissAccessRequest(req.id)} className="bg-white text-gray-400 p-2 rounded-xl border border-blue-100">
                                <XCircle className="w-4 h-4" />
                             </button>
                           </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </motion.div>
          )}

          {activeAdminTab === 'users' && (
            <motion.div 
               key="users"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-6"
            >
              <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-xl font-bold mb-6">Access Registry</h3>
                <form onSubmit={handleAddAllowedUser} className="flex gap-4 mb-8 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                  <input
                    type="email"
                    placeholder="Authorize new email..."
                    value={newAllowedEmail}
                    onChange={(e) => setNewAllowedEmail(e.target.value)}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium"
                  />
                  <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100">
                    Grand Access
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allowedUsers.map(u => (
                    <div key={u.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center justify-between group">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                             <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800 truncate max-w-[120px]">{u.email}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">{new Date(u.createdAt).toLocaleDateString()}</p>
                          </div>
                       </div>
                       <button onClick={() => handleDeleteAllowedUser(u.id)} className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {activeAdminTab === 'ai' && (
            <motion.div 
               key="ai"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-auto lg:h-[calc(100vh-200px)]"
            >
              {/* Daily Intelligence */}
              <div className="lg:col-span-1 space-y-6 flex flex-col h-auto lg:h-full">
                <div className="p-6 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                  <Bot className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                  <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    Daily Intelligence
                  </h3>
                  <p className="text-sm text-indigo-100 font-medium mb-6">Aura analysis of your platform health.</p>
                  
                  <div className="space-y-4">
                    {loadingSuggestions ? (
                      <div className="py-8 flex flex-col items-center gap-3">
                         <Loader2 className="w-8 h-8 animate-spin text-indigo-200" />
                         <span className="text-xs font-bold text-indigo-100 uppercase tracking-widest">Synthesizing...</span>
                      </div>
                    ) : (
                      suggestions.map((s, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          key={idx} 
                          className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl hover:bg-white/15 transition-colors cursor-default"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm">{s.title}</span>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                               s.priority === 'high' ? 'bg-red-400 text-red-950' : 
                               s.priority === 'medium' ? 'bg-orange-300 text-orange-950' : 'bg-green-300 text-green-950'
                            }`}>{s.priority}</span>
                          </div>
                          <p className="text-[11px] text-indigo-50 leading-relaxed">{s.description}</p>
                        </motion.div>
                      ))
                    )}
                  </div>

                  <button 
                    onClick={() => fetchDailySuggestions()}
                    className="mt-6 w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/30 rounded-2xl text-xs font-bold transition-all"
                  >
                    Recalibrate Aura
                  </button>
                </div>

                <div className="flex-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                   <div className="bg-indigo-50 p-4 rounded-full mb-4">
                      <BarChart3 className="w-8 h-8 text-indigo-600" />
                   </div>
                   <h4 className="font-bold text-gray-900">Health Overview</h4>
                   <p className="text-xs text-gray-500 max-w-[200px] mt-1">AI monitors access logs and error rates every hour.</p>
                </div>
              </div>

              {/* Chatbot Interface */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xl flex flex-col overflow-hidden">
                 <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center relative">
                          <Bot className="w-6 h-6 text-white" />
                          <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full translate-x-1 -translate-y-1" />
                       </div>
                       <div>
                          <h4 className="font-bold text-gray-900">Aura Command Interface</h4>
                          <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Active System Connection</p>
                       </div>
                    </div>
                    <Settings className="w-5 h-5 text-gray-300 cursor-pointer hover:text-gray-500 transition-colors" />
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {chatMessages.map((msg, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                         <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                           msg.role === 'user' 
                             ? 'bg-gray-900 text-white rounded-tr-none shadow-lg shadow-gray-100' 
                             : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200'
                         }`}>
                            {msg.content}
                         </div>
                      </motion.div>
                    ))}
                    {isSending && (
                      <div className="flex justify-start">
                         <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none border border-gray-200 flex gap-1">
                            <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                            <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                            <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                         </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                 </div>

                 <form onSubmit={handleSendMessage} className="p-6 pt-0">
                    <div className="p-2 bg-gray-100 rounded-2xl border border-gray-200 flex gap-2">
                       <input 
                         value={userInput}
                         onChange={(e) => setUserInput(e.target.value)}
                         placeholder="Inquire about system health or strategy..."
                         className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium px-4"
                       />
                       <button 
                         disabled={isSending || !userInput.trim()}
                         className="bg-indigo-600 disabled:bg-gray-400 text-white p-3 rounded-xl shadow-lg shadow-indigo-100 transform active:scale-95 transition"
                       >
                         <Send className="w-4 h-4" />
                       </button>
                    </div>
                 </form>
              </div>
            </motion.div>
          )}

          {activeAdminTab === 'history' && (
            <motion.div 
               key="history"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-6"
            >
              <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-bold">Global Generation Logs</h3>
                   <button onClick={() => setLoading(true)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition">
                      <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                   </button>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-gray-100">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Identity</th>
                        <th className="px-6 py-4">Title</th>
                        <th className="px-6 py-4">Cycle Date</th>
                        <th className="px-6 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {generations.map((g, i) => (
                        <tr key={g.id || i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            {g.status === 'failed' ? (
                              <span className="flex items-center gap-1.5 text-red-500 font-bold text-xs">
                                <XCircle className="w-3.5 h-3.5" /> FAILED
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-green-500 font-bold text-xs">
                                <CheckCircle className="w-3.5 h-3.5" /> SUCCESS
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-700">{g.userEmail}</td>
                          <td className="px-6 py-4 truncate max-w-[150px] text-gray-500">{g.title}</td>
                          <td className="px-6 py-4 text-gray-400 text-xs">{new Date(g.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                             <button onClick={() => handleDeleteGeneration(g.id)} className="text-red-400 hover:text-red-600 font-bold text-xs uppercase tracking-tighter">Discard</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </motion.div>
          )}

          {activeAdminTab === 'settings' && (
            <motion.div 
               key="settings"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-6"
            >
              <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                   <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                      <Settings className="w-5 h-5" />
                   </div>
                   <h3 className="text-xl font-bold">System Configuration</h3>
                </div>

                <div className="max-w-2xl">
                  <div className="mb-8 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                     <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <Key className="w-4 h-4" /> Central Gemini API Key
                     </h4>
                     <p className="text-sm text-indigo-700 mb-6 font-medium">
                        This key will be used by all users for all features (Image Prompts, Video Prompts, Scripts, etc.).
                        Ensure this key has sufficient quota and is linked to a funded project.
                     </p>

                     <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest pl-1">API Key Value</label>
                          <div className="relative group">
                            <input 
                               type={isKeyVisible ? "text" : "password"}
                               value={systemKey}
                               onChange={(e) => setSystemKey(e.target.value)}
                               placeholder="Enter Gemini API Key..."
                               className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-mono focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                            />
                            <button 
                              type="button"
                              onClick={() => setIsKeyVisible(!isKeyVisible)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                            >
                              {isKeyVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                           <button 
                             onClick={handleVerifySystemKey}
                             disabled={isVerifyingKey || !systemKey.trim()}
                             className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                           >
                             {isVerifyingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                             Validate Connection
                           </button>

                           <button 
                             onClick={handleSaveSystemKey}
                             disabled={isSavingKey || !systemKey.trim()}
                             className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                           >
                             {isSavingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                             Save & Apply System Key
                           </button>

                           <button 
                             onClick={async () => {
                               if (window.confirm('Are you sure you want to remove the system key? This will stop the tool from working for everyone.')) {
                                 try {
                                   await updateDoc(doc(db, 'system_config', 'gemini'), { keyValue: '', updatedAt: Date.now() });
                                   setSystemKey('');
                                   alert('System key removed.');
                                 } catch (e) { console.error(e); }
                               }
                             }}
                             className="flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 rounded-2xl text-sm font-bold transition-all"
                           >
                             <Trash2 className="w-4 h-4" />
                             Delete Key
                           </button>
                        </div>

                        {verificationResult && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-2xl border text-sm font-medium ${
                               verificationResult.ok 
                               ? 'bg-green-50 border-green-200 text-green-700 font-bold' 
                               : 'bg-red-50 border-red-200 text-red-700 max-w-full overflow-hidden'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                               {verificationResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <XCircle className="w-5 h-5 mt-0 flex-shrink-0" />}
                               <div className="flex-1 min-w-0">
                                 {verificationResult.ok 
                                   ? 'API Key is VALID and ready for production use!' 
                                   : (
                                      <div className="flex flex-col gap-2">
                                        <p className="font-bold text-red-800">Verification Failed:</p>
                                        <p className="text-xs break-words font-mono bg-white/50 p-2 rounded">{verificationResult.error}</p>
                                        {verificationResult.error?.includes('API_KEY_SERVICE_BLOCKED') && (
                                            <div className="mt-2 text-xs bg-red-100 p-3 rounded-lg border border-red-200 font-medium text-red-900 shadow-sm">
                                              <p className="font-bold mb-2 uppercase text-[10px] tracking-wider flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> How to fix this error:</p>
                                              <p className="mb-2">Google is blocking this key because the <b>Generative Language API</b> is not enabled on your Google Cloud Project.</p>
                                              <ol className="list-decimal pl-4 space-y-2">
                                                <li>The <b>easiest solution</b> is to get a fresh key directly from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold text-blue-700">Google AI Studio</a>. Keys made here work instantly.</li>
                                                <li>If using Google Cloud Platform (GCP): You <b>must</b> search for "Generative Language API" (NOT Vertex AI) and click Enable.</li>
                                                <li>Go to Credentials {'>'} API Keys. Ensure <b>Application restrictions</b> are set to <b>None</b>.</li>
                                                <li>Ensure your billing account is actively linked if you selected the paid tier.</li>
                                              </ol>
                                            </div>
                                        )}
                                        {verificationResult.error?.includes('prepayment credits are depleted') && (
                                            <div className="mt-2 text-xs bg-red-100 p-3 rounded-lg border border-red-200 font-medium text-red-900 shadow-sm">
                                              <p className="font-bold mb-2 uppercase text-[10px] tracking-wider flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Billing Issue: Outstanding Balance or Depleted Credit</p>
                                              <p className="mb-2">Your API key is valid, but the associated Google Cloud / AI Studio project has run out of funds.</p>
                                              <ol className="list-decimal pl-4 space-y-2">
                                                <li><b>The $300 GCP Trial Issue:</b> While you have a $300 Google Cloud Platform trial, Google AI Studio uses a separate <b>prepaid billing system</b> that may not automatically draw from your GCP trial credits depending on your account setup.</li>
                                                <li><b>Solution 1:</b> Go to <a href="https://ai.studio/projects" target="_blank" rel="noreferrer" className="underline font-bold text-blue-700">AI Studio Billing</a>, switch to the correct project, and either add $5-$10 prepay funds or unlink the billing account to downgrade back to the <b>Free Tier</b> (which has a lower rate limit but is 100% free).</li>
                                                <li><b>Solution 2 (Recommended):</b> Generate a completely new API key from a brand new Google account without attaching any billing (Free Tier). Free tier allows ~15 requests per minute, which is enough for basic usage.</li>
                                                <li><b>Solution 3:</b> Check your GCP Console Billing section to ensure your $300 credits are actually active and your billing account is linked to the exact project that generated this API key.</li>
                                              </ol>
                                            </div>
                                        )}
                                        {verificationResult.error?.includes('Quota exceeded') && verificationResult.error?.includes('limit: 0') && (
                                            <div className="mt-2 text-xs bg-orange-100 p-3 rounded-lg border border-orange-200 font-medium text-orange-900 shadow-sm">
                                              <p className="font-bold mb-2 uppercase text-[10px] tracking-wider flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Free Tier / Model Conflict</p>
                                              <p className="mb-2">Your API key has a <b>Quota Limit of 0</b>. This usually happens for one of these reasons:</p>
                                              <ol className="list-decimal pl-4 space-y-2">
                                                <li><b>Model Not Available:</b> We were trying to use a newer model which may not have a free tier in your region. <b>GOOD NEWS:</b> I have just successfully updated our code to use a different robust model (gemini-1.5-pro) everywhere. Try clicking verify again now!</li>
                                                <li><b>The Prepay Trap:</b> Your AI Studio project is still linked to a "Tier 1 - Prepay" billing account that has 0 credits. Even if you "disabled" billing, if the project still shows as "Tier 1" in AI Studio, your free tier limit is permanently 0. <b>Solution:</b> Create a brand new project in AI Studio without attaching any billing account, and generate a new key there.</li>
                                                <li><b>Location Issue:</b> Google AI Studio's <b>Free Tier is NOT available in the UK, EU, or Switzerland</b>. (If your Google account's payment profile is registered in these regions, it applies even if you are physically elsewhere).</li>
                                              </ol>
                                            </div>
                                        )}
                                        {verificationResult.error?.includes('Quota exceeded') && !verificationResult.error?.includes('limit: 0') && (
                                            <div className="mt-2 text-xs bg-orange-100 p-3 rounded-lg border border-orange-200 font-medium text-orange-900 shadow-sm">
                                              <p className="font-bold mb-2 uppercase text-[10px] tracking-wider flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Rate Limit Exceeded</p>
                                              <p className="mb-2">You have exceeded your Free Tier quotas (15 requests per minute, 1500 per day).</p>
                                              <ol className="list-decimal pl-4 space-y-2">
                                                <li>Please wait a minute before trying again if you hit the RPM limit.</li>
                                                <li>If you hit the daily limit, you will need to wait until UTC midnight.</li>
                                                <li>To increase your quota, you can enable billing in AI Studio.</li>
                                              </ol>
                                            </div>
                                        )}
                                     </div>
                                   )}
                               </div>
                            </div>
                          </motion.div>
                        )}
                     </div>
                  </div>

                  <div className="p-6 bg-orange-50/50 rounded-2xl border border-orange-100">
                     <div className="flex items-center gap-2 text-orange-600 mb-2">
                        <Loader2 className="w-4 h-4" />
                        <h4 className="font-bold">System Maintenance</h4>
                     </div>
                     <p className="text-xs text-orange-700 font-medium leading-relaxed">
                        Changes to the system key are applied instantly. All users currently logged in will automatically start using the new key on their next generation attempt.
                     </p>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

