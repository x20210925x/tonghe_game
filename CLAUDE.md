# 砼核 · Concrete Core — 项目说明（给 Claude / 新对话用）

第三人称巨构探索游戏，纯静态网页（Three.js r160，无构建、无依赖）。玩家是巡检员，从值班室出发 → 泄洪廊调压开闸 → 斜桥 → 动力间合闸 → 轨车 → 160 m 中空混凝土塔「砼核」→ 升降台断电后爬北墙梯 → 主控层重启 → 冠顶记录，结束。第一章约 8 分钟，8 份档案。

## 用户与协作偏好

- 用户说中文，回复用中文；用户在学 Git，边做边解释工作流。
- 用户会截图报问题，截图里通常带开发者读数（坐标 / 视角）。用同一坐标和视角复现再修。
- 只在用户要求时提交 / 推送。提交信息用英文，末尾附 `Co-Authored-By` 行。

## 运行、测试、发布

- 本地运行：`npm start` → http://127.0.0.1:4173（`server.mjs` 只是静态文件服务器）。用户自己常开着这个服务。
- 测试：`npm test`（node --test，纯逻辑：物理、剧情顺序、存档、轨车、步态）。改逻辑先写能复现的测试。
- 仓库：https://github.com/x20210925x/tonghe_game ，`main` 通过 GitHub Pages 发布（https://x20210925x.github.io/tonghe_game/ ，有 `.nojekyll`）。**main 上的提交会直接上线**，新功能一律在 feature 分支开发，做完再合并。
- `legacy-v1/` 是第一版备份，不要改。

## 目录结构（src/）

| 路径 | 作用 |
| --- | --- |
| `main.js` | 菜单、章节选择、对话框（暂停 / 设置 / 档案 / 日志 / 结尾）、存档（每章一个：`concrete.v2.save` / `concrete.v2.save.ch2`）、通关进度 `concrete.progress`、设置 `concrete.settings`、`window.__concrete.game` 调试入口 |
| `game/game.js` | 主循环与模式（walk / valve / cart / cinematic）、交互列表 `makeInteractables()`、坠落重生、HUD、提示、开发者模式（传送、飞行）、自由视角 |
| `game/site.js` | 剧情旗标 + 所有机械状态（阀门、闸门、轨车、升降台），纯逻辑可测 |
| `game/quest.js` | `STEPS`：按顺序的目标列表，`objective()` 取第一个未完成的 |
| `game/layout.js` | **所有共享坐标的唯一来源**（区域、机器、档案位置、`DEV_SPOTS` 传送点、`areaAt()`） |
| `game/lore.js` | 档案文本 a1–a8 |
| `engine/physics.js` | 绕竖轴旋转的盒体碰撞、角色控制、移动平台携带、相机射线、飞行 / 穿墙 |
| `engine/input.js` / `camera.js` / `audio.js` | 输入合并（键鼠 / 指针锁定 / 触屏 / 手柄）、第三人称相机、全合成声场 |
| `actor/worker.js` / `player.js` | 程序化巡检员模型 + 步态 IK（腰部关节在 0.86 m）、角色手感（后退、跳跃缓冲、飞行） |
| `world/builder.js` | 几何 DSL：`box / slab / block / rail / handrail / flight / beam / gantry / trench / plate / barrier / collider`，按材质批量实例化 |
| `world/zones.js` | 值班室、泄洪廊、梯塔、斜桥（含桥台、桥墩）、动力间、检修道、栈桥 |
| `world/core.js` / `coreworks.js` | 砼核主体 / 升降台、安全门、井壁灯、信标、主控台 |
| `world/machines.js` / `pickups.js` / `scenery.js` | 门、闸、阀、轨车、开关；档案拾取物；肋墙、远景、水面、雾团、两个太阳 |
| `render/` | 混凝土材质、HDR 日光、后期（AO + 泛光）、湿地面反射、尘埃、`cascade.js`（双级阴影） |

坐标约定：Y 向上，-Z 为路线前进方向。地面 y=0，升降台停靠 0 / 48 / 96 / 132。

## 已踩过的坑（务必遵守）

- **共面 = 闪烁方块**：两个面在同一高度会 z-fighting（曾在升降台地板上表现为“方块瑕疵”）。叠加的板、边梁、收边条要错开至少 1–3 cm。
- **贴近镜头的大面片 = “白色雾面”**：别再用大的半透明 Sprite / 面片做雾或光柱。雾团现在在甲板以下，并随相机距离淡出；核心井里的光柱已删除，靠阴影出光斑。
- **指示牌要真实**：`textPlate` 自带钢板背面；牌子挂在门架（`gantry`）、栏杆或结构上，不要立在通道中间。
- **线缆 / 管道要有合理路线**：走地沟（`trench`）、桥架、立柱，不要躺在地上或悬空，不要穿过楼梯。
- **支撑要落地**：平台、栈桥要有柱子 / 支架落到水里或结构上，斜撑不能伸进空中，也不能穿过旁边梯段的空间。
- **着色器补丁**：`cascade.js` 改了 `ShaderChunk.lights_fragment_begin`；被 unroll 的循环里声明变量必须包在 `{}` 里。改完检查 `renderer.info.programs` 无编译失败。两个太阳强度相同，由补丁按片元选一个（0 号近级跟随玩家，1 号远级静态）。
- 新加的可走表面要同时加碰撞（`collide` 参数或 `collider()`），护栏用 `barrier`（不挡相机）。
- 跳跃落地：物理里下落时会被 `stepUp` 内的台阶 / 上升平台接住（有测试），改物理别破坏这些测试。

