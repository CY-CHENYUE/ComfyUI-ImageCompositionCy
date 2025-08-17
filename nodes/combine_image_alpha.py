"""
简单的图像透明度组合节点
专门用于处理LoadImage的输出并保持兼容性
"""
import torch
import numpy as np
from PIL import Image
import folder_paths
import os
import json
from datetime import datetime
import random


class CombineImageAlpha:
    """
    组合RGB图像和Alpha通道，输出带透明度的图像
    保持与ComfyUI标准节点的完全兼容
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),  # RGB图像
                "mask": ("MASK",),    # Alpha mask (来自LoadImage)
            }
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "combine"
    CATEGORY = "ImageCompositionCy"
    OUTPUT_NODE = True  # 重要：这样ComfyUI会为节点生成预览
    
    def combine(self, image, mask):
        """
        将RGB图像和mask组合
        内部创建RGBA但输出时保持兼容性
        """
        batch_size = image.shape[0]
        height = image.shape[1]
        width = image.shape[2]
        
        # 确保mask的形状正确
        if len(mask.shape) == 2:
            mask = mask.unsqueeze(0)
        
        # 调整mask尺寸匹配图像
        if mask.shape[0] != batch_size:
            if mask.shape[0] == 1:
                mask = mask.repeat(batch_size, 1, 1)
            else:
                mask = mask[:batch_size]
        
        if mask.shape[1] != height or mask.shape[2] != width:
            # 使用nearest neighbor插值调整大小
            mask = torch.nn.functional.interpolate(
                mask.unsqueeze(1),  # [B, H, W] -> [B, 1, H, W]
                size=(height, width),
                mode='nearest'
            ).squeeze(1)  # [B, 1, H, W] -> [B, H, W]
        
        # ComfyUI的mask是反转的（1=遮罩，0=显示）
        # 所以我们需要反转它来得到正确的alpha（1=不透明，0=透明）
        alpha = 1.0 - mask
        
        # 添加通道维度
        alpha = alpha.unsqueeze(-1)  # [B, H, W] -> [B, H, W, 1]
        
        # 创建RGBA图像
        rgba = torch.cat([image, alpha], dim=-1)  # [B, H, W, 3] + [B, H, W, 1] -> [B, H, W, 4]
        
        # 生成预览图像供前端显示
        preview_images = self.generate_preview(rgba)
        
        # 返回RGBA图像和预览信息
        return {
            "result": (rgba,),
            "ui": { "images": preview_images }
        }
    
    def generate_preview(self, rgba_tensor):
        """
        生成预览图像供前端显示
        """
        results = []
        temp_dir = folder_paths.get_temp_directory()
        
        # 生成唯一的前缀
        prefix = "_temp_" + ''.join(random.choice("abcdefghijklmnopqrstupvxyz") for _ in range(5))
        
        # 处理批次中的每个图像
        batch_size = rgba_tensor.shape[0]
        for i in range(batch_size):
            img_tensor = rgba_tensor[i]
            
            # 转换为PIL图像
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)
            
            if img_np.shape[-1] == 4:
                # RGBA图像
                pil_image = Image.fromarray(img_np, mode='RGBA')
            else:
                # RGB图像
                pil_image = Image.fromarray(img_np[:, :, :3], mode='RGB')
            
            # 生成文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            random_str = ''.join(random.choice("0123456789") for _ in range(4))
            filename = f"{prefix}_{timestamp}_{random_str}.png"
            filepath = os.path.join(temp_dir, filename)
            
            # 保存图像
            pil_image.save(filepath, "PNG", compress_level=1)
            
            results.append({
                "filename": filename,
                "subfolder": "",
                "type": "temp"
            })
        
        return results