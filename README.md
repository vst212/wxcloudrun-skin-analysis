# 微信云托管 - 皮肤分析代理服务

用于微信小程序调用宜美AI皮肤分析API的代理服务。

## 功能

- `/` - 健康检查
- `/api/analyze` - 皮肤分析（POST，上传图片）
- `/api/test` - 测试API连接

## 部署到微信云托管

### 方式1：代码包上传

1. 打包代码：
```bash
zip -r deploy.zip . -x "node_modules/*" -x ".git/*"
```

2. 在云托管控制台：
   - 进入服务 → 部署发布 → 新建版本
   - 选择「代码包上传」
   - 上传 deploy.zip

### 方式2：Git仓库部署

1. 将代码推送到 GitHub
2. 在云托管控制台配置 Git 仓库
3. 自动部署

## 本地测试

```bash
npm install
npm start
```

访问 http://localhost/api/test

## API 使用

### 皮肤分析

```javascript
wx.uploadFile({
  url: 'https://your-domain.sh.run.tcloudbase.com/api/analyze',
  filePath: imagePath,
  name: 'image',
  formData: {
    detect_types: '4124'
  },
  success: (res) => {
    const data = JSON.parse(res.data);
    console.log('分析结果:', data);
  }
});
```

## 检测类型

| 类型 | 值 | 说明 |
|------|-----|------|
| SKIN_TYPE | 8 | 肤质 |
| PORE | 4 | 毛孔 |
| MOISTURE | 4096 | 水分 |
| POCKMARK | 65536 | 痘痘 |
| ACNE | 16 | 痤疮 |
| BLACKHEAD | 32768 | 黑头 |

常用组合：`4124` = 基础分析
