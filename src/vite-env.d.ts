// Ambient declarations for side-effect asset imports. Vite resolves these at
// build time, but TypeScript needs a module declaration so statements like
// `import './App.css'` typecheck (newer TS errors on undeclared side-effect
// imports). Scoped to the styles this project actually imports.
declare module '*.css' {
  const content: string
  export default content
}
