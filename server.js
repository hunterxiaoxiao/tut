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

            const { subject, grade, message, image } = data;
            if (!message && !image) {
                res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: 'Missing message or image' }));
                return;
            }

            const GRADES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
            const subjectName = subject || '全科';
            const gradeName = GRADES[grade || 1];

            const userId = `stu_${subjectName}_${grade || 1}`;

            // 构建消息内容（支持图文混合）
            let additionalMessages;
            if (image) {
                // 有图片时，使用图文混合格式
                additionalMessages = [
                    { role: 'user', content: image, content_type: 'image' },
                    { role: 'user', content: message || '请看图片，帮我解答', content_type: 'text' }
                ];
            } else {
                additionalMessages = [
                    { role: 'user', content: message, content_type: 'text' }
                ];
            }

            const payload = {
                bot_id: COZE_BOT_ID,
                user_id: userId,
                stream: true,
                auto_save_history: true,
                additional_messages: additionalMessages
            };

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
                // 只在扣子返回成功状态码时才转发
                if (cozeRes.statusCode !== 200) {
                    let errBody = '';
                    cozeRes.on('data', c => errBody += c);
                    cozeRes.on('end', () => {
                        console.error('[扣子错误]', cozeRes.statusCode, errBody);
                        res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders });
                        res.end(JSON.stringify({ error: '扣子API返回错误', status: cozeRes.statusCode, detail: errBody }));
                    });
                    return;
                }
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    ...corsHeaders
                });
                cozeRes.pipe(res);
            });

            cozeReq.on('error', (e) => {
                console.error('[代理错误]', e.message);
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
