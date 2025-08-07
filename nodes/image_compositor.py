"""
图片合成节点的具体实现
"""
import json
from . import image_utils
from PIL import Image


class ImageCompositor:
    """
    图片合成节点 - 支持Canvas交互式编辑
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "composition_data": ("STRING", {
                    "default": json.dumps({
                        "images": [],
                        "settings": {}
                    }, indent=2),
                    "multiline": True,
                    "dynamicPrompts": False
                }),
            },
            "optional": {
                "background_image": ("IMAGE",),
                "overlay_image_1": ("IMAGE",),
                "overlay_image_2": ("IMAGE",),
                "overlay_image_3": ("IMAGE",),
                "overlay_image_4": ("IMAGE",),
                "overlay_image_5": ("IMAGE",),
                "overlay_image_6": ("IMAGE",),
                "overlay_image_7": ("IMAGE",),
                "overlay_image_8": ("IMAGE",),
                "overlay_image_9": ("IMAGE",),
                "overlay_image_10": ("IMAGE",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }
    
    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("composite", "mask")
    FUNCTION = "composite_images"
    CATEGORY = "CY-ImageComposition"
    OUTPUT_NODE = True  # 允许节点输出预览
    
    def composite_images(self, composition_data, background_image=None, unique_id=None, **kwargs):
        """
        Composite multiple images based on Canvas data
        """
        # 解析配置数据
        try:
            config = json.loads(composition_data)
        except json.JSONDecodeError:
            config = {
                "images": [],
                "settings": {}
            }
        
        images_config = config.get("images", [])
        
        # 收集输入图片预览数据（用于前端显示）
        preview_images = []
        
        # 记录背景图在画布上的显示位置和大小（用于前端显示）
        display_bounds = None
        # 记录前端显示的缩放比例
        display_scale = 1.0
        
        # 如果有背景图，使用原始分辨率
        if background_image is not None:
            bg_img = image_utils.tensor_to_pil(background_image)
            if bg_img.mode != 'RGBA':
                bg_img = bg_img.convert('RGBA')
            
            # 前端Canvas显示尺寸固定为1024x1024
            canvas_display_size = 1024
            
            # 计算前端显示时的contain模式缩放（仅用于计算坐标转换）
            bg_aspect = bg_img.width / bg_img.height
            
            if bg_aspect > 1.0:
                # 背景图更宽，按宽度缩放
                display_width = canvas_display_size
                display_height = canvas_display_size / bg_aspect
                display_scale = display_width / bg_img.width
            else:
                # 背景图更高或正方形，按高度缩放
                display_height = canvas_display_size
                display_width = canvas_display_size * bg_aspect
                display_scale = display_height / bg_img.height
            
            # 计算前端显示位置
            x_offset = (canvas_display_size - display_width) / 2
            y_offset = (canvas_display_size - display_height) / 2
            
            # 记录显示位置和缩放比例
            display_bounds = {
                "x": x_offset,
                "y": y_offset,
                "width": display_width,
                "height": display_height
            }
            # display_scale已在上面条件分支中正确计算
            
            # 创建原始分辨率的画布（保持背景图原始大小）
            canvas = image_utils.create_canvas(bg_img.width, bg_img.height, "transparent")
            
            # 将背景图以原始分辨率绘制到画布上
            canvas.paste(bg_img, (0, 0), bg_img)
            
            # 保存背景图片预览
            bg_filename = image_utils.save_temp_image(bg_img, "bg")
            preview_images.append({"image": bg_filename, "type": "background"})
        else:
            # 如果没有背景图，使用默认大小1024x1024
            canvas = image_utils.create_canvas(1024, 1024, "transparent")
        
        # 收集叠加图片
        overlay_images = []
        for i in range(1, 11):
            img_key = f"overlay_image_{i}"
            if img_key in kwargs and kwargs[img_key] is not None:
                img = image_utils.tensor_to_pil(kwargs[img_key])
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                overlay_images.append(img)
                
                # 保存输入图片预览
                img_filename = image_utils.save_temp_image(img, f"input_{i}")
                preview_images.append({"image": img_filename, "type": f"input_{i}"})
        
        # 执行图片合成（将叠加图片合成到画布上）
        # 过滤出非背景图的配置
        overlay_configs = [cfg for cfg in images_config if cfg.get("source") != "background"]
        
        # 前端已经转换好坐标，直接使用
        if False and display_bounds and overlay_configs:  # 暂时禁用后端转换，因为前端已经处理
            # 调整图片配置，将前端显示坐标转换为实际图片坐标
            adjusted_configs = []
            for idx, config in enumerate(overlay_configs):
                adjusted_config = config.copy()
                
                # 确保有位置和尺寸信息
                if "position" in config and "size" in config:
                    orig_pos = config["position"]
                    orig_size = config["size"]
                    
                    
                    # 检查坐标是否在背景图显示范围内
                    if (orig_pos["x"] >= display_bounds["x"] and 
                        orig_pos["y"] >= display_bounds["y"] and
                        orig_pos["x"] <= display_bounds["x"] + display_bounds["width"] and
                        orig_pos["y"] <= display_bounds["y"] + display_bounds["height"]):
                        
                        # 坐标在背景图范围内，进行转换
                        # 1. 减去显示偏移得到相对于背景图显示区域的坐标
                        relative_x = orig_pos["x"] - display_bounds["x"]
                        relative_y = orig_pos["y"] - display_bounds["y"]
                        
                        # 2. 除以缩放比例得到在原始背景图上的坐标
                        new_x = relative_x / display_scale
                        new_y = relative_y / display_scale
                        new_w = orig_size["width"] / display_scale
                        new_h = orig_size["height"] / display_scale
                        
                    else:
                        # 坐标在背景图范围外，可能需要裁剪或忽略
                        new_x = orig_pos["x"] / display_scale
                        new_y = orig_pos["y"] / display_scale
                        new_w = orig_size["width"] / display_scale
                        new_h = orig_size["height"] / display_scale
                    
                    adjusted_config["position"] = {"x": new_x, "y": new_y}
                    adjusted_config["size"] = {"width": new_w, "height": new_h}
                else:
                    pass  # 保持原始配置
                    
                adjusted_configs.append(adjusted_config)
            canvas = image_utils.composite_images(canvas, overlay_images, adjusted_configs)
        else:
            # 前端已经处理了坐标转换，直接使用
            canvas = image_utils.composite_images(canvas, overlay_images, overlay_configs)
        
        # 转换结果
        result = image_utils.pil_to_tensor(canvas)
        mask = image_utils.extract_mask(canvas)
        
        # 准备UI更新数据
        ui_data = {
            "images": preview_images
        }
        
        return {
            "ui": ui_data,
            "result": (result, mask)
        }