# ComfyUI-ImageCompositionCy

一个强大的ComfyUI多图实时合成节点，支持在交互式Canvas画布上自由调整图片位置、大小和旋转角度，并支持自由绘画功能，实时预览合成效果。

## ✨ 主要特性

- 🎨 **实时预览** - 在Canvas上即时查看合成效果，无需运行工作流
- 🖱️ **直观操作** - 拖拽移动、缩放、旋转图片，所见即所得
- ✏️ **绘画功能** - 支持在画布上自由绘画，包括画笔、橡皮擦等工具
- 📐 **精确控制** - 支持输入精确数值调整位置和尺寸
- 🎭 **图层管理** - 调整图片层级，控制遮挡关系
- 🎨 **绘画工具** - 颜色选择器、画笔大小和透明度调节
- 💾 **参数保存** - 自动保存布局配置和绘画内容到工作流

## 📦 安装

1. 进入ComfyUI的 `custom_nodes` 目录：
```bash
cd ComfyUI/custom_nodes
```

2. 克隆本仓库：
```bash
git clone https://github.com/CY-CHENYUE/ComfyUI-ImageCompositionCy.git
```

3. 安装依赖：
```bash
cd ComfyUI-ImageCompositionCy
pip install -r requirements.txt
```

4. 重启ComfyUI

## 🎯 使用方法

### 基础使用

1. 在ComfyUI中添加 **Image Compositor** 节点
2. 连接底图到 `background_image` 输入（可选）
3. 连接要合成的图片到 `overlay_image_*` 输入
4. 在节点的Canvas画布上进行编辑

### 编辑模式
在编辑模式下，你可以：
- 拖拽图片调整位置
- 拖拽角点缩放图片
- 使用旋转手柄旋转图片
- 右键菜单管理图层

### 绘画模式
点击工具栏的铅笔图标或按 `D` 键切换到绘画模式：
- 使用画笔在画布上自由绘画
- 选择橡皮擦工具擦除绘画内容
- 调整颜色、画笔大小和透明度
- 清除所有绘画内容

## ⌨️ 快捷键

### 通用快捷键
- `D` - 切换编辑/绘画模式

### 编辑模式快捷键
- `Ctrl+A` - 全选所有图片
- `↑↓←→` - 微调选中图片位置（1px）
- `[` - 下移一层
- `]` - 上移一层
- `Shift+[` - 移到最底层
- `Shift+]` - 移到最顶层

### 绘画模式快捷键
- `B` - 选择画笔工具
- `E` - 选择橡皮擦工具
- `C` - 打开颜色选择器

## 🛠️ 高级功能

### 图层管理
- 置顶/置底
- 上移/下移一层
- 通过右键菜单访问图层选项

### 绘画工具
- **画笔** - 自由绘画工具
- **橡皮擦** - 擦除绘画内容
- **颜色选择器** - 选择绘画颜色
- **画笔大小** - 调节画笔粗细（1-50像素）
- **透明度** - 调节绘画透明度（0-100%）
- **清除** - 一键清除所有绘画内容

### 工具栏
- 紧凑的浮动工具栏设计
- 可折叠以节省空间
- 位于画布右上角，不遮挡内容

## 📖 节点参数

### 输入
- `input_count` (INT) - 叠加图片数量（1-20）
- `background_image` (IMAGE) - 底图，决定画布尺寸（可选）
- `overlay_image_*` (IMAGE) - 叠加图片（根据input_count动态显示）
- `composition_data` (STRING) - JSON格式的布局配置（自动管理）

### 输出
- `composite` (IMAGE) - 合成后的图片（包含绘画内容）
- `mask` (MASK) - 透明通道蒙版

## 🎨 界面说明

### Canvas画布
- 支持高DPI显示器
- 自适应图片尺寸
- 实时渲染预览

### 绘画层
- 独立的绘画层，不影响图片编辑
- 绘画内容会保存并合成到最终输出
- 支持透明度混合

## 💡 使用技巧

1. **模式切换** - 使用 `D` 键快速切换编辑和绘画模式
2. **精确定位** - 使用方向键进行像素级微调
3. **图层管理** - 使用快捷键快速调整图层顺序
4. **绘画技巧** - 调整透明度可以创建半透明效果

## 联系我

- X (Twitter): [@cychenyue](https://x.com/cychenyue)
- TikTok: [@cychenyue](https://www.tiktok.com/@cychenyue)
- YouTube: [@CY-CHENYUE](https://www.youtube.com/@CY-CHENYUE)
- BiliBili: [@CY-CHENYUE](https://space.bilibili.com/402808950)
- 小红书: [@CY-CHENYUE](https://www.xiaohongshu.com/user/profile/6360e61f000000001f01bda0)