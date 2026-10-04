// SPA routing: redirect all paths to root, preserving query + hash (invite tokens
// travel as ?join=/?add= params). Lives in its own file because the production CSP
// (script-src 'self' + hashes, no 'unsafe-inline') blocks every inline script on
// 404.html — this redirect silently never ran as an inline <script>.
const path = window.location.pathname;
if (path !== '/' && !path.startsWith('/api/')) {
  window.location.replace('/' + window.location.search + window.location.hash);
}
