import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, Plus, RefreshCw, XCircle, CheckCircle, Bot, MessageSquare, Lightbulb, Send, Loader2, Sparkles, User, Key, BarChart3, Settings, ShieldAlert, ArrowRight, Clock, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { generateAdminAdvice, AdminAdviceResult } from '../services/geminiService';

export default function AdminPanel() {
  const { isAdmin, user } = useAuth();
  const [apiKeys, setApiKeys] = useState<{ id: string; name: string; keyValue: string; assignedTo?: string }[]>([]);
  const [generations, setGenerations] = useState<any[]>([]);
  const [apiKeyRequests, setApiKeyRequests] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [allowedUsers, setAllowedUsers] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyAssignedTo, setNewKeyAssignedTo] = useState('');
  const [newAllowedEmail, setNewAllowedEmail] = useState('');
  const [loading, setLoading] = useState(true);

  // AI Chatbot & Suggestions State
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'users' | 'keys' | 'history' | 'ai'>('overview');
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

  useEffect(() => {
    if (!isAdmin) return;
    fetchDailySuggestions();
  }, [isAdmin]);

  const fetchDailySuggestions = async (forceMessage?: string) => {
    setLoadingSuggestions(true);
    try {
      const stats = {
        totalUsers: allowedUsers.length,
        totalGenerations: generations.length,
        pendingRequests: apiKeyRequests.length + accessRequests.length,
        activeKeys: apiKeys.length,
        recentErrors: generations.filter(g => g.status === 'failed').length
      };
      
      const adminKey = apiKeys.find(k => k.assignedTo === user?.email || !k.assignedTo)?.keyValue;
      const result = await generateAdminAdvice(stats, forceMessage, adminKey);
      
      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
      }
      
      if (result.chatbotResponse) {
        setChatMessages(prev => [...prev, { role: 'ai', content: result.chatbotResponse! }]);
      }
    } catch (err) {
      console.error("Suggestions Error:", err);
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

  useEffect(() => {
    if (!isAdmin) return;
    
    const qKeys = collection(db, 'api_keys');
    const unsubKeys = onSnapshot(qKeys, (snapshot) => {
      const keys = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setApiKeys(keys);
    }, (err) => console.error("api_keys error AdminPanel:", err));

    const qReqs = query(collection(db, 'api_key_requests'), orderBy('createdAt', 'desc'));
    const unsubReqs = onSnapshot(qReqs, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setApiKeyRequests(reqs.filter((r: any) => r.status === 'pending'));
    }, (err) => console.error("api_key_requests error AdminPanel:", err));

    const qAccessReqs = query(collection(db, 'access_requests'), orderBy('createdAt', 'desc'));
    const unsubAccessReqs = onSnapshot(qAccessReqs, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAccessRequests(reqs.filter((r: any) => r.status === 'pending'));
    }, (err) => console.error("access_requests error AdminPanel:", err));

    const qGenerations = query(collection(db, 'generations'), orderBy('createdAt', 'desc'));
    const unsubGens = onSnapshot(qGenerations, (snapshot) => {
      const gens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGenerations(gens);
      setLoading(false);
    }, (err) => console.error("generations error AdminPanel:", err));

    const qAllowedUsers = collection(db, 'allowed_users');
    const unsubAllowedUsers = onSnapshot(qAllowedUsers, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllowedUsers(users);
    }, (err) => console.error("allowed_users error AdminPanel:", err));

    return () => {
      unsubKeys();
      unsubReqs();
      unsubAccessReqs();
      unsubGens();
      unsubAllowedUsers();
    };
  }, [isAdmin]);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    
    try {
      await addDoc(collection(db, 'api_keys'), {
        name: newKeyName,
        keyValue: newKeyValue,
        assignedTo: newKeyAssignedTo.trim() || '',
        createdAt: Date.now(),
      });
      setNewKeyName('');
      setNewKeyValue('');
      setNewKeyAssignedTo('');
    } catch (err) {
      console.error(err);
      alert('Error adding key');
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'api_keys', id));
    } catch (err) {
      console.error(err);
      alert('Error deleting key');
    }
  };

  const handleUpdateAssignment = async (id: string, newEmail: string) => {
    try {
      await updateDoc(doc(db, 'api_keys', id), {
        assignedTo: newEmail.trim()
      });
    } catch (err) {
      console.error(err);
      alert('Error updating assignment');
    }
  };

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

  const handleApproveRequest = async (reqId: string, email: string) => {
    const keyVal = prompt(`Enter a new API key to assign to ${email}`);
    if (!keyVal) return;
    try {
      await addDoc(collection(db, 'api_keys'), {
        name: `Key for ${email.split('@')[0]}`,
        keyValue: keyVal.trim(),
        assignedTo: email,
        createdAt: Date.now(),
      });
      await updateDoc(doc(db, 'api_key_requests', reqId), { status: 'approved' });
      alert('Key assigned successfully and request approved!');
    } catch (e) {
      console.error(e);
      alert('Failed to approve request');
    }
  };

  const handleDismissRequest = async (reqId: string) => {
    try {
      await updateDoc(doc(db, 'api_key_requests', reqId), { status: 'rejected' });
    } catch (e) {
      console.error(e);
      alert('Failed to dismiss request');
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
                { id: 'keys', icon: Key, label: 'API Management' },
                { id: 'history', icon: RefreshCw, label: 'Global Logs' },
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                 {[
                   { label: 'Total Users', value: allowedUsers.length, color: 'indigo', icon: User },
                   { label: 'Daily Cycles', value: generations.length, color: 'blue', icon: Sparkles },
                   { label: 'API Stability', value: '98.2%', color: 'green', icon: CheckCircle },
                   { label: 'Pending Req', value: apiKeyRequests.length + accessRequests.length, color: 'orange', icon: Clock },
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {apiKeyRequests.length > 0 && (
                  <section className="bg-white p-6 rounded-3xl border border-orange-100 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                       <Key className="w-5 h-5 text-orange-600" />
                       API Key Pipeline
                    </h3>
                    <div className="space-y-3">
                      {apiKeyRequests.map(req => (
                        <div key={req.id} className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 flex justify-between items-center">
                           <span className="text-sm font-bold text-gray-700">{req.email}</span>
                           <div className="flex gap-2">
                             <button onClick={() => handleApproveRequest(req.id, req.email)} className="bg-orange-600 text-white p-2 rounded-xl hover:bg-orange-700 transition">
                                <CheckCircle className="w-4 h-4" />
                             </button>
                             <button onClick={() => handleDismissRequest(req.id)} className="bg-white text-gray-400 p-2 rounded-xl border border-orange-100">
                                <XCircle className="w-4 h-4" />
                             </button>
                           </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

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

          {activeAdminTab === 'keys' && (
            <motion.div 
               key="keys"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-6"
            >
              <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-xl font-bold mb-6">Engine API Management</h3>
                <form onSubmit={handleAddKey} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <input
                    type="text"
                    placeholder="Internal Alias (e.g. Primary Flash)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <input
                    type="password"
                    placeholder="Secured Key Value"
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <input
                    type="email"
                    placeholder="Owner Allocation (Optional)"
                    value={newKeyAssignedTo}
                    onChange={(e) => setNewKeyAssignedTo(e.target.value)}
                    className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <button type="submit" className="bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 h-[52px] md:col-span-2 lg:col-span-1">
                    Register Engine Key
                  </button>
                </form>

                <div className="space-y-4">
                  {apiKeys.map(k => (
                    <div key={k.id} className="p-5 bg-white border border-gray-100 rounded-3xl shadow-sm flex items-center justify-between group">
                       <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900">{k.name}</span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${k.assignedTo ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'}`}>
                               {k.assignedTo ? `Owned by ${k.assignedTo}` : 'Global Pool'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <code className="text-xs text-gray-400 font-mono">••••••••••••••••••••</code>
                            <div className="flex items-center gap-2">
                               <input 
                                 id={`reassign-${k.id}`}
                                 defaultValue={k.assignedTo || ''}
                                 className="text-[10px] bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 w-40 font-bold"
                                 placeholder="Relocate..."
                               />
                               <button onClick={() => {
                                 const el = document.getElementById(`reassign-${k.id}`) as HTMLInputElement;
                                 handleUpdateAssignment(k.id, el.value);
                               }} className="text-[10px] font-bold text-indigo-600 hover:underline">Reassign</button>
                            </div>
                          </div>
                       </div>
                       <button onClick={() => handleDeleteKey(k.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all">
                          <Trash2 className="w-5 h-5" />
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
        </AnimatePresence>
      </main>
    </div>
  );
}

