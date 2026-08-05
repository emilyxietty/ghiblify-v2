// Pre-mount wallpaper paint — runs before React. MUST live in this
// external file: MV3's CSP (`script-src 'self'`) blocks inline
// scripts in extension pages, which silently killed the previous
// inline version of this — every new tab sat on black until React
// mounted AND the remote wallpaper finished downloading. External
// extension-packaged scripts are allowed.
//
// On the very first load ever (no cache yet) the body paints the
// bundled chihiro043 splash; on every later load it paints the
// previously-displayed wallpaper from `ghiblify:lastBg` (written by
// useBackground), so users see yesterday's photo instantly while the
// fresh pick downloads. Bare try/catch: strict contexts can throw on
// localStorage access.
(function () {
  var splash = "/assets/backgrounds/chihiro043.jpg";
  var url = splash;
  try {
    var last = localStorage.getItem("ghiblify:lastBg");
    if (last) url = last;
  } catch (e) {
    /* ignored */
  }
  document.body.style.backgroundImage =
    "url('" + url.replace(/'/g, "\\'") + "')";
})();
