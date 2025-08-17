"""
ComfyUI-ImageCompositionCy
图像合成节点集合
"""

from .nodes.image_compositor import ImageCompositor
from .nodes.combine_image_alpha import CombineImageAlpha
from .nodes.load_image_alpha import LoadImageAlpha

# ComfyUI 节点映射
NODE_CLASS_MAPPINGS = {
    "ImageCompositor": ImageCompositor,
    "CombineImageAlpha": CombineImageAlpha,
    "LoadImageAlpha": LoadImageAlpha,
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "ImageCompositor": "Image Compositor 🎨",
    "CombineImageAlpha": "Combine Image Alpha 🔀",
    "LoadImageAlpha": "Load Image (Alpha) 🖼️",
}

# Web 扩展目录
WEB_DIRECTORY = "./web"

# 导出给 ComfyUI
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']