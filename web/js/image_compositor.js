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
        
        // 图片管理
        this.images = [];
        this.selectedImage = null;
        this.selectedImages = new Set();
        
        // Canvas尺寸管理
        this.maxCanvasSize = 512;  // Canvas最大显示尺寸
        
        // 交互状态
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.activeHandle = null;
        
        // 鼠标位置记录
        this.dragStart = { x: 0, y: 0 };
        this.imageStart = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
        
        // 历史记录（撤销/重做）
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        
        // 剪贴板
        this.clipboard = null;
        
        this.setupEventListeners();
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
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 按比例转换坐标
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
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
        const handleSize = 8;
        
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
    
    startDragging(pos) {
        this.isDragging = true;
        this.dragStart = pos;
        this.imageStart = {
            x: this.selectedImage.x,
            y: this.selectedImage.y
        };
        this.saveHistory();
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
        this.saveHistory();
    }
    
    startRotating(pos) {
        this.isRotating = true;
        this.dragStart = pos;
        this.imageStart = {
            rotation: this.selectedImage.rotation || 0
        };
        this.saveHistory();
    }
    
    onMouseMove(e) {
        const pos = this.getMousePos(e);
        
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
            newX = Math.max(0, Math.min(this.canvas.width - this.selectedImage.width, newX));
            newY = Math.max(0, Math.min(this.canvas.height - this.selectedImage.height, newY));
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
        // 如果正在操作，则在结束时更新节点数据
        if (this.isDragging || this.isResizing || this.isRotating) {
            this.updateNodeData();
        }
        
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.activeHandle = null;
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
        
        // 撤销/重做
        if (ctrl && key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
        } else if (ctrl && key === 'y') {
            e.preventDefault();
            this.redo();
        }
        
        // 复制/粘贴
        else if (ctrl && key === 'c') {
            e.preventDefault();
            this.copy();
        } else if (ctrl && key === 'v') {
            e.preventDefault();
            this.paste();
        } else if (ctrl && key === 'x') {
            e.preventDefault();
            this.cut();
        }
        
        // 全选
        else if (ctrl && key === 'a') {
            e.preventDefault();
            this.selectAll();
        }
        
        // 删除
        else if (key === 'delete' || key === 'backspace') {
            e.preventDefault();
            this.deleteSelected();
        }
        
        // 方向键微调
        else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            e.preventDefault();
            this.nudgeSelected(key);
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
                { label: '复制', action: () => this.copy() },
                { label: '粘贴', action: () => this.paste() },
                { label: '删除', action: () => this.deleteSelected() },
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
        if (this.selectedImage) {
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
        if (this.selectedImage) {
            const index = this.images.indexOf(this.selectedImage);
            if (index > -1) {
                this.images.splice(index, 1);
                this.images.unshift(this.selectedImage);
                this.renderComposite();
                this.updateNodeData();
            }
        }
    }
    
    bringForward() {
        if (this.selectedImage) {
            const index = this.images.indexOf(this.selectedImage);
            if (index > -1 && index < this.images.length - 1) {
                [this.images[index], this.images[index + 1]] = [this.images[index + 1], this.images[index]];
                this.renderComposite();
                this.updateNodeData();
            }
        }
    }
    
    sendBackward() {
        if (this.selectedImage) {
            const index = this.images.indexOf(this.selectedImage);
            if (index > 0) {
                [this.images[index], this.images[index - 1]] = [this.images[index - 1], this.images[index]];
                this.renderComposite();
                this.updateNodeData();
            }
        }
    }
    
    // 编辑操作
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
    
    // 历史记录
    saveHistory() {
        const state = JSON.stringify(this.images.map(img => ({
            x: img.x,
            y: img.y,
            width: img.width,
            height: img.height,
            rotation: img.rotation,
            opacity: img.opacity,
            source: img.source
        })));
        
        // 删除当前位置之后的历史
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // 添加新状态
        this.history.push(state);
        
        // 限制历史记录数量
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreHistory();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreHistory();
        }
    }
    
    restoreHistory() {
        const state = JSON.parse(this.history[this.historyIndex]);
        state.forEach((imgState, index) => {
            if (this.images[index]) {
                Object.assign(this.images[index], imgState);
            }
        });
        this.renderComposite();
        this.updateNodeData();
    }
    
    renderComposite() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
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
        
        // 绘制选中框和控制点
        for (const img of this.images) {
            if (this.selectedImages.has(img)) {
                this.drawSelection(img);
            }
        }
        
        // 如果没有内容，显示提示
        if (this.images.length === 0) {
            this.ctx.fillStyle = '#666';
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('连接图片即可实时预览合成效果', this.canvas.width / 2, this.canvas.height / 2);
        }
    }
    
    drawCheckerboard() {
        // 绘制棋盘格背景表示透明区域
        const tileSize = 10;
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#1e1e1e';
        for (let y = 0; y < this.canvas.height; y += tileSize) {
            for (let x = 0; x < this.canvas.width; x += tileSize) {
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
        const handleSize = 6;
        
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
        
        // 如果图片已存在且源相同，检查是否真的需要更新
        if (existingIndex >= 0) {
            const existing = this.images[existingIndex];
            
            // 如果源路径相同，直接返回，避免重复加载
            if (existing.element && existing.element.src === src) {
                console.log(`[CanvasEditor] Image ${source} already loaded with same src, skipping`);
                return;
            }
            
            // 如果已存在但源不同，更新图片元素
            const img = new Image();
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
                        const canvasAspect = this.canvas.width / this.canvas.height;
                        
                        if (bgAspect > canvasAspect) {
                            existing.width = this.canvas.width;
                            existing.height = this.canvas.width / bgAspect;
                            existing.x = 0;
                            existing.y = (this.canvas.height - existing.height) / 2;
                        } else {
                            existing.height = this.canvas.height;
                            existing.width = this.canvas.height * bgAspect;
                            existing.x = (this.canvas.width - existing.width) / 2;
                            existing.y = 0;
                        }
                    } else {
                        // 叠加图：保持相对比例调整大小
                        const oldAspect = existing.width / existing.height;
                        const newAspect = img.naturalWidth / img.naturalHeight;
                        
                        // 如果宽高比变化，调整尺寸以保持新的比例
                        if (Math.abs(oldAspect - newAspect) > 0.01) {
                            existing.height = existing.width / newAspect;
                        }
                    }
                }
                // 如果图片没变化，保持所有现有属性不变
                
                this.renderComposite();
            };
            img.src = src;
            return;
        }
        
        // 添加新图片
        console.log(`[CanvasEditor] Adding new image ${source}`);
        const img = new Image();
        img.onload = () => {
            let imageData;
            
            if (index === 0) {
                // 背景图：以contain模式显示（完整显示，保持比例）
                const bgAspect = img.naturalWidth / img.naturalHeight;
                const canvasAspect = this.canvas.width / this.canvas.height;
                
                let displayWidth, displayHeight, offsetX = 0, offsetY = 0;
                
                if (bgAspect > canvasAspect) {
                    // 背景图更宽，按宽度缩放
                    displayWidth = this.canvas.width;
                    displayHeight = this.canvas.width / bgAspect;
                    offsetY = (this.canvas.height - displayHeight) / 2;
                } else {
                    // 背景图更高，按高度缩放
                    displayHeight = this.canvas.height;
                    displayWidth = this.canvas.height * bgAspect;
                    offsetX = (this.canvas.width - displayWidth) / 2;
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
                    maxWidth = this.canvas.width * 0.8;
                    maxHeight = this.canvas.height * 0.8;
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
                const centerX = baseX + (bgImage ? bgImage.width : this.canvas.width) / 2;
                const centerY = baseY + (bgImage ? bgImage.height : this.canvas.height) / 2;
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
        img.src = src;
    }
    
    updateNodeData() {
        // 更新节点的composition_data
        const bgImage = this.images.find(img => img.isBackground);
        
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
            settings: {}
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
        
        // 设置Canvas尺寸
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        console.log(`[CanvasEditor] Canvas size: ${canvasWidth}x${canvasHeight} (original: ${width}x${height})`);
        
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
                    
                    // 获取画布尺寸
                    const widthWidget = this.widgets?.find(w => w.name === "canvas_width");
                    const heightWidget = this.widgets?.find(w => w.name === "canvas_height");
                    if (widthWidget && heightWidget) {
                        const width = widthWidget.value;
                        const height = heightWidget.value;
                        this.canvasEditor.resizeCanvas(width, height);
                    }
                    
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
                    
                    // 检查叠加图片输入
                    for (let i = 1; i <= 10; i++) {
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
                    
                    // 创建Canvas元素
                    const canvasEl = document.createElement("canvas");
                    canvasEl.width = 512;
                    canvasEl.height = 512;
                    canvasEl.style.width = "100%";
                    canvasEl.style.height = "auto";
                    canvasEl.style.display = "block";
                    canvasEl.style.background = "#1e1e1e";
                    canvasEl.style.border = "1px solid #444";
                    canvasEl.style.borderRadius = "4px";
                    canvasEl.style.imageRendering = "pixelated";
                    
                    // 使用addDOMWidget添加Canvas
                    console.log("[ImageCompositor] Adding Canvas widget");
                    const canvasWidget = node.addDOMWidget("canvas_display", "canvas", canvasEl, {
                        serialize: false,
                        hideOnZoom: false,
                    });
                    
                    
                    // 初始化Canvas编辑器
                    node.canvasEditor = new CanvasEditor(canvasEl, node);
                    console.log("[ImageCompositor] Canvas editor initialized");
                    
                    // 设置节点最小尺寸
                    node.size[0] = Math.max(node.size[0], 420);
                    node.size[1] = Math.max(node.size[1], 450);
                    
                    // 初始化完成后，检查是否已有连接的输入
                    setTimeout(() => {
                        if (!node.isUpdating) {
                            node.updateCanvasFromInputs();
                        }
                    }, 100);
                }, 0);
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
                
                // 如果有运行结果，更新画布尺寸
                if (message && message.canvas_size) {
                    const [width, height] = message.canvas_size;
                    console.log(`[ImageCompositor] Workflow executed - canvas size: ${width}x${height}`);
                    // 运行后可能需要更新画布尺寸
                    this.canvasEditor.resizeCanvas(width, height);
                }
            });
        }
    }
});

console.log("[ImageCompositor] Extension loaded");