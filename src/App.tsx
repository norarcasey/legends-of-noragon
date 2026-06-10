import { useState } from 'react'
import { Noragon } from './components/Noragon'
import './App.css'

export default function App() {
  const [parchment, setParchment] = useState(false)

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
      <button
        type="button"
        className="demo__theme"
        onClick={() => setParchment((p) => !p)}
        aria-pressed={parchment}
      >
        {parchment ? '◑ Dark theme' : '◐ Parchment theme'}
      </button>

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
