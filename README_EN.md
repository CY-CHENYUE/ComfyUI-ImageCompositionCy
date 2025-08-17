# ComfyUI-ImageCompositionCy

[中文](./README.md) | English

A powerful ComfyUI multi-image composition node that supports real-time adjustment of image position, size, and rotation angle on an interactive Canvas, with freehand drawing capabilities and real-time preview of composition effects.

## ✨ Key Features

- 🎨 **Real-time Preview** - See composition effects instantly without running workflow
- 🖱️ **Intuitive Operation** - Drag-and-drop interaction, WYSIWYG
- ✏️ **Drawing Feature** - Freehand drawing on canvas with brush and eraser tools
- 📐 **Precise Control** - Support for precise numerical input for position and size
- 🎭 **Layer Management** - Adjust image layer order, control occlusion relationships
- 🎨 **Drawing Tools** - Color picker, brush size and opacity adjustment
- 🔀 **Transparency Support** - Fully preserve and process PNG transparency channels
- 💾 **Auto Save** - Layout configuration and drawing content automatically saved to workflow

## 📦 Installation

### Method 1: Install via ComfyUI Manager (Recommended)

1. Open **ComfyUI Manager** in ComfyUI
2. Search for **"ImageCompositionCy"** or **"Image Compositor"**
3. Click **Install**
4. Restart ComfyUI

### Method 2: Manual Installation

1. Navigate to ComfyUI's `custom_nodes` directory:
```bash
cd ComfyUI/custom_nodes
```

2. Clone this repository:
```bash
git clone https://github.com/CY-CHENYUE/ComfyUI-ImageCompositionCy.git
```

3. Install dependencies:
```bash
cd ComfyUI-ImageCompositionCy
pip install -r requirements.txt
```

4. Restart ComfyUI

## 🎯 Usage

### Basic Use

1. Add **Image Compositor** node to ComfyUI
2. Adjust `input_count` to set the number of inputs needed
3. Connect background image to `background_image` input (optional)
4. Connect images to compose to `overlay_image_*` inputs
5. Edit on the node's Canvas

### Edit Mode
In edit mode, you can:
- Drag images to adjust position
- Drag corner points to scale images
- Use rotation handle to rotate images
- Right-click menu for layer management

### Drawing Mode
Click the toolbar pencil icon or press `D` key to switch to drawing mode:
- Use brush to draw freely on canvas
- Select eraser tool to erase drawing content
- Adjust color, brush size and opacity
- Clear all drawings with one click

## ⌨️ Keyboard Shortcuts

### General Shortcuts
- `D` - Toggle edit/drawing mode

### Edit Mode Shortcuts
- `Ctrl+A` - Select all images
- `↑↓←→` - Fine-tune selected image position (1px)
- `[` - Move layer down
- `]` - Move layer up
- `Shift+[` - Send to back
- `Shift+]` - Bring to front

### Drawing Mode Shortcuts
- `B` - Select brush tool
- `E` - Select eraser tool
- `C` - Open color picker

## 🛠️ Advanced Features

### Layer Management
- Bring to front/Send to back
- Move up/down one layer
- Access layer options via right-click menu

### Drawing Tools
- **Brush** - Freehand drawing tool
- **Eraser** - Erase drawing content
- **Color Picker** - Select drawing color
- **Brush Size** - Adjust brush thickness (1-50 pixels)
- **Opacity** - Adjust drawing opacity (0-100%)
- **Clear** - Clear all drawings with one click

### Toolbar
- Compact floating toolbar design
- Collapsible to save space
- Located at top-right corner of canvas

### Transparency Handling

This node set provides two specialized nodes for handling image transparency:

#### Load Image (Alpha) 🖼️
A specialized node for loading and preserving PNG transparency channels.

**Features:**
- Fully preserves PNG transparency information
- Outputs 4-channel RGBA images
- Directly compatible with Image Compositor node

**Use Cases:**
- Loading PNG images with transparent backgrounds
- Creating compositions that require transparency

#### Combine Image Alpha 🔀
Combines RGB images from standard LoadImage node with masks to create transparent images.

**Features:**
- Accepts RGB image and MASK inputs
- Outputs RGBA images with transparency
- Fully compatible with ComfyUI standard nodes

**Use Cases:**
- Using standard LoadImage node but needing transparency
- Obtaining masks from other nodes and applying as alpha channel
- Dynamically generating transparency effects

**Workflow Example:**
```
LoadImage → [IMAGE] → Combine Image Alpha → [RGBA] → Image Compositor
      └─→ [MASK] ─→ ┘
```

## 📖 Node Parameters

### Image Compositor Node

#### Inputs
- `input_count` (INT) - Number of overlay images (1-20)
- `background_image` (IMAGE) - Background image, determines canvas size (optional)
- `overlay_image_*` (IMAGE) - Overlay images (dynamically displayed based on input_count)
- `composition_data` (STRING) - JSON format layout configuration (auto-managed)

#### Outputs
- `composite` (IMAGE) - Composited image (including drawings)
- `mask` (MASK) - Alpha channel mask

### Load Image (Alpha) Node

#### Inputs
- `image` - Image file to load

#### Outputs
- `IMAGE` - RGBA image with transparency channel

### Combine Image Alpha Node

#### Inputs
- `image` (IMAGE) - RGB image
- `mask` (MASK) - Alpha mask

#### Outputs
- `image` (IMAGE) - Combined RGBA image

## 🎨 Interface Description

### Canvas
- Supports high-DPI displays
- Adaptive image sizing
- Real-time rendering preview

### Drawing Layer
- Independent drawing layer, doesn't affect image editing
- Drawing content saved and composited to final output
- Supports transparency blending

## 💡 Tips & Tricks

1. **Mode Switching** - Use `D` key to quickly switch between edit and drawing modes
2. **Precise Positioning** - Use arrow keys for pixel-level adjustments
3. **Layer Management** - Use shortcuts to quickly adjust layer order
4. **Drawing Techniques** - Adjust opacity to create semi-transparent effects

## Contact Me

- X (Twitter): [@cychenyue](https://x.com/cychenyue)
- TikTok: [@cychenyue](https://www.tiktok.com/@cychenyue)
- YouTube: [@CY-CHENYUE](https://www.youtube.com/@CY-CHENYUE)
- BiliBili: [@CY-CHENYUE](https://space.bilibili.com/402808950)
- 小红书: [@CY-CHENYUE](https://www.xiaohongshu.com/user/profile/6360e61f000000001f01bda0)