"""
图像处理工具函数
"""
import torch
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import json
from typing import Optional, Tuple, List, Dict, Any


def tensor_to_pil(tensor: torch.Tensor) -> Image.Image:
    """
    将ComfyUI的Tensor格式转换为PIL Image
    
    Args:
        tensor: 形状为 [batch, height, width, channels] 的张量
    
    Returns:
        PIL Image对象
    """
    if len(tensor.shape) == 4:
        tensor = tensor[0]
    
    if tensor.shape[-1] == 4:
        mode = "RGBA"
    else:
        mode = "RGB"
    
    tensor = tensor.cpu().numpy()
    tensor = (tensor * 255).astype(np.uint8)
    
    return Image.fromarray(tensor, mode)


def pil_to_tensor(image: Image.Image) -> torch.Tensor:
    """
    将PIL Image转换为ComfyUI的Tensor格式
    
    Args:
        image: PIL Image对象
    
    Returns:
        形状为 [1, height, width, channels] 的张量
    """
    if image.mode == "RGBA":
        channels = 4
    elif image.mode == "RGB":
        channels = 3
    else:
        image = image.convert("RGB")
        channels = 3
    
    np_image = np.array(image).astype(np.float32) / 255.0
    
    tensor = torch.from_numpy(np_image)
    tensor = tensor.unsqueeze(0)
    
    return tensor


def parse_composition_data(data_string: str) -> Dict[str, Any]:
    """
    解析JSON格式的合成配置数据
    
    Args:
        data_string: JSON字符串
    
    Returns:
        解析后的配置字典
    """
    try:
        data = json.loads(data_string)
    except json.JSONDecodeError:
        data = {
            "canvas": {
                "width": 1024,
                "height": 768,
                "background": "#FFFFFF"
            },
            "images": [],
            "settings": {
                "showGrid": True,
                "gridSize": 20,
                "snapToGrid": False
            }
        }
    
    return data


def create_canvas(width: int, height: int, background: str = "#FFFFFF") -> Image.Image:
    """
    创建画布
    
    Args:
        width: 画布宽度
        height: 画布高度
        background: 背景颜色或"transparent"
    
    Returns:
        PIL Image画布
    """
    if background.lower() == "transparent":
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (width, height), background)
    
    return canvas


def apply_transform(image: Image.Image, 
                   position: Tuple[int, int],
                   size: Optional[Tuple[int, int]] = None,
                   rotation: float = 0,
                   opacity: float = 1.0) -> Tuple[Image.Image, Tuple[int, int]]:
    """
    应用变换到图片
    
    Args:
        image: 原始图片
        position: (x, y) 位置
        size: (width, height) 尺寸，None表示保持原尺寸
        rotation: 旋转角度（度）
        opacity: 透明度 (0-1)
    
    Returns:
        变换后的图片和最终位置
    """
    img = image.copy()
    
    if size and (size[0] != img.width or size[1] != img.height):
        img = img.resize(size, Image.Resampling.LANCZOS)
    
    if rotation != 0:
        img = img.rotate(-rotation, expand=True, fillcolor=(0, 0, 0, 0))
    
    if opacity < 1.0:
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        
        alpha = img.split()[-1]
        alpha = Image.eval(alpha, lambda x: int(x * opacity))
        img.putalpha(alpha)
    
    return img, position


def composite_images(canvas: Image.Image,
                    images: List[Image.Image],
                    image_configs: List[Dict[str, Any]]) -> Image.Image:
    """
    将多张图片合成到画布上
    
    Args:
        canvas: 基础画布
        images: 图片列表
        image_configs: 每张图片的配置信息列表
    
    Returns:
        合成后的画布
    """
    result = canvas.copy()
    
    sorted_configs = sorted(enumerate(image_configs), 
                           key=lambda x: x[1].get("layer", 0))
    
    for idx, config in sorted_configs:
        if idx >= len(images):
            continue
        
        img = images[idx]
        
        position = (config.get("position", {}).get("x", 0),
                   config.get("position", {}).get("y", 0))
        
        size = None
        if "size" in config:
            size = (config["size"].get("width", img.width),
                   config["size"].get("height", img.height))
        
        rotation = config.get("rotation", 0)
        opacity = config.get("opacity", 1.0)
        blend_mode = config.get("blendMode", "normal")
        
        transformed_img, pos = apply_transform(
            img, position, size, rotation, opacity
        )
        
        if blend_mode == "normal" or blend_mode is None:
            if transformed_img.mode == "RGBA":
                result.paste(transformed_img, pos, transformed_img)
            else:
                result.paste(transformed_img, pos)
        else:
            result = apply_blend_mode(result, transformed_img, pos, blend_mode)
    
    return result


def apply_blend_mode(base: Image.Image, 
                    overlay: Image.Image,
                    position: Tuple[int, int],
                    mode: str) -> Image.Image:
    """
    应用混合模式
    
    Args:
        base: 基础图层
        overlay: 叠加图层
        position: 叠加位置
        mode: 混合模式名称
    
    Returns:
        混合后的图片
    """
    result = base.copy()
    
    temp = Image.new("RGBA", base.size, (0, 0, 0, 0))
    temp.paste(overlay, position, overlay if overlay.mode == "RGBA" else None)
    
    if mode == "multiply":
        result = Image.blend(result, temp, 0.5)
    elif mode == "screen":
        result = Image.blend(result, temp, 0.5)
    elif mode == "overlay":
        result = Image.blend(result, temp, 0.5)
    else:
        if overlay.mode == "RGBA":
            result.paste(overlay, position, overlay)
        else:
            result.paste(overlay, position)
    
    return result


def extract_mask(image: Image.Image) -> Optional[torch.Tensor]:
    """
    提取图片的透明通道作为蒙版
    
    Args:
        image: PIL Image对象
    
    Returns:
        蒙版张量，如果没有透明通道则返回None
    """
    if image.mode != "RGBA":
        return None
    
    alpha = image.split()[-1]
    
    np_alpha = np.array(alpha).astype(np.float32) / 255.0
    
    mask = torch.from_numpy(np_alpha)
    mask = mask.unsqueeze(0).unsqueeze(-1)
    
    return mask