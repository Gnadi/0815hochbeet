import { useState } from 'react';
import { T } from '../theme';
import { PLANTS, SEASONS, pairScore, companionReason, plantById } from '../data/plants';
import { PlantTile } from '../components/PlantTile';
import { TabBar } from '../components/TabBar';

const MONO = { fontFamily: 'JetBrains Mono,monospace' };

function sunLabel(s) {
  return s === 'full' ? '☀ Sonne' : s === 'part' ? '⛅ Halb' : '☁ Schatten';
}
function waterLabel(w) {
  return w === 'high' ? '💧💧 Viel' : w === 'med' ? '💧 Mittel' : '○ Wenig';
}

function PlantCard({ plant }) {
  const [open, setOpen] = useState(false);

  const goodNeighbors = PLANTS.filter(o => o.id !== plant.id && pairScore(plant.id, o.id) === 1);
  const badNeighbors  = PLANTS.filter(o => o.id !== plant.id && pairScore(plant.id, o.id) === -1);

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 18,
        padding: 16,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <PlantTile plant={plant} size={52} showLabel={false} draggable={false} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontFamily: 'Fraunces,serif', fontSize: 18, fontWeight: 500, color: T.ink }}>{plant.de}</div>
            <div style={{ fontSize: 16, color: T.inkMute, marginLeft: 8, flexShrink: 0 }}>{open ? '▲' : '▼'}</div>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ ...MONO, fontSize: 10, color: T.inkDim }}>{sunLabel(plant.sun)}</span>
            <span style={{ ...MONO, fontSize: 10, color: T.inkDim }}>{waterLabel(plant.water)}</span>
            {plant.yield > 0 && (
              <span style={{ ...MONO, fontSize: 10, color: T.greenLi }}>~{plant.yield} kg</span>
            )}
          </div>

          {/* Season badges */}
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {SEASONS.filter(s => plant.seasons.includes(s.id)).map(s => (
              <span key={s.id} style={{
                ...MONO,
                fontSize: 9,
                padding: '2px 7px',
                borderRadius: 999,
                background: `oklch(0.85 0.07 ${s.hue})`,
                color: `oklch(0.35 0.09 ${s.hue})`,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}>{s.de.toUpperCase()}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Description (always visible) */}
      <p style={{ margin: '12px 0 0', fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>
        {plant.description}
      </p>

      {/* Expanded content */}
      {open && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>

          {/* Care notes */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.inkMute, marginBottom: 6 }}>
              Pflege
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>{plant.careNotes}</p>
          </div>

          {/* Harvest & spacing */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {plant.harvestWeeks > 0 && (
              <span style={{ ...MONO, fontSize: 10, padding: '3px 9px', borderRadius: 999, background: T.bg, border: `1px solid ${T.border}`, color: T.inkDim }}>
                ⏱ {plant.harvestWeeks} Wochen bis Ernte
              </span>
            )}
            {plant.sowDepth > 0 && (
              <span style={{ ...MONO, fontSize: 10, padding: '3px 9px', borderRadius: 999, background: T.bg, border: `1px solid ${T.border}`, color: T.inkDim }}>
                ↓ {plant.sowDepth} cm Saattiefe
              </span>
            )}
            <span style={{ ...MONO, fontSize: 10, padding: '3px 9px', borderRadius: 999, background: T.bg, border: `1px solid ${T.border}`, color: T.inkDim }}>
              ↔ {plant.spacing_cm} cm Abstand
            </span>
          </div>

          {/* Good neighbors */}
          {goodNeighbors.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ ...MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.good, marginBottom: 6 }}>
                ✓ Gute Nachbarn
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {goodNeighbors.map(o => {
                  const reason = companionReason(plant.id, o.id);
                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12, fontWeight: 600, color: T.good,
                        background: 'rgba(107,142,78,0.10)', borderRadius: 999,
                        padding: '2px 9px', flexShrink: 0,
                      }}>
                        <span style={{ fontFamily: 'Fraunces,serif', fontStyle: 'italic' }}>{o.glyph}</span>
                        {o.de}
                      </span>
                      {reason && (
                        <span style={{ fontSize: 11, color: T.inkDim, lineHeight: 1.4, paddingTop: 2 }}>{reason}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bad neighbors */}
          {badNeighbors.length > 0 && (
            <div>
              <div style={{ ...MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.bad, marginBottom: 6 }}>
                ✗ Nicht neben
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {badNeighbors.map(o => {
                  const reason = companionReason(plant.id, o.id);
                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12, fontWeight: 600, color: T.bad,
                        background: 'rgba(201,84,58,0.10)', borderRadius: 999,
                        padding: '2px 9px', flexShrink: 0,
                      }}>
                        <span style={{ fontFamily: 'Fraunces,serif', fontStyle: 'italic' }}>{o.glyph}</span>
                        {o.de}
                      </span>
                      {reason && (
                        <span style={{ fontSize: 11, color: T.inkDim, lineHeight: 1.4, paddingTop: 2 }}>{reason}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlantsPage() {
  const [activeSeason, setActiveSeason] = useState('all');

  const filtered = activeSeason === 'all'
    ? PLANTS
    : PLANTS.filter(p => p.seasons.includes(activeSeason));

  return (
    <div style={{ minHeight: '100vh', background: T.bg, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ ...MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.inkMute }}>
          Pflanzenlexikon
        </div>
        <h1 style={{ fontFamily: 'Fraunces,serif', fontSize: 28, margin: '4px 0 0', fontWeight: 500 }}>
          <em style={{ color: T.green, fontStyle: 'italic' }}>Pflanzen</em>
        </h1>
        <p style={{ fontSize: 13, color: T.inkDim, margin: '6px 0 0', lineHeight: 1.5 }}>
          Alle {PLANTS.length} Pflanzen im Planer — Tipps, Pflege & Mischkultur.
        </p>
      </div>

      {/* Season filter pills */}
      <div style={{ padding: '16px 16px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
        <button
          onClick={() => setActiveSeason('all')}
          style={{
            padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
            background: activeSeason === 'all' ? T.green : T.panel,
            color: activeSeason === 'all' ? '#fff' : T.ink,
            border: `1px solid ${activeSeason === 'all' ? 'transparent' : T.border}`,
          }}
        >
          Alle ({PLANTS.length})
        </button>
        {SEASONS.map(s => {
          const count = PLANTS.filter(p => p.seasons.includes(s.id)).length;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSeason(s.id)}
              style={{
                padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
                background: activeSeason === s.id ? T.green : T.panel,
                color: activeSeason === s.id ? '#fff' : T.ink,
                border: `1px solid ${activeSeason === s.id ? 'transparent' : T.border}`,
              }}
            >
              {s.glyph} {s.de} ({count})
            </button>
          );
        })}
      </div>

      {/* Plant cards */}
      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(plant => (
          <PlantCard key={plant.id} plant={plant} />
        ))}
      </div>

      <TabBar active="plants" />
    </div>
  );
}
