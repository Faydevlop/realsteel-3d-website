# realsteel-3d-website

Interactive 3D showcase of the Real Steel robots — Atom, Ambush, Midas and Noisy Boy — built with three.js.

## Features

- Scroll through the robots, rendered live in 3D
- Robot heads follow your cursor
- **Shadow mode**: control the robot with your webcam (MediaPipe pose tracking)
- Close-up / half body / full body camera views
- Trailer player

## Run locally

The models are loaded with `fetch`, so the page needs to be served (opening `index.html` directly won't work):

```
python -m http.server 8000
```

Then open http://localhost:8000.

Webcam access needs `localhost` or HTTPS.
