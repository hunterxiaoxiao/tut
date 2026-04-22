// Railway 入口文件 - 同时提供静态页面和API代理
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const COZE_BOT_ID = '7626567449689063443';
const COZE_TOKEN = 'pat_6rFw3HSu0kmmeHHO6ICWnEfI5FPlknNZtX9gToGoqOGs9glnucCRnVjqDKlHRCbz';
const COZE_HOST = 'api.coze.cn';
const PORT = process.env.PORT || 3000;

// 读取前端页面
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const server = http.createServer((req, res) => {
    // CORS 头
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // API 代理接口
    if (req.url === '/api/chat' && req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    if (req.url === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            let data;
            try {
                data = JSON.parse(body);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }

            const { subject, grade, message, conversationId } = data;
            if (!message) {
                res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: 'Missing message' }));
                return;
            }

            const GRADES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
            const subjectName = subject || '全科';
            const gradeName = GRADES[grade || 1];

            // 固定user_id：同一学科+年级组合用同一用户，保证对话上下文
            const userId = `stu_${subjectName}_${grade || 1}`;

            const payload = {
                bot_id: COZE_BOT_ID,
                user_id: userId,
                stream: true,
                additional_messages: [
                    { role: 'user', content: message, content_type: 'text' }
                ]
            };

            // 如果有conversationId，加入payload保持对话连贯
            if (conversationId) {
                payload.conversation_id = conversationId;
            }

            const postData = JSON.stringify(payload);

            const cozeReq = https.request({
                hostname: COZE_HOST,
                path: '/v3/chat',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${COZE_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (cozeRes) => {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    ...corsHeaders
                });
                cozeRes.pipe(res);
            });

            cozeReq.on('error', (e) => {
                res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: e.message }));
            });

            cozeReq.write(postData);
            cozeReq.end();
        });
        return;
    }

    // 首页 - 返回前端页面
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexHtml);
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`AI学习助手已启动: http://localhost:${PORT}`);
});
