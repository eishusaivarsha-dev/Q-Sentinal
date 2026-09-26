# Push this repository to GitHub

The source tree is already prepared as a clean Git-ready repository. A GitHub remote was not configured because no repository URL or GitHub credentials were provided.

From this directory:

```bash
git init
git add .
git commit -m "Complete Q-SENTINEL D1-D6 quantum detection workstream"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO>.git
git push -u origin main
```

Do **not** put an API token, password, SSH private key, or other secret inside this repository.
