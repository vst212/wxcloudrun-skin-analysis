/**
 * 微信云托管 - 皮肤分析代理服务
 * 用于中转调用宜美AI API
 */

const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const cors = require('cors');

const app = express();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API 配置
const API_BASE_URL = 'https://api.yimei.ai';
const CLIENT_ID = 'c6e0044f161e7f20';
const CLIENT_SECRET = '4d0c6323f560114b1695b86e9d7aafe4';

// 已购买的服务：仅 pockmark (痘痘检测 = 65536)
const DEFAULT_DETECT_TYPES = '65536';

// 健康检查
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'skin-analysis-proxy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 健康检查（云托管专用）
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 皮肤分析接口
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 使用已购买的服务，忽略客户端传来的 detect_types
    const detectTypes = DEFAULT_DETECT_TYPES;
    
    if (!req.file) {
      return res.status(400).json({ 
        code: -1, 
        message: '请上传图片' 
      });
    }

    console.log(`[${new Date().toISOString()}] 收到分析请求`);
    console.log(`  - detect_types: ${detectTypes}`);
    console.log(`  - 图片大小: ${(req.file.size / 1024).toFixed(2)} KB`);
    console.log(`  - 图片类型: ${req.file.mimetype}`);

    // 构建 multipart form data（根据文档，使用 multipart/form-data 上传图片）
    const formData = new FormData();
    formData.append('image', req.file.buffer, {
      filename: 'image.jpg',
      contentType: req.file.mimetype || 'image/jpeg'
    });

    // 构建 Basic Authorization（base64 编码的 client_id:client_secret）
    const authString = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    // 调用宜美 AI API v2 版本
    // URL 格式: /v2/api/face/analysis/${detect_types}
    const apiUrl = `${API_BASE_URL}/v2/api/face/analysis/${detectTypes}`;
    console.log(`  - 调用 API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      },
      timeout: 30000 // 30秒超时
    });

    const result = await response.json();
    
    const duration = Date.now() - startTime;
    console.log(`  - HTTP状态: ${response.status}`);
    console.log(`  - API响应码: ${result.code}`);
    console.log(`  - 耗时: ${duration}ms`);
    
    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 分析失败 (${duration}ms):`, error.message);
    
    res.status(500).json({ 
      code: -1, 
      message: '分析服务暂时不可用',
      error: error.message 
    });
  }
});

// 测试接口
app.get('/api/test', (req, res) => {
  res.json({
    code: 0,
    message: 'API 服务正常',
    config: {
      apiUrl: API_BASE_URL,
      clientId: CLIENT_ID.substring(0, 4) + '****'
    }
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ 
    code: 404, 
    message: 'Not Found',
    path: req.path
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务错误:', err);
  res.status(500).json({ 
    code: -1, 
    message: '服务内部错误',
    error: err.message
  });
});

// 启动服务
const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('  皮肤分析代理服务已启动');
  console.log(`  端口: ${PORT}`);
  console.log(`  时间: ${new Date().toISOString()}`);
  console.log('========================================');
});
