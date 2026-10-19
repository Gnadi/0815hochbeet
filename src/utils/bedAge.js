// Befüllungsjahr — the rule every raised bed lives by.
//
// A freshly layered Hochbeet releases a lot of nitrogen as its lower layers
// rot. Year 1 and 2 belong to the Starkzehrer (Paradeiser, Kürbis, Kohl);
// Schwachzehrer like Salat and Spinat would store the surplus as nitrate.
// From year 3 the nutrients are spent, Starkzehrer stay small, and the bed
// wants Mittel- and Schwachzehrer. After that the top layer is topped up with
// compost and the cycle starts over.

import { FEEDERS } from '../data/plantDetails.js';

export function bedAge(bed, year = new Date().getFullYear()) {
  const filled = Number(bed?.filledYear);
  // Before it was filled the bed did not exist (in this form) — no age.
  if (!filled || year < filled) return null;
  return year - filled + 1;
}

/** Which feeder classes suit a bed of this age, and what to tell the gardener. */
export function ageAdvice(age) {
  if (!age) return null;
  if (age <= 2) {
    return {
      age, phase: 'rich', ideal: ['heavy', 'medium'], avoid: ['light'],
      title: `${age}. Jahr nach dem Befüllen — Starkzehrer-Zeit`,
      text: 'Die frische Füllung gibt viel Stickstoff ab. Paradeiser, Kürbis, Zucchini, Kohl und Sellerie nutzen das am besten. Blattsalate und Spinat würden jetzt Nitrat einlagern.',
    };
  }
  if (age === 3) {
    return {
      age, phase: 'lean', ideal: ['medium', 'light', 'fixer'], avoid: ['heavy'],
      title: '3. Jahr — Mittel- und Schwachzehrer',
      text: 'Die Nährstoffe sind weitgehend verbraucht. Karotten, Zwiebeln, Salat, Kräuter und Hülsenfrüchte passen jetzt; Starkzehrer bleiben klein.',
    };
  }
  return {
    age, phase: 'refill', ideal: ['light', 'fixer'], avoid: ['heavy'],
    refill: true,
    title: `${age}. Jahr — Zeit zum Auffüllen`,
    text: 'Das Beet ist ausgezehrt und abgesackt. Im Frühjahr oder Herbst die oberen 20–30 cm mit reifem Kompost und Erde auffüllen — danach beginnt der Zyklus wieder mit Starkzehrern.',
  };
}

/** Plants that do not suit the bed's age, with the reason. */
export function feederMismatches(plants, age) {
  const advice = ageAdvice(age);
  if (!advice) return [];
  return plants
    .filter(p => advice.avoid.includes(p.feeder))
    .map(p => ({
      plant: p,
      reason: advice.phase === 'rich'
        ? `${FEEDERS[p.feeder].de} im ${age}. Jahr: Die frische Füllung ist zu nährstoffreich.`
        : `${FEEDERS[p.feeder].de} im ${age}. Jahr: Das Beet hat dafür zu wenig Nährstoffe${advice.refill ? ' — vorher auffüllen' : ''}.`,
    }));
}

/** Bonus the plan generator gives plants that suit the bed's age. */
export function ageScore(plant, age) {
  const advice = ageAdvice(age);
  if (!advice) return 0;
  if (advice.ideal[0] === plant.feeder) return 2;
  if (advice.ideal.includes(plant.feeder)) return 1;
  if (advice.avoid.includes(plant.feeder)) return -2;
  return 0;
}
