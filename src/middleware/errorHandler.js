function sendSiteNotFoundPage(res) {
  res.status(404).set("Content-Type", "text/html; charset=utf-8").send(`
<!DOCTYPE html>
<html lang="sw">
<head>
  <meta charset="UTF-8" />
  <title>Tovuti haipatikani</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: -apple-system, Arial, sans-serif;
      background: #f8f9fa;
      color: #202124;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .box { text-align: center; padding: 24px; }
    h1 { font-size: 22px; font-weight: 400; }
    p { color: #5f6368; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Tovuti hii haiwezi kufikiwa</h1>
    <p>Faili ulilotafuta halipo au limeondolewa.</p>
  </div>
</body>
</html>
  `);
}

/** 404 kwa route zisizofahamika */
function notFoundHandler(req, res) {
  sendSiteNotFoundPage(res);
}

/** Error handler ya jumla (lazima iwe na args 4 kwa Express kuitambua) */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error("❌ Server error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Hitilafu ya ndani ya server" });
}

module.exports = { sendSiteNotFoundPage, notFoundHandler, errorHandler };
