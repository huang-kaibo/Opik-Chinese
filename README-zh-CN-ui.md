# Opik 简体中文界面

本仓库基于 [Comet Opik](https://github.com/comet-ml/opik) 2.2.76（上游提交 `582edccd63f270d582673fe11f5daa3ae52c8579`），保留 Apache-2.0 许可证，在前端加入简体中文界面。

当前词表包含从前端源码提取的 3718 条静态文案和 334 条动态文案模式。页面导航、按钮、表单提示、弹窗、无障碍标签和人工评审界面使用中文。词表位于 `apps/opik-frontend/src/localization/`，运行时离线使用。代码示例、用户输入和品牌名称保留原文。词表由机器翻译加术语规则生成，仍需按实际页面校对。第三方内容、服务端自由文本或未收录的新文案可能显示英文。

## 本地启动

需要 Docker Desktop 或 Docker Engine 与 Compose。以下命令在仓库根目录运行，使用固定的 2.2.76 后端镜像和本地构建的中文前端镜像。PowerShell 示例：

```powershell
$env:OPIK_VERSION = '2.2.76'
docker build --build-arg OPIK_VERSION=2.2.76 -t opik-chinese-frontend:2.2.76 apps/opik-frontend
docker compose -p opik-chinese -f deployment/docker-compose/docker-compose.yaml -f deployment/docker-compose/docker-compose.zh-cn.yaml --profile opik up -d --no-build
```

访问 <http://127.0.0.1:5173>。此部署只将网页端口绑定到本机，使用独立的 `opik-chinese` Compose 项目。上游 Compose 的数据库示例密码适合本机测试，外部访问部署需要单独配置鉴权和密码。停用服务时使用同一组 Compose 参数执行 `stop`，不要使用 `down -v`，以免删除数据卷。

## 更新词表

维护脚本位于 `scripts/zh-cn/`。在仓库根目录安装前端依赖后运行：

```powershell
npm ci --prefix apps/opik-frontend
node scripts/zh-cn/extract-ui-strings.mjs
python -m pip install requests
python scripts/zh-cn/translate-ui.py
```

提取命令将候选文案输出为 JSON；翻译脚本会更新两个词表文件，生成时需要联网。人工修改词表后，重新构建前端镜像并更新 frontend 服务即可，运行时无在线翻译依赖。

## 验证与来源

已通过前端 TypeScript 检查、2 条定向本地化测试、Vite 构建和定向 ESLint 检查。本地运行的中文镜像及 Opik 服务健康检查通过。上游大量文件在 Windows 检出时触发换行格式 lint 错误，因此没有批量格式化第三方代码。尚未完成逐页浏览器视觉验收。

原项目版权和许可证见 [LICENSE](LICENSE)。汉化只修改前端入口、词表及相关工具；后端和 SDK 保持上游 2.2.76 实现。
