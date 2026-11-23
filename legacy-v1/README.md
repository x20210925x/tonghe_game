# 砼核 · Concrete Core

第三人称巨构探索游戏。出门后在 P–03 旁通阀调节压力，打开泄压闸。斜桥经过排水口直抵动力间，原有栈桥也能通行。合闸后可驾驶 M–04 检修轨车前往升降井，再登上标高 78 米的观测台。

## 本地运行

在项目目录使用 Node.js 18 或更新版本运行 `npm start`，然后打开 <http://127.0.0.1:4173>。无需安装依赖。也可使用其他静态 HTTP 服务器托管本目录。

## 操作

| 操作 | 桌面 | 触屏 |
| --- | --- | --- |
| 移动 | WASD | 左侧摇杆 |
| 环视 | 按住鼠标拖动或使用方向键 | 在场景上滑动 |
| 慢跑 | 按住 Shift | 点击慢跑切换 |
| 操作设备 | E 或点击屏幕提示 | 点击交互提示 |
| 调整旁通阀 | A 关小、D 开大 | 点击阀门面板按钮 |
| 驾驶轨车 | W 牵引、S 制动、E 停车下车 | 按住牵引或制动按钮，点击下车提示 |
| 暂停 | Esc 或右上角暂停键 | 右上角暂停键 |

巡检进度与设置保存在当前浏览器。暂停菜单可保存并返回、重新开始，或调整图像质量与环视灵敏度。静音和全屏开关位于主菜单右上角。

主菜单使用原创生成画面，游玩场景使用本地 Three.js 实时渲染。建筑、巡检员、动画与声场由项目生成。引擎和反射组件采用 Three.js r160，许可随附于 assets/THREE-LICENSE.txt。

## 原创视觉素材

以下素材由内置 ImageGen 生成。场景不依赖远程资源。

| 文件 | 生成提示要点 |
| --- | --- |
| [spillway.webp](assets/spillway.webp) | 16:9 建筑摄影。巨型曲面混凝土泄洪肋、午后斜射光、浅水倒影、远处薄雾，穿旧橙色工装的巡检员背对镜头。为左侧标题保留暗部。 |
| [boardcast.webp](assets/boardcast.webp) | 正交拍摄的清水混凝土材质，约四米见方。保留模板木纹、细孔、矿物沉积和轻微的垂直水渍，均匀漫射光。 |
| [workwear.webp](assets/workwear.webp) | 四格写实材质图集。橙色旧帆布夹克背片、橄榄灰检修背包、炭灰工装裤腿、起皱的橙色袖料，保留织纹、接缝与磨损。 |
| [equipment.webp](assets/equipment.webp) | 四格设备照片风格图集。压制钢门板、带电压表的配电柜、带铆钉和水痕的闸板、双表盘控制台。以同一座旧水电站为材质参考。 |

## 实景采集素材

天空照明使用 [Poly Haven 的 Kloofendal 48d Partly Cloudy Pure Sky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)。混凝土使用 [Wood Textured Concrete](https://polyhaven.com/a/wood_textured_concrete) 和 [Concrete Floor Worn 001](https://polyhaven.com/a/concrete_floor_worn_001) 的颜色、法线及表面属性图。这些资源保存在项目中，采用 [Poly Haven 的 CC0 许可](https://polyhaven.com/license)。

## 回归检查

运行 `npm test` 可检查关节弯曲方向、支撑脚贴地、调压开闸、斜桥通行、轨车制动和存档恢复。
