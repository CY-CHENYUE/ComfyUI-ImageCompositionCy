"""
图像处理工具函数模块
提供图像格式转换、变换、合成等功能
"""
import torch
import numpy as np
from PIL import Image
import folder_paths
import os
from datetime import datetime


def tensor_to_pil(tensor):
    """将ComfyUI的Tensor格式转换为PIL Image
    
    Args:
        tensor: ComfyUI格式的图像tensor [B, H, W, C]
    
    Returns:
        PIL.Image对象
    """
    if len(tensor.shape) == 4:
        tensor = tensor[0]
    
    tensor = tensor.cpu().numpy()
    tensor = (tensor * 255).astype(np.uint8)
    
    if tensor.shape[-1] == 4:
        return Image.fromarray(tensor, mode='RGBA')
    elif tensor.shape[-1] == 3:
        return Image.fromarray(tensor, mode='RGB')
    else:
        return Image.fromarray(tensor.squeeze(), mode='L')


def pil_to_tensor(image):
    """将PIL Image转换为ComfyUI的Tensor格式
    
    Args:
        image: PIL.Image对象
    
    Returns:
        torch.Tensor [1, H, W, C]
    """
    # 保留RGBA格式，确保透明度信息不丢失
    if image.mode == "RGBA":
        # 保持RGBA格式
        pass
    elif image.mode == "RGB":
        # RGB格式保持不变
        pass
    elif image.mode == "L":
        # 灰度图转换为RGB
        image = image.convert("RGB")
    elif image.mode == "P":
        # 调色板模式，检查是否有透明度
        if 'transparency' in image.info:
            # 有透明度信息，转换为RGBA
            image = image.convert("RGBA")
        else:
            # 无透明度，转换为RGB
            image = image.convert("RGB")
    else:
        # 其他格式尝试转换为RGBA以保留可能的透明度
        try:
            image = image.convert("RGBA")
        except:
            image = image.convert("RGB")
    
    np_image = np.array(image).astype(np.float32) / 255.0
    tensor = torch.from_numpy(np_image).unsqueeze(0)
    
    return tensor


def create_canvas(width, height, background="#FFFFFF"):
    """创建画布
    
    Args:
        width: 画布宽度
        height: 画布高度
        background: 背景颜色或"transparent"
    
    Returns:
        PIL.Image对象 (RGBA模式)
    """
    if background.lower() == "transparent":
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    else:
        try:
            canvas = Image.new("RGBA", (width, height), background)
        except:
            # 如果颜色解析失败，使用白色
            canvas = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    
    return canvas


def apply_transform(image, config):
    """应用变换到图片
    
    Args:
        image: PIL.Image对象
        config: 变换配置字典，包含:
            - size: {width, height}
            - rotation: 旋转角度
            - opacity: 透明度 (0-1)
    
    Returns:
        tuple: (变换后的图片, 位置(x, y))
    """
    img = image.copy()
    
    # 获取变换参数
    position = config.get("position", {"x": 0, "y": 0})
    size = config.get("size", None)
    rotation = config.get("rotation", 0)
    opacity = config.get("opacity", 1.0)
    
    # 调整尺寸
    if size and (size.get("width") != img.width or size.get("height") != img.height):
        new_width = int(size.get("width", img.width))
        new_height = int(size.get("height", img.height))
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # 旋转
    if rotation != 0:
        img = img.rotate(-rotation, expand=True, fillcolor=(0, 0, 0, 0))
    
    # 调整透明度
    if opacity < 1.0:
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        alpha = img.split()[-1]
        alpha = Image.eval(alpha, lambda a: int(a * opacity))
        img.putalpha(alpha)
    
    return img, (int(position["x"]), int(position["y"]))


def composite_images(canvas, overlay_images, images_config):
    """将多张图片合成到画布上
    
    Args:
        canvas: PIL.Image画布
        overlay_images: 叠加图片列表
        images_config: 图片配置列表
    
    Returns:
        合成后的PIL.Image
    """
    if not overlay_images or not images_config:
        return canvas
    
    # 按层级排序
    sorted_configs = sorted(enumerate(images_config), 
                           key=lambda x: x[1].get("layer", x[0]))
    
    for idx, img_config in sorted_configs:
        # 映射配置索引到输入图片
        source = img_config.get("source", "")
        img_index = source.replace("input_", "")
        try:
            img_index = int(img_index) - 1
        except:
            img_index = idx
        
        if 0 <= img_index < len(overlay_images):
            img = overlay_images[img_index]
            
            # 跳过None图片（空输入）
            if img is None:
                continue
            
            # 应用变换
            transformed_img, pos = apply_transform(img, img_config)
            
            # 混合模式
            blend_mode = img_config.get("blendMode", "normal")
            
            if blend_mode == "normal":
                # 使用alpha_composite来正确处理透明度
                temp = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
                # 确保图像是RGBA格式以便正确合成
                if transformed_img.mode == 'RGBA':
                    temp.paste(transformed_img, pos)
                else:
                    # 如果不是RGBA，需要转换
                    transformed_img_rgba = transformed_img.convert('RGBA')
                    temp.paste(transformed_img_rgba, pos)
                canvas = Image.alpha_composite(canvas, temp)
            else:
                # 简单的混合模式支持
                temp = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
                temp.paste(transformed_img, pos)
                
                if blend_mode == "multiply":
                    canvas = Image.blend(canvas, temp, 0.5)
                elif blend_mode == "screen":
                    canvas = Image.blend(canvas, temp, 0.7)
                else:
                    canvas = Image.alpha_composite(canvas, temp)
    
    return canvas


