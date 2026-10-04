const express = require('express');
const https = require('https');
const app = express();

// CONFIG
const TARGET_GIF = 'https://media3.giphy.com/media/26n6WywJyh39n1pBu/giphy.gif';
const PORT = process.env.PORT || 3000;

// IN-M MEMORY STORAGE (No file system needed)
// Logs are stored in a variable. They are lost if the server restarts, 
// but this prevents crashes and is standard for ephemeral containers.
let visitorLogs = [];

function getClientInfo(req) {
    let ip = req.headers['x-forwarded-for']?.split(',')[0].trim() 
          || req.headers['x-real-ip'] 
          || req.socket.remoteAddress || 'Unknown';
    
    if (ip && ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }

    return {
        ip: ip,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'] || 'direct',
        language: req.headers['accept-language']?.split(',')[0] || 'unknown'
    };
}

// Main Tracking Endpoint
app.get('/meme.gif', (req, res) {
    const data = getClientInfo(req);
    
    // Log to console (visible in Render Dashboard)
    console.log(`[+] New Hit: ${data.ip}`);
    
    // Store in memory
    visitorLogs.push(data);
    
    // Limit memory usage (keep last 100 logs only)
    if (visitorLogs.length > 100) {
        visitorLogs.shift();
    }

    // Proxy the GIF
    https.get(TARGET_GIF, (gifRes) => {
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        gifRes.pipe(res);
    }).on('error', (err) {
        console.error('GIF Fetch Error:', err);
        res.status(500).send('Error fetching image');
    });
});

// Admin Dashboard (View Logs)
app.get('/admin', (req, res) {
    if (visitorLogs.length === 0) {
        return res.send('No logs yet. Send the link to someone!');
    }

    let html = `
    <html>
    <head>
        <title>Visitor Logs</title>
        <style>
            body { font-family: monospace; background: #111; color: #0f0; padding: 20px; }
            h1 { color: #fff; }
            .log-entry { border-bottom: 1px solid #333; padding: 10px 0; }
            .label { color: #aaa; }
        </style>
    </head>
    <body>
        <h1>Active Visitor Logs (${visitorLogs.length})</h1>
        <p>Warning: Logs are stored in memory only. They will be lost if the server restarts.</p>
    `;
    
    // Show last 50 logs in reverse order (newest first)
    const recentLogs = [...visitorLogs].reverse().slice(0, 50);
    
    recentLogs.forEach(log => {
        html += `
        <div class="log-entry">
            <div><span class="label">Time:</span> ${log.timestamp}</div>
            <div><span class="label">IP:</span> ${log.ip}</div>
            <div><span class="label">Location:</span> [GeoIP Disabled for Stability]</div>
            <div><span class="label">User-Agent:</span> ${log.userAgent.substring(0, 100)}...</div>
            <div><span class="label">Referrer:</span> ${log.referrer}</div>
        </div>
        `;
    });
    
    html += '</body></html>';
    res.send(html);
});

// Root redirect
app.get('/', (req, res) {
    res.redirect('/meme.gif');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Status: OK - Memory logging active`);
});
