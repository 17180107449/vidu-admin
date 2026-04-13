# Vidu批量生成工具 - 后台管理系统

## 🚀 快速部署到公网

### 方式一：部署到 Render.com（免费，推荐）

**步骤：**

1. 注册 Render 账号：https://render.com（可以用GitHub登录）

2. 将 `vidu-admin` 文件夹上传到 GitHub 仓库

3. 在 Render 创建新的 Web Service：
   - 选择你的 GitHub 仓库
   - Build Command: `npm install`
   - Start Command: `npm start`
   - 添加环境变量：
     - `ADMIN_USER` = 你的管理员用户名
     - `ADMIN_PASS` = 你的管理员密码

4. 点击 Deploy，等待部署完成

5. 部署成功后会获得一个网址，如：`https://vidu-admin.onrender.com`

6. 修改插件配置：
```javascript
const AUTH_CONFIG = {
  loginUrl: 'https://vidu-admin.onrender.com/api/login',
  verifyUrl: 'https://vidu-admin.onrender.com/api/verify',
  storageKey: 'vidu_auth_data'
};