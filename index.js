/**
 * 微信云托管 - 皮肤/产品/零食分析服务
 * v2.0 - 支持 OpenAI/Gemini 进行产品和零食分析
 */

const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const cors = require('cors');
const axios = require('axios');

const app = express();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========== 配置 ==========
// 宜美 API 配置
const YIMEI_API_URL = 'https://api.yimei.ai';
const YIMEI_CLIENT_ID = process.env.SKIN_API_CLIENT_ID || 'c6e0044f161e7f20';
const YIMEI_CLIENT_SECRET = process.env.SKIN_API_CLIENT_SECRET || '4d0c6323f560114b1695b86e9d7aafe4';
const DEFAULT_DETECT_TYPES = '65536'; // 仅痘痘检测

// OpenAI/Gemini 配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// 启动时打印配置
console.log('========================================');
console.log('  皮肤/产品/零食分析服务 v2.0');
console.log('========================================');
console.log('配置信息:');
console.log(`  - OpenAI Model: ${OPENAI_MODEL}`);
console.log(`  - OpenAI Base URL: ${OPENAI_BASE_URL}`);
console.log(`  - OpenAI API Key: ${OPENAI_API_KEY ? '***' + OPENAI_API_KEY.slice(-4) : 'NOT SET'}`);
console.log('========================================');

// ========== 健康检查 ==========
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'skin-product-snack-analysis',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ========== 皮肤分析 (宜美 API) ==========
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const detectTypes = DEFAULT_DETECT_TYPES;
    
    if (!req.file) {
      return res.status(400).json({ code: -1, message: '请上传图片' });
    }

    console.log(`[SKIN] 收到分析请求, 图片大小: ${(req.file.size / 1024).toFixed(2)} KB`);

    const formData = new FormData();
    formData.append('image', req.file.buffer, {
      filename: 'image.jpg',
      contentType: req.file.mimetype || 'image/jpeg'
    });

    const authString = Buffer.from(`${YIMEI_CLIENT_ID}:${YIMEI_CLIENT_SECRET}`).toString('base64');
    const apiUrl = `${YIMEI_API_URL}/v2/api/face/analysis/${detectTypes}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    const result = await response.json();
    console.log(`[SKIN] 完成, 耗时: ${Date.now() - startTime}ms, code: ${result.code}`);
    
    res.json(result);
  } catch (error) {
    console.error(`[SKIN] 失败:`, error.message);
    res.status(500).json({ code: -1, message: '分析服务暂时不可用', error: error.message });
  }
});

// ========== 产品分析 (OpenAI/Gemini) ==========
app.post('/api/analysis/product', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传图片' });
    }

    console.log(`[PRODUCT] 收到分析请求, 图片大小: ${(req.file.size / 1024).toFixed(2)} KB`);

    const base64Image = req.file.buffer.toString('base64');
    const result = await analyzeProduct(base64Image);

    console.log(`[PRODUCT] 完成, 耗时: ${Date.now() - startTime}ms`);
    res.json({ success: true, data: { ...result, type: 'PRODUCT' } });
  } catch (error) {
    console.error(`[PRODUCT] 失败:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 零食分析 (OpenAI/Gemini) ==========
