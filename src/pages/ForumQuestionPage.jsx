import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { T } from '../theme';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { TabBar } from '../components/TabBar';
import { AuthModal } from '../components/AuthModal';
import { Btn } from '../components/Btn';
import {
  useQuestion, useAnswers,
  postAnswer, toggleVoteQuestion, toggleVoteAnswer, acceptAnswer,
} from '../hooks/useForum';

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return `vor ${Math.floor(diff / 86400)} Tagen`;
}

function VoteButton({ count, upvoters, userId, onVote, disabled }) {
  const voted = (upvoters || []).includes(userId);
  return (
    <button
      onClick={onVote}
      disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
        padding: '4px 8px', borderRadius: 8,
        color: voted ? T.green : T.inkMute,
        transition: 'color 0.15s',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>▲</span>
      <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono,monospace', fontWeight: 700 }}>{count ?? 0}</span>
    </button>
  );
}

function AnswerCard({ answer, questionId, questionAuthorId, user, acceptedId }) {
  const isAccepted = answer.accepted;
  const isAuthor = user?.uid === questionAuthorId;

  const handleVote = () => {
    if (!user) return;
    toggleVoteAnswer(user, questionId, answer.id, answer.upvoters);
  };

  const handleAccept = () => {
    if (!isAuthor) return;
    acceptAnswer(questionId, answer.id, isAccepted ? answer.id : acceptedId);
  };

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '16px 0',
      borderTop: `1px solid ${T.border}`,
    }}>
      {/* Vote column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 2 }}>
        <VoteButton
          count={answer.voteCount}
          upvoters={answer.upvoters}
          userId={user?.uid}
          onVote={handleVote}
          disabled={!user}
        />
        {isAccepted && (
          <div title="Beste Antwort" style={{ fontSize: 20, color: T.good, lineHeight: 1 }}>✓</div>
        )}
        {isAuthor && !isAccepted && (
          <button
            onClick={handleAccept}
            title="Als beste Antwort markieren"
            style={{
              background: 'none', border: `1px solid ${T.border}`, borderRadius: 6,
              cursor: 'pointer', color: T.inkMute, fontSize: 16, lineHeight: 1,
              padding: '3px 6px', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.good; e.currentTarget.style.color = T.good; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkMute; }}
          >✓</button>
        )}
        {isAuthor && isAccepted && (
          <button
            onClick={handleAccept}
            title="Akzeptierung aufheben"
            style={{
              background: T.good, border: 'none', borderRadius: 6,
              cursor: 'pointer', color: '#fff', fontSize: 16, lineHeight: 1,
              padding: '3px 6px',
            }}
          >✓</button>
        )}
      </div>

      {/* Answer body */}
      <div style={{
        flex: 1, minWidth: 0,
        background: isAccepted ? 'rgba(107,142,78,0.06)' : 'transparent',
        borderRadius: isAccepted ? 10 : 0,
        padding: isAccepted ? '10px 12px' : 0,
        border: isAccepted ? `1px solid rgba(107,142,78,0.2)` : 'none',
      }}>
        <p style={{ margin: '0 0 10px', color: T.ink, fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {answer.body}
        </p>
        <div style={{ fontSize: 12, color: T.inkMute, fontFamily: 'JetBrains Mono,monospace' }}>
          {answer.authorName} · {timeAgo(answer.createdAt)}
        </div>
      </div>
    </div>
  );
}

