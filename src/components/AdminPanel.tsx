import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, Plus, RefreshCw, XCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminPanel() {
  const { isAdmin } = useAuth();
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
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
         <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
         <Link to="/" className="text-indigo-600 font-medium hover:underline">← Back to App</Link>
      </div>

      {apiKeyRequests.length > 0 && (
        <section className="bg-white p-6 rounded-xl shadow-sm border border-orange-200">
          <h2 className="text-lg font-semibold mb-4 text-orange-800 flex items-center gap-2">
            Pending API Key Requests <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full text-xs">{apiKeyRequests.length}</span>
          </h2>
          <div className="space-y-3 max-w-3xl">
            {apiKeyRequests.map(req => (
              <div key={req.id} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-100 shadow-sm">
                <div>
                  <p className="font-medium text-gray-900">{req.email} <span className="text-xs text-gray-400 font-normal ml-2">{new Date(req.createdAt).toLocaleString()}</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApproveRequest(req.id, req.email)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                    Add & Assign Key
                  </button>
                  <button onClick={() => handleDismissRequest(req.id)} className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {accessRequests.length > 0 && (
        <section className="bg-white p-6 rounded-xl shadow-sm border border-blue-200">
          <h2 className="text-lg font-semibold mb-4 text-blue-800 flex items-center gap-2">
            Pending Platform Access Requests <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full text-xs">{accessRequests.length}</span>
          </h2>
          <div className="space-y-3 max-w-3xl">
            {accessRequests.map(req => (
              <div key={req.id} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100 shadow-sm">
                <div>
                  <p className="font-medium text-gray-900">{req.email} <span className="text-xs text-gray-400 font-normal ml-2">{new Date(req.createdAt).toLocaleString()}</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApproveAccessRequest(req.id, req.email)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                    Approve Access
                  </button>
                  <button onClick={() => handleDismissAccessRequest(req.id)} className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">User Access Management</h2>
        <p className="text-sm text-gray-500 mb-6">Users must be added here to be able to sign in to the application.</p>
        <form onSubmit={handleAddAllowedUser} className="flex gap-4 mb-6 max-w-xl">
          <input
            type="email"
            placeholder="User Email Address"
            value={newAllowedEmail}
            onChange={(e) => setNewAllowedEmail(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm">
            <Plus className="w-4 h-4" /> Allow Access
          </button>
        </form>
        
        <div className="space-y-2 max-w-xl">
          {allowedUsers.map(u => (
            <div key={u.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div>
                <p className="font-medium text-gray-900">{u.email}</p>
                <p className="text-xs text-gray-500">Added: {new Date(u.createdAt).toLocaleString()}</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  console.log("Attempting to delete user:", u.id);
                  handleDeleteAllowedUser(u.id);
                }} 
                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {allowedUsers.length === 0 && <p className="text-gray-500 text-sm">No users have been allowed access yet.</p>}
        </div>
      </section>
      
      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Manage Default API Keys</h2>
        <form onSubmit={handleAddKey} className="flex flex-col gap-4 mb-6 max-w-3xl">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Key Name (e.g. key-1, Bob's Key)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="password"
              placeholder="API Key Value"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-4">
            <input
              type="email"
              placeholder="Assign to User Email (Optional)"
              value={newKeyAssignedTo}
              onChange={(e) => setNewKeyAssignedTo(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add Key
            </button>
          </div>
        </form>
        
        <div className="space-y-3 max-w-3xl">
          {apiKeys.map(k => (
            <div key={k.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  {k.name}
                  {k.assignedTo ? (
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-normal">Assigned: {k.assignedTo}</span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-normal">Public/Shared</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-1 blur-[2px] transition hover:blur-none cursor-pointer" title="Hover to view key">
                  {k.keyValue.substring(0, 10)}...{k.keyValue.substring(k.keyValue.length - 4)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="New user email to assign"
                    className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 w-48"
                    id={`assign-${k.id}`}
                    defaultValue={k.assignedTo || ''}
                  />
                  <button
                    onClick={() => {
                      const el = document.getElementById(`assign-${k.id}`) as HTMLInputElement;
                      if (el) handleUpdateAssignment(k.id, el.value);
                    }}
                    className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 transition font-medium"
                  >
                    Assign
                  </button>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteKey(k.id)} 
                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition ml-4"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
          {apiKeys.length === 0 && <p className="text-gray-500 text-sm">No API keys added yet.</p>}
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">All Generations History ({generations.length})</h2>
        {loading ? (
          <div className="py-8 flex justify-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Key Used</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Error Message</th>
                  <th className="px-4 py-3 font-semibold w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {generations.map((g, i) => (
                  <tr key={g.id || i} className={`hover:bg-gray-50 ${g.status === 'failed' ? 'bg-red-50/20' : ''}`}>
                    <td className="px-4 py-3">
                      {g.status === 'failed' ? (
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                          <XCircle className="w-4 h-4" /> Failed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <CheckCircle className="w-4 h-4" /> Success
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{g.userEmail}</td>
                    <td className="px-4 py-3 truncate max-w-[200px]" title={g.title}>{g.title}</td>
                    <td className="px-4 py-3 text-gray-500">{g.apiKeyUsed}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(g.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-red-600 truncate max-w-[300px]" title={g.error || ''}>
                      {g.error ? g.error : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                       {g.status === 'success' && g.result && (
                         <button 
                            onClick={() => {
                              alert(JSON.stringify(g.result, null, 2));
                            }}
                            className="text-indigo-600 hover:underline text-xs font-medium"
                         >
                           View Results
                         </button>
                       )}
                       <button 
                         onClick={() => handleDeleteGeneration(g.id)}
                         className="text-red-600 hover:underline text-xs font-medium ml-auto"
                       >
                         Delete
                       </button>
                    </td>
                  </tr>
                ))}
                {generations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No generations recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

