import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../theme';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { TabBar } from '../components/TabBar';
import { AuthModal } from '../components/AuthModal';
import { useQuestions, postQuestion } from '../hooks/useForum';
import { Btn } from '../components/Btn';

const TAGS = [
  'Hochbeet-Bau', 'Pflanzenpflege', 'Schädlinge', 'Erntezeit',
  'Saatgut', 'Bewässerung', 'Kompost', 'Winterschutz', 'Allgemein',
];

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return `vor ${Math.floor(diff / 86400)} Tagen`;
}

function QuestionCard({ q, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s',
        display: 'flex', gap: 14,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px -4px rgba(31,42,27,0.13)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Vote / answers column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 44 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.green, fontFamily: 'JetBrains Mono,monospace' }}>
            {q.voteCount ?? 0}
          </div>
          <div style={{ fontSize: 10, color: T.inkMute, fontFamily: 'JetBrains Mono,monospace' }}>Votes</div>
        </div>
        <div style={{
          textAlign: 'center',
          background: q.hasAccepted ? T.good : 'transparent',
          border: `1px solid ${q.hasAccepted ? T.good : T.border}`,
          borderRadius: 8, padding: '2px 6px',
        }}>
          <div style={{
            fontSize: 15, fontWeight: 700,
            fontFamily: 'JetBrains Mono,monospace',
            color: q.hasAccepted ? '#fff' : T.inkDim,
          }}>
            {q.answersCount ?? 0}
          </div>
          <div style={{ fontSize: 9, color: q.hasAccepted ? '#fff' : T.inkMute, fontFamily: 'JetBrains Mono,monospace' }}>
            {q.hasAccepted ? '✓' : 'Antw.'}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Fraunces,serif', fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 4, lineHeight: 1.3 }}>
          {q.title}
        </div>
        <div style={{ fontSize: 13, color: T.inkDim, marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {q.body}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(q.tags || []).map(tag => (
            <span key={tag} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(62,92,48,0.08)', color: T.green,
              fontFamily: 'JetBrains Mono,monospace', fontWeight: 600,
            }}>{tag}</span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: T.inkMute, fontFamily: 'JetBrains Mono,monospace', whiteSpace: 'nowrap' }}>
            {q.authorName} · {timeAgo(q.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function NewQuestionModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = tag => setSelectedTags(prev =>
    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
  );

  const handleSubmit = async () => {
    if (!title.trim()) return setError('Bitte gib einen Titel ein.');
    if (body.trim().length < 20) return setError('Die Beschreibung muss mindestens 20 Zeichen lang sein.');
    if (!selectedTags.length) return setError('Bitte wähle mindestens ein Thema aus.');
    setError('');
    setLoading(true);
    try {
      await onSubmit({ title: title.trim(), body: body.trim(), tags: selectedTags });
    } catch (e) {
      setError('Fehler beim Erstellen. Bitte versuche es erneut.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(31,42,27,0.45)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 50, padding: 16,
    }}>
      <div style={{
        background: T.paper, borderRadius: 20, padding: 28, width: '100%',
        maxWidth: 560, boxShadow: '0 20px 60px -12px rgba(31,42,27,0.3)',
        border: `1px solid ${T.border}`, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Fraunces,serif', fontSize: 22, color: T.ink, margin: 0 }}>Neue Frage stellen</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: T.inkMute }}>✕</button>
        </div>

        <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: T.inkDim }}>Titel</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="z.B. Welche Pflanzen passen gut zu Tomaten?"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${T.borderHi}`, background: T.panel,
            fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box', marginBottom: 14,
          }}
        />

        <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: T.inkDim }}>Beschreibung</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Beschreibe deine Frage möglichst ausführlich …"
          rows={5}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${T.borderHi}`, background: T.panel,
            fontSize: 14, color: T.ink, outline: 'none', resize: 'vertical',
            boxSizing: 'border-box', marginBottom: 14, fontFamily: 'inherit',
          }}
        />

        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: T.inkDim }}>Themen</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                fontFamily: 'JetBrains Mono,monospace', fontWeight: 600,
                border: `1px solid ${selectedTags.includes(tag) ? T.green : T.border}`,
                background: selectedTags.includes(tag) ? 'rgba(62,92,48,0.12)' : 'transparent',
                color: selectedTags.includes(tag) ? T.green : T.inkDim,
                transition: 'all 0.15s',
              }}
            >{tag}</button>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(201,84,58,0.08)', border: `1px solid rgba(201,84,58,0.2)`, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: T.bad }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn onClick={onClose} disabled={loading}>Abbrechen</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Wird gesendet…' : 'Frage stellen'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default function ForumPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useBreakpoint();
  const [activeTag, setActiveTag] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const { questions, loading } = useQuestions(activeTag);

  const filtered = questions.filter(q => {
    if (statusFilter === 'open') return !q.hasAccepted;
    if (statusFilter === 'answered') return q.hasAccepted;
    return true;
  });

  const handleSubmitQuestion = async (data) => {
    const id = await postQuestion(user, data);
    setShowNewModal(false);
    navigate(`/forum/question/${id}`);
  };

  const containerStyle = {
    minHeight: '100vh', background: T.bg, padding: isMobile ? '16px 16px 100px' : '32px 32px 40px',
    maxWidth: isMobile ? undefined : 900, margin: isMobile ? undefined : '0 auto',
  };

  if (!db && user) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: T.inkDim }}>
          Firebase ist nicht konfiguriert. Das Forum ist nicht verfügbar.
        </div>
        {isMobile && <TabBar active="forum" />}
      </div>
    );
  }

  if (user === null) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
          <h2 style={{ fontFamily: 'Fraunces,serif', fontSize: 26, color: T.ink, marginBottom: 10 }}>Garten-Forum</h2>
          <p style={{ color: T.inkDim, marginBottom: 24, maxWidth: 340, margin: '0 auto 24px' }}>
            Melde dich an, um Fragen zu stellen, Antworten zu lesen und dich mit anderen Gartenfreunden auszutauschen.
          </p>
          <Btn variant="primary" onClick={() => setShowAuth(true)}>Anmelden / Registrieren</Btn>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        {isMobile && <TabBar active="forum" />}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Fraunces,serif', fontSize: isMobile ? 26 : 32, color: T.ink, margin: 0, lineHeight: 1.1 }}>Garten-Forum</h1>
          <p style={{ color: T.inkDim, margin: '4px 0 0', fontSize: 14 }}>Fragen & Antworten für Hochbeet-Freunde</p>
        </div>
        <Btn variant="terra" onClick={() => setShowNewModal(true)}>+ Neue Frage</Btn>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['all','Alle'],['open','Offen'],['answered','Beantwortet']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: `1px solid ${statusFilter === val ? T.green : T.border}`,
              background: statusFilter === val ? 'rgba(62,92,48,0.1)' : 'transparent',
              color: statusFilter === val ? T.green : T.inkDim, fontWeight: 600,
            }}
          >{label}</button>
        ))}
      </div>

      {/* Tag filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTag(null)}
          style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
            border: `1px solid ${activeTag === null ? T.green : T.border}`,
            background: activeTag === null ? 'rgba(62,92,48,0.1)' : 'transparent',
            color: activeTag === null ? T.green : T.inkMute,
            fontFamily: 'JetBrains Mono,monospace', fontWeight: 600,
          }}
        >Alle Themen</button>
        {TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${activeTag === tag ? T.green : T.border}`,
              background: activeTag === tag ? 'rgba(62,92,48,0.1)' : 'transparent',
              color: activeTag === tag ? T.green : T.inkMute,
              fontFamily: 'JetBrains Mono,monospace', fontWeight: 600,
            }}
          >{tag}</button>
        ))}
      </div>

      {/* Question list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.inkMute }}>Lädt…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
          <div style={{ color: T.inkDim, marginBottom: 16 }}>
            {questions.length === 0
              ? 'Noch keine Fragen – sei der Erste!'
              : 'Keine Fragen für diesen Filter.'}
          </div>
          <Btn variant="primary" onClick={() => setShowNewModal(true)}>Erste Frage stellen</Btn>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(q => (
            <QuestionCard
              key={q.id}
              q={q}
              onClick={() => navigate(`/forum/question/${q.id}`)}
            />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewQuestionModal
          onClose={() => setShowNewModal(false)}
          onSubmit={handleSubmitQuestion}
        />
      )}

      {isMobile && <TabBar active="forum" />}
    </div>
  );
}
