# ethannju.github.io

Academic homepage of Yuchen Lu, served by GitHub Pages at https://ethannju.github.io/.
The interactive, cinematic site lives in a separate private repo (`personal-site`, https://yuchenlu.me/).

Plain static files with no build step:

- `index.html`: all content (bio, research interests, research, experience, education, projects, photography, albums).
- `assets/css/site.css`: styles. The design tokens are the custom properties at the top.
- `assets/js/site.js`: the photo viewer only. The page works without it.
- `assets/img/photos/`: contact-sheet photographs. To add one, copy a `<li class="frame">` block in `index.html` and set the image `width`/`height`.
- `assets/Yuchen_Lu_CV.pdf`: the CV. Replace the file and keep the name.

To preview locally, run `python3 -m http.server` in this folder.
