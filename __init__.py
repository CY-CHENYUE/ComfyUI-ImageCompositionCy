"""
ComfyUI-ImageCompositionCy
图像合成节点集合
"""

from .nodes.image_compositor import ImageCompositor

# ComfyUI 节点映射
NODE_CLASS_MAPPINGS = {
    "ImageCompositor": ImageCompositor,
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "ImageCompositor": "Image Compositor 🎨",
}

# Web 扩展目录
WEB_DIRECTORY = "./web"

# 导出给 ComfyUI
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']