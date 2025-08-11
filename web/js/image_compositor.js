import { app } from '../../../scripts/app.js'
import { api } from '../../../scripts/api.js'

// 变换控制点类型
const HandleType = {
    TOP_LEFT: 'tl',
    TOP_CENTER: 'tc',
    TOP_RIGHT: 'tr',
    MIDDLE_LEFT: 'ml',
    MIDDLE_RIGHT: 'mr',
    BOTTOM_LEFT: 'bl',
    BOTTOM_CENTER: 'bc',
    BOTTOM_RIGHT: 'br',
    ROTATE: 'rotate'
};

// Canvas编辑器类
class CanvasEditor {
    constructor(canvas, node) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.node = node;
        
        // 获取设备像素比
        this.dpr = window.devicePixelRatio || 1;
        
        // 设置初始缩放，支持高DPI
        this.ctx.scale(this.dpr, this.dpr);
        
        // 设置高质量图像渲染
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // 图片管理
        this.images = [];
        this.selectedImage = null;
        this.selectedImages = new Set();
        
        // Canvas尺寸管理
        this.maxCanvasSize = 1024;  // Canvas最大显示尺寸，进一步提高分辨率获得最佳清晰度
        
        // 交互状态
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.activeHandle = null;
        
        // 鼠标位置记录
        this.dragStart = { x: 0, y: 0 };
        this.imageStart = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
        
        // 剪贴板
        this.clipboard = null;
        
        // 绘画模式相关
        this.mode = 'edit';  // 'edit' or 'draw'
        this.isDrawing = false;
        this.drawingTool = 'brush';  // 'brush', 'eraser'
        this.brushSize = 5;
        this.brushColor = '#000000';
        this.brushOpacity = 1.0;
        this.lastDrawPos = null;
        
        // 创建绘画层canvas
        this.drawingCanvas = document.createElement('canvas');
        this.drawingCtx = this.drawingCanvas.getContext('2d');
        this.drawingCanvas.width = this.canvas.width;
        this.drawingCanvas.height = this.canvas.height;
        this.drawingCtx.scale(this.dpr, this.dpr);
        
        // 绘画路径历史
        this.drawingPaths = [];
        this.currentPath = null;
        
