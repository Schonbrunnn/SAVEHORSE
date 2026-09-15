# 宝马之路

一个面向 iPhone/iPad 横屏、macOS 与 Windows 浏览器的三关轻量格斗游戏。

主线：公主被掳进国轩之窟。玩家从奇瑞队长和上海交通骑士中选择一位，穿过洞窟前线的小兵封锁，击败秦岭杀人兔·玥与草莓熊博士·珏，救出小马国公主。

## 直接试玩

[进入在线试玩](https://schonbrunnn.github.io/SAVEHORSE/)。本地可用任意静态服务器打开 `public/game/`。完整工程预览使用：

```bash
pnpm install
pnpm dev
```

访问终端显示的本地地址。游戏运行时完全静态；修改源码后执行 `pnpm game:build`。GitHub Actions 会自动构建并发布。

## 操作

| 动作 | 键盘 | 触屏 |
|---|---|---|
| 左移 / 右移 | A / D 或 ← / → | 左侧透明方向盘 |
| 跳跃 / 二段跳 | W 或 ↑，分别点击 | 右侧跳跃圆钮 |
| 攻击 | J | 右侧攻击 |
| 技能 | K | 右侧技能 |
| 格挡 / 闪避 | L 原地格挡，带方向闪避 | 右侧格挡圆钮，配合方向闪避 |
| 暂停 | Esc | 右上角暂停 |

## GitHub Pages

1. 本项目已发布到 `Schonbrunnn/SAVEHORSE`，更新提交到 `main` 分支。
2. 在仓库 `Settings → Pages → Build and deployment` 中选择 `GitHub Actions`。
3. 工作流构建游戏后发布 `public/game/`，完成后仓库的 Actions 页面会显示访问地址。

## 当前地图

第一关先经过安全练习区与两批普通伏兵，盾卫长位于后山钟楼（约全图62%处）；击败后启动绞盘、放桥进洞。第二关保留上层可选挑战、下层配重主路和战后木屋。第三关通过上下双回路进入最终机甲室。

三张地图新增独立区域美术：6张背景和18件透明场景组件。详见 [地图节奏与区域美术](docs/2026-09-15-地图节奏与区域美术.md)。

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
