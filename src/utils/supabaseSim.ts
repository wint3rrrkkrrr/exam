import { subjectsList } from '../data/subjectsData';
import claytonKimImg from '../assets/images/clayton_kim_1789743353081.jpg';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';

export interface UserScoreRecord {
  id: string;
  username: string;
  subject_id: string;
  subject_name: string;
  score: number;
  max_questions: number;
  streak: number;
  created_at: string;
  device_info?: string;
}

export interface RegisteredUser {
  username: string;
  joined_at: string;
  last_active: string;
  device_info: string;
}

export interface UserAggregatedLeaderboard {
  username: string;
  totalScore: number;
  totalAttempted: number;
  maxStreak: number;
  quizzesCompleted: number;
  lastActive: string;
  deviceInfo: string;
  isRankZero?: boolean;
}

export interface UserProfile {
  username: string;
  avatar: string;
  bio: string;
  joined_at: string;
  last_active: string;
  device_info: string;
}

export interface FriendRequest {
  id: string;
  fromUsername: string;
  toUsername: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ChatMessage {
  id: string;
  sender: string;
  recipient?: string;
  text: string;
  timestamp: string;
  isGlobal: boolean;
  avatar?: string;
}

const STORAGE_KEY_SCORES = 'winter_exam_supabase_scores_v2';
const STORAGE_KEY_USERS = 'winter_exam_supabase_real_users_v2';
const STORAGE_KEY_PROFILES = 'winter_exam_user_profiles_v1';
const STORAGE_KEY_FRIENDS = 'winter_exam_user_friends_v1';
const STORAGE_KEY_FRIEND_REQ = 'winter_exam_friend_requests_v1';
const STORAGE_KEY_CHAT = 'winter_exam_chat_messages_v1';

export const DEFAULT_AVATARS = [
  claytonKimImg,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
];

export function detectDevice(): string {
  if (typeof window === 'undefined' || !navigator) return 'ไม่ทราบอุปกรณ์';
  const ua = navigator.userAgent || '';

  // Extract specific model strings from Android UA if available
  let specificModel = '';
  const androidModelMatch = ua.match(/\(([^)]+)\)/);
  if (androidModelMatch && androidModelMatch[1]) {
    const parts = androidModelMatch[1].split(';').map(p => p.trim());
    for (const part of parts) {
      if (/Android/i.test(part) || /Linux/i.test(part) || /wv/i.test(part)) continue;
      if (/Build\//i.test(part)) {
        const modelName = part.split('Build/')[0].trim();
        if (modelName) {
          specificModel = modelName;
          break;
        }
      } else if (/SM-|Pixel|CPH|RMX|M2|220|V2|M20|Mi|Redmi|POCO|OnePlus|ROG|Xperia|Galaxy/i.test(part)) {
        specificModel = part.replace(/Build\/.*/i, '').trim();
        break;
      }
    }
  }