export default function ForumQuestionPage() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useBreakpoint();

  const { question, loading: qLoading } = useQuestion(questionId);
  const { answers, loading: aLoading } = useAnswers(questionId);

  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [showAuth, setShowAuth] = useState(false);

  const acceptedId = answers.find(a => a.accepted)?.id;

  const sortedAnswers = [...answers].sort((a, b) => {
    if (a.accepted && !b.accepted) return -1;
    if (!a.accepted && b.accepted) return 1;
    return (b.voteCount ?? 0) - (a.voteCount ?? 0);
  });

  const handleVoteQuestion = () => {
    if (!user) return setShowAuth(true);
    toggleVoteQuestion(user, questionId, question.upvoters);
  };

  const handleSubmitAnswer = async () => {
    if (!user) return setShowAuth(true);
    if (replyBody.trim().length < 10) return setReplyError('Antwort muss mindestens 10 Zeichen lang sein.');
    setReplyError('');
    setSending(true);
    try {
      await postAnswer(user, questionId, replyBody.trim());
      setReplyBody('');
    } catch {
      setReplyError('Fehler beim Senden. Bitte versuche es erneut.');
    }
    setSending(false);
  };

  const containerStyle = {
    minHeight: '100vh', background: T.bg,
    padding: isMobile ? '16px 16px 100px' : '32px 40px 60px',
    maxWidth: isMobile ? undefined : 760, margin: isMobile ? undefined : '0 auto',
  };

  if (!db) {
    return (
      <div style={containerStyle}>
        <p style={{ color: T.inkDim }}>Firebase ist nicht konfiguriert. Das Forum ist nicht verfügbar.</p>
        {isMobile && <TabBar active="forum" />}
      </div>
    );
  }

  if (user === null) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
          <h2 style={{ fontFamily: 'Fraunces,serif', fontSize: 24, color: T.ink, marginBottom: 10 }}>Anmeldung erforderlich</h2>
          <p style={{ color: T.inkDim, marginBottom: 24 }}>Melde dich an, um Fragen und Antworten zu lesen.</p>
          <Btn variant="primary" onClick={() => setShowAuth(true)}>Anmelden / Registrieren</Btn>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        {isMobile && <TabBar active="forum" />}
      </div>
    );
  }

  if (qLoading) {
    return (
      <div style={containerStyle}>
        <div style={{ color: T.inkMute, padding: 40, textAlign: 'center' }}>Lädt…</div>
        {isMobile && <TabBar active="forum" />}
      </div>
    );
  }

  if (!question) {
    return (
      <div style={containerStyle}>
        <div style={{ color: T.inkDim, padding: 40, textAlign: 'center' }}>Frage nicht gefunden.</div>
        <Btn onClick={() => navigate('/forum')}>← Zurück zum Forum</Btn>
        {isMobile && <TabBar active="forum" />}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Back link */}
      <button
        onClick={() => navigate('/forum')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.green, fontSize: 13, fontWeight: 600, marginBottom: 20,
          padding: 0, display: 'flex', alignItems: 'center', gap: 4,
        }}
      >← Forum</button>

      {/* Question */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
        <div style={{ paddingTop: 4 }}>
          <VoteButton
            count={question.voteCount}
            upvoters={question.upvoters}
            userId={user?.uid}
            onVote={handleVoteQuestion}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontFamily: 'Fraunces,serif', fontSize: isMobile ? 22 : 28,
            color: T.ink, margin: '0 0 8px', lineHeight: 1.25,
          }}>{question.title}</h1>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {(question.tags || []).map(tag => (
              <span key={tag} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(62,92,48,0.08)', color: T.green,
                fontFamily: 'JetBrains Mono,monospace', fontWeight: 600,
              }}>{tag}</span>
            ))}
          </div>

          <p style={{ color: T.ink, fontSize: 15, lineHeight: 1.7, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
            {question.body}
          </p>

          <div style={{ fontSize: 12, color: T.inkMute, fontFamily: 'JetBrains Mono,monospace' }}>
            {question.authorName} · {timeAgo(question.createdAt)}
          </div>
        </div>
      </div>

      {/* Answers heading */}
      <div style={{
        fontFamily: 'Fraunces,serif', fontSize: 18, color: T.ink,
        paddingBottom: 8, borderBottom: `2px solid ${T.border}`, marginBottom: 4,
      }}>
        {answers.length === 0 ? 'Noch keine Antworten' : `${answers.length} ${answers.length === 1 ? 'Antwort' : 'Antworten'}`}
      </div>

      {/* Answers list */}
      {!aLoading && sortedAnswers.map(answer => (
        <AnswerCard
          key={answer.id}
          answer={answer}
          questionId={questionId}
          questionAuthorId={question.authorId}
          user={user}
          acceptedId={acceptedId}
        />
      ))}

      {/* Reply form */}
      <div style={{
        marginTop: 32, background: T.panel, borderRadius: 14,
        border: `1px solid ${T.border}`, padding: '20px',
      }}>
        <h3 style={{ fontFamily: 'Fraunces,serif', fontSize: 18, color: T.ink, margin: '0 0 14px' }}>
          Deine Antwort
        </h3>
        <textarea
          value={replyBody}
          onChange={e => setReplyBody(e.target.value)}
          placeholder="Schreibe eine hilfreiche Antwort …"
          rows={5}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${T.borderHi}`, background: T.paper,
            fontSize: 14, color: T.ink, outline: 'none', resize: 'vertical',
            boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit',
          }}
        />
        {replyError && (
          <div style={{
            background: 'rgba(201,84,58,0.08)', border: `1px solid rgba(201,84,58,0.2)`,
            borderRadius: 8, padding: '8px 12px', marginBottom: 10,
            fontSize: 13, color: T.bad,
          }}>{replyError}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="primary" onClick={handleSubmitAnswer} disabled={sending}>
            {sending ? 'Wird gesendet…' : 'Antworten'}
          </Btn>
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {isMobile && <TabBar active="forum" />}
    </div>
  );
}
