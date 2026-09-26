import { fileURLToPath } from 'node:url';

// Resolve relative to this file so the build works regardless of the cwd.
const config = fileURLToPath(new URL('./tailwind.config.js', import.meta.url));
export default { plugins: { tailwindcss: { config }, autoprefixer: {} } };
