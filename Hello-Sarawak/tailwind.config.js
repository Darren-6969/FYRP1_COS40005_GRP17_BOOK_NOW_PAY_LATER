/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
      "./src/Pages/cams_owner/Modules/Finances/**/*.css",
      "./src/Pages/administrator/Modules/Booklog/**/*.css"
    ],
    theme: {
      extend: {},
    },
    plugins: [],
    corePlugins: {
      preflight: false,
    },
  }
  
  