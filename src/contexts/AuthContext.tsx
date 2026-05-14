import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebaseService';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isAdmin: boolean;
  createdAt: number;
  updatedAt: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isAllowed: boolean | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
  isAdmin: false,
  isAllowed: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      if (currUser) {
        
        let allowed = false;
        if (currUser.email?.trim().toLowerCase() === 'frazcheema82@gmail.com') {
           allowed = true;
        } else if (currUser.email) {
           try {
             // Check if user is in allowed_users (case-insensitive)
             const q = query(collection(db, 'allowed_users'));
             const qSnap = await getDocs(q);
             let found = false;
             qSnap.forEach(doc => {
               if (doc.data().email?.trim().toLowerCase() === currUser.email?.trim().toLowerCase()) {
                 found = true;
               }
             });
             if (found) {
               allowed = true;
             }
           } catch (e) {
             console.error("Error checking allowed users", e);
           }
        }

        if (!allowed) {
           setIsAllowed(false);
           setUser(currUser);
           setProfile(null);
           setLoading(false);
           return;
        }

        setUser(currUser);
        setIsAllowed(true);

        // Fetch or create profile
        const userRef = doc(db, 'users', currUser.uid);
        try {
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: currUser.uid,
              email: currUser.email || '',
              displayName: currUser.displayName || '',
              photoURL: currUser.photoURL || '',
              isAdmin: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
         setUser(null);
         setProfile(null);
         setIsAllowed(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setIsAllowed(null); // reset so we can show proper errors
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert(`Failed to sign in. The domain '${window.location.hostname}' is not authorized in Firebase. You must add it to Authorized Domains in your Firebase Console under Authentication > Settings > Authorized domains.`);
      } else {
        alert(`Failed to sign in: ${error.message}`);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isAdmin = profile?.isAdmin === true || user?.email?.trim().toLowerCase() === 'frazcheema82@gmail.com';

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, logout, isAdmin, isAllowed }}>
      {children}
    </AuthContext.Provider>
  );
};
