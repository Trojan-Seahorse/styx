# Styx — NCME 解构器

> 继续医学教育自动化解构器。自动答题 · 倍速锁定 · 智能跳课 · 无人值守完成 NCME 课程。

**v3.0** | Tampermonkey / Violentmonkey 用户脚本

## 功能

- **自动答题** — Vue 数据层注入 `userAnswer` + `status`，绕过 DOM 交互
- **倍速锁定** — 劫持 `playbackRate` descriptor，隐藏 CC SDK 真实速率
- **进度模拟** — 检查点跳跃 + SDK 同步，满足平台进度校验
- **智能跳课** — 自动检测未完成课程/测试，DOM 点击"去做题"按钮
- **ESC 暂停** — 随时暂停/恢复自动化，不打断可以手动浏览

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开 `styx-ncme.user.js` → 复制全部内容
3. Tampermonkey 面板 → 添加新脚本 → 粘贴 → 保存
4. 或直接从 [Greasy Fork](https://greasyfork.org) 安装（待发布）

## 许可

MIT License

---

**Xi Ewell · Duke Ewell Laboratory** · [github.com/Trojan-Seahorse](https://github.com/Trojan-Seahorse)
