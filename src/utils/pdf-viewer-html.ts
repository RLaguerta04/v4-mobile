// Builds a self-contained HTML document that renders a PDF with pdf.js inside a
// react-native-webview. This is what makes broadsheet PDFs render on mobile:
// Android's system WebView has no PDF engine (it shows blank for a file:// PDF),
// so instead of pointing the WebView at the file we hand it a page that decodes
// the PDF bytes and paints each page to a <canvas> via pdf.js — which works
// identically on iOS and Android.
//
// pdf.js is loaded from a CDN (the legacy UMD build, for broad WebView support).
// That means rendering needs network; vendoring the two files for full offline
// use is a drop-in follow-up (inline them in place of the two <script src> tags).
const PDFJS_BASE = 'https://unpkg.com/pdfjs-dist@3.11.174/legacy/build';

// Backdrop behind the rendered PDF pages. Light = warm sand matching the app's
// PDF surface (theme.track); dark = the near-black app canvas (theme.background).
// The pages themselves stay white (they're the scanned document) — only this
// surrounding chrome flips, so the document is never tinted.
const SURFACE_LIGHT = '#EDE6D8';
const SURFACE_DARK = '#0A0A0B';

export function buildPdfViewerHtml(base64: string, opts: { allPages: boolean; isDark?: boolean }): string {
  const { allPages, isDark = false } = opts;
  const surface = isDark ? SURFACE_DARK : SURFACE_LIGHT;
  // `allPages` → full-screen modal: render every page, allow pinch-zoom + scroll.
  // Otherwise → inline preview: first page only, fixed scale, no zoom.
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=${
    allPages ? 5 : 1
  }, user-scalable=${allPages ? 'yes' : 'no'}" />
<style>
  html, body { margin: 0; padding: 0; background: ${surface}; -webkit-text-size-adjust: 100%; }
  #pages { display: flex; flex-direction: column; align-items: center; gap: ${allPages ? '10px' : '0'}; padding: ${
    allPages ? '10px' : '0'
  }; box-sizing: border-box; }
  canvas { max-width: 100%; height: auto; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18); border-radius: 2px; }
  ${allPages ? '' : 'body { overflow: hidden; }'}
</style>
</head>
<body>
<div id="pages"></div>
<script src="${PDFJS_BASE}/pdf.min.js"></script>
<script>
(function () {
  var RN = window.ReactNativeWebView;
  function post(o) { try { RN && RN.postMessage(JSON.stringify(o)); } catch (e) {} }
  function toBytes(b64) {
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_BASE}/pdf.worker.min.js';
    var ALL = ${allPages ? 'true' : 'false'};
    var data = toBytes(${JSON.stringify(base64)});
    pdfjsLib.getDocument({ data: data }).promise.then(function (pdf) {
      var count = ALL ? pdf.numPages : 1;
      var host = document.getElementById('pages');
      function render(n) {
        pdf.getPage(n).then(function (page) {
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          var base = page.getViewport({ scale: 1 });
          var avail = (document.body.clientWidth || 360) - (ALL ? 20 : 0);
          var scale = avail / base.width;
          var vp = page.getViewport({ scale: scale * dpr });
          var canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          canvas.style.width = (vp.width / dpr) + 'px';
          canvas.style.height = (vp.height / dpr) + 'px';
          host.appendChild(canvas);
          page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise.then(
            function () { if (n < count) render(n + 1); else post({ type: 'loaded', pages: count }); },
            function (e) { post({ type: 'error', message: String(e) }); }
          );
        }, function (e) { post({ type: 'error', message: String(e) }); });
      }
      render(1);
    }, function (e) { post({ type: 'error', message: String(e) }); });
  } catch (e) { post({ type: 'error', message: String(e) }); }
})();
</script>
</body>
</html>`;
}
