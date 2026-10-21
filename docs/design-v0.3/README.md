# docs/design-v0.3：设计参考（外星谷星网一期）

这个目录里的东西都是**设计参考**，可以随 PR 一起提交，但**不是游戏素材**，也不被游戏代码引用。

| 文件 | 是什么 |
| --- | --- |
| `三谷主题设计稿-v0.3.md` | 三谷主题设计稿 v0.3.1 全文。一期主要看 0.5（画质）、0.6（年龄档）、4.3–4.11（星网）、5.3（外星谷原型尺寸）、第 6 节（已拍板的决定）。文中引用的日谷、美谷图片没有放进来，链接会断，这是正常的 |
| `img/xing-*.jpg` | 外星谷概念图（`-v2`）和原型设定图（`-proto`）。只当方向参考，模型要用方块重新搭，尺寸以设计稿 5.3 为准 |
| `img/story-relations.jpg` | 跨谷角色关系图（第 1 章，一期不做，供以后接「拯救河谷」主线时参考） |
| `prototype-xing/src/kit.js` | 原型的方块工具：材质工厂 `M`、按最小角放方块 `B`、按中心放方块 `C`、角色体素 `VB`（`V = 0.075`）、`pivot`、`setNight` |
| `prototype-xing/src/builds-xing.js` | 数据穹顶 `dome`、悬浮修炼平台 `pad`、星舰「咕咕号」`ship`，每个都返回 `{ group, update(t, state) }` |
| `prototype-xing/src/chars-xing.js` | 通用少年体 `humanoid`、基础动画 `baseAnim`，以及星核化身 `avatar`、小咕 `gugu`、零一 `zero` |
| `prototype-xing/src/scene-reference.js` | 原型页的场景代码（灯光、雾、色调映射、泛光、画质开关）。它还引用了日谷和美谷的模型，**不能直接运行**，只用来对照外星谷的灯光和雾参数（`VALLEYS.xing`） |
| `prototype-xing/shots/*.jpg` | 原型截图：外星谷总览（夜）、星舰起飞、化身说话（夜）、小咕、零一扫描（夜） |

原型用的是 three 0.186.1（和仓库一致），只依赖 `three` 和 `MeshStandardMaterial`。搬进游戏时，按游戏里现有的合并网格和材质复用方式改写，不要把原型里每个方块一个 Mesh 的写法原样搬进去。
