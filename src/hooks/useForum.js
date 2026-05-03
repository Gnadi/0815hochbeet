import { useState, useEffect } from 'react';
import {
  collection, doc, addDoc, onSnapshot, runTransaction,
  updateDoc, query, orderBy, serverTimestamp, increment,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';

export function useQuestions(tagFilter) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(collection(db, 'forum'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (tagFilter) docs = docs.filter(q => q.tags?.includes(tagFilter));
      setQuestions(docs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [tagFilter]);

  return { questions, loading };
}

export function useQuestion(questionId) {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !questionId) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, 'forum', questionId), snap => {
      setQuestion(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [questionId]);

  return { question, loading };
}

export function useAnswers(questionId) {
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !questionId) { setLoading(false); return; }
    const q = query(
      collection(db, 'forum', questionId, 'answers'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setAnswers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [questionId]);

  return { answers, loading };
}

export async function postQuestion(user, { title, body, tags }) {
  if (!db) throw new Error('Firebase nicht konfiguriert');
  const ref = await addDoc(collection(db, 'forum'), {
    title,
    body,
    tags,
    authorId: user.uid,
    authorName: user.displayName || user.email,
    voteCount: 0,
    upvoters: [],
    answersCount: 0,
    hasAccepted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function postAnswer(user, questionId, body) {
  if (!db) throw new Error('Firebase nicht konfiguriert');
  await addDoc(collection(db, 'forum', questionId, 'answers'), {
    body,
    authorId: user.uid,
    authorName: user.displayName || user.email,
    voteCount: 0,
    upvoters: [],
    accepted: false,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'forum', questionId), {
    answersCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}

export async function toggleVoteQuestion(user, questionId, upvoters) {
  if (!db) return;
  const ref = doc(db, 'forum', questionId);
  const hasVoted = (upvoters || []).includes(user.uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const data = snap.data();
    tx.update(ref, {
      upvoters: hasVoted ? arrayRemove(user.uid) : arrayUnion(user.uid),
      voteCount: (data.voteCount ?? 0) + (hasVoted ? -1 : 1),
    });
  });
}

export async function toggleVoteAnswer(user, questionId, answerId, upvoters) {
  if (!db) return;
  const ref = doc(db, 'forum', questionId, 'answers', answerId);
  const hasVoted = (upvoters || []).includes(user.uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const data = snap.data();
    tx.update(ref, {
      upvoters: hasVoted ? arrayRemove(user.uid) : arrayUnion(user.uid),
      voteCount: (data.voteCount ?? 0) + (hasVoted ? -1 : 1),
    });
  });
}

export async function acceptAnswer(questionId, answerId, prevAcceptedId) {
  if (!db) return;
  if (prevAcceptedId && prevAcceptedId !== answerId) {
    await updateDoc(doc(db, 'forum', questionId, 'answers', prevAcceptedId), { accepted: false });
  }
  const isTogglingOff = prevAcceptedId === answerId;
  await updateDoc(doc(db, 'forum', questionId, 'answers', answerId), {
    accepted: !isTogglingOff,
  });
  await updateDoc(doc(db, 'forum', questionId), {
    hasAccepted: !isTogglingOff,
    updatedAt: serverTimestamp(),
  });
}
