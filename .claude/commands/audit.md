Run a deep audit of the codebase:
1. Syntax check: node -c _worker.js + client JS extraction + node -c
2. Check for remaining hardcoded strings (grep for textContent/innerHTML = 'English text')
3. Check dead functions (defined once, never called)
4. Check placeholder URLs (example.com, github.com/user)
5. Run ./validate.sh
Report findings and fix any issues found.
