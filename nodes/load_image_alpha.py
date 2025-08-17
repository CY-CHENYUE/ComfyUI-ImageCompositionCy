"""
支持透明度的图像加载节点
专门用于加载和保持PNG图像的透明通道
"""
import os
import torch
import numpy as np
import hashlib
from PIL import Image, ImageOps, ImageSequence
import folder_paths
import node_helpers


class LoadImageAlpha:
    """
    加载图像并保持透明通道的节点
    输出RGBA格式图像供ImageCompositor使用
    """
    
    @classmethod
    def INPUT_TYPES(s):
        input_dir = folder_paths.get_input_directory()
        files = [f for f in os.listdir(input_dir) if os.path.isfile(os.path.join(input_dir, f))]
        files = folder_paths.filter_files_content_types(files, ["image"])
        return {
            "required": {
                "image": (sorted(files), {"image_upload": True})
            },
        }

    CATEGORY = "ImageCompositionCy"
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE",)
    FUNCTION = "load_image"

    def load_image(self, image):
        """
        加载图像并保持透明通道
        """
        image_path = folder_paths.get_annotated_filepath(image)
        
        # 打开图像
        img = node_helpers.pillow(Image.open, image_path)
        
        output_images = []
        w, h = None, None
        
        for i in ImageSequence.Iterator(img):
            # 处理EXIF方向
            i = node_helpers.pillow(ImageOps.exif_transpose, i)
            
            # 处理不同的图像模式
            if i.mode == 'I':
                i = i.point(lambda x: x * (1 / 255))
            
            # 检查是否有透明通道
            has_alpha = 'A' in i.getbands() or (i.mode == 'P' and 'transparency' in i.info)
            
            if has_alpha:
                # 保持RGBA格式
                if i.mode != 'RGBA':
                    image = i.convert("RGBA")
                else:
                    image = i
            else:
                # 没有透明通道，转换为RGBA（添加不透明的alpha）
                image = i.convert("RGBA")
            
            # 尺寸检查
            if len(output_images) == 0:
                w = image.size[0]
                h = image.size[1]
            
            if image.size[0] != w or image.size[1] != h:
                continue
            
            # 转换为numpy数组（4通道）
            np_image = np.array(image).astype(np.float32) / 255.0
            # 转换为tensor [H, W, C]
            tensor_image = torch.from_numpy(np_image)
            # 添加batch维度 [1, H, W, C]
            tensor_image = tensor_image.unsqueeze(0)
            
            output_images.append(tensor_image)
        
        if len(output_images) > 1:
            output_image = torch.cat(output_images, dim=0)
        else:
            output_image = output_images[0]
        
        return (output_image,)

    @classmethod
    def IS_CHANGED(s, image):
        image_path = folder_paths.get_annotated_filepath(image)
        m = hashlib.sha256()
        with open(image_path, 'rb') as f:
            m.update(f.read())
        return m.digest().hex()

    @classmethod
    def VALIDATE_INPUTS(s, image):
        if not folder_paths.exists_annotated_filepath(image):
            return "Invalid image file: {}".format(image)
        return True