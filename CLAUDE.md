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
| `main.js` | 菜单、对话框（暂停 / 设置 / 档案 / 日志 / 结尾）、存档 `concrete.v2.save`、设置 `concrete.settings`、`window.__concrete.game` 调试入口 |
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
- 验证完一定要：关闭游戏音频 / 关闭面板标签（`game.pause(true)` 不会静音，曾导致用户电脑一直响背景音），并清掉测试存档 `localStorage.removeItem('concrete.v2.save')`、`concrete.settings`，视口重置为 desktop。

## 开发者模式（设置里开启）

移动速度 0.5–8×、双击空格飞行（空格上升 / Shift 下降）、飞行穿墙、传送（`DEV_SPOTS`）、右下角显示坐标 / 视角 / FPS。开发者模式下高处坠落不重置。

## 下一步：第二章《汛期》（分支 `feature/chapter2-flood`，已创建）

初步设计，可与用户确认后调整：

- **衔接**：第一章结尾卡片增加「进入第二章」，标题页在解锁后可选章节；存档加 `chapter` 字段，第二章开局视为第一章全部完成（砼核已重启，升降台在 96）。
- **天气系统**（`render/weather.js`）：入夜暴雨。太阳 / 半球光 / 环境光调暗，天空穹顶加色调与亮度 uniform，雾变暗变浓，雨丝（相机周围的实例化线条），闪电（短暂提亮 + 延迟雷声），混凝土粗糙度降低表现湿润，玩家手电（F 键，SpotLight，不投影）。结局转为黎明。
- **新区域**：砼核北墙在 +96 西侧平台开一道门 → 约 160 m 长的风雨栈桥通往北侧坝顶（替换原 z≈-475 的远景闸墩）。坝顶标高 96，三孔泄洪闸，每孔上方有启闭机房；上游水库为独立水面（无反射，水位 92→96 上涨）。
- **机制**：
  - 阵风：桥和坝顶上周期性横风，先有预警，躲在挡风墙后可免；几段护栏损坏，被吹落则回到最近的挡风墙。
  - 闸 1：机房合电、开闸（教学）。
  - 闸 2：机房断电，下到坝面 +88 的漆黑检修廊（要用手电）重置被淹的接线箱。
  - 闸 3：液压闸电力不足，手动泵压（按住 / 连按 E）。
  - 水位随时间上涨，开闸越多涨得越慢；漫过坝顶则失败，回到检查点（已开的闸保留）。
  - 三孔全开后水位回落，雨停天亮，第二章结束卡片。
- **配套**：新档案 a9–a12；音效（雨、风、雷、泄洪轰鸣）；`STEPS2`；第二章专用测试（水位、闸门顺序、失败重试、存档恢复）。
- 按功能小步提交，例如：章节与存档 → 天气 → 坝与栈桥几何 → 玩法 → 音效档案结尾。
