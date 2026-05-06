// Railway 入口文件 - 同时提供静态页面和API代理
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const COZE_BOT_ID = '7626567449689063443';
const COZE_TOKEN = 'pat_6rFw3HSu0kmmeHHO6ICWnEfI5FPlknNZtX9gToGoqOGs9glnucCRnVjqDKlHRCbz';
const COZE_HOST = 'api.coze.cn';
const PORT = process.env.PORT || 3000;

// ====== 上传图片到扣子，返回 file_id ======
function uploadImageToCoze(base64Data, mimeType) {
    return new Promise((resolve, reject) => {
        // 去掉 data:image/xxx;base64, 前缀
        const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Clean, 'base64');

        const boundary = '----FormBoundary' + Date.now();
        const filename = 'image.' + (mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : 'jpg');

        // 构建 multipart/form-data
        const bodyParts = [
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
            `Content-Type: ${mimeType || 'image/jpeg'}\r\n`,
            `\r\n`
        ];
        const bodyHeader = Buffer.from(bodyParts.join(''));
        const bodyFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
        const totalBody = Buffer.concat([bodyHeader, imageBuffer, bodyFooter]);

        const options = {
            hostname: COZE_HOST,
            path: '/v1/files/upload',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_TOKEN}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': totalBody.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    console.log('[文件上传]', JSON.stringify(json));
                    if (json.code === 0 && json.data && json.data.id) {
                        resolve(json.data.id);
                    } else {
                        reject(new Error('文件上传失败: ' + body));
                    }
                } catch (e) {
                    reject(new Error('解析上传响应失败: ' + body));
                }
            });
        });

        req.on('error', reject);
        req.write(totalBody);
        req.end();
    });
}

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

            const { subject, grade, message, image, imageMime } = data;
            if (!message && !image) {
                res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: 'Missing message or image' }));
                return;
            }

            const GRADES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
            const subjectName = subject || '全科';
            const gradeName = GRADES[grade || 1];
            const userId = `stu_${subjectName}_${grade || 1}`;

            // 如果有图片，先上传到扣子获取 file_id，再发聊天
            const sendChat = (additionalMessages) => {
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
            };

            // 有图片时先上传，拿到 file_id 再发聊天
            if (image) {
                uploadImageToCoze(image, imageMime || 'image/jpeg')
                    .then(fileId => {
                        console.log('[图片上传成功] file_id:', fileId);
                        // 图片和文字必须放在同一条 object_string 消息里
                        const textPart = message || '请看图片，帮我解答这道题';
                        const objContent = JSON.stringify([
                            { type: 'text', text: textPart },
                            { type: 'image', file_id: fileId }
                        ]);
                        sendChat([
                            {
                                role: 'user',
                                content: objContent,
                                content_type: 'object_string'
                            }
                        ]);
                    })
                    .catch(err => {
                        console.error('[图片上传失败]', err.message);
                        res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
                        res.end(JSON.stringify({ error: '图片上传失败: ' + err.message }));
                    });
            } else {
                sendChat([
                    { role: 'user', content: message, content_type: 'text' }
                ]);
            }
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
