import { Noragon } from './components/Noragon'
import './App.css'

export default function App() {
  return (
    <main className="demo">
      <header className="demo__intro">
        <h1 className="demo__title">Legends of Noragon ⚔️</h1>
        <p className="demo__lede">
          A turn-based top-down dungeon crawl. Move the hero <span className="demo__hero">☻</span>{' '}
          with the arrow keys (or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>). Bump a bat{' '}
          <span className="demo__bat">𝕓</span> to slay it, clear the middle room, and step onto the
          chest <span className="demo__chest">▣</span> to complete the level.
        </p>
      </header>

      <Noragon />

      <p className="demo__credit">
        An embeddable React component. Drop <code>&lt;Noragon /&gt;</code> anywhere.
      </p>
    </main>
  )
}
