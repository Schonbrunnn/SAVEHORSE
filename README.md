# 宝马之路

一个面向 iPhone/iPad 横屏、macOS 与 Windows 浏览器的三关轻量格斗游戏。

主线：公主被掳进国轩之窟。玩家从奇瑞队长和上海交通骑士中选择一位，穿过洞窟前线的小兵封锁，击败秦岭杀人兔·玥与草莓熊博士·珏，救出小马国公主。

## 直接试玩

最简单的方式是用任意静态服务器打开 `public/game/`。完整工程预览使用：

```bash
pnpm install
pnpm dev
```

访问终端显示的本地地址。游戏本体完全静态，GitHub Pages 不需要构建。

## 操作

| 动作 | 键盘 | 触屏 |
|---|---|---|
| 左移 / 右移 | A / D 或 ← / → | 左侧 ← / → |
| 跳跃 | W 或 ↑ | 左侧 ↑ |
| 攻击 | J | 右侧攻击 |
| 技能 | K | 右侧技能 |
| 闪避 | L | 右侧闪避 |
| 暂停 | Esc | 右上角暂停 |

## GitHub Pages

1. 新建 GitHub 仓库，把本目录中的全部文件推送到 `main` 分支。
2. 在仓库 `Settings → Pages → Build and deployment` 中选择 `GitHub Actions`。
3. 工作流会直接发布 `public/game/`，完成后仓库的 Actions 页面会显示访问地址。

## 项目结构

```text
public/game/
├── index.html              # 静态入口
├── game.js                 # 游戏循环、关卡、AI、输入与碰撞
├── styles.css              # 横屏 UI、Safe Area 与触控按钮
├── manifest.webmanifest    # 横屏 PWA 信息
└── assets/                 # 原始人物参考图与分享封面

app/                        # Sites 预览外壳
.github/workflows/          # GitHub Pages 自动发布
docs/                       # 游戏与美术实现说明
```

人物脸部只使用 `人物美术设计` 中提供的原始 PNG。游戏运行时通过 Canvas 源区域裁切绘制，不生成、拼接或重画人脸。
