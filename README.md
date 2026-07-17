# Master Template Generator

Master Template turns structured business documents into polished, on-brand presentations. The current version establishes the production application shell and design-system foundation only; generation, presentation editing, and export are intentionally not implemented yet.

## Stack

- React + TypeScript
- Vite
- Tailwind CSS v4
- Framer Motion

## Project structure

- `src/app` — application composition and shell
- `src/components` — reusable, presentation-agnostic UI components
- `src/features` — future bounded product workflows
- `src/domain` — future canonical business concepts
- `src/theme` — token-backed visual foundations
- `src/hooks` — shared React hooks
- `src/lib` — framework-independent utilities
- `src/styles` — global CSS entry points and base styles

## Commands

```sh
npm install
npm run dev
npm run build
```

## Design-system principle

Application UI must use semantic theme tokens and Tailwind utilities mapped to them. Product features must not introduce hardcoded presentation styling; business data and rendering decisions remain separate.
