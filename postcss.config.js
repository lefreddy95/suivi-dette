/** PostCSS config — runs BEFORE Tailwind compiles
 *  so that `@tailwind` directives in src/index.css are transformed.
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
