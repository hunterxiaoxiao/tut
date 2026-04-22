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

            const { subject, grade, message, systemPrompt } = data;
            if (!message) {
                res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: 'Missing message' }));
                return;
            }

            const GRADES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
            const subjectName = subject || '全科';
            const gradeName = GRADES[grade || 1];

            const SUBJECT_BOUNDARY = {
                '语文': { allow: '汉字、词语、成语、句子、段落、阅读理解、写作、修辞手法、文言文、古诗词、文学常识、语法、标点符号、语言表达', deny: '数学计算、英语单词、物理公式、化学方程式、历史事件、地理知识、生物概念、政治概念、科学实验、音乐乐理、美术技法、体育动作、编程技术' },
                '数学': { allow: '数字运算、方程、几何、函数、概率统计、代数、分数、小数、比例、面积体积计算、坐标系、逻辑推理、数学应用题', deny: '语文阅读、英语语法、物理定律、化学反应、历史年代、地理位置、生物结构、政治制度、科学现象、音乐节奏、美术构图、体育规则、计算机操作' },
                '英语': { allow: '英语单词、语法、句型、听力、口语、阅读理解、写作、翻译、英语文化常识、英语语音、时态语态', deny: '语文知识、数学计算、物理公式、化学知识、历史事件、地理知识、生物知识、政治知识、科学实验、音乐理论、美术知识、体育知识、信息技术' },
                '物理': { allow: '力学、热学、光学、电学、声学、电磁学、能量、运动、物理实验、物理定律、物理公式与应用', deny: '语文知识、数学解题技巧、英语语法、化学反应方程式、历史事件、地理知识、生物知识、政治知识、音乐理论、美术知识、体育动作、编程代码' },
                '化学': { allow: '化学元素、化学方程式、化学反应、酸碱盐、有机化学、化学实验、物质结构、溶液、化学计算', deny: '语文知识、数学解题技巧、英语语法、物理定律、历史事件、地理知识、生物知识、政治知识、音乐理论、美术知识、体育动作、编程代码' },
                '生物': { allow: '细胞、遗传与变异、生态系统、人体结构、植物动物、微生物、进化论、生物实验、生命现象', deny: '语文知识、数学计算、英语语法、物理公式、化学合成、历史事件、地理位置、政治制度、音乐理论、美术技法、体育训练、编程算法' },
                '历史': { allow: '历史事件、历史人物、朝代更替、重大变革、历史文化、历史年表、史料分析、历史意义', deny: '语文阅读理解、数学计算、英语语法、物理定律、化学方程式、地理气候、生物进化、政治法律、科学实验、音乐乐理、美术技法、体育规则、编程技术' },
                '地理': { allow: '地形地貌、气候天气、人口城市、自然资源、地图阅读、区域地理、地球运动、环境保护', deny: '语文阅读、数学计算、英语语法、物理公式、化学方程式、历史事件、生物结构、政治法律、科学实验、音乐理论、美术技法、体育动作、编程代码' },
                '道德与法治': { allow: '道德品质、法律常识、公民权利义务、社会规则、心理健康、国家制度、社会主义核心价值观', deny: '语文阅读、数学计算、英语语法、物理公式、化学方程式、历史事件、地理知识、生物知识、科学实验、音乐理论、美术技法、体育动作、编程代码' },
                '科学': { allow: '自然现象、科学实验、观察探究、物质变化、生命科学、地球与宇宙、技术与生活', deny: '语文阅读理解、数学解题、英语语法、历史事件、地理区域、道德法律、音乐理论、美术技法、体育动作、编程代码' },
                '音乐': { allow: '音符节奏、旋律、乐器、演唱技巧、音乐欣赏、乐理知识、音乐风格、音乐创作', deny: '语文阅读、数学计算、英语语法、物理公式、化学方程式、历史事件、地理知识、生物知识、道德法律、科学实验、美术技法、体育动作、编程代码' },
                '美术': { allow: '绘画技法、色彩搭配、构图设计、美术鉴赏、手工制作、书法、雕塑、美术史', deny: '语文阅读、数学计算、英语语法、物理公式、化学方程式、历史事件、地理知识、生物知识、道德法律、科学实验、音乐理论、体育动作、编程代码' },
                '体育': { allow: '运动技能、体育锻炼、体育规则、健康知识、运动安全、体育项目介绍', deny: '语文阅读、数学计算、英语语法、物理公式、化学方程式、历史事件、地理知识、生物知识、道德法律、科学实验、音乐理论、美术技法、编程代码' },
                '信息科技': { allow: '计算机基础、操作系统、办公软件、编程思维、算法基础、网络基础、数据处理、人工智能、物联网、信息安全', deny: '语文阅读理解、数学解题、英语语法、物理定律、化学反应、历史事件、地理位置、生物结构、道德法律、音乐乐理、美术构图、体育规则' }
            };

            const boundary = SUBJECT_BOUNDARY[subjectName] || { allow: subjectName + '相关知识', deny: '其他学科知识' };

            const prompt = systemPrompt || `你是一名专业的${subjectName}老师，正在教${gradeName}的学生。

═══════════════════════════════════
【最高优先级规则 - 违反即失败】
═══════════════════════════════════

规则一【学科隔离 - 绝对遵守】：
你只能回答【${subjectName}】学科范围内的问题。
- ✅ 你可以回答的内容：${boundary.allow}
- ❌ 你绝对不能回答的内容：${boundary.deny}
如果学生问的问题不属于${subjectName}学科，你必须立即拒绝，回复格式：
"这个问题不属于${subjectName}的范畴哦，请选择对应学科的老师来提问吧～"

特别注意：
- 即使问题看起来和${subjectName}有一点点关联，但核心是其他学科的知识，也必须拒绝
- 学生可能试图用${subjectName}话题引入其他学科知识，你只能回答${subjectName}部分

规则二【年级限制 - 绝对遵守】：
你正在教${gradeName}的学生，必须严格限制在${gradeName}的学习范围内。
- ❌ 绝对不能教授超过${gradeName}的知识
- 如果学生问的问题超出了${gradeName}的范围，你绝不能直接讲解超纲内容，而是这样处理：
  "这个知识点对你来说还有点超纲哦～不过我们可以先学一个类似的${gradeName}知识：[给出一个${gradeName}范围内的同类型知识点讲解]"

规则三【准确性】：
- 绝不编造知识，回答必须准确
- 如果不确定，坦诚告知

规则四【语言风格】：
- 语言简单友好，适合${gradeName}学生理解`;

            const payload = {
                bot_id: COZE_BOT_ID,
                user_id: 's' + Date.now(),
                stream: true,
                additional_messages: [
                    { role: 'system', content: prompt, content_type: 'text' },
                    { role: 'user', content: message, content_type: 'text' }
                ]
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