        this.setupEventListeners();
        this.createDrawingToolbar();
        this.renderComposite();
    }
    
    setupEventListeners() {
        // 鼠标事件 - 使用bind确保this上下文正确
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this)); // 鼠标离开时也触发mouseup
        this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
        
        // 右键菜单
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e);
        });
        
        // 键盘事件 - 当Canvas获得焦点时
        this.canvas.tabIndex = 1; // 允许Canvas获得焦点
        this.canvas.addEventListener('keydown', this.onKeyDown.bind(this));
    }
    
    createDrawingToolbar() {
        // 创建紧凑的浮动工具栏
        const toolbar = document.createElement('div');
        toolbar.className = 'canvas-drawing-toolbar';
        toolbar.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(30, 30, 30, 0.85);
            backdrop-filter: blur(10px);
            border-radius: 8px;
            padding: 4px;
            z-index: 1000;
            color: white;
            font-size: 11px;
            display: flex;
            gap: 2px;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        
        // 统一尺寸的直观SVG图标
        const icons = {
            // 绘画模式 - 铅笔图标
            draw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            
            // 编辑模式 - 移动十字箭头
            edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            
            // 画笔工具 - 与绘画模式图标一致
            brush: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            
            // 橡皮擦工具 - 简化的橡皮擦
            eraser: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7l-4-4a1 1 0 0 1 0-1.414l10-10a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1 0 1.414l-10 10z" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 13l-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            
            // 清除 - 垃圾桶
            clear: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11v6M14 11v6" stroke-linecap="round"/></svg>',
            
            // 折叠/展开箭头
            collapse: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
            expand: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
        };
        
        // 折叠/展开按钮
        const collapseBtn = document.createElement('button');
        collapseBtn.innerHTML = icons.collapse;
        collapseBtn.title = '折叠工具栏';
        collapseBtn.style.cssText = `
            padding: 4px;
            background: transparent;
            color: #888;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            transition: all 0.2s;
        `;
        collapseBtn.onmouseover = () => collapseBtn.style.background = 'rgba(255,255,255,0.1)';
        collapseBtn.onmouseout = () => collapseBtn.style.background = 'transparent';
        toolbar.appendChild(collapseBtn);
        this.collapseBtn = collapseBtn;
        
        // 工具容器（可折叠部分）
        const toolsContainer = document.createElement('div');
        toolsContainer.style.cssText = `
            display: flex;
            gap: 2px;
            align-items: center;
        `;
        toolbar.appendChild(toolsContainer);
        this.toolsContainer = toolsContainer;
        
        // 模式切换按钮
        const modeBtn = document.createElement('button');
        modeBtn.innerHTML = icons.draw;
        modeBtn.title = '切换绘画模式 (D)';
        modeBtn.style.cssText = `
            padding: 5px 8px;
            background: rgba(76, 175, 80, 0.8);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            font-size: 11px;
            transition: all 0.2s;
        `;
        modeBtn.onmouseover = () => modeBtn.style.background = 'rgba(76, 175, 80, 1)';
        modeBtn.onmouseout = () => modeBtn.style.background = this.mode === 'draw' ? 'rgba(33, 150, 243, 0.8)' : 'rgba(76, 175, 80, 0.8)';
        modeBtn.onclick = () => this.toggleMode();
        toolsContainer.appendChild(modeBtn);
        this.modeButton = modeBtn;
        
        // 分隔符
        const separator1 = document.createElement('div');
        separator1.style.cssText = 'width: 1px; height: 18px; background: rgba(255,255,255,0.2);';
        toolsContainer.appendChild(separator1);
        this.separator1 = separator1;
        
        // 画笔工具
        const brushBtn = document.createElement('button');
        brushBtn.innerHTML = icons.brush;
        brushBtn.title = '画笔 (B)';
        brushBtn.style.cssText = `
            padding: 5px;
            background: transparent;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            transition: all 0.2s;
        `;
        brushBtn.onmouseover = () => {
            if (this.drawingTool !== 'brush') brushBtn.style.background = 'rgba(255,255,255,0.1)';
        };
        brushBtn.onmouseout = () => brushBtn.style.background = this.drawingTool === 'brush' ? 'rgba(76, 175, 80, 0.6)' : 'transparent';
        brushBtn.onclick = () => this.selectTool('brush');
        toolsContainer.appendChild(brushBtn);
        this.brushButton = brushBtn;
        
        // 橡皮擦工具
        const eraserBtn = document.createElement('button');
        eraserBtn.innerHTML = icons.eraser;
        eraserBtn.title = '橡皮擦 (E)';
        eraserBtn.style.cssText = `
            padding: 5px;
            background: transparent;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            transition: all 0.2s;
        `;
        eraserBtn.onmouseover = () => {
            if (this.drawingTool !== 'eraser') eraserBtn.style.background = 'rgba(255,255,255,0.1)';
        };
        eraserBtn.onmouseout = () => eraserBtn.style.background = this.drawingTool === 'eraser' ? 'rgba(76, 175, 80, 0.6)' : 'transparent';
        eraserBtn.onclick = () => this.selectTool('eraser');
        toolsContainer.appendChild(eraserBtn);
        this.eraserButton = eraserBtn;
        
        // 颜色选择器
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = this.brushColor;
        colorPicker.title = '选择颜色 (C)';
        colorPicker.style.cssText = `
            width: 24px;
            height: 24px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 4px;
            cursor: pointer;
            padding: 0;
            background: transparent;
        `;
        colorPicker.oninput = (e) => {
            this.brushColor = e.target.value;
        };
        toolsContainer.appendChild(colorPicker);
        this.colorPicker = colorPicker;
        
        // 画笔大小滑块
        const sizeSlider = document.createElement('input');
        sizeSlider.type = 'range';
        sizeSlider.min = '1';
        sizeSlider.max = '50';
        sizeSlider.value = this.brushSize;
        sizeSlider.title = `画笔大小: ${this.brushSize}`;
        sizeSlider.style.cssText = 'width: 60px; cursor: pointer;';
        sizeSlider.oninput = (e) => {
            this.brushSize = parseInt(e.target.value);
            sizeSlider.title = `画笔大小: ${this.brushSize}`;
        };
        toolsContainer.appendChild(sizeSlider);
        this.sizeSlider = sizeSlider;
        
        // 透明度滑块
        const opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.min = '0';
        opacitySlider.max = '100';
        opacitySlider.value = this.brushOpacity * 100;
        opacitySlider.title = `透明度: ${Math.round(this.brushOpacity * 100)}%`;
        opacitySlider.style.cssText = 'width: 60px; cursor: pointer;';
        opacitySlider.oninput = (e) => {
            this.brushOpacity = parseInt(e.target.value) / 100;
            opacitySlider.title = `透明度: ${Math.round(this.brushOpacity * 100)}%`;
        };
        toolsContainer.appendChild(opacitySlider);
        this.opacitySlider = opacitySlider;
        
        // 分隔符
        const separator2 = document.createElement('div');
        separator2.style.cssText = 'width: 1px; height: 18px; background: rgba(255,255,255,0.2);';
        toolsContainer.appendChild(separator2);
        
        // 清除按钮
        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = icons.clear;
        clearBtn.title = '清除绘画';
        clearBtn.style.cssText = `
            padding: 5px;
            background: transparent;
            color: #f44336;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            transition: all 0.2s;
        `;
        clearBtn.onmouseover = () => clearBtn.style.background = 'rgba(244, 67, 54, 0.2)';
        clearBtn.onmouseout = () => clearBtn.style.background = 'transparent';
        clearBtn.onclick = () => this.clearDrawing();
        toolsContainer.appendChild(clearBtn);
        
        // 实现折叠功能
        this.toolbarCollapsed = false;
        collapseBtn.onclick = () => {
            this.toolbarCollapsed = !this.toolbarCollapsed;
            if (this.toolbarCollapsed) {
                toolsContainer.style.display = 'none';
                collapseBtn.innerHTML = icons.expand;
                collapseBtn.title = '展开工具栏';
                toolbar.style.padding = '4px 4px 4px 8px';
            } else {
                toolsContainer.style.display = 'flex';
                collapseBtn.innerHTML = icons.collapse;
                collapseBtn.title = '折叠工具栏';
                toolbar.style.padding = '4px';
            }
        };
        
        // 将工具栏添加到canvas的父容器（应该是我们创建的container）
        if (this.canvas.parentElement) {
            // 确保父容器的position是relative（虽然我们已经在创建时设置了）
            if (!this.canvas.parentElement.style.position || this.canvas.parentElement.style.position === 'static') {
                this.canvas.parentElement.style.position = 'relative';
            }
            this.canvas.parentElement.appendChild(toolbar);
        }
        
        this.toolbar = toolbar;
        
        // 初始化工具选择状态
        this.selectTool('brush');
        
        // 初始隐藏绘画工具
        this.updateToolbarVisibility();
    }
    
    toggleMode() {
        this.mode = this.mode === 'edit' ? 'draw' : 'edit';
        this.updateToolbarVisibility();
        
        // 更新模式按钮图标 - 使用统一的14x14尺寸
        if (this.modeButton) {
            const icons = {
                draw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            };
            
            const icon = this.mode === 'draw' ? icons.edit : icons.draw;
            this.modeButton.innerHTML = icon;
            this.modeButton.style.background = this.mode === 'draw' ? 'rgba(33, 150, 243, 0.8)' : 'rgba(76, 175, 80, 0.8)';
            this.modeButton.title = this.mode === 'draw' ? '切换到编辑模式 (D)' : '切换到绘画模式 (D)';
        }
        
        // 切换到绘画模式时取消选择
        if (this.mode === 'draw') {
            this.selectedImage = null;
            this.selectedImages.clear();
            this.renderComposite();
        }
    }
    
    selectTool(tool) {
        this.drawingTool = tool;
        
        // 更新按钮状态 - 不改变图标大小
        if (this.brushButton) {
            this.brushButton.style.background = tool === 'brush' ? 'rgba(76, 175, 80, 0.6)' : 'transparent';
        }
        if (this.eraserButton) {
            this.eraserButton.style.background = tool === 'eraser' ? 'rgba(76, 175, 80, 0.6)' : 'transparent';
        }
    }
    
    updateToolbarVisibility() {
        // 根据模式显示/隐藏工具
        if (!this.toolbar) return;
        
        const display = this.mode === 'draw' ? '' : 'none';
        
        // 绘画工具和控件
        const drawingElements = [
            this.separator1,
            this.brushButton,
            this.eraserButton,
            this.colorPicker,
            this.sizeSlider,
            this.opacitySlider
        ];
        
        drawingElements.forEach(element => {
            if (element) {
                element.style.display = display;
            }
        });
        
        // 清除按钮及其分隔符
        const clearBtn = this.toolbar.querySelector('button[title="清除绘画"]');
        if (clearBtn) {
            clearBtn.style.display = display;
            if (clearBtn.previousElementSibling && clearBtn.previousElementSibling.style.cssText.includes('background')) {
                clearBtn.previousElementSibling.style.display = display;
            }
        }
        
        // 确保初始工具选中状态
        if (this.mode === 'draw' && !this.drawingTool) {
            this.selectTool('brush');
        }
    }
    
    clearDrawing() {
        // 清除绘画层
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width / this.dpr, this.drawingCanvas.height / this.dpr);
        this.drawingPaths = [];
        this.renderComposite();
        this.updateNodeData();
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 转换为逻辑坐标（考虑CSS缩放但不包含DPR）
        const logicalWidth = this.canvas.width / this.dpr;
        const logicalHeight = this.canvas.height / this.dpr;
        const scaleX = logicalWidth / rect.width;
        const scaleY = logicalHeight / rect.height;
        
        return {
            x: x * scaleX,
            y: y * scaleY
        };
    }
    
    getImageAt(x, y) {
        // 从上到下查找（后绘制的在上面）
        for (let i = this.images.length - 1; i >= 0; i--) {
            const img = this.images[i];
            // 跳过背景图，背景图不可选中
            if (img.isBackground) continue;
            if (this.isPointInImage(x, y, img)) {
                return img;
            }
        }
        return null;
    }
    
    isPointInImage(x, y, img) {
        // 考虑旋转的碰撞检测
        const cx = img.x + img.width / 2;
        const cy = img.y + img.height / 2;
        const angle = -img.rotation * Math.PI / 180;
        
        // 将点转换到图片的局部坐标系
        const dx = x - cx;
        const dy = y - cy;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + cx;
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + cy;
        
        return localX >= img.x && localX <= img.x + img.width &&
               localY >= img.y && localY <= img.y + img.height;
    }
    
    getHandleAt(x, y) {
        if (!this.selectedImage) return null;
        
        const handles = this.getHandles(this.selectedImage);
        const handleSize = 12;  // 增加检测范围，让控制点更容易被点击
        
        for (const [type, pos] of Object.entries(handles)) {
            const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
            if (dist <= handleSize) {
                return type;
            }
        }
        
        return null;
    }
    
    getHandles(img) {
        const cx = img.x + img.width / 2;
        const cy = img.y + img.height / 2;
        const angle = img.rotation * Math.PI / 180;
        
        // 计算旋转后的角点位置
        const corners = [
            { x: img.x, y: img.y, type: HandleType.TOP_LEFT },
            { x: img.x + img.width / 2, y: img.y, type: HandleType.TOP_CENTER },
            { x: img.x + img.width, y: img.y, type: HandleType.TOP_RIGHT },
            { x: img.x, y: img.y + img.height / 2, type: HandleType.MIDDLE_LEFT },
            { x: img.x + img.width, y: img.y + img.height / 2, type: HandleType.MIDDLE_RIGHT },
            { x: img.x, y: img.y + img.height, type: HandleType.BOTTOM_LEFT },
            { x: img.x + img.width / 2, y: img.y + img.height, type: HandleType.BOTTOM_CENTER },
            { x: img.x + img.width, y: img.y + img.height, type: HandleType.BOTTOM_RIGHT }
        ];
        
        const handles = {};
        
        // 旋转每个控制点
        corners.forEach(corner => {
            const dx = corner.x - cx;
            const dy = corner.y - cy;
            handles[corner.type] = {
                x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
                y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
            };
        });
        
        // 旋转手柄（在顶部中心上方）
        handles[HandleType.ROTATE] = {
            x: cx - 30 * Math.sin(angle),
            y: cy - 30 * Math.cos(angle) - img.height / 2
        };
        
        return handles;
    }
    
    onMouseDown(e) {
        // 让Canvas获得焦点以接收键盘事件
        this.canvas.focus();
        
        const pos = this.getMousePos(e);
        
        // 如果在绘画模式，开始绘画
        if (this.mode === 'draw') {
            this.startDrawing(pos);
            return;
        }
        
        // 编辑模式的原有逻辑
        // 检查是否点击了控制点
        const handle = this.getHandleAt(pos.x, pos.y);
        if (handle) {
            if (handle === HandleType.ROTATE) {
                this.startRotating(pos);
            } else {
                this.startResizing(pos, handle);
            }
            return;
        }
        
        // 检查是否点击了图片
        const clickedImage = this.getImageAt(pos.x, pos.y);
        
        if (e.shiftKey && clickedImage) {
            // Shift+点击：多选
            if (this.selectedImages.has(clickedImage)) {
                this.selectedImages.delete(clickedImage);
            } else {
                this.selectedImages.add(clickedImage);
            }
            this.selectedImage = clickedImage;
        } else if (clickedImage) {
            // 普通点击：选中并开始拖拽
            this.selectedImage = clickedImage;
            this.selectedImages.clear();
            this.selectedImages.add(clickedImage);
            this.startDragging(pos);
        } else {
            // 点击空白：取消选择
            this.selectedImage = null;
            this.selectedImages.clear();
        }
        
        this.renderComposite();
    }
    
    startDrawing(pos) {
        this.isDrawing = true;
        this.lastDrawPos = pos;
        
        // 开始新的绘画路径
        this.currentPath = {
            tool: this.drawingTool,
            color: this.brushColor,
            size: this.brushSize,
            opacity: this.brushOpacity,
            points: [pos]
        };
        
        // 设置绘画上下文
        this.drawingCtx.globalCompositeOperation = this.drawingTool === 'eraser' ? 'destination-out' : 'source-over';
        this.drawingCtx.globalAlpha = this.brushOpacity;
        this.drawingCtx.strokeStyle = this.brushColor;
        this.drawingCtx.lineWidth = this.brushSize;
        this.drawingCtx.lineCap = 'round';
        this.drawingCtx.lineJoin = 'round';
        
        // 开始路径
        this.drawingCtx.beginPath();
        this.drawingCtx.moveTo(pos.x, pos.y);
    }
    
    startDragging(pos) {
        this.isDragging = true;
        this.dragStart = pos;
        this.imageStart = {
            x: this.selectedImage.x,
            y: this.selectedImage.y
        };
    }
    
    startResizing(pos, handle) {
        this.isResizing = true;
        this.activeHandle = handle;
        this.dragStart = pos;
        this.imageStart = {
            x: this.selectedImage.x,
            y: this.selectedImage.y,
            width: this.selectedImage.width,
            height: this.selectedImage.height
        };
    }
    
    startRotating(pos) {
        this.isRotating = true;
        this.dragStart = pos;
        this.imageStart = {
            rotation: this.selectedImage.rotation || 0
        };
    }
    
    onMouseMove(e) {
        const pos = this.getMousePos(e);
        
        // 如果在绘画模式且正在绘画
        if (this.mode === 'draw' && this.isDrawing) {
            e.preventDefault();
            this.handleDrawing(pos);
            return;
        }
        
        // 编辑模式的原有逻辑
        if (this.isDragging && this.selectedImage) {
            e.preventDefault();
            this.handleDragging(pos);
        } else if (this.isResizing && this.selectedImage) {
            e.preventDefault();
            this.handleResizing(pos, e);
        } else if (this.isRotating && this.selectedImage) {
            e.preventDefault();
            this.handleRotating(pos, e);
        } else {
            // 更新鼠标光标
            this.updateCursor(pos);
        }
    }
    
    handleDrawing(pos) {
        if (!this.lastDrawPos) return;
        
        // 使用二次贝塞尔曲线使线条更平滑
        const midX = (this.lastDrawPos.x + pos.x) / 2;
        const midY = (this.lastDrawPos.y + pos.y) / 2;
        
        this.drawingCtx.quadraticCurveTo(this.lastDrawPos.x, this.lastDrawPos.y, midX, midY);
        this.drawingCtx.stroke();
        
        // 立即开始新路径以继续绘制
        this.drawingCtx.beginPath();
        this.drawingCtx.moveTo(midX, midY);
        
        // 记录点到路径
        if (this.currentPath) {
            this.currentPath.points.push(pos);
        }
        
        this.lastDrawPos = pos;
        
        // 实时更新显示
        this.renderComposite();
    }
    
    handleDragging(pos) {
        const dx = pos.x - this.dragStart.x;
        const dy = pos.y - this.dragStart.y;
        
        let newX = this.imageStart.x + dx;
        let newY = this.imageStart.y + dy;
        
        // 获取背景图边界（如果有背景图）
        const bgImage = this.images.find(img => img.isBackground);
        if (bgImage) {
            // 限制在背景图范围内
            const minX = bgImage.x;
            const minY = bgImage.y;
            const maxX = bgImage.x + bgImage.width - this.selectedImage.width;
            const maxY = bgImage.y + bgImage.height - this.selectedImage.height;
            
            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));
        } else {
            // 如果没有背景图，限制在画布范围内
            const logicalWidth = this.canvas.width / this.dpr;
            const logicalHeight = this.canvas.height / this.dpr;
            newX = Math.max(0, Math.min(logicalWidth - this.selectedImage.width, newX));
            newY = Math.max(0, Math.min(logicalHeight - this.selectedImage.height, newY));
        }
        
        // 批量移动选中的图片
        if (this.selectedImages.size > 1) {
            const deltaX = newX - this.selectedImage.x;
            const deltaY = newY - this.selectedImage.y;
            this.selectedImages.forEach(img => {
                if (img !== this.selectedImage && !img.isBackground) {
                    img.x += deltaX;
                    img.y += deltaY;
                }
            });
        }
        
        this.selectedImage.x = newX;
        this.selectedImage.y = newY;
        
        // 使用requestAnimationFrame优化渲染
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => {
                this.renderComposite();
                this.renderPending = false;
            });
        }
    }
    
    handleResizing(pos, e) {
        const dx = pos.x - this.dragStart.x;
        const dy = pos.y - this.dragStart.y;
        
        let newX = this.imageStart.x;
        let newY = this.imageStart.y;
        let newWidth = this.imageStart.width;
        let newHeight = this.imageStart.height;
        
        // 获取原始宽高比
        const aspectRatio = this.selectedImage.originalWidth / this.selectedImage.originalHeight;
        
        // 根据不同的控制点调整大小（始终保持比例）
        switch (this.activeHandle) {
            case HandleType.TOP_LEFT:
                // 从左上角缩放，保持比例
                const tlDelta = Math.max(Math.abs(dx), Math.abs(dy)) * (dx < 0 || dy < 0 ? -1 : 1);
                newWidth = this.imageStart.width - tlDelta;
                newHeight = newWidth / aspectRatio;
                newX = this.imageStart.x + this.imageStart.width - newWidth;
                newY = this.imageStart.y + this.imageStart.height - newHeight;
                break;
                
            case HandleType.TOP_CENTER:
                // 从顶部中心缩放，只改变高度
                newHeight = this.imageStart.height - dy;
                newWidth = newHeight * aspectRatio;
                newX = this.imageStart.x - (newWidth - this.imageStart.width) / 2;
                newY = this.imageStart.y + dy;
                break;
                
            case HandleType.TOP_RIGHT:
                // 从右上角缩放
                const trDelta = Math.max(Math.abs(dx), Math.abs(dy)) * (dx > 0 || dy < 0 ? 1 : -1);
                newWidth = this.imageStart.width + trDelta;
                newHeight = newWidth / aspectRatio;
                newY = this.imageStart.y + this.imageStart.height - newHeight;
                break;
                
            case HandleType.MIDDLE_LEFT:
                // 从左边中心缩放
                newWidth = this.imageStart.width - dx;
                newHeight = newWidth / aspectRatio;
                newX = this.imageStart.x + dx;
                newY = this.imageStart.y - (newHeight - this.imageStart.height) / 2;
                break;
                
            case HandleType.MIDDLE_RIGHT:
                // 从右边中心缩放
                newWidth = this.imageStart.width + dx;
                newHeight = newWidth / aspectRatio;
                newY = this.imageStart.y - (newHeight - this.imageStart.height) / 2;
                break;
                
            case HandleType.BOTTOM_LEFT:
                // 从左下角缩放
                const blDelta = Math.max(Math.abs(dx), Math.abs(dy)) * (dx < 0 || dy > 0 ? 1 : -1);
                newWidth = this.imageStart.width - blDelta;
                newHeight = newWidth / aspectRatio;
                newX = this.imageStart.x + this.imageStart.width - newWidth;
                break;
                
            case HandleType.BOTTOM_CENTER:
                // 从底部中心缩放
                newHeight = this.imageStart.height + dy;
                newWidth = newHeight * aspectRatio;
                newX = this.imageStart.x - (newWidth - this.imageStart.width) / 2;
                break;
                
            case HandleType.BOTTOM_RIGHT:
                // 从右下角缩放（最常用）
                const brDelta = Math.max(Math.abs(dx), Math.abs(dy)) * (dx > 0 || dy > 0 ? 1 : -1);
                newWidth = this.imageStart.width + brDelta;
                newHeight = newWidth / aspectRatio;
                break;
        }
        
        // 保持最小尺寸
        if (newWidth < 20) {
            newWidth = 20;
            newHeight = newWidth / aspectRatio;
        }
        if (newHeight < 20) {
            newHeight = 20;
            newWidth = newHeight * aspectRatio;
        }
        
        this.selectedImage.x = newX;
        this.selectedImage.y = newY;
        this.selectedImage.width = newWidth;
        this.selectedImage.height = newHeight;
        
        // 优化渲染
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => {
                this.renderComposite();
                this.renderPending = false;
            });
        }
    }
    
    handleRotating(pos, e) {
        const cx = this.selectedImage.x + this.selectedImage.width / 2;
        const cy = this.selectedImage.y + this.selectedImage.height / 2;
        
        const angle1 = Math.atan2(this.dragStart.y - cy, this.dragStart.x - cx);
        const angle2 = Math.atan2(pos.y - cy, pos.x - cx);
        
        let rotation = this.imageStart.rotation + (angle2 - angle1) * 180 / Math.PI;
        
        // Shift键：15度吸附
        if (e && e.shiftKey) {
            rotation = Math.round(rotation / 15) * 15;
        }
        
        this.selectedImage.rotation = rotation % 360;
        
        // 优化渲染
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => {
                this.renderComposite();
                this.renderPending = false;
            });
        }
    }
    
    updateCursor(pos) {
        // 绘画模式下使用十字光标
        if (this.mode === 'draw') {
            this.canvas.style.cursor = 'crosshair';
            return;
        }
        
        // 编辑模式的原有逻辑
        const handle = this.getHandleAt(pos.x, pos.y);
        
        if (handle === HandleType.ROTATE) {
            this.canvas.style.cursor = 'grab';
        } else if (handle) {
            // 根据控制点位置设置相应的调整大小光标
            const cursors = {
                [HandleType.TOP_LEFT]: 'nw-resize',
                [HandleType.TOP_CENTER]: 'n-resize',
                [HandleType.TOP_RIGHT]: 'ne-resize',
                [HandleType.MIDDLE_LEFT]: 'w-resize',
                [HandleType.MIDDLE_RIGHT]: 'e-resize',
                [HandleType.BOTTOM_LEFT]: 'sw-resize',
                [HandleType.BOTTOM_CENTER]: 's-resize',
                [HandleType.BOTTOM_RIGHT]: 'se-resize'
            };
            this.canvas.style.cursor = cursors[handle] || 'default';
        } else if (this.getImageAt(pos.x, pos.y)) {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }
    
    onMouseUp(e) {
        // 如果在绘画模式且正在绘画
        if (this.mode === 'draw' && this.isDrawing) {
            this.endDrawing();
            return;
        }
        
        // 编辑模式的原有逻辑
        // 如果正在操作，则在结束时更新节点数据
        if (this.isDragging || this.isResizing || this.isRotating) {
            this.updateNodeData();
        }
        
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.activeHandle = null;
    }
    
    endDrawing() {
        if (this.isDrawing && this.currentPath) {
            // 结束当前路径
            this.drawingCtx.stroke();
            
            // 保存路径
            this.drawingPaths.push(this.currentPath);
            
            // 限制路径数量（防止内存溢出）
            if (this.drawingPaths.length > 100) {
                this.drawingPaths.shift();
            }
            
            this.currentPath = null;
            this.updateNodeData();
        }
        
        this.isDrawing = false;
        this.lastDrawPos = null;
    }
    
    onDoubleClick(e) {
        const pos = this.getMousePos(e);
        const clickedImage = this.getImageAt(pos.x, pos.y);
        
        if (clickedImage) {
            this.showPropertiesPanel(clickedImage);
        }
    }
    
    onWheel(e) {
        // 滚轮功能已禁用，使用角点拖拽来缩放图片
    }
    
    onKeyDown(e) {
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        
        // 绘画模式快捷键
        if (key === 'd') {
            e.preventDefault();
            this.toggleMode();
        }
        
        // 绘画工具快捷键（仅在绘画模式下）
        if (this.mode === 'draw') {
            if (key === 'b') {
                e.preventDefault();
                this.selectTool('brush');
            } else if (key === 'e') {
                e.preventDefault();
                this.selectTool('eraser');
            } else if (key === 'c' && !ctrl) {
                e.preventDefault();
                // 打开颜色选择器
                if (this.colorPicker) {
                    this.colorPicker.click();
                }
            }
        }
        
        // 全选（仅在编辑模式下）
        if (ctrl && key === 'a' && this.mode === 'edit') {
            e.preventDefault();
            this.selectAll();
        }
        
        // 方向键微调（仅在编辑模式下）
        else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && this.mode === 'edit') {
            e.preventDefault();
            this.nudgeSelected(key);
        }
        
        // 图层调整快捷键（仅在编辑模式下）
        else if ((key === '[' || key === ']') && this.mode === 'edit') {
            e.preventDefault();
            if (e.shiftKey) {
                // Shift + [ 移到最底层, Shift + ] 移到最顶层
                if (key === '[') {
                    this.sendToBack();
                } else {
                    this.bringToFront();
                }
            } else {
                // [ 下移一层, ] 上移一层
                if (key === '[') {
                    this.sendBackward();
                } else {
                    this.bringForward();
                }
            }
        }
    }
    
    showContextMenu(e) {
        const pos = this.getMousePos(e);
        const clickedImage = this.getImageAt(pos.x, pos.y);
        
        if (clickedImage) {
            this.selectedImage = clickedImage;
            this.render();
            
            // 创建右键菜单
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            
            const menuItems = [
                { label: '置顶', action: () => this.bringToFront() },
                { label: '置底', action: () => this.sendToBack() },
                { label: '上移一层', action: () => this.bringForward() },
                { label: '下移一层', action: () => this.sendBackward() },
                { separator: true },
                { label: '属性...', action: () => this.showPropertiesPanel(clickedImage) }
            ];
            
            menuItems.forEach(item => {
                if (item.separator) {
                    const separator = document.createElement('div');
                    separator.className = 'context-menu-separator';
                    menu.appendChild(separator);
                } else {
                    const menuItem = document.createElement('div');
                    menuItem.className = 'context-menu-item';
                    menuItem.textContent = item.label;
                    menuItem.onclick = () => {
                        item.action();
                        document.body.removeChild(menu);
                    };
                    menu.appendChild(menuItem);
                }
            });
            
            document.body.appendChild(menu);
            
            // 点击其他地方关闭菜单
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    document.body.removeChild(menu);
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeMenu);
            }, 0);
        }
    }
    
    showPropertiesPanel(img) {
        // TODO: 实现属性面板
        console.log('Show properties for:', img);
    }
    
    // 图层操作
    bringToFront() {
        if (this.selectedImage && !this.selectedImage.isBackground) {
            const index = this.images.indexOf(this.selectedImage);
            if (index > -1) {
                this.images.splice(index, 1);
                this.images.push(this.selectedImage);
                this.renderComposite();
                this.updateNodeData();
            }
        }
    }
    
    sendToBack() {
        if (this.selectedImage && !this.selectedImage.isBackground) {
            const index = this.images.indexOf(this.selectedImage);
            if (index > -1) {
                this.images.splice(index, 1);
                // 如果有背景图，插入到索引1；否则插入到索引0
                const hasBackground = this.images[0]?.isBackground;
                const insertIndex = hasBackground ? 1 : 0;
                this.images.splice(insertIndex, 0, this.selectedImage);
                this.renderComposite();
                this.updateNodeData();
            }
        }
    }
    
    bringForward() {
        if (this.selectedImage && !this.selectedImage.isBackground) {
            const index = this.images.indexOf(this.selectedImage);
            if (index > -1 && index < this.images.length - 1) {
                // 确保不会与背景图交换
                const nextImage = this.images[index + 1];
                if (!nextImage?.isBackground) {
                    [this.images[index], this.images[index + 1]] = [this.images[index + 1], this.images[index]];
                    this.renderComposite();
                    this.updateNodeData();
                }
            }
        }
    }
    
    sendBackward() {
        if (this.selectedImage && !this.selectedImage.isBackground) {
            const index = this.images.indexOf(this.selectedImage);
            // 确保不会移动到背景图下面
            const minIndex = this.images[0]?.isBackground ? 1 : 0;
            if (index > minIndex) {
                [this.images[index], this.images[index - 1]] = [this.images[index - 1], this.images[index]];
                this.renderComposite();
                this.updateNodeData();
            }
        }
    }
    
    // 编辑操作（已禁用）
    /*
    copy() {
        if (this.selectedImage) {
            this.clipboard = {
                ...this.selectedImage,
                element: this.selectedImage.element.cloneNode(true)
            };
        }
    }
    
    cut() {
        this.copy();
        this.deleteSelected();
    }
    
    paste() {
        if (this.clipboard) {
            const newImage = {
                ...this.clipboard,
                x: this.clipboard.x + 20,
                y: this.clipboard.y + 20,
                element: this.clipboard.element.cloneNode(true)
            };
            this.images.push(newImage);
            this.selectedImage = newImage;
            this.renderComposite();
            this.updateNodeData();
        }
    }
    
    deleteSelected() {
        if (this.selectedImages.size > 0) {
            this.saveHistory();
            this.selectedImages.forEach(img => {
                const index = this.images.indexOf(img);
                if (index > -1) {
                    this.images.splice(index, 1);
                }
            });
            this.selectedImage = null;
            this.selectedImages.clear();
            this.renderComposite();
            this.updateNodeData();
        }
    }
    */
    
    selectAll() {
        this.selectedImages.clear();
        this.images.forEach(img => this.selectedImages.add(img));
        if (this.images.length > 0) {
            this.selectedImage = this.images[this.images.length - 1];
        }
        this.renderComposite();
    }
    
    nudgeSelected(direction) {
        if (this.selectedImage) {
            const step = 1;
            switch (direction) {
                case 'arrowup':
                    this.selectedImage.y -= step;
                    break;
                case 'arrowdown':
                    this.selectedImage.y += step;
                    break;
                case 'arrowleft':
                    this.selectedImage.x -= step;
                    break;
                case 'arrowright':
                    this.selectedImage.x += step;
                    break;
            }
            this.renderComposite();
            this.updateNodeData();
        }
    }
    
    renderComposite() {
        // 清空画布（使用逻辑尺寸）
        this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
        
        // 绘制棋盘格背景（表示透明）
        this.drawCheckerboard();
        
        // 绘制所有图片
        for (const img of this.images) {
            if (img.element && img.element.complete) {
                this.ctx.save();
                
                // 背景图不需要裁剪，因为contain模式已经在画布内
                
                // 应用旋转
                if (img.rotation) {
                    const cx = img.x + img.width / 2;
                    const cy = img.y + img.height / 2;
                    this.ctx.translate(cx, cy);
                    this.ctx.rotate(img.rotation * Math.PI / 180);
                    this.ctx.translate(-cx, -cy);
                }
                
                // 应用透明度
                this.ctx.globalAlpha = img.opacity || 1.0;
                
                // 绘制图片
                this.ctx.drawImage(img.element, img.x, img.y, img.width, img.height);
                
                this.ctx.restore();
            }
        }
        
        // 绘制绘画层
        if (this.drawingCanvas) {
            this.ctx.save();
            this.ctx.globalAlpha = 1.0;
            this.ctx.drawImage(this.drawingCanvas, 0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
            this.ctx.restore();
        }
        
        // 绘制选中框和控制点（仅在编辑模式下）
        if (this.mode === 'edit') {
            for (const img of this.images) {
                if (this.selectedImages.has(img)) {
                    this.drawSelection(img);
                }
            }
        }
        
        // 如果没有内容，显示提示
        if (this.images.length === 0 && (!this.drawingCanvas || this.drawingPaths.length === 0)) {
            const logicalWidth = this.canvas.width / this.dpr;
            const logicalHeight = this.canvas.height / this.dpr;
            
            // 主提示文字
            this.ctx.fillStyle = '#ccc';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('连接图片即可实时预览合成效果', logicalWidth / 2, logicalHeight / 2 - 25);
            
            // 显示快捷键提示
            this.ctx.font = '22px Arial';
            this.ctx.fillStyle = '#aaa';
            this.ctx.fillText('使用 [ ] 键调整图层，鼠标悬停查看更多快捷键', logicalWidth / 2, logicalHeight / 2 + 25);
        }
        
        // 始终在右下角显示帮助提示
        this.drawHelpHint();
    }
    
    drawHelpHint() {
        // 在右下角显示帮助提示
        const logicalWidth = this.canvas.width / this.dpr;
        const logicalHeight = this.canvas.height / this.dpr;
        
        this.ctx.save();
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'bottom';
        
        const helpText = this.mode === 'draw' 
            ? '快捷键: B画笔 E橡皮 C颜色 D切换模式'
            : '快捷键: [ ]调整图层 D切换绘画';
        const padding = 10;
        this.ctx.fillText(helpText, logicalWidth - padding, logicalHeight - padding);
        
        this.ctx.restore();
    }
    
    drawCheckerboard() {
        // 绘制棋盘格背景表示透明区域
        const tileSize = 10;
        const logicalWidth = this.canvas.width / this.dpr;
        const logicalHeight = this.canvas.height / this.dpr;
        
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        
        this.ctx.fillStyle = '#1e1e1e';
        for (let y = 0; y < logicalHeight; y += tileSize) {
            for (let x = 0; x < logicalWidth; x += tileSize) {
                if ((x / tileSize + y / tileSize) % 2 === 0) {
                    this.ctx.fillRect(x, y, tileSize, tileSize);
                }
            }
        }
    }
    
    drawSelection(img) {
        this.ctx.save();
        
        // 应用旋转到选择框
        if (img.rotation) {
            const cx = img.x + img.width / 2;
            const cy = img.y + img.height / 2;
            this.ctx.translate(cx, cy);
            this.ctx.rotate(img.rotation * Math.PI / 180);
            this.ctx.translate(-cx, -cy);
        }
        
        // 绘制选择框
        this.ctx.strokeStyle = img === this.selectedImage ? '#00ff00' : '#00aa00';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(img.x, img.y, img.width, img.height);
        
        // 显示图层编号
        const layerIndex = this.images.indexOf(img) + 1;
        const totalLayers = this.images.length;
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        // 在左上角显示图层信息
        const layerText = `Layer ${layerIndex}/${totalLayers}`;
        const textPadding = 4;
        const textMetrics = this.ctx.measureText(layerText);
        const textHeight = 12;
        
        // 绘制背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(
            img.x - 1,
            img.y - textHeight - textPadding * 2 - 1,
            textMetrics.width + textPadding * 2,
            textHeight + textPadding * 2
        );
        
        // 绘制文字
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillText(layerText, img.x + textPadding - 1, img.y - textHeight - textPadding - 1);
        
        // 只为主选中图片绘制控制点
        if (img === this.selectedImage) {
            this.ctx.restore();
            this.drawHandles(img);
        } else {
            this.ctx.restore();
        }
    }
    
    drawHandles(img) {
        const handles = this.getHandles(img);
        const handleSize = 8;  // 增大控制点显示尺寸
        
        // 绘制缩放控制点
        Object.entries(handles).forEach(([type, pos]) => {
            if (type !== HandleType.ROTATE) {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
            }
        });
        
        // 绘制旋转手柄
        const rotateHandle = handles[HandleType.ROTATE];
        const topCenter = handles[HandleType.TOP_CENTER];
        
        // 连接线
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(topCenter.x, topCenter.y);
        this.ctx.lineTo(rotateHandle.x, rotateHandle.y);
        this.ctx.stroke();
        
        // 旋转手柄圆点
        this.ctx.fillStyle = '#00ff00';
        this.ctx.beginPath();
        this.ctx.arc(rotateHandle.x, rotateHandle.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#000';
        this.ctx.stroke();
    }
    
    addImage(src, index, width = 150, height = 150) {
        // 检查是否已经存在相同索引的图片
        const source = index === 0 ? 'background' : `input_${index}`;
        const existingIndex = this.images.findIndex(img => img.source === source);
        
        // 如果图片已存在，更新它
        if (existingIndex >= 0) {
            const existing = this.images[existingIndex];
            
            // 总是更新图片，即使URL相同（内容可能已改变）
            // 添加时间戳参数来避免浏览器缓存
            const img = new Image();
            
            // 为了避免缓存，给URL添加时间戳（如果是blob或data URL则不添加）
            let imgSrc = src;
            if (!src.startsWith('blob:') && !src.startsWith('data:')) {
                imgSrc = src + (src.includes('?') ? '&' : '?') + 't=' + Date.now();
            }
            
            console.log(`[CanvasEditor] Updating image ${source}`);
            
            img.onload = () => {
                // 检查图片是否真的变化了
                const sizeChanged = existing.originalWidth !== img.naturalWidth || 
                                  existing.originalHeight !== img.naturalHeight;
                
                existing.element = img;
                existing.originalWidth = img.naturalWidth;
                existing.originalHeight = img.naturalHeight;
                
                // 只有在图片尺寸发生变化时才重新计算（比如换了不同的图片）
                if (sizeChanged) {
                    if (index === 0) {
                        // 背景图：以contain模式重新计算
                        const bgAspect = img.naturalWidth / img.naturalHeight;
                        const logicalWidth = this.canvas.width / this.dpr;
                        const logicalHeight = this.canvas.height / this.dpr;
                        const canvasAspect = logicalWidth / logicalHeight;
                        
                        if (bgAspect > canvasAspect) {
                            existing.width = logicalWidth;
                            existing.height = logicalWidth / bgAspect;
                            existing.x = 0;
                            existing.y = (logicalHeight - existing.height) / 2;
                        } else {
                            existing.height = logicalHeight;
                            existing.width = logicalHeight * bgAspect;
                            existing.x = (logicalWidth - existing.width) / 2;
                            existing.y = 0;
                        }
                    } else {
                        // 叠加图：重新计算合适的大小（与新图片逻辑一致）
                        const bgImage = this.images.find(img => img.isBackground);
                        let maxWidth, maxHeight;
                        
                        if (bgImage) {
                            // 如果有背景图，使用背景图的范围
                            maxWidth = bgImage.width * 0.8;  // 留出一些边距
                            maxHeight = bgImage.height * 0.8;
                        } else {
                            // 如果没有背景图，使用画布范围
                            const logicalWidth = this.canvas.width / this.dpr;
                            const logicalHeight = this.canvas.height / this.dpr;
                            maxWidth = logicalWidth * 0.8;
                            maxHeight = logicalHeight * 0.8;
                        }
                        
                        // 计算缩放比例，确保图片适合范围
                        const scale = Math.min(
                            maxWidth / img.naturalWidth,
                            maxHeight / img.naturalHeight,
                            1  // 不放大超过原始尺寸
                        );
                        
                        const newWidth = img.naturalWidth * scale;
                        const newHeight = img.naturalHeight * scale;
                        
                        // 保持中心位置不变
                        const centerX = existing.x + existing.width / 2;
                        const centerY = existing.y + existing.height / 2;
                        
                        existing.width = newWidth;
                        existing.height = newHeight;
                        existing.x = centerX - newWidth / 2;
                        existing.y = centerY - newHeight / 2;
                        
                        console.log(`[CanvasEditor] Updated overlay image size: ${newWidth}x${newHeight}`);
                    }
                }
                // 如果图片没变化，保持所有现有属性不变
                
                this.renderComposite();
            };
            img.src = imgSrc;  // 使用带时间戳的URL
            return;
        }
        
        // 添加新图片
        console.log(`[CanvasEditor] Adding new image ${source}`);
        
        // 为了避免缓存，给URL添加时间戳（如果是blob或data URL则不添加）
        let imgSrc = src;
        if (!src.startsWith('blob:') && !src.startsWith('data:')) {
            imgSrc = src + (src.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
        
        const img = new Image();
        img.onload = () => {
            let imageData;
            
            if (index === 0) {
                // 背景图：以contain模式显示（完整显示，保持比例）
                const bgAspect = img.naturalWidth / img.naturalHeight;
                const logicalWidth = this.canvas.width / this.dpr;
                const logicalHeight = this.canvas.height / this.dpr;
                const canvasAspect = logicalWidth / logicalHeight;
                
                let displayWidth, displayHeight, offsetX = 0, offsetY = 0;
                
                if (bgAspect > canvasAspect) {
                    // 背景图更宽，按宽度缩放
                    displayWidth = logicalWidth;
                    displayHeight = logicalWidth / bgAspect;
                    offsetY = (logicalHeight - displayHeight) / 2;
                } else {
                    // 背景图更高，按高度缩放
                    displayHeight = logicalHeight;
                    displayWidth = logicalHeight * bgAspect;
                    offsetX = (logicalWidth - displayWidth) / 2;
                }
                
                imageData = {
                    element: img,
                    source: source,
                    x: offsetX,
                    y: offsetY,
                    width: displayWidth,
                    height: displayHeight,
                    originalWidth: img.naturalWidth,
                    originalHeight: img.naturalHeight,
                    rotation: 0,
                    opacity: 1.0,
                    layer: 0,
                    isBackground: true  // 标记为背景图
                };
                // 背景图插入到最底层
                this.images.unshift(imageData);
            } else {
                // 叠加图：根据背景图范围自动缩放
                const bgImage = this.images.find(img => img.isBackground);
                let maxWidth, maxHeight, baseX, baseY;
                
                if (bgImage) {
                    // 如果有背景图，使用背景图的范围
                    maxWidth = bgImage.width * 0.8;  // 留出一些边距
                    maxHeight = bgImage.height * 0.8;
                    baseX = bgImage.x;
                    baseY = bgImage.y;
                } else {
                    // 如果没有背景图，使用画布范围
                    const logicalWidth = this.canvas.width / this.dpr;
                    const logicalHeight = this.canvas.height / this.dpr;
                    maxWidth = logicalWidth * 0.8;
                    maxHeight = logicalHeight * 0.8;
                    baseX = 0;
                    baseY = 0;
                }
                
                // 计算缩放比例，确保图片适合背景范围
                const scale = Math.min(
                    maxWidth / img.naturalWidth,
                    maxHeight / img.naturalHeight,
                    1  // 不放大超过原始尺寸
                );
                const displayWidth = img.naturalWidth * scale;
                const displayHeight = img.naturalHeight * scale;
                
                // 计算居中位置，带有偏移以区分多个图片
                const offset = (index - 1) * 20;
                const logicalWidth = this.canvas.width / this.dpr;
                const logicalHeight = this.canvas.height / this.dpr;
                const centerX = baseX + (bgImage ? bgImage.width : logicalWidth) / 2;
                const centerY = baseY + (bgImage ? bgImage.height : logicalHeight) / 2;
                const x = centerX - displayWidth / 2 + offset;
                const y = centerY - displayHeight / 2 + offset;
                
                imageData = {
                    element: img,
                    source: source,
                    x: x,
                    y: y,
                    width: displayWidth,
                    height: displayHeight,
                    originalWidth: img.naturalWidth,
                    originalHeight: img.naturalHeight,
                    rotation: 0,
                    opacity: 1.0,
                    layer: index,
                    isBackground: false
                };
                this.images.push(imageData);
            }
            
            this.renderComposite();
            this.updateNodeData();
        };
        img.src = imgSrc;  // 使用带时间戳的URL
    }
    
    updateNodeData() {
        // 更新节点的composition_data
        const bgImage = this.images.find(img => img.isBackground);
        
        // 将绘画层转换为base64数据
        let drawingData = null;
        if (this.drawingCanvas && this.drawingPaths.length > 0) {
            // 创建临时canvas来导出绘画层
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            // 设置尺寸（不含DPR，输出原始尺寸）
            if (bgImage) {
                tempCanvas.width = bgImage.originalWidth;
                tempCanvas.height = bgImage.originalHeight;
                
                // 计算背景图的显示缩放比例和偏移
                const displayScale = bgImage.width / bgImage.originalWidth;
                const offsetX = bgImage.x;
                const offsetY = bgImage.y;
                
                // 绘制绘画层内容，考虑背景图的偏移和缩放
                // 1. 先将坐标系移动到背景图的原点
                // 2. 然后应用缩放
                const sourceX = offsetX * this.dpr;  // 源区域的起始X（考虑DPR）
                const sourceY = offsetY * this.dpr;  // 源区域的起始Y（考虑DPR）
                const sourceWidth = bgImage.width * this.dpr;  // 源区域的宽度（考虑DPR）
                const sourceHeight = bgImage.height * this.dpr;  // 源区域的高度（考虑DPR）
                
                // 从绘画画布的背景图区域复制到输出画布
                tempCtx.drawImage(
                    this.drawingCanvas, 
                    sourceX, sourceY, sourceWidth, sourceHeight,  // 源区域（背景图在画布上的位置）
                    0, 0, bgImage.originalWidth, bgImage.originalHeight  // 目标区域（输出画布的完整区域）
                );
            } else {
                tempCanvas.width = 1024;
                tempCanvas.height = 1024;
                // 没有背景图时，直接缩放整个绘画层
                const scale = 1024 / (this.drawingCanvas.width / this.dpr);
                tempCtx.scale(scale, scale);
                tempCtx.drawImage(this.drawingCanvas, 0, 0, this.drawingCanvas.width / this.dpr, this.drawingCanvas.height / this.dpr);
            }
            
            // 转换为base64
            drawingData = tempCanvas.toDataURL('image/png');
        }
        
        const data = {
            images: this.images.map((img, index) => {
                // 背景图始终保存为(0,0)位置，因为它会填充整个输出画布
                if (img.isBackground) {
                    return {
                        source: img.source,
                        position: { x: 0, y: 0 },  // 背景图在输出中始终是(0,0)
                        size: { width: img.originalWidth, height: img.originalHeight },  // 使用原始尺寸
                        rotation: img.rotation || 0,
                        opacity: img.opacity || 1.0,
                        layer: index
                    };
                } else {
                    // 对于叠加图片，保存相对于背景图实际尺寸的坐标
                    let finalX = img.x;
                    let finalY = img.y;
                    let finalWidth = img.width;
                    let finalHeight = img.height;
                    
                    if (bgImage) {
                        // 计算背景图的显示缩放比例
                        const bgScale = bgImage.width / bgImage.originalWidth;
                        
                        // 将相对于画布的坐标转换为相对于背景图原始尺寸的坐标
                        // 1. 先转换为相对于背景图显示区域的坐标
                        const relativeX = img.x - bgImage.x;
                        const relativeY = img.y - bgImage.y;
                        
                        // 2. 除以缩放比例得到在原始背景图上的坐标
                        finalX = relativeX / bgScale;
                        finalY = relativeY / bgScale;
                        finalWidth = img.width / bgScale;
                        finalHeight = img.height / bgScale;
                        
                    } else {
                    }
                    
                    return {
                        source: img.source,
                        position: { x: finalX, y: finalY },
                        size: { width: finalWidth, height: finalHeight },
                        rotation: img.rotation || 0,
                        opacity: img.opacity || 1.0,
                        layer: index
                    };
                }
            }),
            settings: {},
            drawingLayer: drawingData  // 添加绘画层数据
        };
        
        
        // 更新隐藏的widget值
        const widget = this.node.widgets?.find(w => w.name === "composition_data");
        if (widget) {
            widget.value = JSON.stringify(data, null, 2);
        }
    }
    
    clear() {
        this.images = [];
        this.selectedImage = null;
        this.selectedImages.clear();
        this.renderComposite();
        this.updateNodeData();
    }
    
    resizeCanvas(width, height) {
        // 限制Canvas最大尺寸
        let canvasWidth = width;
        let canvasHeight = height;
        
        // 如果超过最大尺寸，按比例缩小
        if (width > this.maxCanvasSize || height > this.maxCanvasSize) {
            const scale = Math.min(this.maxCanvasSize / width, this.maxCanvasSize / height);
            canvasWidth = Math.round(width * scale);
            canvasHeight = Math.round(height * scale);
        }
        
        // 保存当前绘画内容
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.drawingCanvas.width;
        tempCanvas.height = this.drawingCanvas.height;
        tempCtx.drawImage(this.drawingCanvas, 0, 0);
        
        // 设置Canvas的实际分辨率（考虑高DPI）
        this.canvas.width = canvasWidth * this.dpr;
        this.canvas.height = canvasHeight * this.dpr;
        
        // 同时调整绘画层canvas的尺寸
        this.drawingCanvas.width = canvasWidth * this.dpr;
        this.drawingCanvas.height = canvasHeight * this.dpr;
        
        // 重新设置缩放
        this.ctx.scale(this.dpr, this.dpr);
        this.drawingCtx.scale(this.dpr, this.dpr);
        
        // 恢复绘画内容
        this.drawingCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 
                                  0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        
        // 重新设置图像质量
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        console.log(`[CanvasEditor] Canvas size: ${canvasWidth}x${canvasHeight} (actual: ${this.canvas.width}x${this.canvas.height}, dpr: ${this.dpr})`);
        
        this.renderComposite();
        this.updateNodeData();
    }
}

// 辅助函数：链式回调
function chainCallback(object, property, callback) {
    if (property in object) {
        const callback_orig = object[property];
        object[property] = function () {
            const r = callback_orig.apply(this, arguments);
            callback.apply(this, arguments);
            return r;
        };
    } else {
        object[property] = callback;
    }
}

// 辅助函数：隐藏widget
function hideWidgetForGood(node, widget) {
    if (!widget) return;
    widget.origType = widget.type;
    widget.origComputeSize = widget.computeSize;
    widget.computeSize = () => [0, -4];
    widget.type = "hidden";
}

// 注册扩展
app.registerExtension({
    name: "CY.ImageCompositor",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData?.name === "ImageCompositor") {
            console.log("[ImageCompositor] Registering Canvas widget for node type");
            
            // 扩展节点创建函数
            chainCallback(nodeType.prototype, "onNodeCreated", function () {
                const node = this;
                console.log("[ImageCompositor] Node created, ID:", node.id);
                
                // 添加防抖定时器
                node.updateDebounceTimer = null;
                node.isUpdating = false;
                
                // 添加图片检查相关
                node.loadedImages = {};  // 保存已加载图片的信息
                node.imageCheckInterval = null;  // 定期检查的定时器
                
                // 动态输入管理
                node.updateInputs = function() {
                    const inputCountWidget = this.widgets?.find(w => w.name === "input_count");
                    if (!inputCountWidget) return;
                    
                    const targetCount = inputCountWidget.value;
                    let currentCount = 0;
                    
                    // 计算当前overlay_image输入数量
                    this.inputs?.forEach(input => {
                        if (input.name && input.name.startsWith("overlay_image_")) {
                            currentCount++;
                        }
                    });
                    
                    console.log(`[ImageCompositor] Updating inputs: current=${currentCount}, target=${targetCount}`);
                    
                    // 添加输入
                    while (currentCount < targetCount) {
                        currentCount++;
                        this.addInput(`overlay_image_${currentCount}`, "IMAGE");
                    }
                    
                    // 移除输入
                    while (currentCount > targetCount) {
                        const inputToRemove = this.inputs?.findIndex(
                            input => input.name === `overlay_image_${currentCount}`
                        );
                        if (inputToRemove >= 0) {
                            this.removeInput(inputToRemove);
                        }
                        currentCount--;
                    }
                    
                    // 动态调整节点高度
                    // 基础高度（包含Canvas + input_count widget + padding）
                    const canvasHeight = 400;  // Canvas在节点内的显示高度
                    const widgetHeight = 30;   // input_count widget的高度
                    const inputHeight = 30;    // 每个输入槽的高度
                    const padding = 20;        // 额外padding
                    
                    // 计算总高度
                    const newHeight = canvasHeight + widgetHeight + (targetCount * inputHeight) + padding;
                    
                    // 设置新的节点大小
                    this.size[0] = Math.max(this.size[0], 420);
                    this.size[1] = newHeight;
                    
                    // 更新最小高度
                    this.minHeight = newHeight;
                    
                    // 触发大小更新
                    if (this.graph) {
                        this.graph.setDirtyCanvas(true, true);
                    }
                };
                
                // 监听连接变化，实现实时预览
                chainCallback(node, "onConnectionsChange", function(type, index, connected, link_info) {
                    console.log(`[ImageCompositor] Connection change - type: ${type}, index: ${index}, connected: ${connected}`);
                    
                    // 使用防抖机制，避免频繁更新
                    if (node.updateDebounceTimer) {
                        clearTimeout(node.updateDebounceTimer);
                    }
                    
                    node.updateDebounceTimer = setTimeout(() => {
                        // 检查并更新Canvas
                        if (node.canvasEditor && !node.isUpdating) {
                            node.updateCanvasFromInputs();
                        }
                        node.updateDebounceTimer = null;
                    }, 50);  // 50ms防抖延迟
                });
                
                // 检查连接的图片是否有更新
                node.checkForImageUpdates = function() {
                    if (!this.canvasEditor || this.isUpdating) return false;
                    
                    let hasUpdates = false;
                    
                    // 检查背景图
                    const bgInput = this.inputs?.find(input => input.name === "background_image");
                    if (bgInput && bgInput.link !== null) {
                        const linkInfo = app.graph.links[bgInput.link];
                        if (linkInfo) {
                            const sourceNode = app.graph.getNodeById(linkInfo.origin_id);
                            if (sourceNode && sourceNode.imgs && sourceNode.imgs.length > 0) {
                                const img = sourceNode.imgs[0];
                                if (img && img.src) {
                                    const key = 'background';
                                    const currentInfo = {
                                        src: img.src,
                                        timestamp: Date.now()
                                    };
                                    
                                    // 检查是否有变化
                                    if (!this.loadedImages[key] || this.loadedImages[key].src !== currentInfo.src) {
                                        hasUpdates = true;
                                        console.log("[ImageCompositor] Detected background image change");
                                    }
                                    
                                    this.loadedImages[key] = currentInfo;
                                }
                            }
                        }
                    }
                    
                    // 检查叠加图片
                    const inputCountWidget = this.widgets?.find(w => w.name === "input_count");
                    const maxInputs = inputCountWidget ? inputCountWidget.value : 3;
                    
                    for (let i = 1; i <= maxInputs; i++) {
                        const inputName = `overlay_image_${i}`;
                        const input = this.inputs?.find(inp => inp.name === inputName);
                        if (input && input.link !== null) {
                            const linkInfo = app.graph.links[input.link];
                            if (linkInfo) {
                                const sourceNode = app.graph.getNodeById(linkInfo.origin_id);
                                if (sourceNode && sourceNode.imgs && sourceNode.imgs.length > 0) {
                                    const img = sourceNode.imgs[0];
                                    if (img && img.src) {
                                        const key = `input_${i}`;
                                        const currentInfo = {
                                            src: img.src,
                                            timestamp: Date.now()
                                        };
                                        
                                        // 检查是否有变化
                                        if (!this.loadedImages[key] || this.loadedImages[key].src !== currentInfo.src) {
                                            hasUpdates = true;
                                            console.log(`[ImageCompositor] Detected overlay image ${i} change`);
                                        }
                                        
                                        this.loadedImages[key] = currentInfo;
                                    }
                                }
                            }
                        }
                    }
                    
                    return hasUpdates;
                };
                
                // 添加更新Canvas的方法
                node.updateCanvasFromInputs = function() {
                    if (!this.canvasEditor || this.isUpdating) return;
                    
                    // 设置更新标志，防止并发更新
                    this.isUpdating = true;
                    
                    try {
                        // 保存现有图片的状态
                        const existingStates = {};
                        this.canvasEditor.images.forEach(img => {
                            if (!img.isBackground) {  // 只保存非背景图的状态
                                existingStates[img.source] = {
                                    x: img.x,
                                    y: img.y,
                                    width: img.width,
                                    height: img.height,
                                    rotation: img.rotation,
                                    opacity: img.opacity
                                };
                            }
                        });
                        
                        // 记录当前连接的图片源
                        const connectedSources = new Set();
                    
                    // Canvas显示尺寸固定为1024x1024，最大化清晰度
                    this.canvasEditor.resizeCanvas(1024, 1024);
                    
                    // 检查背景图输入
                    const bgInput = this.inputs?.find(input => input.name === "background_image");
                    if (bgInput && bgInput.link !== null) {
                        const linkInfo = app.graph.links[bgInput.link];
                        if (linkInfo) {
                            const sourceNode = app.graph.getNodeById(linkInfo.origin_id);
                            if (sourceNode && sourceNode.imgs && sourceNode.imgs.length > 0) {
                                const img = sourceNode.imgs[0];
                                if (img && img.src) {
                                    console.log("[ImageCompositor] Found background image from connected node");
                                    connectedSources.add('background');
                                    this.canvasEditor.addImage(img.src, 0);
                                }
                            }
                        }
                    }
                    
                    // 检查叠加图片输入（动态数量）
                    const inputCountWidget = this.widgets?.find(w => w.name === "input_count");
                    const maxInputs = inputCountWidget ? inputCountWidget.value : 3;
                    
                    for (let i = 1; i <= maxInputs; i++) {
                        const inputName = `overlay_image_${i}`;
                        const input = this.inputs?.find(inp => inp.name === inputName);
                        if (input && input.link !== null) {
                            const linkInfo = app.graph.links[input.link];
                            if (linkInfo) {
                                const sourceNode = app.graph.getNodeById(linkInfo.origin_id);
                                if (sourceNode && sourceNode.imgs && sourceNode.imgs.length > 0) {
                                    const img = sourceNode.imgs[0];
                                    if (img && img.src) {
                                        console.log(`[ImageCompositor] Found overlay image ${i} from connected node`);
                                        const source = `input_${i}`;
                                        connectedSources.add(source);
                                        
                                        // 添加图片，但会保持已有的状态
                                        this.canvasEditor.addImage(img.src, i);
                                        
                                        // 如果这个图片有保存的状态，恢复它
                                        if (existingStates[source]) {
                                            const imgIndex = this.canvasEditor.images.findIndex(img => img.source === source);
                                            if (imgIndex >= 0) {
                                                const state = existingStates[source];
                                                Object.assign(this.canvasEditor.images[imgIndex], state);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                        // 先移除所有不再连接的图片
                        this.canvasEditor.images = this.canvasEditor.images.filter(img => {
                            const shouldKeep = img.isBackground ? connectedSources.has('background') : 
                                              connectedSources.has(img.source);
                            if (!shouldKeep) {
                                console.log(`[ImageCompositor] Removing disconnected image: ${img.source}`);
                            }
                            return shouldKeep;
                        });
                        
                        this.canvasEditor.renderComposite();
                    } finally {
                        // 确保清除更新标志
                        this.isUpdating = false;
                    }
                };
                
                // 查找并隐藏composition_data widget
                setTimeout(() => {
                    const compositionWidget = node.widgets?.find(w => w.name === "composition_data");
                    if (compositionWidget) {
                        console.log("[ImageCompositor] Hiding composition_data widget");
                        hideWidgetForGood(node, compositionWidget);
                    }
                    
                    // 监听input_count变化
                    const inputCountWidget = node.widgets?.find(w => w.name === "input_count");
                    if (inputCountWidget) {
                        // 保存原始的callback
                        const originalCallback = inputCountWidget.callback;
                        
                        // 添加新的callback
                        inputCountWidget.callback = function(value) {
                            console.log(`[ImageCompositor] Input count changed to: ${value}`);
                            
                            // 调用原始callback
                            if (originalCallback) {
                                originalCallback.call(this, value);
                            }
                            
                            // 更新输入
                            setTimeout(() => {
                                node.updateInputs();
                            }, 100);
                        };
                        
                        // 初始化输入
                        node.updateInputs();
                    }
                    
                    // 创建容器来包含工具栏和Canvas
                    const container = document.createElement("div");
                    container.style.cssText = `
                        position: relative;
                        width: 100%;
                        height: 100%;
                    `;
                    
                    // 创建Canvas元素
                    const canvasEl = document.createElement("canvas");
                    container.appendChild(canvasEl);
                    
                    // 获取设备像素比，支持高DPI显示
                    const dpr = window.devicePixelRatio || 1;
                    const displaySize = 1024;  // 进一步提高基础分辨率获得最佳清晰度
                    
                    // 设置Canvas的实际分辨率（考虑高DPI）
                    canvasEl.width = displaySize * dpr;
                    canvasEl.height = displaySize * dpr;
                    
                    // CSS显示尺寸
                    canvasEl.style.width = "100%";
                    canvasEl.style.height = "auto";
                    canvasEl.style.display = "block";
                    canvasEl.style.background = "#1e1e1e";
                    canvasEl.style.border = "1px solid #444";
                    canvasEl.style.borderRadius = "4px";
                    // 使用高质量渲染
                    canvasEl.style.imageRendering = "high-quality";
                    canvasEl.style.willChange = "transform";  // 启用GPU加速
                    
                    // 添加提示信息
                    canvasEl.title = "图片编辑器快捷键：\n" +
                                    "• 拖拽: 移动图片\n" +
                                    "• 拖拽边角: 缩放图片\n" +
                                    "• 拖拽绿色手柄: 旋转图片\n" +
                                    "• [ / ]: 下移/上移一层\n" +
                                    "• Shift+[ / Shift+]: 移到最底/最顶层\n" +
                                    "• D: 切换绘画模式";
                    
                    // 使用addDOMWidget添加容器（包含Canvas和工具栏）
                    console.log("[ImageCompositor] Adding Canvas widget");
                    const canvasWidget = node.addDOMWidget("canvas_display", "canvas", container, {
                        serialize: false,
                        hideOnZoom: false,
                    });
                    
                    
                    // 初始化Canvas编辑器
                    node.canvasEditor = new CanvasEditor(canvasEl, node);
                    console.log(`[ImageCompositor] Canvas initialized - Display: ${displaySize}x${displaySize}, Actual: ${canvasEl.width}x${canvasEl.height}, DPR: ${dpr}`);
                    
                    // 启动定期检查图片更新（每500ms检查一次）
                    if (node.imageCheckInterval) {
                        clearInterval(node.imageCheckInterval);
                    }
                    node.imageCheckInterval = setInterval(() => {
                        if (node.checkForImageUpdates()) {
                            console.log("[ImageCompositor] Image updates detected, refreshing canvas");
                            node.updateCanvasFromInputs();
                        }
                    }, 500);  // 每500毫秒检查一次
                    
                    // 初始设置节点尺寸（基于默认3个输入计算）
                    // Canvas 400px + widget 30px + 3个输入90px + padding 20px = 540px
                    node.size[0] = Math.max(node.size[0], 420);
                    node.size[1] = Math.max(node.size[1], 540);
                    
                    // 设置最小高度和宽度（稍后会动态更新）
                    node.minHeight = 540;
                    node.minWidth = 420;
                    
                    // 重写onResize回调，强制执行最小尺寸
                    const originalOnResize = node.onResize;
                    node.onResize = function(size) {
                        // 强制执行最小尺寸（使用动态计算的minHeight）
                        if (size[0] < this.minWidth) size[0] = this.minWidth;
                        if (size[1] < this.minHeight) size[1] = this.minHeight;
                        
                        // 调用原始的onResize（如果存在）
                        if (originalOnResize) {
                            originalOnResize.call(this, size);
                        }
                    };
                    
                    // 初始化完成后，检查是否已有连接的输入
                    setTimeout(() => {
                        if (!node.isUpdating) {
                            node.updateCanvasFromInputs();
                        }
                    }, 100);
                }, 0);
                
                // 添加节点移除时的清理
                const origOnRemoved = node.onRemoved;
                node.onRemoved = function() {
                    // 清理定时器
                    if (this.imageCheckInterval) {
                        clearInterval(this.imageCheckInterval);
                        this.imageCheckInterval = null;
                        console.log("[ImageCompositor] Cleared image check interval");
                    }
                    if (this.updateDebounceTimer) {
                        clearTimeout(this.updateDebounceTimer);
                        this.updateDebounceTimer = null;
                    }
                    
                    // 调用原始方法
                    if (origOnRemoved) {
                        origOnRemoved.apply(this, arguments);
                    }
                };
            });
            
            // 扩展节点执行后的处理
            chainCallback(nodeType.prototype, "onExecuted", function(message) {
                console.log("[ImageCompositor] Node executed, message:", message);
                
                if (!this.canvasEditor) {
                    console.warn("[ImageCompositor] Canvas editor not initialized");
                    return;
                }
                
                // onExecuted只处理运行后的结果更新，不处理实时预览
                // 实时预览由onConnectionsChange和updateCanvasFromInputs处理
            });
        }
    }
});

console.log("[ImageCompositor] Extension loaded");