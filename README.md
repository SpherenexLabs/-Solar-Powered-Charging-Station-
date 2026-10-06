# React + Vite

## Deployment

This project is ready for Vercel deployment. Do not commit the local `.env`
file. Configure these variables in **Vercel → Project Settings → Environment
Variables** instead:

```text
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
VITE_USE_GOOGLE_PLACES=false
```

Apply them to Production, Preview, and Development, then redeploy the project.
For the Google Maps browser key, allow these website referrers:

```text
http://localhost:5173/*
https://solar-powered-charging-station.vercel.app/*
```

The `vercel.json` rewrite keeps React Router URLs such as `/stations` working
when opened or refreshed directly.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