  // Known Brand / Model detection
  let brandModel = '';
  if (/iPhone/i.test(ua)) {
    brandModel = 'iPhone';
  } else if (/iPad/i.test(ua) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/i.test(ua))) {
    brandModel = 'iPad';
  } else if (/Pixel/i.test(ua)) {
    const m = ua.match(/Pixel\s?[\w\d\s]+/i);
    brandModel = m ? m[0].trim() : 'Google Pixel';
  } else if (/SM-[A-Z0-9]+/i.test(ua) || /Samsung/i.test(ua)) {
    const m = ua.match(/SM-[A-Z0-9]+/i);
    brandModel = m ? `Samsung Galaxy (${m[0]})` : 'Samsung Galaxy';
  } else if (/CPH[0-9]+/i.test(ua) || /OPPO/i.test(ua)) {
    const m = ua.match(/CPH[0-9]+/i);
    brandModel = m ? `OPPO (${m[0]})` : 'OPPO';
  } else if (/V2[0-9]+/i.test(ua) || /vivo/i.test(ua)) {
    const m = ua.match(/V2[0-9]+/i);
    brandModel = m ? `Vivo (${m[0]})` : 'Vivo';
  } else if (/Redmi|Xiaomi|Mi\s|M2[0-9]+/i.test(ua)) {
    const m = ua.match(/(Redmi[\w\s\d]+|Mi[\w\s\d]+)/i);
    brandModel = m ? m[0].trim() : 'Xiaomi / Redmi';
  } else if (/Realme|RMX[0-9]+/i.test(ua)) {
    const m = ua.match(/RMX[0-9]+/i);
    brandModel = m ? `Realme (${m[0]})` : 'Realme';
  } else if (/OnePlus/i.test(ua)) {
    brandModel = 'OnePlus';
  } else if (specificModel) {
    brandModel = specificModel;
  }

  // OS detection with version
  let osName = '';
  if (/windows nt 10/i.test(ua) || /windows nt 11/i.test(ua)) osName = 'Windows PC (10/11)';
  else if (/windows nt 6.3/i.test(ua)) osName = 'Windows PC (8.1)';
  else if (/windows nt 6.1/i.test(ua)) osName = 'Windows PC (7)';
  else if (/windows/i.test(ua)) osName = 'Windows PC';
  else if (/macintosh|mac os x/i.test(ua)) {
    osName = (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ? 'iPadOS' : 'MacBook / Mac (macOS)';
  } else if (/iphone|ipod/i.test(ua)) osName = 'iOS';
  else if (/ipad/i.test(ua)) osName = 'iPadOS';
  else if (/android/i.test(ua)) {
    const ver = ua.match(/Android\s([0-9.]+)/i);
    osName = ver ? `Android ${ver[1]}` : 'Android';
  } else if (/linux/i.test(ua)) osName = 'Linux PC';

  // Browser detection
  let browserName = '';
  if (/edg/i.test(ua)) browserName = 'Edge';
  else if (/chrome|crios/i.test(ua)) browserName = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browserName = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browserName = 'Safari';

  // Device type icon
  let icon = '💻';
  if (/mobile/i.test(ua) || /iphone|android/i.test(ua)) {
    icon = '📱';
  } else if (/ipad/i.test(ua)) {
    icon = '📱';
  }

  if (brandModel) {
    return `${icon} ${brandModel} (${osName}${browserName ? ' • ' + browserName : ''})`;
  } else {
    return `${icon} ${osName || 'ไม่ทราบอุปกรณ์'}${browserName ? ' (' + browserName + ')' : ''}`;
  }
}

// Initialize Real Firebase Configuration
const firebaseConfig = {
  projectId: "effective-glyph-6xctm",
  appId: "1:716432792036:web:258ff79b7ca9c2aab60ff1",
  apiKey: "AIzaSyA6t8xZ2uEDgjJyEBExwzZm-etUfORYCI0",
  authDomain: "effective-glyph-6xctm.firebaseapp.com",
  storageBucket: "effective-glyph-6xctm.firebasestorage.app",
  messagingSenderId: "716432792036"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Start Real-Time Firestore listeners to keep local database perfectly in sync globally
if (typeof window !== 'undefined') {
  // Listen to users
  onSnapshot(collection(db, 'users'), (snapshot) => {
    const users: RegisteredUser[] = [];
    snapshot.forEach((doc) => {
      users.push(doc.data() as RegisteredUser);
    });
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    window.dispatchEvent(new Event('storage'));
  });

  // Listen to scores
  onSnapshot(collection(db, 'scores'), (snapshot) => {
    const scores: UserScoreRecord[] = [];
    snapshot.forEach((doc) => {
      scores.push(doc.data() as UserScoreRecord);
    });
    localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(scores));
    window.dispatchEvent(new Event('storage'));
  });

  // Listen to profiles
  onSnapshot(collection(db, 'profiles'), (snapshot) => {
    const profiles: Record<string, UserProfile> = {};
    snapshot.forEach((doc) => {
      profiles[doc.id] = doc.data() as UserProfile;
    });
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
    window.dispatchEvent(new Event('storage'));
  });

  // Listen to friendRequests
  onSnapshot(collection(db, 'friendRequests'), (snapshot) => {
    const reqs: FriendRequest[] = [];
    snapshot.forEach((doc) => {
      reqs.push(doc.data() as FriendRequest);
    });
    localStorage.setItem(STORAGE_KEY_FRIEND_REQ, JSON.stringify(reqs));
    window.dispatchEvent(new Event('storage'));
  });

  // Listen to chatMessages
  onSnapshot(collection(db, 'chatMessages'), (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      messages.push(doc.data() as ChatMessage);
    });
    // Sort by timestamp ascending
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(messages));
    window.dispatchEvent(new Event('storage'));
  });

  // Listen to friends
  onSnapshot(collection(db, 'friends'), (snapshot) => {
    const friendsMap: Record<string, string[]> = {};
    snapshot.forEach((doc) => {
      friendsMap[doc.id] = (doc.data() as { list: string[] }).list || [];
    });
    localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(friendsMap));
    window.dispatchEvent(new Event('storage'));
  });
}

// Async syncing function (no-op now since we have persistent, real-time Firestore listeners!)
export async function syncWithServer() {
  // Directly rely on Firestores instant stream snapshot updates!
}

