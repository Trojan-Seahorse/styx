# Styx — NCME 解构器

> 继续医学教育自动化解构器。自动答题 · 智能跳课 · 进度模拟 · 无人值守完成 NCME 课程。

**v3.2.0** | Tampermonkey / Violentmonkey 用户脚本

## 功能

- **自动答题** — Vue 数据层注入 `userAnswer` + `status`，绕过 DOM 交互
- **进度模拟** — 检查点跳跃 + SDK 同步，15s 末段播放，满足平台进度校验
- **智能跳课** — 自动检测未完成课程/测试，跨模块导航，DOM 点击"去做题"按钮
- **ESC 暂停** — 随时暂停/恢复自动化，不打断可以手动浏览

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开 `styx-ncme.user.js` → 复制全部内容
3. Tampermonkey 面板 → 添加新脚本 → 粘贴 → 保存
4. 或直接从 [Greasy Fork](https://greasyfork.org) 安装（待发布）

## 技术幕后

本脚本的架构设计、逆向分析与问题诊断全程由 **Tom**（7 层通用思维引擎 skill）辅助完成——从 Cynefin 域分类到多模块课程结构逆向、从 Vue 响应式注入到 CSP 绕过，Tom 的结构化思维方法论贯穿每一次关键决策。

## 致谢

- **[Cherry Studio](https://github.com/CherryHQ/cherry-studio)** — 优秀的 AI 桌面客户端，Styx 的开发环境
- **[DeepSeek V4 Pro](https://www.deepseek.com)** — 主力推理模型，逆向分析与代码生成的中坚力量

## 许可

[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)

- ✅ 个人使用、分享（需署名）
- ❌ 修改、二创、演绎
- ❌ 商业用途

> © 2026 Xi Ewell · Duke Ewell Laboratory

## 免责声明

本脚本由 AI 辅助编写，仅供学习交流之用。

- 使用者自行承担全部使用风险，作者不对任何直接或间接损失负责
- 禁止利用本脚本从事违法违规或侵害他人权益的行为
- 使用即视为同意上述条款

---

**Xi Ewell · Duke Ewell Laboratory** · [github.com/Trojan-Seahorse](https://github.com/Trojan-Seahorse)