def save_temp_image(pil_image, prefix="temp"):
    """保存临时图片供前端预览
    
    Args:
        pil_image: PIL.Image对象
        prefix: 文件名前缀
    
    Returns:
        文件名
    """
    # 获取临时文件夹路径
    temp_dir = folder_paths.get_temp_directory()
    
    # 生成唯一文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{prefix}_{timestamp}.png"
    filepath = os.path.join(temp_dir, filename)
    
    # 保存图片
    pil_image.save(filepath, "PNG")
    
    return filename


def composite_images_v2(canvas, all_images, images_config):
    """将多张图片合成到画布上（背景图也作为图层处理）
    
    Args:
        canvas: PIL.Image画布
        all_images: 所有图片列表（第一个是背景图，如果有的话）
        images_config: 图片配置列表
    
    Returns:
        合成后的PIL.Image
    """
    if not all_images:
        return canvas
    
    # 如果没有配置，使用默认配置
    if not images_config:
        images_config = []
    
    # 为每个图片创建默认配置（如果不存在）
    while len(images_config) < len(all_images):
        idx = len(images_config)
        # 计算默认位置（居中或者稍微偏移）
        offset_x = (idx % 3) * 50
        offset_y = (idx // 3) * 50
        
        # 计算适合画布的默认尺寸
        img = all_images[idx]
        scale = min(canvas.width / img.width, canvas.height / img.height, 1.0)
        default_width = int(img.width * scale)
        default_height = int(img.height * scale)
        
        # 居中位置
        default_x = (canvas.width - default_width) // 2 + offset_x
        default_y = (canvas.height - default_height) // 2 + offset_y
        
        images_config.append({
            "source": "background" if idx == 0 else f"input_{idx}",
            "position": {"x": default_x, "y": default_y},
            "size": {"width": default_width, "height": default_height},
            "rotation": 0,
            "opacity": 1.0,
            "layer": idx
        })
    
    # 按层级排序（保持稳定排序）
    sorted_indices = sorted(range(len(images_config)), 
                           key=lambda i: (images_config[i].get("layer", i), i))
    
    for idx in sorted_indices:
        if idx < len(all_images):
            img = all_images[idx]
            img_config = images_config[idx]
            
            # 应用变换
            transformed_img, pos = apply_transform(img, img_config)
            
            # 混合模式
            blend_mode = img_config.get("blendMode", "normal")
            
            if blend_mode == "normal":
                # 使用alpha_composite来正确处理透明度
                temp = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
                # 确保图像是RGBA格式以便正确合成
                if transformed_img.mode == 'RGBA':
                    temp.paste(transformed_img, pos)
                else:
                    # 如果不是RGBA，需要转换
                    transformed_img_rgba = transformed_img.convert('RGBA')
                    temp.paste(transformed_img_rgba, pos)
                canvas = Image.alpha_composite(canvas, temp)
            else:
                # 简单的混合模式支持
                temp = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
                temp.paste(transformed_img, pos)
                
                if blend_mode == "multiply":
                    canvas = Image.blend(canvas, temp, 0.5)
                elif blend_mode == "screen":
                    canvas = Image.blend(canvas, temp, 0.7)
                else:
                    canvas = Image.alpha_composite(canvas, temp)
    
    return canvas


def extract_mask(image):
    """从RGBA图片提取透明通道作为蒙版
    
    Args:
        image: PIL.Image对象
    
    Returns:
        torch.Tensor蒙版 [1, H, W] - ComfyUI标准mask格式
    """
    if image.mode == 'RGBA':
        alpha = image.split()[-1]
        mask_np = np.array(alpha).astype(np.float32) / 255.0
        mask = torch.from_numpy(mask_np).unsqueeze(0)
        return mask
    else:
        # 创建全白的mask
        mask_np = np.ones((image.height, image.width), dtype=np.float32)
        mask = torch.from_numpy(mask_np).unsqueeze(0)
        return mask