export const supabaseSim = {
  // Register or update user active status
  registerUser: async (username: string) => {
    if (!username || !username.trim()) return;
    const cleanName = username.trim();
    const docId = cleanName.toLowerCase();
    const device = detectDevice();
    const now = new Date().toISOString();

    try {
      const userDocRef = doc(db, 'users', docId);
      const existing = await getDoc(userDocRef);
      const joined_at = existing.exists() ? (existing.data()?.joined_at || now) : now;

      const data: RegisteredUser = {
        username: cleanName,
        joined_at,
        last_active: now,
        device_info: device
      };

      await setDoc(userDocRef, data);
    } catch (e) {
      console.error("Error registering user with Firebase", e);
    }
  },

  // Get list of all real users registered in the app
  getRealUsers: (): RegisteredUser[] => {
    try {
      const usersRaw = localStorage.getItem(STORAGE_KEY_USERS);
      if (usersRaw) {
        return JSON.parse(usersRaw);
      }
    } catch (e) {
      console.error("Error fetching real users from local", e);
    }
    return [];
  },

  // Get aggregated leaderboard scores across all subjects for REAL users only
  getAggregatedLeaderboard: async (): Promise<UserAggregatedLeaderboard[]> => {
    try {
      const scoresRaw = localStorage.getItem(STORAGE_KEY_SCORES);
      const scores: UserScoreRecord[] = scoresRaw ? JSON.parse(scoresRaw) : [];
      const realUsers = supabaseSim.getRealUsers();
      const currentDevice = detectDevice();

      // Aggregate scores by username
      const userMap: { [username: string]: UserAggregatedLeaderboard } = {};

      // Initialize entries for all registered real users
      realUsers.forEach(u => {
        userMap[u.username.toLowerCase()] = {
          username: u.username,
          totalScore: 0,
          totalAttempted: 0,
          maxStreak: 0,
          quizzesCompleted: 0,
          lastActive: u.last_active,
          deviceInfo: u.device_info || currentDevice,
        };
      });

      // Sum up score records
      scores.forEach(rec => {
        const key = rec.username.toLowerCase();
        if (!userMap[key]) {
          userMap[key] = {
            username: rec.username,
            totalScore: 0,
            totalAttempted: 0,
            maxStreak: 0,
            quizzesCompleted: 0,
            lastActive: rec.created_at,
            deviceInfo: rec.device_info || currentDevice,
          };
        }

        userMap[key].totalScore += rec.score;
        userMap[key].totalAttempted += rec.max_questions;
        userMap[key].quizzesCompleted += 1;
        if (rec.streak > userMap[key].maxStreak) {
          userMap[key].maxStreak = rec.streak;
        }
        if (new Date(rec.created_at).getTime() > new Date(userMap[key].lastActive).getTime()) {
          userMap[key].lastActive = rec.created_at;
        }
        if (rec.device_info) {
          userMap[key].deviceInfo = rec.device_info;
        }
      });

      const list = Object.values(userMap);

      // Filter out users with 0 score unless registered
      const filtered = list.filter(u => u.totalAttempted > 0 || realUsers.some(r => r.username.toLowerCase() === u.username.toLowerCase()));

      // Sort by Total Score DESC, then Max Streak DESC, then Quizzes Completed DESC
      filtered.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.maxStreak !== a.maxStreak) return b.maxStreak - a.maxStreak;
        return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
      });

      // Special Rank 0 Dummy Entry for WIN requested by user
      const rankZeroWin: UserAggregatedLeaderboard = {
        username: 'WIN',
        totalScore: 999,
        totalAttempted: 999,
        maxStreak: 999,
        quizzesCompleted: 999,
        lastActive: new Date().toISOString(),
        deviceInfo: currentDevice,
        isRankZero: true,
      };

      // Filter out any existing 'win' entry from real array to prevent duplicate
      const filteredReal = filtered.filter(u => u.username.trim().toLowerCase() !== 'win');

      return [rankZeroWin, ...filteredReal];
    } catch (e) {
      console.error("Failed to parse aggregated leaderboard", e);
      return [];
    }
  },

  // Submit quiz score
  submitScore: async (username: string, subjectId: string, score: number, maxQuestions: number, streak: number): Promise<void> => {
    if (!username || !username.trim()) return;
    const cleanName = username.trim();
    
    // Register user first
    await supabaseSim.registerUser(cleanName);

    try {
      const subject = subjectsList.find(s => s.id === subjectId);
      const subjectName = subject ? subject.name : subjectId;
      const device = detectDevice();
      const id = Math.random().toString(36).substring(2, 9);

      const newRecord: UserScoreRecord = {
        id,
        username: cleanName,
        subject_id: subjectId,
        subject_name: subjectName,
        score,
        max_questions: maxQuestions,
        streak,
        created_at: new Date().toISOString(),
        device_info: device,
      };

      await setDoc(doc(db, 'scores', id), newRecord);
    } catch (e) {
      console.error("Error submitting score to Firebase", e);
    }
  },

  // Admin method: Delete specific user and their scores
  deleteUserByAdmin: async (username: string) => {
    try {
      const cleanName = username.trim().toLowerCase();
      
      // Delete from users
      await deleteDoc(doc(db, 'users', cleanName));

      // Delete from profiles
      await deleteDoc(doc(db, 'profiles', cleanName));

      // Delete from friends
      await deleteDoc(doc(db, 'friends', cleanName));

      // Delete from scores where username matches
      const qScores = query(collection(db, 'scores'), where('username', '==', username.trim()));
      const snapScores = await getDocs(qScores);
      const batch = writeBatch(db);
      snapScores.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (e) {
      console.error("Error deleting user from Firebase", e);
    }
  },

  // Admin method: Reset all scores
  clearAllScoresByAdmin: async () => {
    try {
      // Clear scores
      const snapScores = await getDocs(collection(db, 'scores'));
      const batchScores = writeBatch(db);
      snapScores.forEach((doc) => {
        batchScores.delete(doc.ref);
      });
      await batchScores.commit();

      // Clear users
      const snapUsers = await getDocs(collection(db, 'users'));
      const batchUsers = writeBatch(db);
      snapUsers.forEach((doc) => {
        batchUsers.delete(doc.ref);
      });
      await batchUsers.commit();

      // Clear profiles
      const snapProfiles = await getDocs(collection(db, 'profiles'));
      const batchProfiles = writeBatch(db);
      snapProfiles.forEach((doc) => {
        batchProfiles.delete(doc.ref);
      });
      await batchProfiles.commit();

      // Clear friendRequests
      const snapReqs = await getDocs(collection(db, 'friendRequests'));
      const batchReqs = writeBatch(db);
      snapReqs.forEach((doc) => {
        batchReqs.delete(doc.ref);
      });
      await batchReqs.commit();

      // Clear friends
      const snapFriends = await getDocs(collection(db, 'friends'));
      const batchFriends = writeBatch(db);
      snapFriends.forEach((doc) => {
        batchFriends.delete(doc.ref);
      });
      await batchFriends.commit();
    } catch (e) {
      console.error("Error clearing scores", e);
    }
  },

  // --- Profile Methods ---
  getProfile: (username: string): UserProfile => {
    if (!username) return { username: '', avatar: DEFAULT_AVATARS[0], bio: 'สู้ๆ ไปด้วยกันนะ!', joined_at: '', last_active: '', device_info: '' };
    const cleanName = username.trim().toLowerCase();
    
    // Check saved profiles in local storage first
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
      const profiles: Record<string, UserProfile> = raw ? JSON.parse(raw) : {};
      if (profiles[cleanName] && profiles[cleanName].avatar) {
        return profiles[cleanName];
      }
    } catch (e) {
      console.error(e);
    }

    // Default fallback for WIN if no custom profile created yet
    if (cleanName === 'win' || cleanName === 'wintararer') {
      return {
        username: 'WIN',
        avatar: claytonKimImg,
        bio: '👑 RANK 0 TOP SUPREME VIP',
        joined_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        device_info: detectDevice(),
      };
    }

    return {
      username: username.trim(),
      avatar: DEFAULT_AVATARS[Math.abs(username.length) % DEFAULT_AVATARS.length],
      bio: 'เด็กเตรียมสอบ WINTER 2026 ✌️',
      joined_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      device_info: detectDevice(),
    };
  },

  updateProfile: async (username: string, updates: { avatar?: string; bio?: string }) => {
    if (!username) return;
    const cleanName = username.trim().toLowerCase();
    const device = detectDevice();
    const now = new Date().toISOString();

    try {
      const current = supabaseSim.getProfile(username);
      const updatedProfile: UserProfile = {
        ...current,
        ...updates,
        username: username.trim(),
        last_active: now,
        device_info: device,
      };

      await setDoc(doc(db, 'profiles', cleanName), updatedProfile);
    } catch (e) {
      console.error("Error updating profile in Firebase", e);
    }
  },

  // --- Friend & Friend Request Methods ---
  getFriends: (username: string): string[] => {
    if (!username) return [];
    const cleanName = username.trim().toLowerCase();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FRIENDS);
      const friendsMap: Record<string, string[]> = raw ? JSON.parse(raw) : {};
      return friendsMap[cleanName] || [];
    } catch {
      return [];
    }
  },

  sendFriendRequest: (fromUsername: string, toUsername: string): { success: boolean; message: string } => {
    if (!fromUsername || !toUsername) return { success: false, message: 'ข้อมูลไม่ถูกต้อง' };
    if (fromUsername.trim().toLowerCase() === toUsername.trim().toLowerCase()) {
      return { success: false, message: 'ไม่สามารถแอดตัวเองเป็นเพื่อนได้' };
    }
    const cleanFrom = fromUsername.trim();
    const cleanTo = toUsername.trim();

    const friends = supabaseSim.getFriends(cleanFrom);
    if (friends.some(f => f.toLowerCase() === cleanTo.toLowerCase())) {
      return { success: false, message: `เป็นเพื่อนกับ ${cleanTo} อยู่แล้ว` };
    }

    try {
      const id = Math.random().toString(36).substring(2, 9);
      const newReq: FriendRequest = {
        id,
        fromUsername: cleanFrom,
        toUsername: cleanTo,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      setDoc(doc(db, 'friendRequests', id), newReq).catch(console.error);

      return { success: true, message: `ส่งคำขอเป็นเพื่อนถึง ${cleanTo} แล้ว!` };
    } catch (e) {
      console.error(e);
      return { success: false, message: 'เกิดข้อผิดพลาดในการส่งคำขอ' };
    }
  },

  getFriendRequests: (username: string): FriendRequest[] => {
    if (!username) return [];
    const cleanName = username.trim().toLowerCase();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FRIEND_REQ);
      const reqs: FriendRequest[] = raw ? JSON.parse(raw) : [];
      return reqs.filter(r => r.toUsername.toLowerCase() === cleanName && r.status === 'pending');
    } catch {
      return [];
    }
  },

  respondFriendRequest: async (requestId: string, accept: boolean) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FRIEND_REQ);
      const reqs: FriendRequest[] = raw ? JSON.parse(raw) : [];
      const req = reqs.find(r => r.id === requestId);
      if (!req) return;

      await setDoc(doc(db, 'friendRequests', requestId), { ...req, status: accept ? 'accepted' : 'rejected' }, { merge: true });

      if (accept) {
        const keyA = req.fromUsername.trim().toLowerCase();
        const keyB = req.toUsername.trim().toLowerCase();

        // Update keyA's friends list
        const docRefA = doc(db, 'friends', keyA);
        const snapA = await getDoc(docRefA);
        const listA = snapA.exists() ? (snapA.data()?.list || []) : [];
        if (!listA.some((f: string) => f.toLowerCase() === keyB)) {
          listA.push(req.toUsername);
          await setDoc(docRefA, { list: listA });
        }

        // Update keyB's friends list
        const docRefB = doc(db, 'friends', keyB);
        const snapB = await getDoc(docRefB);
        const listB = snapB.exists() ? (snapB.data()?.list || []) : [];
        if (!listB.some((f: string) => f.toLowerCase() === keyA)) {
          listB.push(req.fromUsername);
          await setDoc(docRefB, { list: listB });
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  // --- Chat Methods ---
  getChatMessages: (username: string, recipient?: string): ChatMessage[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CHAT);
      const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];

      if (!recipient) {
        return messages.filter(m => m.isGlobal);
      } else {
        const cleanUser = username.trim().toLowerCase();
        const cleanRecip = recipient.trim().toLowerCase();
        return messages.filter(
          m => !m.isGlobal &&
          ((m.sender.toLowerCase() === cleanUser && m.recipient?.toLowerCase() === cleanRecip) ||
           (m.sender.toLowerCase() === cleanRecip && m.recipient?.toLowerCase() === cleanUser))
        );
      }
    } catch {
      return [];
    }
  },

  sendChatMessage: (msg: { sender: string; recipient?: string; text: string; isGlobal: boolean; avatar?: string }): ChatMessage => {
    const id = Math.random().toString(36).substring(2, 9);
    const newMsg: ChatMessage = {
      id,
      sender: msg.sender,
      recipient: msg.recipient || '',
      text: msg.text.trim(),
      timestamp: new Date().toISOString(),
      isGlobal: msg.isGlobal,
      avatar: msg.avatar || supabaseSim.getProfile(msg.sender).avatar,
    };

    try {
      setDoc(doc(db, 'chatMessages', id), newMsg).catch(console.error);
    } catch (e) {
      console.error(e);
    }
    return newMsg;
  }
};