app.post('/api/analysis/snack', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传图片' });
    }

    console.log(`[SNACK] 收到分析请求, 图片大小: ${(req.file.size / 1024).toFixed(2)} KB`);

    const base64Image = req.file.buffer.toString('base64');
    const result = await analyzeSnack(base64Image);

    console.log(`[SNACK] 完成, 耗时: ${Date.now() - startTime}ms`);
    res.json({ success: true, data: { ...result, type: 'SNACK' } });
  } catch (error) {
    console.error(`[SNACK] 失败:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== Base64 分析接口 (通用) ==========
app.post('/api/analysis/analyze-base64', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { image, mode } = req.body;
    
    if (!image) {
      return res.status(400).json({ success: false, message: '缺少图片数据' });
    }

    console.log(`[BASE64-${mode}] 收到分析请求`);

    let result;
    if (mode === 'PRODUCT') {
      result = await analyzeProduct(image);
    } else if (mode === 'SNACK') {
      result = await analyzeSnack(image);
    } else {
      return res.status(400).json({ success: false, message: '不支持的分析模式' });
    }

    console.log(`[BASE64-${mode}] 完成, 耗时: ${Date.now() - startTime}ms`);
    res.json({ success: true, data: { ...result, type: mode } });
  } catch (error) {
    console.error(`[BASE64] 失败:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== OpenAI/Gemini 调用函数 ==========
async function analyzeProduct(base64Image) {
  const prompt = `你是一位专业的护肤品成分分析师。请分析这张护肤品/化妆品图片，识别产品信息和成分。

请以JSON格式返回以下信息：
{
  "productName": "产品名称",
  "brandName": "品牌名称",
  "productType": "产品类型（如：精华、面霜、洁面等）",
  "mainIngredients": ["主要有效成分列表"],
  "harmfulIngredients": ["可能有害的成分，如有"],
  "suitableSkinTypes": ["适合的肤质"],
  "notSuitableFor": ["不适合的肤质或情况"],
  "efficacy": ["主要功效"],
  "usageTips": ["使用建议"],
  "overallScore": 85,
  "safetyScore": 90,
  "efficacyScore": 80,
  "summary": "产品总结评价（50字以内）",
  "warnings": ["注意事项"]
}

如果无法识别产品，返回：{"error": true, "message": "无法识别产品，请上传清晰的产品正面或成分表照片"}

只返回JSON，不要其他文字。`;

  return callVisionAPI(base64Image, prompt);
}

async function analyzeSnack(base64Image) {
  const prompt = `你是一位专业的营养师。请分析这张零食/食品图片，识别产品信息和营养成分。

请以JSON格式返回以下信息：
{
  "productName": "产品名称",
  "brandName": "品牌名称",
  "category": "食品类别（如：膨化食品、饼干、糖果等）",
  "calories": "每100g热量（大卡）",
  "caloriesPerServing": "每份热量",
  "servingSize": "每份大小",
  "nutrition": {
    "protein": "蛋白质(g)",
    "fat": "脂肪(g)",
    "saturatedFat": "饱和脂肪(g)",
    "carbs": "碳水化合物(g)",
    "sugar": "糖(g)",
    "sodium": "钠(mg)",
    "fiber": "膳食纤维(g)"
  },
  "additives": ["添加剂列表"],
  "harmfulAdditives": ["有争议或可能有害的添加剂"],
  "healthScore": 60,
  "skinImpactScore": 50,
  "skinImpact": "对皮肤的影响评价",
  "acneTrigger": true或false,
  "acneTriggerReason": "如果可能致痘，说明原因",
  "recommendedFrequency": "建议食用频率",
  "healthTips": ["健康小贴士"],
  "alternatives": ["更健康的替代选择"],
  "summary": "总结评价（50字以内）"
}

如果无法识别食品，返回：{"error": true, "message": "无法识别食品，请上传清晰的产品正面或营养成分表照片"}

只返回JSON，不要其他文字。`;

  return callVisionAPI(base64Image, prompt);
}

async function callVisionAPI(base64Image, prompt) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY 未配置');
  }

  try {
    console.log(`[AI] 调用 ${OPENAI_MODEL} ...`);
    
    const response = await axios.post(
      `${OPENAI_BASE_URL}/chat/completions`,
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minutes timeout
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    console.log('[AI] 原始响应:', content?.substring(0, 500));
    
    if (!content) {
      console.error('[AI] 空响应, 完整数据:', JSON.stringify(response.data));
      throw new Error('AI 返回空响应');
    }

    // 尝试多种方式解析 JSON
    let result;
    
    // 方式1: 直接解析
    try {
      result = JSON.parse(content);
      console.log('[AI] 直接解析成功');
    } catch (e1) {
      // 方式2: 提取 JSON 块
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1]);
          console.log('[AI] 从代码块解析成功');
        } catch (e2) {
          // 继续尝试
        }
      }
      
      // 方式3: 提取第一个 { } 块
      if (!result) {
        const braceMatch = content.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          try {
            result = JSON.parse(braceMatch[0]);
            console.log('[AI] 从大括号提取成功');
          } catch (e3) {
            console.error('[AI] 所有解析方式都失败');
            console.error('[AI] 内容:', content);
            throw new Error('无法解析 AI 响应格式');
          }
        } else {
          console.error('[AI] 未找到 JSON 结构');
          console.error('[AI] 内容:', content);
          throw new Error('AI 响应不包含 JSON');
        }
      }
    }
    
    if (result.error) {
      throw new Error(result.message || '分析失败');
    }
    
    console.log('[AI] 解析成功:', Object.keys(result).join(', '));
    return result;
  } catch (error) {
    console.error('[AI] 错误详情:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response?.status === 401) {
      throw new Error('API 密钥无效');
    }
    if (error.response?.status === 429) {
      throw new Error('API 调用次数超限，请稍后再试');
    }
    if (error.response?.status === 400) {
      throw new Error('图片格式不支持或请求格式错误');
    }
    
    throw new Error(error.message || '分析失败，请重试');
  }
}

// ========== 测试接口 ==========
app.get('/api/test', (req, res) => {
  res.json({
    code: 0,
    message: 'API 服务正常',
    config: {
      yimeiApi: YIMEI_API_URL,
      openaiModel: OPENAI_MODEL,
      openaiConfigured: !!OPENAI_API_KEY
    }
  });
});

// ========== 404 处理 ==========
app.use((req, res) => {
  res.status(404).json({ 
    code: 404, 
    message: 'Not Found',
    path: req.path
  });
});

// ========== 错误处理 ==========
app.use((err, req, res, next) => {
  console.error('服务错误:', err);
  res.status(500).json({ 
    code: -1, 
    message: '服务内部错误',
    error: err.message
  });
});

// ========== 启动服务 ==========
const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务已启动，端口: ${PORT}`);
  console.log(`时间: ${new Date().toISOString()}`);
});
