import { useState } from 'react'
import { Noragon } from './components/Noragon'
import './App.css'

const CONTROLS: [string[], string][] = [
  [['↑', '↓', '←', '→', 'W', 'A', 'S', 'D'], 'Move the hero'],
  [['(bump)'], 'Strike an adjacent foe in melee'],
  [['F'], 'Take aim (Tab / arrows switch targets)'],
  [['Enter'], 'Loose an arrow at the target'],
  [['F', 'Esc'], 'Cancel aiming'],
  [['Q'], 'Quaff a health potion'],
  [['E'], 'Disarm an adjacent trap (✕)'],
  [['>', 'Enter'], 'Descend the stairs (while on them)'],
  [['(bump ⚖)'], 'Open the merchant’s shop'],
  [['Esc'], 'Leave the shop'],
]

export default function App() {
  const [parchment, setParchment] = useState(false)
  const [showControls, setShowControls] = useState(false)

  const intro = (
    <p className="demo__lede">
      A turn-based, procedurally generated dungeon crawl. Move the hero{' '}
      <span className="demo__hero">☻</span> with the arrow keys (or <kbd>W</kbd> <kbd>A</kbd>{' '}
      <kbd>S</kbd> <kbd>D</kbd>). Bump a foe to strike it in melee, or press <kbd>F</kbd> to take
      aim and loose an arrow. Fight past the bats <span className="demo__bat">𝕓</span> and goblins{' '}
      <span className="demo__goblin">𝕘</span>, grab the chest <span className="demo__chest">▣</span>{' '}
      for treasure, and take the stairs <span className="demo__stairs">&gt;</span> ever deeper —
      leveling up as you go, until you fall.
    </p>
  )

  return (
    <main className="demo">
      <div className="demo__toolbar">
        <button
          type="button"
          className="demo__btn"
          onClick={() => setShowControls(true)}
          aria-haspopup="dialog"
        >
          ⌨ Controls
        </button>
        <button
          type="button"
          className="demo__btn"
          onClick={() => setParchment((p) => !p)}
          aria-pressed={parchment}
        >
          {parchment ? '◑ Dark theme' : '◐ Parchment theme'}
        </button>
      </div>

      {showControls && (
        <div className="demo__modal-backdrop" onClick={() => setShowControls(false)}>
          <div
            className="demo__modal"
            role="dialog"
            aria-modal="true"
            aria-label="Controls"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="demo__modal-title">Controls</h2>
            <dl className="demo__controls">
              {CONTROLS.map(([keys, desc]) => (
                <div key={desc} className="demo__controls-row">
                  <dt className="demo__controls-keys">
                    {keys.map((k) =>
                      k.startsWith('(') ? (
                        <span key={k} className="demo__controls-note">
                          {k}
                        </span>
                      ) : (
                        <kbd key={k}>{k}</kbd>
                      ),
                    )}
                  </dt>
                  <dd className="demo__controls-desc">{desc}</dd>
                </div>
              ))}
            </dl>
            <button type="button" className="demo__btn" onClick={() => setShowControls(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      <header className="demo__intro">
        <h1 className="demo__title">Legends of Noragon ⚔️</h1>
        <span className="demo__credit">
          An embeddable React component. Drop <code>&lt;Noragon /&gt;</code> anywhere.
        </span>
      </header>

      <Noragon
        intro={intro}
        title={null}
        className={parchment ? 'noragon--parchment' : undefined}
      />
    </main>
  )
}
