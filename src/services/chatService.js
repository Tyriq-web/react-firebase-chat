
import {
  collection,
  doc,
  getDocs,
  getDoc,
  runTransaction,
  serverTimestamp,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

import { db } from "../firebase/config";

// Get all registered users except the currently signed-in user.
export async function getUsers(currentUserId) {
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);

  return snapshot.docs
    .map((userDoc) => ({
      id: userDoc.id,
      ...userDoc.data(),
    }))
    .filter((user) => user.id !== currentUserId)
    .sort((a, b) =>
      (a.displayName || "").localeCompare(b.displayName || "")
    );
}

// Create or open one consistent conversation for two users.
export async function getOrCreateConversation(currentUserId, otherUserId) {
  if (!currentUserId || !otherUserId || currentUserId === otherUserId) {
    throw new Error("Choose another registered user to start a chat.");
  }

  const participants = [currentUserId, otherUserId].sort();
  const conversationId = `${participants[0]}_${participants[1]}`;
  const conversationRef = doc(db, "conversations", conversationId);

  await runTransaction(db, async (transaction) => {
    const conversationSnap = await transaction.get(conversationRef);

    if (!conversationSnap.exists()) {
      transaction.set(conversationRef, {
        participants,
        lastMessage: "",
        updatedAt: serverTimestamp(),
      });
    }
  });

  const conversationSnap = await getDoc(conversationRef);

  if (!conversationSnap.exists()) {
    throw new Error("Could not open the conversation. Please try again.");
  }

  return {
    id: conversationSnap.id,
    ...conversationSnap.data(),
  };
}

// Listen for messages and keep them ordered by creation time.
export function listenToMessages(conversationId, callback, onError) {
  const messagesRef = collection(
    db,
    "conversations",
    conversationId,
    "messages"
  );

  const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc"),
    limit(200)
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((messageDoc) => ({
          id: messageDoc.id,
          ...messageDoc.data(),
        }))
      );
    },
    onError
  );
}

// Send a message and update the conversation preview.
export async function sendMessage(conversationId, senderId, text) {
  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error("Message cannot be empty.");
  }

  if (cleanText.length > 2000) {
    throw new Error("Messages must be 2,000 characters or fewer.");
  }

  const conversationRef = doc(db, "conversations", conversationId);
  const messagesRef = collection(
    db,
    "conversations",
    conversationId,
    "messages"
  );

  await addDoc(messagesRef, {
    senderId,
    text: cleanText,
    createdAt: serverTimestamp(),
  });

  const { updateDoc } = await import("firebase/firestore");

  await updateDoc(conversationRef, {
    lastMessage: cleanText,
    updatedAt: serverTimestamp(),
  });
}