## 浏览器验证方法（Claude Browser 面板）

面板隐藏时 requestAnimationFrame 被限到约 1 fps，**不要等实时循环**，直接用脚本驱动：

```js
const g = window.__concrete.game;      // 先点 #start 进入游戏
g.pause(true); document.getElementById('veil').hidden = true;
g.restore({ v: 2, site: { flags: { door: true, valve: true /* … */ }, liftY: 48 }, player: { x, y, z, yaw }, cam: { yaw, pitch } });
g.player.place(x, y, z, yaw); g.rig.yaw = yaw; g.rig.pitch = pitch; g.rig.snap();
for (let i = 0; i < 90; i++) g.step(1 / 60);           // 推进模拟
g.post.render(g.scene, g.camera, g.settings.quality);   // 然后截图
g.input.keys.add('KeyW'); g.input.pressed.add('KeyE');  // 模拟按键
```

- 截图会触发可见性变化并自动暂停（正常行为）。
- 验证时先在 `concrete.settings` 里设 `muted: true` 再进游戏。
- 验证完一定要：关闭游戏音频 / 关闭面板标签（`game.pause(true)` 不会静音，曾导致用户电脑一直响背景音），并清掉所有 `concrete.` 开头的 localStorage 键（两章存档、`concrete.progress`、`concrete.settings`），视口重置为 desktop。
- 章节：`g.restore(save, chapter)`；第二章开局 = 第一章旗标全开、升降台在 96、出生在主控层（`CH2_SPAWN`）。

## 开发者模式（设置里开启）

移动速度 0.5–8×、双击空格飞行（空格上升 / Shift 下降）、飞行穿墙、传送（`DEV_SPOTS`）、右下角显示坐标 / 视角 / FPS。开发者模式下高处坠落不重置。

## 第二章《汛期》（分支 `feature/chapter2-flood`）

第一章通关后解锁（`concrete.progress`），标题页底部选章节。第二章开局在主控层（`CH2_SPAWN`），第一章旗标全开、升降台在 96。

路线（`STEPS2`）：北门（北墙梯顶平台 x 64–67）→ 风雨栈桥 → 坝顶 → 1 号闸机房合电、开 1 号闸 → 竖井下到 +084 检修廊复位接线箱 → 开 2 号闸 → 3 号闸手压泵（按住 / 连按 E，移动键离开）→ 等水位回落（天转黎明）→ 坝顶西端水尺站记录水情 → 结尾环绕镜头。档案 a9–a12。

| 路径 | 作用 |
| --- | --- |
| `game/flood.js` | 纯规则：水位涨速（按开闸数插值）、警报水位、阵风节拍 `gustAt`、受风区域 `windExposure`、被吹落后的避风处 `refugeBehind`、手压泵参数 |
| `game/site.js` | 第二章状态：`level`、`gates`、`pump`、`atPump`、`overtopped`、`fails`；`openGate / canOpen / recover / stepFlood` |
| `world/dam.js` | 北门、栈桥（桁架、3 座桥墩、避风处、断护栏）、北坝（阶梯坝面、三孔闸、闸门叶、启闭机房、竖井、检修廊、水库、泄洪水幕、水尺站）、跟随玩家的机房顶灯 |
| `render/weather.js` | `day / storm / dawn` 三种天气：天穹、日光变月光、雾、雨丝、闪电、湿混凝土、头灯 |

要点：
- 水位从踏上栈桥（`bridge` 旗标）才开始涨；漫顶（96.0）→ 回到 `CHECKPOINTS2` 最近检查点，水位退到 93.5，已开的闸保留。
- 阵风只在栈桥开阔段起作用，从西往东推；断护栏在东侧。顶风向西奔跑可以站住。
- 坝体高程：坝顶 96，闸底板 89，检修廊 84–87，坝面 +70 以下是 20 级台阶。坐标都在 `layout.js` 的第二章段落。
- 第一章里北门关闭、无提示，天气为白天；坝体、栈桥照常可见。
- 灯光预算：全场只多了 1 个聚光灯（头灯）和 1 个点光源（机房顶灯），开关时只改强度，不增删灯，避免着色器重编译。
